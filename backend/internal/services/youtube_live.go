package services

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"creati.in/creati/backend/internal/db/repositories"
	"creati.in/creati/backend/internal/types"
	"google.golang.org/api/googleapi"
)

type LiveEventStore interface {
	Account(context.Context, types.UserContext, int) error
	ClaimEvent(context.Context, types.UserContext, string, types.LiveEventSettings) (*types.LiveDraft, error)
	Progress(context.Context, *types.LiveDraft) error
}
type LiveImageStore interface {
	GetStream(context.Context, string) (io.ReadCloser, error)
}
type LiveEventService struct {
	Store   LiveEventStore
	Gateway func(context.Context, int) (LiveGateway, error)
	Images  LiveImageStore
}

func (s *LiveEventService) Create(ctx context.Context, scope types.UserContext, id string, event types.LiveEventSettings) (*types.LiveDraft, error) {
	if err := s.Store.Account(ctx, scope, event.AccountID); err != nil {
		return nil, fmt.Errorf("channel unavailable in this workspace; connect YouTube Live first")
	}
	d, err := s.Store.ClaimEvent(ctx, scope, id, event)
	if err != nil {
		return nil, err
	}
	if d.State == "created" {
		return d, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	fail := func(cause error) (*types.LiveDraft, error) {
		d.State = "needs_attention"
		d.Error = "YouTube setup failed at " + d.Step + ". Reconnect YouTube Live if permissions expired, or check Studio and retry the unfinished step."
		var apiErr *googleapi.Error
		if errors.As(cause, &apiErr) && apiErr.Code >= 400 && apiErr.Code < 500 && apiErr.Code != 408 {
			d.Error = fmt.Sprintf("YouTube returned HTTP %d at %s. Check channel Live eligibility, permissions and quota, then retry.", apiErr.Code, d.Step)
			if d.Step == "broadcast_create" || d.Step == "stream_create" {
				d.Step = ""
			}
		} else if (d.Step == "broadcast_create" && d.BroadcastID == "") || (d.Step == "stream_create" && d.StreamID == "") {
			d.Error = repositories.ErrLiveReconcile.Error()
		}
		cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		if err := s.Store.Progress(cleanup, d); err != nil {
			return d, fmt.Errorf("setup state could not be saved; reload and check YouTube Studio before retrying")
		}
		return d, nil
	}
	gateway, err := s.Gateway(ctx, event.AccountID)
	if err != nil {
		d.Step = "connection"
		return fail(err)
	}
	checkpoint := func(step string) error { d.Step = step; return s.Store.Progress(ctx, d) }
	if d.BroadcastID == "" {
		if err = checkpoint("broadcast_create"); err != nil {
			return nil, err
		}
		d.BroadcastID, err = gateway.CreateBroadcast(ctx, event)
		if err != nil {
			return fail(err)
		}
		if err = checkpoint("broadcast_created"); err != nil {
			return nil, err
		}
	}
	if d.StreamID == "" {
		if err = checkpoint("stream_create"); err != nil {
			return nil, err
		}
		d.StreamID, err = gateway.CreateStream(ctx, event.Title)
		if err != nil {
			return fail(err)
		}
		if err = checkpoint("stream_created"); err != nil {
			return nil, err
		}
	}
	if err = checkpoint("bind"); err != nil {
		return nil, err
	}
	if err = gateway.Bind(ctx, d.BroadcastID, d.StreamID); err != nil {
		return fail(err)
	}
	if err = checkpoint("metadata"); err != nil {
		return nil, err
	}
	if err = gateway.Metadata(ctx, d.BroadcastID, event); err != nil {
		return fail(err)
	}
	if d.ThumbnailKey != "" {
		if err = checkpoint("thumbnail"); err != nil {
			return nil, err
		}
		if s.Images == nil {
			return fail(fmt.Errorf("thumbnail storage unavailable"))
		}
		image, openErr := s.Images.GetStream(ctx, d.ThumbnailKey)
		if openErr != nil {
			return fail(openErr)
		}
		err = gateway.Thumbnail(ctx, d.BroadcastID, image)
		image.Close()
		if err != nil {
			return fail(err)
		}
	}
	d.State = "created"
	d.Step = "complete"
	d.Error = ""
	if err = s.Store.Progress(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}
