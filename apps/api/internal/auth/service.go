package auth

import (
	"context"
	"errors"
)

var ErrInvalidCredentials = errors.New("invalid email or password")

type AuthService interface {
	Register(ctx context.Context, req *RegisterRequest) (*AuthResponse, error)
	Login(ctx context.Context, req *LoginRequest) (*AuthResponse, error)
	GetUserDetails(ctx context.Context, userID int64) (*UserDTO, error)
}

type authService struct {
	repo         UserRepository
	tokenService TokenService
}

func NewAuthService(repo UserRepository, tokenService TokenService) AuthService {
	return &authService{
		repo:         repo,
		tokenService: tokenService,
	}
}

// Register handles the registration of a new user. It hashes the password, creates the user record,
// and returns an authentication token and user details.
func (s *authService) Register(ctx context.Context, req *RegisterRequest) (*AuthResponse, error) {
	hashedPassword, err := HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	user := &User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hashedPassword,
		DisplayName:  req.Username, // Default to username setup
	}

	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, err
	}

	token, err := s.tokenService.GenerateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		Token: token,
		User: UserDTO{
			ID:          user.ID,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			Email:       user.Email,
		},
	}, nil
}

// Login authenticates a user by email and password, and returns an authentication token and user details.
func (s *authService) Login(ctx context.Context, req *LoginRequest) (*AuthResponse, error) {
	user, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if !CheckPasswordHash(req.Password, user.PasswordHash) {
		return nil, ErrInvalidCredentials
	}

	token, err := s.tokenService.GenerateToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		Token: token,
		User: UserDTO{
			ID:          user.ID,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			AvatarKey:   user.AvatarKey,
			Email:       user.Email,
		},
	}, nil
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
