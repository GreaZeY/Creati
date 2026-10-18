package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"strings"
	"time"

	"creati.in/creati/backend/internal/db/repositories"
	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/types"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type LiveHandler struct {
	repo     *repositories.LiveRepository
	producer *services.LiveProducer
	events   *services.LiveEventService
	youtube  *services.YouTubeService
	storage  *services.StorageService
	cache    *services.CacheService
	images   *services.LiveImageGenerator
	history  services.LiveHistoryProvider
}

func NewLiveHandler(db *sql.DB, storage *services.StorageService, cache *services.CacheService) *LiveHandler {
	repo := repositories.NewLiveRepository(db)
	yt := services.NewYouTubeService(db)
	var images services.LiveImageStore
	if storage != nil {
		images = storage
	}
	return &LiveHandler{repo: repo, youtube: yt, storage: storage, cache: cache, history: yt, images: services.NewLiveImageGenerator(services.LiveImageEnvironment(), nil), producer: services.NewLiveProducer(services.LiveProducerEnvironment(), nil), events: &services.LiveEventService{Store: repo, Gateway: yt.LiveGateway, Images: images}}
}
func (h *LiveHandler) Register(r fiber.Router) {
	r.Use(func(c *fiber.Ctx) error {
		if err := h.repo.Authorize(c.UserContext(), middleware.GetContext(c), c.Method() != fiber.MethodGet); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return utils.ErrorResponse(c, 403, "you do not have access to this workspace or action")
			}
			return utils.ErrorResponse(c, 503, "workspace validation unavailable")
		}
		if len(c.Body()) > 3<<20 {
			return utils.ErrorResponse(c, 413, "request is too large")
		}
		return c.Next()
	})
	r.Get("/capabilities", h.Capabilities)
	r.Get("/preferences", h.Preferences)
	r.Put("/preferences", h.SavePreferences)
	r.Post("/connect", h.Connect)
	r.Post("/connect/callback", h.Callback)
	r.Get("/drafts", h.List)
	r.Post("/drafts", h.Create)
	r.Get("/drafts/:id", h.Get)
	r.Patch("/drafts/:id", h.Save)
	r.Post("/drafts/:id/generate", h.Generate)
	r.Post("/drafts/:id/create-event", h.CreateEvent)
	r.Get("/drafts/:id/event", h.Get)
	r.Put("/drafts/:id/thumbnail", h.Thumbnail)
	r.Get("/drafts/:id/thumbnail", h.GetThumbnail)
	r.Post("/drafts/:id/generate-thumbnail", h.GenerateThumbnail)
	r.Post("/drafts/:id/reconcile", h.Reconcile)
	r.Post("/drafts/:id/reuse", h.Reuse)
	r.Get("/channels/:account/history", h.History)
	r.Post("/channels/:account/history/:broadcast/reuse", h.ReuseYouTube)
}
func liveError(c *fiber.Ctx, err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return utils.ErrorResponse(c, 404, "draft or channel not found in this workspace")
	}
	if errors.Is(err, repositories.ErrLiveConflict) || errors.Is(err, repositories.ErrLiveReconcile) {
		return utils.ErrorResponse(c, 409, err.Error())
	}
	return utils.ErrorResponse(c, 503, "YouTube Live operation unavailable. Reload the draft; check the feature migration and server configuration.")
}
func liveID(c *fiber.Ctx) (string, error) {
	id, err := uuid.Parse(c.Params("id"))
	return id.String(), err
}
func (h *LiveHandler) Capabilities(c *fiber.Ctx) error {
	return utils.SuccessResponse(c, fiber.Map{"generation": h.producer.Ready(), "research": h.producer.SearchEnabled(), "imageGeneration": h.images.Ready() && h.storage != nil, "prompt": services.LivePrompt("[Your stream idea]", "[Optional context]"), "usage": "Research, writing, and thumbnail generation use your configured AI routes. No Creati credits are deducted.", "thumbnailUpload": h.storage != nil}, "")
}
func (h *LiveHandler) List(c *fiber.Ctx) error {
	d, err := h.repo.List(c.UserContext(), middleware.GetContext(c))
	if err != nil {
		return liveError(c, err)
	}
	return utils.SuccessResponse(c, d, "")
}
func (h *LiveHandler) Create(c *fiber.Ctx) error {
	var req struct {
		Idea    string `json:"idea"`
		Context string `json:"context"`
	}
	if c.BodyParser(&req) != nil {
		return utils.ErrorResponse(c, 400, "invalid draft")
	}
	if err := types.ValidateLiveText(req.Idea, req.Context); err != nil {
		return utils.ErrorResponse(c, 400, err.Error())
	}
	d, err := h.repo.Create(c.UserContext(), middleware.GetContext(c), req.Idea, req.Context)
	if err != nil {
		return liveError(c, err)
	}
	return utils.CreatedResponse(c, d)
}
func (h *LiveHandler) Get(c *fiber.Ctx) error {
	id, err := liveID(c)
	if err != nil {
		return utils.ErrorResponse(c, 400, "invalid draft ID")
	}
	d, err := h.repo.Get(c.UserContext(), middleware.GetContext(c), id)
	if err != nil {
		return liveError(c, err)
	}
	return utils.SuccessResponse(c, d, "")
}
func (h *LiveHandler) Save(c *fiber.Ctx) error {
	id, err := liveID(c)
	if err != nil {
		return utils.ErrorResponse(c, 400, "invalid draft ID")
	}
	var req types.LiveDraft
	if len(c.Body()) > 128<<10 || c.BodyParser(&req) != nil {
		return utils.ErrorResponse(c, 400, "invalid or oversized draft")
	}
	if err = types.ValidateLiveText(req.Idea, req.Context); err != nil {
		return utils.ErrorResponse(c, 400, err.Error())
	}
	req.ID = id
	d, err := h.repo.Save(c.UserContext(), middleware.GetContext(c), &req)
	if err != nil {
		return liveError(c, err)
	}
	return utils.SuccessResponse(c, d, "")
}
func (h *LiveHandler) Generate(c *fiber.Ctx) error {
	id, err := liveID(c)
	if err != nil {
		return utils.ErrorResponse(c, 400, "invalid draft ID")
	}
	if !h.producer.Ready() {
		return utils.ErrorResponse(c, 503, "AI is not configured. Copy the producer prompt for manual use, or configure the server model route.")
	}
	var req struct {
		Research bool   `json:"research"`
		TimeZone string `json:"timeZone"`
	}
	if c.BodyParser(&req) != nil {
		return utils.ErrorResponse(c, 400, "invalid generation request")
	}
	if !req.Research {
		return utils.ErrorResponse(c, 400, "research is required for automatic package preparation")
	}
	zone := time.UTC
	if req.TimeZone != "" {
		zone, err = time.LoadLocation(req.TimeZone)
		if err != nil {
			return utils.ErrorResponse(c, 400, "invalid creator time zone")
		}
	}
	scope := middleware.GetContext(c)
	d, err := h.repo.BeginGeneration(c.UserContext(), scope, id)
	if err != nil {
		return liveError(c, err)
	}
	creatorContext := d.Context + "\nCreator time zone: " + zone.String() + "; local date: " + time.Now().In(zone).Format("2006-01-02")
	pack, questions, generateErr := h.producer.Generate(c.UserContext(), d.Idea, creatorContext, req.Research)
	cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err = h.repo.EndGeneration(cleanup, scope, id, pack, questions); err != nil {
		return liveError(c, err)
	}
	if generateErr != nil {
		return utils.ErrorResponse(c, 502, generateErr.Error())
	}
	d, err = h.repo.Get(c.UserContext(), scope, id)
	if err != nil {
		return liveError(c, err)
	}
	return utils.SuccessResponse(c, d, "")
}
func (h *LiveHandler) CreateEvent(c *fiber.Ctx) error {
	id, err := liveID(c)
	if err != nil {
		return utils.ErrorResponse(c, 400, "invalid draft ID")
	}
	var e types.LiveEventSettings
	if len(c.Body()) > 32<<10 || c.BodyParser(&e) != nil {
		return utils.ErrorResponse(c, 400, "invalid event settings")
	}
	draft, err := h.repo.Get(c.UserContext(), middleware.GetContext(c), id)
	if err != nil {
		return liveError(c, err)
	}
	if draft.Event == nil {
		if err = e.Validate(time.Now()); err != nil {
			return utils.ErrorResponse(c, 400, err.Error())
		}
		if !draft.HasThumbnail {
			return utils.ErrorResponse(c, 400, "prepare or upload the thumbnail before approving this broadcast")
		}
	}
	_, err = h.events.Create(c.UserContext(), middleware.GetContext(c), id, e)
	if err != nil {
		return liveError(c, err)
	}
	return h.Get(c)
}
func (h *LiveHandler) Thumbnail(c *fiber.Ctx) error {
	id, err := liveID(c)
	if err != nil {
		return utils.ErrorResponse(c, 400, "invalid draft ID")
	}
	scope := middleware.GetContext(c)
	d, err := h.repo.Get(c.UserContext(), scope, id)
	if err != nil {
		return liveError(c, err)
	}
	if d.State == "creating" || d.State == "generating" {
		return liveError(c, repositories.ErrLiveConflict)
	}
	if h.storage == nil {
		return utils.ErrorResponse(c, 503, "thumbnail storage is unavailable")
	}
	data := c.Body()
	if len(data) == 0 || len(data) > 2<<20 {
		return utils.ErrorResponse(c, 400, "thumbnail must be at most 2 MB")
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (format != "jpeg" && format != "png") || config.Width != 1280 || config.Height != 720 {
		return utils.ErrorResponse(c, 400, "provide a 1280 × 720 JPEG or PNG thumbnail")
	}
	if _, _, err = image.Decode(bytes.NewReader(data)); err != nil {
		return utils.ErrorResponse(c, 400, "invalid image content")
	}
	key := fmt.Sprintf("youtube-live/%s/%s.%s", id, uuid.NewString(), format)
	mime := "image/" + format
	if err = h.storage.Upload(c.UserContext(), key, bytes.NewReader(data), mime); err != nil {
		return utils.ErrorResponse(c, 502, "thumbnail could not be stored")
	}
	if err = h.repo.Thumbnail(c.UserContext(), scope, id, key); err != nil {
		return liveError(c, err)
	}
	return h.Get(c)
}
func (h *LiveHandler) GenerateThumbnail(c *fiber.Ctx) error {
	id, err := liveID(c)
	if err != nil {
		return utils.ErrorResponse(c, 400, "invalid draft ID")
	}
	if !h.images.Ready() || h.storage == nil {
		return utils.ErrorResponse(c, 503, "image generation or storage is not configured on the server; your text package is preserved")
	}
	scope := middleware.GetContext(c)
	d, err := h.repo.BeginGeneration(c.UserContext(), scope, id)
	if err != nil {
		return liveError(c, err)
	}
	data, generateErr := h.images.Generate(c.UserContext(), d)
	cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err = h.repo.EndGeneration(cleanup, scope, id, nil, nil); err != nil {
		return liveError(c, err)
	}
	if generateErr != nil {
		return utils.ErrorResponse(c, 502, generateErr.Error())
	}
	key := fmt.Sprintf("youtube-live/%s/%s.jpeg", id, uuid.NewString())
	if err = h.storage.Upload(c.UserContext(), key, bytes.NewReader(data), "image/jpeg"); err != nil {
		return utils.ErrorResponse(c, 502, "generated thumbnail could not be stored; package preserved")
	}
	if err = h.repo.Thumbnail(c.UserContext(), scope, id, key); err != nil {
		return liveError(c, err)
	}
	return h.Get(c)
}
func (h *LiveHandler) GetThumbnail(c *fiber.Ctx) error {
	id, err := liveID(c)
	if err != nil {
		return utils.ErrorResponse(c, 400, "invalid draft ID")
	}
	d, err := h.repo.Get(c.UserContext(), middleware.GetContext(c), id)
	if err != nil {
		return liveError(c, err)
	}
	if h.storage == nil || d.ThumbnailKey == "" {
		return utils.ErrorResponse(c, 404, "thumbnail not available")
	}
	image, err := h.storage.GetStream(c.UserContext(), d.ThumbnailKey)
	if err != nil {
		return utils.ErrorResponse(c, 502, "thumbnail storage unavailable")
	}
	defer image.Close()
	data, err := io.ReadAll(io.LimitReader(image, 3<<20))
	if err != nil {
		return utils.ErrorResponse(c, 502, "thumbnail could not be read")
	}
	c.Set("Content-Type", httpDetectImage(data))
	c.Set("Cache-Control", "private, no-store")
	return c.Send(data)
}
func httpDetectImage(data []byte) string {
	if bytes.HasPrefix(data, []byte{0x89, 'P', 'N', 'G'}) {
		return "image/png"
	}
	return "image/jpeg"
}
func (h *LiveHandler) Reconcile(c *fiber.Ctx) error {
	id, err := liveID(c)
	if err != nil {
		return utils.ErrorResponse(c, 400, "invalid draft ID")
	}
	var req struct {
		BroadcastID string `json:"broadcastId"`
		StreamID    string `json:"streamId"`
	}
	if c.BodyParser(&req) != nil || req.BroadcastID == "" || len(req.BroadcastID) > 128 || len(req.StreamID) > 128 {
		return utils.ErrorResponse(c, 400, "provide the existing YouTube event ID")
	}
	scope := middleware.GetContext(c)
	d, err := h.repo.Get(c.UserContext(), scope, id)
	if err != nil {
		return liveError(c, err)
	}
	if d.State != "needs_attention" || d.Event == nil {
		return utils.ErrorResponse(c, 409, "only an interrupted event can be reconciled")
	}
	if d.BroadcastID != "" && d.BroadcastID != req.BroadcastID {
		return utils.ErrorResponse(c, 400, "event ID differs from the saved event")
	}
	if err = h.repo.Account(c.UserContext(), scope, d.Event.AccountID); err != nil {
		return liveError(c, err)
	}
	ctx, cancel := context.WithTimeout(c.UserContext(), 30*time.Second)
	defer cancel()
	gateway, err := h.youtube.LiveGateway(ctx, d.Event.AccountID)
	if err != nil {
		return utils.ErrorResponse(c, 502, "channel connection unavailable")
	}
	verifier, ok := gateway.(interface {
		VerifyExisting(context.Context, types.LiveEventSettings, string, string) (string, error)
	})
	if !ok {
		return utils.ErrorResponse(c, 503, "event recovery unavailable")
	}
	streamID, err := verifier.VerifyExisting(ctx, *d.Event, req.BroadcastID, req.StreamID)
	if err != nil {
		return utils.ErrorResponse(c, 400, err.Error())
	}
	if d.Step == "stream_create" && d.StreamID == "" && streamID == "" {
		return utils.ErrorResponse(c, 400, "the interrupted stream must be identified before retrying; use its YouTube stream resource ID")
	}
	if d.StreamID != "" && streamID != d.StreamID {
		return utils.ErrorResponse(c, 400, "stream differs from the saved stream")
	}
	if err = h.repo.Reconcile(ctx, scope, d, req.BroadcastID, streamID); err != nil {
		return liveError(c, err)
	}
	return h.Get(c)
}
func liveHash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}
func liveSession(c *fiber.Ctx) string {
	token := c.Cookies("jwt")
	if token == "" {
		token = strings.TrimPrefix(c.Get("Authorization"), "Bearer ")
	}
	return liveHash(token)
}
func (h *LiveHandler) Connect(c *fiber.Ctx) error {
	state := "live_" + uuid.NewString() + uuid.NewString()
	if err := h.repo.PutOAuth(c.UserContext(), middleware.GetContext(c), liveHash(state), liveSession(c)); err != nil {
		return liveError(c, err)
	}
	return utils.SuccessResponse(c, fiber.Map{"authUrl": h.youtube.LiveAuthURL(state)}, "")
}
func (h *LiveHandler) Callback(c *fiber.Ctx) error {
	var req struct {
		Code  string `json:"code"`
		State string `json:"state"`
	}
	if c.BodyParser(&req) != nil || !strings.HasPrefix(req.State, "live_") || req.Code == "" {
		return utils.ErrorResponse(c, 400, "invalid Live connection callback")
	}
	userID := middleware.GetUserID(c)
	clientID, err := h.repo.ConsumeOAuth(c.UserContext(), userID, liveHash(req.State), liveSession(c))
	if err != nil {
		return utils.ErrorResponse(c, 403, "connection expired, already used, or opened in another session")
	}
	scope := types.UserContext{UserID: userID, ClientID: clientID}
	if err = h.repo.Authorize(c.UserContext(), scope, true); err != nil {
		return utils.ErrorResponse(c, 403, "workspace publishing access is no longer available")
	}
	ctx, cancel := context.WithTimeout(c.UserContext(), 45*time.Second)
	defer cancel()
	if err = h.youtube.AuthenticateContext(ctx, req.Code, userID, clientID); err != nil {
		return utils.ErrorResponse(c, 502, "YouTube Live connection failed. Verify OAuth setup and try connecting again.")
	}
	if h.cache != nil {
		_ = h.cache.Delete(ctx, h.cache.GetAccountsKey(scope, "list"))
		_ = h.cache.Delete(ctx, h.cache.GetAccountsKey(scope, "counts"))
	}
	return utils.SuccessResponse(c, fiber.Map{"connected": true}, "YouTube Live connected")
}

func (h *PlatformHandler) secureYouTubeConnection(c *fiber.Ctx, userID int, clientID *int) error {
	scope := types.UserContext{UserID: userID, ClientID: clientID}
	repo := repositories.NewLiveRepository(h.db)
	if err := repo.Authorize(c.UserContext(), scope, true); err != nil {
		return utils.ErrorResponse(c, 403, "workspace publishing access required")
	}
	state := "live_" + uuid.NewString() + uuid.NewString()
	if err := repo.PutOAuth(c.UserContext(), scope, liveHash(state), liveSession(c)); err != nil {
		return liveError(c, err)
	}
	return utils.SuccessResponse(c, fiber.Map{"authUrl": services.NewYouTubeService(h.db).LiveAuthURL(state)}, "")
}
