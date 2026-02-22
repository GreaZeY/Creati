package workers

import (
	"context"
	"time"

	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/services"
)

// EvergreenWorker periodically scans for high-performing content
// and creates recycling suggestions for agency users to approve.
type EvergreenWorker struct {
	recycling *services.RecyclingService
	interval  time.Duration
}

func NewEvergreenWorker(recycling *services.RecyclingService, interval time.Duration) *EvergreenWorker {
	return &EvergreenWorker{
		recycling: recycling,
		interval:  interval,
	}
}

func (w *EvergreenWorker) Start(ctx context.Context) {
	log := logger.Get("evergreen-worker")
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	log.Infof("Evergreen worker started, scanning every %v", w.interval)

	// Run immediately on startup, then on each tick
	if err := w.recycling.ScanAndSuggest(ctx); err != nil {
		log.WithError(err).Error("Initial evergreen scan failed")
	}

	for {
		select {
		case <-ctx.Done():
			log.Info("Evergreen worker shutting down")
			return
		case <-ticker.C:
			if err := w.recycling.ScanAndSuggest(ctx); err != nil {
				log.WithError(err).Error("Evergreen scan failed")
			}
		}
	}
}
