package services

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

	"creati.in/creati/backend/internal/logger"
	razorpay "github.com/razorpay/razorpay-go"
)

type InvoiceService struct {
	db  *sql.DB
	rzp *razorpay.Client
}

func NewInvoiceService(db *sql.DB) *InvoiceService {
	rzp := razorpay.NewClient(
		os.Getenv("RAZORPAY_KEY_ID"),
		os.Getenv("RAZORPAY_KEY_SECRET"),
	)
	return &InvoiceService{db: db, rzp: rzp}
}

type Invoice struct {
	ID                     int        `json:"id"`
	UserID                 int        `json:"userId"`
	ClientID               int        `json:"clientId"`
	ClientName             string     `json:"clientName"`
	ClientColor            string     `json:"clientColor"`
	Title                  string     `json:"title"`
	Description            string     `json:"description"`
	AmountPaise            int        `json:"amountPaise"`
	Currency               string     `json:"currency"`
	RazorpayPaymentLinkID  string     `json:"razorpayPaymentLinkId"`
	RazorpayPaymentLinkURL string     `json:"razorpayPaymentLinkUrl"`
	Status                 string     `json:"status"`
	PaidAt                 *time.Time `json:"paidAt"`
	DueDate                *string    `json:"dueDate"`
	CreatedAt              time.Time  `json:"createdAt"`
}

type CreateInvoiceRequest struct {
	ClientID    int    `json:"clientId"`
	Title       string `json:"title"`
	Description string `json:"description"`
	AmountPaise int    `json:"amountPaise"` // e.g. 50000 = ₹500
	DueDate     string `json:"dueDate"`     // ISO date string, optional
}

// Create generates a Razorpay Payment Link and records the invoice in DB
func (s *InvoiceService) Create(ctx context.Context, userID int, req CreateInvoiceRequest) (*Invoice, error) {
	log := logger.Get("invoice")

	// 1. Fetch client details for the payment link description
	var clientName, clientEmail string
	err := s.db.QueryRowContext(ctx, `
		SELECT c.name, COALESCE(u.email, '') 
		FROM clients c
		JOIN organizations o ON c.org_id = o.id
		JOIN users u ON o.owner_id = u.id
		WHERE c.id = $1
	`, req.ClientID).Scan(&clientName, &clientEmail)
	if err != nil {
		return nil, fmt.Errorf("client not found: %w", err)
	}

	// 2. Build Razorpay Payment Link payload
	amountINR := float64(req.AmountPaise) / 100.0
	description := req.Description
	if description == "" {
		description = fmt.Sprintf("Invoice: %s", req.Title)
	}

	rzpData := map[string]interface{}{
		"amount":          req.AmountPaise,
		"currency":        "INR",
		"accept_partial":  false,
		"description":     description,
		"reference_id":    fmt.Sprintf("inv-u%d-c%d-%d", userID, req.ClientID, time.Now().Unix()),
		"reminder_enable": true,
		"notes": map[string]interface{}{
			"invoice_title": req.Title,
			"client_name":   clientName,
			"user_id":       userID,
		},
	}

	if req.DueDate != "" {
		// Razorpay expects expire_by as unix timestamp
		// Parse and add to payload
		due, parseErr := time.Parse("2006-01-02", req.DueDate)
		if parseErr == nil {
			rzpData["expire_by"] = due.Unix()
		}
	}

	log.Infof("Creating Razorpay Payment Link for ₹%.2f (client: %s)", amountINR, clientName)

	body, err := s.rzp.PaymentLink.Create(rzpData, nil)
	if err != nil {
		log.WithError(err).Warn("Razorpay Payment Link creation failed, storing invoice as draft")
		// Gracefully degrade: store as draft without a payment link
		body = map[string]interface{}{}
	}

	rzpID, _ := body["id"].(string)
	rzpURL, _ := body["short_url"].(string)

	status := "sent"
	if rzpID == "" {
		status = "draft"
	}

	// 3. Store invoice in DB
	var invoice Invoice
	var dueDate sql.NullString
	if req.DueDate != "" {
		dueDate = sql.NullString{String: req.DueDate, Valid: true}
	}

	err = s.db.QueryRowContext(ctx, `
		INSERT INTO client_invoices 
			(user_id, client_id, title, description, amount_paise, currency, 
			 razorpay_payment_link_id, razorpay_payment_link_url, status, due_date)
		VALUES ($1, $2, $3, $4, $5, 'INR', $6, $7, $8, $9)
		RETURNING id, user_id, client_id, title, description, amount_paise, currency, 
		          COALESCE(razorpay_payment_link_id, ''), COALESCE(razorpay_payment_link_url, ''),
		          status, paid_at, due_date::text, created_at
	`, userID, req.ClientID, req.Title, req.Description, req.AmountPaise,
		rzpID, rzpURL, status, dueDate,
	).Scan(
		&invoice.ID, &invoice.UserID, &invoice.ClientID, &invoice.Title,
		&invoice.Description, &invoice.AmountPaise, &invoice.Currency,
		&invoice.RazorpayPaymentLinkID, &invoice.RazorpayPaymentLinkURL,
		&invoice.Status, &invoice.PaidAt, &invoice.DueDate, &invoice.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to save invoice: %w", err)
	}

	invoice.ClientName = clientName
	return &invoice, nil
}

// List returns all invoices for a user, optionally filtered by client
func (s *InvoiceService) List(ctx context.Context, userID int, clientID *int) ([]Invoice, error) {
	query := `
		SELECT 
			i.id, i.user_id, i.client_id, i.title, i.description,
			i.amount_paise, i.currency,
			COALESCE(i.razorpay_payment_link_id, ''),
			COALESCE(i.razorpay_payment_link_url, ''),
			i.status, i.paid_at, i.due_date::text, i.created_at,
			c.name, c.color
		FROM client_invoices i
		JOIN clients c ON i.client_id = c.id
		WHERE i.user_id = $1
	`
	args := []interface{}{userID}
	if clientID != nil {
		query += " AND i.client_id = $2"
		args = append(args, *clientID)
	}
	query += " ORDER BY i.created_at DESC LIMIT 100"

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list invoices: %w", err)
	}
	defer rows.Close()

	invoices := make([]Invoice, 0)
	for rows.Next() {
		var inv Invoice
		if err := rows.Scan(
			&inv.ID, &inv.UserID, &inv.ClientID, &inv.Title, &inv.Description,
			&inv.AmountPaise, &inv.Currency,
			&inv.RazorpayPaymentLinkID, &inv.RazorpayPaymentLinkURL,
			&inv.Status, &inv.PaidAt, &inv.DueDate, &inv.CreatedAt,
			&inv.ClientName, &inv.ClientColor,
		); err != nil {
			continue
		}
		invoices = append(invoices, inv)
	}
	return invoices, nil
}

// MarkPaid updates an invoice's status to paid (called by webhook or manually)
func (s *InvoiceService) MarkPaid(ctx context.Context, razorpayLinkID string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE client_invoices 
		SET status = 'paid', paid_at = NOW(), updated_at = NOW()
		WHERE razorpay_payment_link_id = $1
	`, razorpayLinkID)
	return err
}
