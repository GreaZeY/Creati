package services

import (
	"context"
	"encoding/json"
)

// Ability defines the contract for any tool the AI Agent can use
type Ability interface {
	Name() string        // System name (e.g. create_automation)
	Description() string // Human-like description for the LLM
	Parameters() any     // JSON Schema for the tool parameters
	Execute(ctx context.Context, userID int, args json.RawMessage) (any, error)
}

// AbilityRegistry is the central hub for all agent capabilities
type AbilityRegistry struct {
	abilities map[string]Ability
}

func NewAbilityRegistry() *AbilityRegistry {
	return &AbilityRegistry{
		abilities: make(map[string]Ability),
	}
}

func (r *AbilityRegistry) Register(a Ability) {
	r.abilities[a.Name()] = a
}

func (r *AbilityRegistry) Get(name string) (Ability, bool) {
	a, ok := r.abilities[name]
	return a, ok
}

// GetToolDefinitions returns the tools in a format compatible with LLM function calling
func (r *AbilityRegistry) GetToolDefinitions() []map[string]interface{} {
	var defs []map[string]interface{}
	for _, a := range r.abilities {
		defs = append(defs, map[string]interface{}{
			"type": "function",
			"function": map[string]interface{}{
				"name":        a.Name(),
				"description": a.Description(),
				"parameters":  a.Parameters(),
			},
		})
	}
	return defs
}

// Capability Categories (for organization)
const (
	CategoryAppControl = "app_control"
	CategoryAnalytics  = "analytics"
	CategoryContent    = "content"
	CategoryBusiness   = "business"
)
