package permissions

import "errors"

var (
	// ErrMemberNotFound represents a member lookup failure.
	ErrMemberNotFound = errors.New("member not found")

	// ErrRoleNotFound represents a role lookup failure.
	ErrRoleNotFound = errors.New("role not found")

	// ErrChannelNotFound represents a channel lookup failure.
	ErrChannelNotFound = errors.New("channel not found")

	// ErrPermissionDenied represents a lack of required permissions.
	ErrPermissionDenied = errors.New("permission denied")
)
