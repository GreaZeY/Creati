package services

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"creati.in/creati/backend/internal/types"
	"golang.org/x/oauth2"
	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"
)

type LiveGateway interface {
	CreateBroadcast(context.Context, types.LiveEventSettings) (string, error)
	CreateStream(context.Context, string) (string, error)
	Bind(context.Context, string, string) error
	Metadata(context.Context, string, types.LiveEventSettings) error
	Thumbnail(context.Context, string, io.Reader) error
}
type googleLiveGateway struct{ client *youtube.Service }

func (g *googleLiveGateway) VerifyExisting(ctx context.Context, e types.LiveEventSettings, broadcastID, streamID string) (string, error) {
	channels, err := g.client.Channels.List([]string{"id"}).Mine(true).Context(ctx).Do()
	if err != nil || len(channels.Items) != 1 {
		return "", fmt.Errorf("channel identity could not be verified")
	}
	result, err := g.client.LiveBroadcasts.List([]string{"snippet", "contentDetails", "status"}).Id(broadcastID).Context(ctx).Do()
	if err != nil || len(result.Items) != 1 {
		return "", fmt.Errorf("existing broadcast could not be verified")
	}
	b := result.Items[0]
	if b.Snippet == nil || b.ContentDetails == nil || b.Status == nil || b.Snippet.ChannelId != channels.Items[0].Id || b.Snippet.Title != e.Title || b.Status.LifeCycleStatus == "live" || b.Status.LifeCycleStatus == "complete" {
		return "", fmt.Errorf("existing event does not match this channel and approved draft, or is already live")
	}
	a, errA := time.Parse(time.RFC3339, b.Snippet.ScheduledStartTime)
	c, errC := time.Parse(time.RFC3339, e.ScheduledStart)
	if errA != nil || errC != nil || !a.Equal(c) {
		return "", fmt.Errorf("existing event schedule does not match the approved draft")
	}
	if b.ContentDetails.EnableAutoStart {
		return "", fmt.Errorf("disable automatic start in Studio before recovering this event")
	}
	if bound := b.ContentDetails.BoundStreamId; bound != "" {
		if streamID != "" && streamID != bound {
			return "", fmt.Errorf("stream differs from the event binding")
		}
		streamID = bound
	}
	if streamID != "" {
		streams, err := g.client.LiveStreams.List([]string{"snippet"}).Id(streamID).Context(ctx).Do()
		if err != nil || len(streams.Items) != 1 || streams.Items[0].Snippet == nil || streams.Items[0].Snippet.ChannelId != channels.Items[0].Id {
			return "", fmt.Errorf("existing stream does not belong to the connected channel")
		}
	}
	return streamID, nil
}

func (y *YouTubeService) LiveGateway(ctx context.Context, accountID int) (LiveGateway, error) {
	httpClient, err := y.getClient(ctx, accountID)
	if err != nil {
		return nil, err
	}
	client, err := youtube.NewService(ctx, option.WithHTTPClient(httpClient))
	if err != nil {
		return nil, err
	}
	return &googleLiveGateway{client: client}, nil
}
func (y *YouTubeService) LiveAuthURL(state string) string {
	config := *y.oauthConfig
	config.Scopes = append(append([]string{}, config.Scopes...), youtube.YoutubeForceSslScope)
	config.RedirectURL = strings.TrimRight(os.Getenv("FRONTEND_URL"), "/") + "/platforms/youtube/callback"
	return config.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.SetAuthURLParam("prompt", "consent"), oauth2.SetAuthURLParam("include_granted_scopes", "true"))
}
func (g *googleLiveGateway) CreateBroadcast(ctx context.Context, e types.LiveEventSettings) (string, error) {
	b := &youtube.LiveBroadcast{
		Snippet:        &youtube.LiveBroadcastSnippet{Title: e.Title, Description: e.Description, ScheduledStartTime: e.ScheduledStart},
		Status:         &youtube.LiveBroadcastStatus{PrivacyStatus: e.Visibility, SelfDeclaredMadeForKids: *e.MadeForKids, ForceSendFields: []string{"SelfDeclaredMadeForKids"}},
		ContentDetails: &youtube.LiveBroadcastContentDetails{EnableAutoStart: false, EnableAutoStop: false, EnableDvr: true, RecordFromStart: true, ForceSendFields: []string{"EnableAutoStart", "EnableAutoStop"}},
	}
	result, err := g.client.LiveBroadcasts.Insert([]string{"snippet", "status", "contentDetails"}, b).Context(ctx).Do()
	if err != nil {
		return "", err
	}
	if result.Id == "" {
		return "", fmt.Errorf("broadcast response had no ID")
	}
	return result.Id, nil
}
func (g *googleLiveGateway) CreateStream(ctx context.Context, title string) (string, error) {
	result, err := g.client.LiveStreams.Insert([]string{"snippet", "cdn", "contentDetails"}, &youtube.LiveStream{Snippet: &youtube.LiveStreamSnippet{Title: title}, Cdn: &youtube.CdnSettings{IngestionType: "rtmp", Resolution: "variable", FrameRate: "variable"}, ContentDetails: &youtube.LiveStreamContentDetails{IsReusable: false, ForceSendFields: []string{"IsReusable"}}}).Context(ctx).Do()
	if err != nil {
		return "", err
	}
	if result.Id == "" {
		return "", fmt.Errorf("stream response had no ID")
	}
	return result.Id, nil
}
func (g *googleLiveGateway) Bind(ctx context.Context, broadcast, stream string) error {
	_, err := g.client.LiveBroadcasts.Bind(broadcast, []string{"id", "contentDetails"}).StreamId(stream).Context(ctx).Do()
	return err
}
func (g *googleLiveGateway) Metadata(ctx context.Context, id string, e types.LiveEventSettings) error {
	current, err := g.client.Videos.List([]string{"snippet"}).Id(id).Context(ctx).Do()
	if err != nil {
		return err
	}
	if len(current.Items) != 1 || current.Items[0].Snippet == nil {
		return fmt.Errorf("event video is not yet available; retry setup")
	}
	snippet := current.Items[0].Snippet
	snippet.Title = e.Title
	snippet.Description = e.Description
	snippet.CategoryId = e.Category
	snippet.DefaultLanguage = e.Language
	snippet.Tags = e.Tags
	snippet.ForceSendFields = append(snippet.ForceSendFields, "Tags", "Description")
	_, err = g.client.Videos.Update([]string{"snippet"}, &youtube.Video{Id: id, Snippet: snippet}).Context(ctx).Do()
	return err
}
func (g *googleLiveGateway) Thumbnail(ctx context.Context, id string, image io.Reader) error {
	_, err := g.client.Thumbnails.Set(id).Media(image).Context(ctx).Do()
	return err
}
