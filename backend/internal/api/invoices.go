package api

import (
	"database/sql"
	"encoding/json"
	"os"
	"strconv"

	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type InvoiceHandler struct {
	invoiceSvc *services.InvoiceService
}

func NewInvoiceHandler(db *sql.DB) *InvoiceHandler {
	return &InvoiceHandler{
		invoiceSvc: services.NewInvoiceService(db),
	}
}

// List returns all invoices, optionally filtered by ?clientId=
func (h *InvoiceHandler) List(c *fiber.Ctx) error {
	ctx := middleware.GetContext(c)

	var clientID *int
	if ctx.ClientID != nil {
		clientID = ctx.ClientID
	}
	if q := c.Query("clientId"); q != "" {
		if id, err := strconv.Atoi(q); err == nil {
			clientID = &id
		}
	}

	invoices, err := h.invoiceSvc.List(c.Context(), ctx.UserID, clientID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to list invoices", err)
	}

	return utils.SuccessResponse(c, invoices, "")
}

// Create generates a Razorpay Payment Link and records the invoice
func (h *InvoiceHandler) Create(c *fiber.Ctx) error {
	ctx := middleware.GetContext(c)

	var req services.CreateInvoiceRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.ClientID == 0 || req.Title == "" || req.AmountPaise <= 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "clientId, title, and amount are required")
	}

	invoice, err := h.invoiceSvc.Create(c.Context(), ctx.UserID, req)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create invoice", err)
	}

	return utils.SuccessResponse(c, invoice, "Invoice created and payment link sent")
}

// HandlePaymentLinkWebhook processes Razorpay payment_link.paid events
func (h *InvoiceHandler) HandlePaymentLinkWebhook(c *fiber.Ctx) error {
	secret := os.Getenv("RAZORPAY_WEBHOOK_SECRET")
	sig := c.Get("X-Razorpay-Signature")
	if !utils.VerifyWebhookSignature(c.Body(), sig, secret) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid signature"})
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(c.Body(), &payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid json"})
	}

	event, _ := payload["event"].(string)
	if event != "payment_link.paid" {
		return c.SendStatus(fiber.StatusOK)
	}

	payloadData, _ := payload["payload"].(map[string]interface{})
	plEntity, _ := payloadData["payment_link"].(map[string]interface{})
	plInner, _ := plEntity["entity"].(map[string]interface{})
	linkID, _ := plInner["id"].(string)

	if linkID != "" {
		_ = h.invoiceSvc.MarkPaid(c.Context(), linkID)
	}

	return c.SendStatus(fiber.StatusOK)
}
