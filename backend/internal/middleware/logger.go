package middleware

import (
	"fmt"
	"runtime/debug"
	"time"

	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
)

// RequestLogger handles request logging and panic recovery with Trace IDs
func RequestLogger(c *fiber.Ctx) error {
	start := time.Now()

	// Get Trace ID (set by requestid middleware)
	traceID := c.GetRespHeader("X-Request-ID")
	if traceID == "" {
		// Fallback if requestid middleware isn't used
		traceID = c.Get("X-Request-ID")
	}

	// Add traceID to local context for other middlewares/handlers
	c.Locals("trace_id", traceID)

	defer func() {
		if r := recover(); r != nil {
			stack := string(debug.Stack())
			err, ok := r.(error)
			if !ok {
				err = fmt.Errorf("%v", r)
			}

			// Log Panic with Stack Trace
			logger.Get("server").WithFields(logrus.Fields{
				"trace_id": traceID,
				"method":   c.Method(),
				"path":     c.Path(),
				"ip":       c.IP(),
				"stack":    stack,
				"panic":    true,
			}).WithError(err).Error("Panic recovered")

			// Return JSON 500
			utils.ErrorResponse(c, fiber.StatusInternalServerError, fmt.Sprintf("Internal Server Error (Ref: %s)", traceID))
		}
	}()

	// Process Request
	err := c.Next()

	// Calculate latency
	latency := time.Since(start)

	// Determine status
	status := c.Response().StatusCode()

	// Create logger entry
	logEntry := logger.Get("server").WithFields(logrus.Fields{
		"trace_id":   traceID,
		"method":     c.Method(),
		"path":       c.Path(),
		"query":      string(c.Request().URI().QueryArgs().QueryString()),
		"status":     status,
		"latency":    latency.String(),
		"latency_ms": latency.Milliseconds(),
		"ip":         c.IP(),
		"user_agent": c.Get("User-Agent"),
	})

	// Add User ID if present (from AuthMiddleware)
	if userID := c.Locals("userID"); userID != nil {
		logEntry = logEntry.WithField("user_id", userID)
	}

	// Check for internal error first (set by utils.ErrorResponse)
	if internalErr := c.Locals("internal_error"); internalErr != nil {
		if err, ok := internalErr.(error); ok {
			logEntry.WithError(err).Error("Server error (captured)")
		} else {
			logEntry.WithField("error", internalErr).Error("Server error (captured)")
		}
	} else if err != nil {
		// Fiber returned an error during processing
		logEntry.WithError(err).Error("Request failed")
	} else if status >= 500 {
		logEntry.Error("Server error")
	} else if status >= 400 {
		logEntry.Warn("Client error")
	} else {
		logEntry.Info("Request completed")
	}

	return err
}
