package types

// UserContext holds common request parameters
// Following SOLID: Dedicated structure for request context in a shared package
type UserContext struct {
	UserID   int
	ClientID *int
	OrgID    *int
}
