package utils

import "github.com/gofiber/fiber/v2"

/**
 * Standardized response structures
 * Following DRY principle - one place for response formatting
 */

type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// SuccessResponse returns a success response
func SuccessResponse(c *fiber.Ctx, data interface{}, message string) error {
	return c.JSON(Response{
		Success: true,
		Data:    data,
		Message: message,
	})
}

// ErrorResponse returns an error response
// Optionally accepts an internal error to log (not sent to client)
func ErrorResponse(c *fiber.Ctx, statusCode int, message string, internalErr ...error) error {
	if len(internalErr) > 0 && internalErr[0] != nil {
		c.Locals("internal_error", internalErr[0])
	}
	return c.Status(statusCode).JSON(Response{
		Success: false,
		Error:   message,
	})
}

// CreatedResponse returns a 201 Created response
func CreatedResponse(c *fiber.Ctx, data interface{}) error {
	return c.Status(fiber.StatusCreated).JSON(Response{
		Success: true,
		Data:    data,
	})
}
