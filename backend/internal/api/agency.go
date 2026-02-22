package api

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"

	"github.com/gofiber/fiber/v2"
)

type AgencyHandler struct {
	db          *sql.DB
	intakeSvc   *services.IntakeService
	approvalSvc *services.ApprovalService
}

func NewAgencyHandler(db *sql.DB, intake *services.IntakeService, approval *services.ApprovalService) *AgencyHandler {
	return &AgencyHandler{
		db:          db,
		intakeSvc:   intake,
		approvalSvc: approval,
	}
}

// ListClients returns all workspaces (clients) available to the user
func (h *AgencyHandler) ListClients(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	// In the future this will be more complex (joining team_members),
	// but for now, we assume user owns the org that owns the clients.
	// Simplified: Get all clients belonging to organizations owned by this user
	// OR clients where user is a team member.

	// Phase 1: Simple retrieval - Find clients linked to user's orgs
	// We first need to ensure user has a "Personal Organization" or similar concept if we go strict.
	// But per our plan: "Personal" is just client_id = NULL. available implicitly.

	// Query clients linked to user via team_members (or direct ownership if simplified)
	// Using the schema: User -> TeamMember -> Org -> Client

	query := `
		SELECT c.id, c.name, c.color, COALESCE(c.logo_url, '') as logo_url, c.created_at, o.name as org_name
		FROM clients c
		JOIN organizations o ON c.org_id = o.id
		JOIN team_members tm ON o.id = tm.org_id
		WHERE tm.user_id = $1 AND tm.status = 'active'
		ORDER BY c.name ASC
	`

	rows, err := h.db.Query(query, userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to fetch clients", err)
	}
	defer rows.Close()

	type ClientResponse struct {
		ID        int       `json:"id"`
		Name      string    `json:"name"`
		Color     string    `json:"color"`
		LogoURL   string    `json:"logoUrl"`
		OrgName   string    `json:"orgName"`
		CreatedAt time.Time `json:"createdAt"`
	}

	clients := make([]ClientResponse, 0)
	for rows.Next() {
		var c ClientResponse
		if err := rows.Scan(&c.ID, &c.Name, &c.Color, &c.LogoURL, &c.CreatedAt, &c.OrgName); err != nil {
			continue
		}
		clients = append(clients, c)
	}

	return utils.SuccessResponse(c, clients, "")
}

// CreateClient creates a new workspace under an organization
func (h *AgencyHandler) CreateClient(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var payload struct {
		Name  string `json:"name"`
		Color string `json:"color"`
		OrgID int    `json:"orgId"` // Optional if we auto-select user's default org
	}

	if err := c.BodyParser(&payload); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	if payload.Name == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "name is required")
	}

	// 1. If OrgID is missing, find or create the User's "Default Agency"
	var orgID int
	if payload.OrgID != 0 {
		orgID = payload.OrgID
		// Verify membership
		var role string
		err := h.db.QueryRow("SELECT role FROM team_members WHERE user_id = $1 AND org_id = $2", userID, orgID).Scan(&role)
		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusForbidden, "not a member of this organization", err)
		}
		if role != "owner" && role != "admin" {
			return utils.ErrorResponse(c, fiber.StatusForbidden, "insufficient permissions")
		}
		println("CreateClient: Using provided orgID:", orgID, "for user:", userID)
	} else {
		// Auto-create/find default org
		// Check if user owns any org
		err := h.db.QueryRow("SELECT id FROM organizations WHERE owner_id = $1 LIMIT 1", userID).Scan(&orgID)
		if err == sql.ErrNoRows {
			println("CreateClient: No org found for user", userID, "- creating new org")
			// Create default org
			var newOrgID int
			// Explicitly handle transaction might be safer but simple is fine here
			err := h.db.QueryRow(`
				INSERT INTO organizations (name, owner_id) VALUES ($1, $2) RETURNING id
			`, "My Agency", userID).Scan(&newOrgID)
			if err != nil {
				println("CreateClient: Failed to create org:", err.Error())
				return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create organization", err)
			}
			orgID = newOrgID
			println("CreateClient: Created new org with ID:", orgID)

			// Add user as owner in team_members
			_, err = h.db.Exec(`
				INSERT INTO team_members (org_id, user_id, role, status) VALUES ($1, $2, 'owner', 'active')
			`, orgID, userID)
			if err != nil {
				println("CreateClient: Failed to create team_member entry:", err.Error())
			} else {
				println("CreateClient: Created team_member entry for user", userID, "in org", orgID)
			}
		} else if err != nil {
			println("CreateClient: Database error looking for org:", err.Error())
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
		} else {
			println("CreateClient: Found existing org with ID:", orgID, "for user:", userID)
			// Org exists - ensure team_members entry exists
			var exists bool
			err := h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM team_members WHERE org_id = $1 AND user_id = $2)", orgID, userID).Scan(&exists)
			if err == nil && !exists {
				println("CreateClient: team_members entry missing - creating for org", orgID, "user", userID)
				// Add team_members entry if missing
				_, err = h.db.Exec(`
					INSERT INTO team_members (org_id, user_id, role, status) VALUES ($1, $2, 'owner', 'active')
				`, orgID, userID)
				if err != nil {
					println("CreateClient: Failed to create team_member entry:", err.Error())
				} else {
					println("CreateClient: Successfully created team_member entry")
				}
			} else if err != nil {
				println("CreateClient: Error checking team_members existence:", err.Error())
			} else {
				println("CreateClient: team_members entry already exists")
			}
		}
	}

	// 2. Create Client
	var clientID int
	err := h.db.QueryRow(`
		INSERT INTO clients (org_id, name, color) VALUES ($1, $2, $3) RETURNING id
	`, orgID, payload.Name, payload.Color).Scan(&clientID)

	if err != nil {
		println("CreateClient: Failed to create client:", err.Error())
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create client", err)
	}

	println("CreateClient: Successfully created client", clientID, "in org", orgID, "for user", userID)
	return utils.SuccessResponse(c, fiber.Map{"id": clientID, "orgId": orgID}, "Client workspace created")
}

