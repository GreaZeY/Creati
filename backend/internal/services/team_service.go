package services

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type TeamService struct {
	db *sql.DB
}

func NewTeamService(db *sql.DB) *TeamService {
	return &TeamService{db: db}
}

// TeamMemberInfo includes user details for UI display
type TeamMemberInfo struct {
	ID        int       `json:"id"`
	UserID    int       `json:"userId"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	Status    string    `json:"status"`
	Avatar    string    `json:"avatar"`
	CreatedAt time.Time `json:"createdAt"`
}

// ListTeamMembers returns all members of an organization
func (s *TeamService) ListTeamMembers(ctx context.Context, orgID int) ([]TeamMemberInfo, error) {
	query := `
		SELECT tm.id, tm.user_id, u.name, u.email, tm.role, tm.status, COALESCE(u.picture_url, '') as avatar, tm.created_at
		FROM team_members tm
		JOIN users u ON tm.user_id = u.id
		WHERE tm.org_id = $1
		ORDER BY tm.created_at ASC
	`
	rows, err := s.db.QueryContext(ctx, query, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := make([]TeamMemberInfo, 0)
	for rows.Next() {
		var m TeamMemberInfo
		if err := rows.Scan(&m.ID, &m.UserID, &m.Name, &m.Email, &m.Role, &m.Status, &m.Avatar, &m.CreatedAt); err != nil {
			continue
		}
		members = append(members, m)
	}
	return members, nil
}

// InviteMember adds a new member to the organization by email
func (s *TeamService) InviteMember(ctx context.Context, orgID int, email string, role string) error {
	// 1. Find user by email
	var userID int
	err := s.db.QueryRowContext(ctx, "SELECT id FROM users WHERE email = $1", email).Scan(&userID)
	if err == sql.ErrNoRows {
		// In a real app, we would send an invite email to a non-existent user.
		// For this MVP, we assume the user must already exist.
		return errors.New("user with this email not found")
	}
	if err != nil {
		return err
	}

	// 2. Check if already a member
	var exists bool
	err = s.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM team_members WHERE org_id = $1 AND user_id = $2)", orgID, userID).Scan(&exists)
	if err != nil {
		return err
	}
	if exists {
		return errors.New("user is already a member of this organization")
	}

	// 3. Add to team_members
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO team_members (org_id, user_id, role, status)
		VALUES ($1, $2, $3, 'active')
	`, orgID, userID, role)

	return err
}

// RemoveMember removes a member from the organization
func (s *TeamService) RemoveMember(ctx context.Context, orgID int, memberID int) error {
	// Ensure we are not removing the owner (or at least check permissions)
	var role string
	err := s.db.QueryRowContext(ctx, "SELECT role FROM team_members WHERE id = $1 AND org_id = $2", memberID, orgID).Scan(&role)
	if err != nil {
		return err
	}

	if role == "owner" {
		return errors.New("cannot remove the organization owner")
	}

	_, err = s.db.ExecContext(ctx, "DELETE FROM team_members WHERE id = $1 AND org_id = $2", memberID, orgID)
	return err
}

// UpdateMemberRole changes the role of a team member
func (s *TeamService) UpdateMemberRole(ctx context.Context, orgID int, memberID int, newRole string) error {
	if newRole != "admin" && newRole != "editor" && newRole != "viewer" {
		return errors.New("invalid role")
	}

	_, err := s.db.ExecContext(ctx, "UPDATE team_members SET role = $1 WHERE id = $2 AND org_id = $3", newRole, memberID, orgID)
	return err
}

// CheckPermission verifies if a user has a specific role or high enough permission
func (s *TeamService) CheckPermission(ctx context.Context, userID int, orgID int, requiredRoles []string) (bool, error) {
	var role string
	err := s.db.QueryRowContext(ctx, "SELECT role FROM team_members WHERE user_id = $1 AND org_id = $2 AND status = 'active'", userID, orgID).Scan(&role)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	// Owner and Admin usually have all permissions
	if role == "owner" || role == "admin" {
		return true, nil
	}

	for _, r := range requiredRoles {
		if r == role {
			return true, nil
		}
	}

	return false, nil
}
