package features

// Plans
const (
	PlanFree    = "free"
	PlanCreator = "creator"
	PlanPro     = "pro"
)

// Capabilities
type Capability string

const (
	CanUseMagicSync             Capability = "can_use_magic_sync"
	CanUseAudienceNotifications Capability = "can_use_audience_notifications"
	CanUseAdvancedAnalytics     Capability = "can_use_advanced_analytics"
	MaxUploadsPerMonth          Capability = "max_uploads_per_month"
	MaxConnectedAccounts        Capability = "max_connected_accounts"
)

// Entitlements definition
var planEntitlements = map[string]map[Capability]interface{}{
	PlanFree: {
		CanUseMagicSync:             false,
		CanUseAudienceNotifications: false,
		CanUseAdvancedAnalytics:     false,
		MaxUploadsPerMonth:          5,
		MaxConnectedAccounts:        3,
	},
	PlanCreator: {
		CanUseMagicSync:             true,
		CanUseAudienceNotifications: true,
		CanUseAdvancedAnalytics:     false,
		MaxUploadsPerMonth:          -1, // Unlimited
		MaxConnectedAccounts:        10,
	},
	PlanPro: {
		CanUseMagicSync:             true,
		CanUseAudienceNotifications: true,
		CanUseAdvancedAnalytics:     true,
		MaxUploadsPerMonth:          -1, // Unlimited
		MaxConnectedAccounts:        -1, // Unlimited
	},
}

// GetEntitlement returns the value of a capability for a given plan
// If the plan is invalid, it defaults to Free plan entitlements
func GetEntitlement(plan string, cap Capability) interface{} {
	entitlements, ok := planEntitlements[plan]
	if !ok {
		entitlements = planEntitlements[PlanFree]
	}
	return entitlements[cap]
}

// HasFeature returns true if the plan has the feature enabled (boolean capability)
func HasFeature(plan string, cap Capability) bool {
	val := GetEntitlement(plan, cap)
	if boolVal, ok := val.(bool); ok {
		return boolVal
	}
	return false
}

// GetLimit returns the integer limit for a capability (e.g. max uploads)
// Returns -1 for unlimited
func GetLimit(plan string, cap Capability) int {
	val := GetEntitlement(plan, cap)
	if intVal, ok := val.(int); ok {
		return intVal
	}
	return 0
}