// UpdateClient updates a client's name and/or color
func (h *AgencyHandler) UpdateClient(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	clientID := c.Params("id")

	var payload struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}

	if err := c.BodyParser(&payload); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	// Verify user has access to this client
	var exists bool
	err := h.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM clients c
			JOIN organizations o ON c.org_id = o.id
			JOIN team_members tm ON o.id = tm.org_id
			WHERE c.id = $1 AND tm.user_id = $2 AND tm.status = 'active'
		)
	`, clientID, userID).Scan(&exists)

	if err != nil || !exists {
		return utils.ErrorResponse(c, fiber.StatusForbidden, "not authorized")
	}

	// Build update query dynamically
	var updates []string
	var args []interface{}
	argIdx := 1

	if payload.Name != "" {
		updates = append(updates, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, payload.Name)
		argIdx++
	}
	if payload.Color != "" {
		updates = append(updates, fmt.Sprintf("color = $%d", argIdx))
		args = append(args, payload.Color)
		argIdx++
	}

	if len(updates) == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "no fields to update")
	}

	args = append(args, clientID)
	query := fmt.Sprintf("UPDATE clients SET %s WHERE id = $%d", strings.Join(updates, ", "), argIdx)

	_, err = h.db.Exec(query, args...)
	if err != nil {
		println("UpdateClient: Failed to update:", err.Error())
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update client", err)
	}

	return utils.SuccessResponse(c, nil, "Client updated successfully")
}

// DeleteClient deletes a client workspace
func (h *AgencyHandler) DeleteClient(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	clientID := c.Params("id")

	// Verify user has owner/admin access
	var role string
	err := h.db.QueryRow(`
		SELECT tm.role FROM clients c
		JOIN organizations o ON c.org_id = o.id
		JOIN team_members tm ON o.id = tm.org_id
		WHERE c.id = $1 AND tm.user_id = $2 AND tm.status = 'active'
	`, clientID, userID).Scan(&role)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusForbidden, "not authorized")
	}

	if role != "owner" && role != "admin" {
		return utils.ErrorResponse(c, fiber.StatusForbidden, "insufficient permissions")
	}

	// Delete client (cascades to platform_accounts, videos, etc.)
	_, err = h.db.Exec("DELETE FROM clients WHERE id = $1", clientID)
	if err != nil {
		println("DeleteClient: Failed to delete:", err.Error())
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to delete client", err)
	}

	return utils.SuccessResponse(c, nil, "Client deleted successfully")
}

// ReorderClients updates the display order of clients
func (h *AgencyHandler) ReorderClients(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var payload struct {
		Order []int `json:"order"` // Array of client IDs in desired order
	}

	if err := c.BodyParser(&payload); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	// Verify all clients belong to user's orgs
	for i, clientID := range payload.Order {
		var exists bool
		err := h.db.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM clients c
				JOIN organizations o ON c.org_id = o.id
				JOIN team_members tm ON o.id = tm.org_id
				WHERE c.id = $1 AND tm.user_id = $2 AND tm.status = 'active'
			)
		`, clientID, userID).Scan(&exists)

		if err != nil || !exists {
			return utils.ErrorResponse(c, fiber.StatusForbidden, "invalid client in order")
		}

		// Update display_order
		_, err = h.db.Exec("UPDATE clients SET display_order = $1 WHERE id = $2", i, clientID)
		if err != nil {
			println("ReorderClients: Failed to update order:", err.Error())
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to reorder", err)
		}
	}

	return utils.SuccessResponse(c, nil, "Clients reordered successfully")
}

