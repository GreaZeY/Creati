package api

import (
	"database/sql"
	"encoding/json"

	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type MediaHandler struct {
	db *sql.DB
}

func NewMediaHandler(db *sql.DB) *MediaHandler {
	return &MediaHandler{db: db}
}

func (h *MediaHandler) ListAssets(c *fiber.Ctx) error {
	orgID := c.Locals("orgID").(int)
	assetType := c.Query("type")

	query := `
		SELECT id, type, name, url, metadata, tags, is_public 
		FROM media_assets 
		WHERE (org_id = $1 OR is_public = TRUE)
	`
	args := []interface{}{orgID}

	if assetType != "" {
		query += " AND type = $2"
		args = append(args, assetType)
	}

	query += " ORDER BY created_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to list assets", err)
	}
	defer rows.Close()

	var assets []interface{}
	for rows.Next() {
		var id int
		var aType, name, url string
		var metadata []byte
		var tags []string
		var isPublic bool

		if err := rows.Scan(&id, &aType, &name, &url, &metadata, &tags, &isPublic); err != nil {
			continue
		}

		var metaMap map[string]interface{}
		_ = json.Unmarshal(metadata, &metaMap)

		assets = append(assets, fiber.Map{
			"id":       id,
			"type":     aType,
			"name":     name,
			"url":      url,
			"metadata": metaMap,
			"tags":     tags,
			"isPublic": isPublic,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    assets,
	})
}
