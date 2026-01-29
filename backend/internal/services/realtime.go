package services

import (
	"context"
	"fmt"
	"sync"

	"creati.in/creati/backend/internal/logger"
	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
)

type RealtimeService struct {
	// Map of user_id to a list of client channels
	clients    map[int][]chan string
	clientsMux sync.RWMutex
}

func NewRealtimeService() *RealtimeService {
	return &RealtimeService{
		clients: make(map[int][]chan string),
	}
}

// HandleConnection manages an SSE connection for a specific user
func (s *RealtimeService) HandleConnection(c *fiber.Ctx, userID int) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	messageChan := make(chan string)

	s.clientsMux.Lock()
	s.clients[userID] = append(s.clients[userID], messageChan)
	s.clientsMux.Unlock()

	logger.Get("realtime").WithField("user_id", userID).Info("New SSE connection")

	c.Context().SetBodyStreamWriter(func(w *fiber.Writer) {
		keepAliveTicker := fiber.NewTicker(20 * fiber.Second)
		defer keepAliveTicker.Stop()

		for {
			select {
			case <-c.Context().Done():
				s.removeClient(userID, messageChan)
				return
			case msg := <-messageChan:
				fmt.Fprintf(w, "data: %s\n\n", msg)
				w.Flush()
			case <-keepAliveTicker.C:
				fmt.Fprintf(w, ": keep-alive\n\n")
				w.Flush()
			}
		}
	})

	return nil
}

// Broadcast sends a message to all active connections for a user
func (s *RealtimeService) Broadcast(userID int, message string) {
	s.clientsMux.RLock()
	defer s.clientsMux.RUnlock()

	if channels, ok := s.clients[userID]; ok {
		for _, ch := range channels {
			// Non-blocking send
			select {
			case ch <- message:
			default:
				logger.Get("realtime").WithField("user_id", userID).Warn("Client buffer full, dropping message")
			}
		}
	}
}

func (s *RealtimeService) removeClient(userID int, ch chan string) {
	s.clientsMux.Lock()
	defer s.clientsMux.Unlock()

	channels := s.clients[userID]
	for i, c := range channels {
		if c == ch {
			s.clients[userID] = append(channels[:i], channels[i+1:]...)
			break
		}
	}
	if len(s.clients[userID]) == 0 {
		delete(s.clients, userID)
	}
	close(ch)
	logger.Get("realtime").WithField("user_id", userID).Info("SSE connection closed")
}