// BatchUpdateClients updates multiple clients (name, color, order) in a single transaction
func (h *AgencyHandler) BatchUpdateClients(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var payload struct {
		Clients []struct {
			ID           int    `json:"id"`
			Name         string `json:"name"`
			Color        string `json:"color"`
			DisplayOrder int    `json:"displayOrder"`
		} `json:"clients"`
	}

	if err := c.BodyParser(&payload); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	if len(payload.Clients) == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "no clients to update")
	}

	// Start Transaction
	tx, err := h.db.Begin()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to start transaction", err)
	}
	defer tx.Rollback()

	for _, client := range payload.Clients {
		// Verify ownership inside transaction for consistency
		var exists bool
		err := tx.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM clients c
				JOIN organizations o ON c.org_id = o.id
				JOIN team_members tm ON o.id = tm.org_id
				WHERE c.id = $1 AND tm.user_id = $2 AND tm.status = 'active'
			)
		`, client.ID, userID).Scan(&exists)

		if err != nil || !exists {
			return utils.ErrorResponse(c, fiber.StatusForbidden, fmt.Sprintf("not authorized for client %d", client.ID))
		}

		// Perform update
		_, err = tx.Exec(`
			UPDATE clients 
			SET name = $1, color = $2, display_order = $3 
			WHERE id = $4
		`, client.Name, client.Color, client.DisplayOrder, client.ID)

		if err != nil {
			println("BatchUpdateClients: Failed to update client", client.ID, ":", err.Error())
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update client "+client.Name)
		}
	}

	if err := tx.Commit(); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to commit changes", err)
	}

	return utils.SuccessResponse(c, nil, "All changes saved successfully")
}

// -- Agency Pivot: Secure Credential Vault & Approval Links --

// CreateIntakeLink generates a magic link for client platform connection
func (h *AgencyHandler) CreateIntakeLink(c *fiber.Ctx) error {
	ctx := middleware.GetContext(c)
	if ctx.ClientID == nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "must be in a client context to generate an intake link")
	}

	// Default 7 days expiry
	token, err := h.intakeSvc.GenerateIntakeToken(c.Context(), ctx.UserID, *ctx.ClientID, 7*24*time.Hour)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to generate token", err)
	}

	return utils.SuccessResponse(c, fiber.Map{
		"token": token,
		"url":   "/connect-client/" + token,
	}, "Intake link generated")
}

// GetClientPublicContext returns public brand info for the intake page
func (h *AgencyHandler) GetClientPublicContext(c *fiber.Ctx) error {
	token := c.Params("token")
	_, clientID, err := h.intakeSvc.ValidateIntakeToken(c.Context(), token)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "invalid or expired token", err)
	}

	client, err := h.intakeSvc.GetClientContext(c.Context(), clientID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to fetch client context", err)
	}

	return utils.SuccessResponse(c, fiber.Map{
		"name":     client.Name,
		"logo_url": client.LogoURL,
		"color":    client.Color,
	}, "")
}

// CreateApprovalLink generates a magic link for content approval
func (h *AgencyHandler) CreateApprovalLink(c *fiber.Ctx) error {
	idStr := c.Params("id")
	videoID, err := strconv.Atoi(idStr)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid video id")
	}

	// Default 3 days expiry
	token, err := h.approvalSvc.GenerateApprovalLink(c.Context(), videoID, 3*24*time.Hour)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to generate approval link", err)
	}

	return utils.SuccessResponse(c, fiber.Map{
		"token": token,
		"url":   "/approve/" + token,
	}, "Approval link generated")
}

// GetApprovalContext returns video info for the approval page
func (h *AgencyHandler) GetApprovalContext(c *fiber.Ctx) error {
	token := c.Params("token")
	video, err := h.approvalSvc.ValidateApprovalToken(c.Context(), token)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "invalid or expired approval link", err)
	}

	return utils.SuccessResponse(c, video, "")
}

// SubmitApprovalDecision handles the client's decision
func (h *AgencyHandler) SubmitApprovalDecision(c *fiber.Ctx) error {
	token := c.Params("token")

	var payload struct {
		Decision string `json:"decision"` // 'approved', 'rejected'
		Feedback string `json:"feedback"`
	}

	if err := c.BodyParser(&payload); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	err := h.approvalSvc.SubmitDecision(c.Context(), token, payload.Decision, payload.Feedback)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to submit decision", err)
	}

	return utils.SuccessResponse(c, nil, "Decision submitted successfully")
}
