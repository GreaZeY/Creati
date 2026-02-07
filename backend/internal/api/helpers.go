package api

import (
"strconv"

"github.com/gofiber/fiber/v2"
)

// getClientIDFromQuery extracts client ID from query parameter
func getClientIDFromQuery(c *fiber.Ctx) *int {
clientIDStr := c.Query("clientId")
if clientIDStr == "" {
return nil
}

clientID, err := strconv.Atoi(clientIDStr)
if err != nil {
return nil
}

return &clientID
}
