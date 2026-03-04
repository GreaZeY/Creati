package api

import (
	"database/sql"
	"encoding/json"

	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type OrgHandler struct {
	db *sql.DB
}

func NewOrgHandler(db *sql.DB) *OrgHandler {
	return &OrgHandler{db: db}
}

func (h *OrgHandler) GetOrgSettings(c *fiber.Ctx) error {
	orgID := c.Locals("orgID").(int)

	var name, customDomain string
	var logoURL, primaryColor sql.NullString
	err := h.db.QueryRow(`SELECT name, custom_domain, logo_url, primary_color FROM organizations WHERE id = $1`, orgID).Scan(&name, &customDomain, &logoURL, &primaryColor)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to fetch org settings", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"name":         name,
			"customDomain": customDomain,
			"logoUrl":      logoURL.String,
			"primaryColor": primaryColor.String,
		},
	})
}

func (h *OrgHandler) UpdateOrgSettings(c *fiber.Ctx) error {
	orgID := c.Locals("orgID").(int)
	var body struct {
		Name         string `json:"name"`
		CustomDomain string `json:"customDomain"`
		LogoUrl      string `json:"logoUrl"`
		PrimaryColor string `json:"primaryColor"`
	}

	if err := c.BodyParser(&body); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	_, err := h.db.Exec(`
		UPDATE organizations 
		SET name = $1, custom_domain = $2, logo_url = $3, primary_color = $4 
		WHERE id = $5
	`, body.Name, body.CustomDomain, body.LogoUrl, body.PrimaryColor, orgID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update org settings", err)
	}

	return c.JSON(fiber.Map{"success": true})
}

func (h *OrgHandler) GetPublicBranding(c *fiber.Ctx) error {
	host := c.Hostname()

	var name string
	var logoURL, primaryColor sql.NullString

	// Resolve org by custom domain or subdomain
	err := h.db.QueryRow(`
		SELECT name, logo_url, primary_color 
		FROM organizations 
		WHERE custom_domain = $1 OR subdomain = $1
	`, host).Scan(&name, &logoURL, &primaryColor)

	if err == sql.ErrNoRows {
		return c.JSON(fiber.Map{
			"success": false,
			"message": "no custom branding found for this domain",
		})
	}

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to fetch public branding", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"name":         name,
			"logoUrl":      logoURL.String,
			"primaryColor": primaryColor.String,
		},
	})
}

func (h *OrgHandler) GetStorageConfig(c *fiber.Ctx) error {
	orgID := c.Locals("orgID").(int)

	var providerType string
	var creds json.RawMessage
	var isActive bool

	err := h.db.QueryRow(`
		SELECT provider_type, credentials, is_active 
		FROM organization_storage_configs 
		WHERE org_id = $1
	`, orgID).Scan(&providerType, &creds, &isActive)

	if err == sql.ErrNoRows {
		// Return empty default
		return c.JSON(fiber.Map{
			"success": true,
			"data": fiber.Map{
				"providerType": "managed",
				"credentials":  nil,
				"isActive":     false,
			},
		})
	}

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to fetch storage config", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"providerType": providerType,
			"credentials":  creds,
			"isActive":     isActive,
		},
	})
}

func (h *OrgHandler) UpdateStorageConfig(c *fiber.Ctx) error {
	orgID := c.Locals("orgID").(int)
	var body struct {
		ProviderType string          `json:"providerType"`
		Credentials  json.RawMessage `json:"credentials"`
		IsActive     bool            `json:"isActive"`
	}

	if err := c.BodyParser(&body); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	// Upsert storage config
	_, err := h.db.Exec(`
		INSERT INTO organization_storage_configs (org_id, provider_type, credentials, is_active)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (org_id) DO UPDATE 
		SET provider_type = EXCLUDED.provider_type, 
		    credentials = EXCLUDED.credentials, 
		    is_active = EXCLUDED.is_active
	`, orgID, body.ProviderType, body.Credentials, body.IsActive)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update storage config", err)
	}

	return c.JSON(fiber.Map{"success": true})
}
