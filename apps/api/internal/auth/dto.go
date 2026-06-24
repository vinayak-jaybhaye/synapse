package auth

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=32"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token string  `json:"token"`
	User  UserDTO `json:"user"`
}

type UserDTO struct {
	ID          int64  `json:"id,string"` // Use string tag to prevent JS precision issues with BIGINT
	Username    string `json:"username"`
	DisplayName string `json:"display_name,omitempty"`
	AvatarKey   string `json:"avatar_key,omitempty"`
	Email       string `json:"email"`
}
