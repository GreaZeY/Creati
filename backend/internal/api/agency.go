package api

import (
	"database/sql"
	"time"

	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/utils"

	"github.com/gofiber/fiber/v2"
)

type AgencyHandler struct {
	db *sql.DB
}

func NewAgencyHandler(db *sql.DB) *AgencyHandler {
	return &AgencyHandler{db: db}
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

	// Debug: Check components separately
	var clientCount, orgCount, teamMemberCount int
	h.db.QueryRow("SELECT COUNT(*) FROM clients").Scan(&clientCount)
	h.db.QueryRow("SELECT COUNT(*) FROM organizations WHERE owner_id = $1", userID).Scan(&orgCount)
	h.db.QueryRow("SELECT COUNT(*) FROM team_members WHERE user_id = $1", userID).Scan(&teamMemberCount)
	println("ListClients DEBUG: Total clients:", clientCount, "| User's orgs:", orgCount, "| User's team_members:", teamMemberCount)

	// Debug: Check the actual data
	var tmStatus string
	var tmOrgID int
	err := h.db.QueryRow("SELECT org_id, status FROM team_members WHERE user_id = $1 LIMIT 1", userID).Scan(&tmOrgID, &tmStatus)
	if err == nil {
		println("ListClients DEBUG: team_member for user", userID, "-> org_id:", tmOrgID, "status:", tmStatus)

		// Check if any clients match this org_id
		var matchingClients int
		h.db.QueryRow("SELECT COUNT(*) FROM clients WHERE org_id = $1", tmOrgID).Scan(&matchingClients)
		println("ListClients DEBUG: Clients with org_id", tmOrgID, ":", matchingClients)

		// Show actual org_ids in clients table
		clientRows, _ := h.db.Query("SELECT id, name, org_id FROM clients LIMIT 5")
		if clientRows != nil {
			defer clientRows.Close()
			println("ListClients DEBUG: Sample clients:")
			for clientRows.Next() {
				var cid, corgid int
				var cname string
				clientRows.Scan(&cid, &cname, &corgid)
				println("  - Client", cid, ":", cname, "-> org_id:", corgid)
			}
		}
	} else {
		println("ListClients DEBUG: No team_member found:", err.Error())
	}

	rows, err := h.db.Query(query, userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to fetch clients")
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
			println("ListClients ERROR: Failed to scan row:", err.Error())
			continue
		}
		clients = append(clients, c)
	}

	// Debug logging
	println("ListClients: Found", len(clients), "clients for user", userID)

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
			return utils.ErrorResponse(c, fiber.StatusForbidden, "not a member of this organization")
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
				return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create organization")
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
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
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
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create client")
	}

	println("CreateClient: Successfully created client", clientID, "in org", orgID, "for user", userID)
	return utils.SuccessResponse(c, fiber.Map{"id": clientID, "orgId": orgID}, "Client workspace created")
}
