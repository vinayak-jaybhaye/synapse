package auth

import (
	"context"
)

type AuthService interface {
	GetUserDetails(ctx context.Context, userID int64) (*UserDTO, error)
}

type authService struct {
	repo UserRepository
}

func NewAuthService(repo UserRepository) AuthService {
	return &authService{
		repo: repo,
	}
}

// GetUserDetails retrieves the details of a user by their user ID.
func (s *authService) GetUserDetails(ctx context.Context, userID int64) (*UserDTO, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &UserDTO{
		ID:          user.ID,
		Username:    user.Username,
		DisplayName: user.DisplayName,
		AvatarKey:   user.AvatarKey,
		Email:       user.Email,
	}, nil
}
