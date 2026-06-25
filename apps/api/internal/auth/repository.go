package auth

import (
	"context"
	"errors"
	"time"

	"github.com/bwmarrin/snowflake"
)

var ErrUserNotFound = errors.New("user not found")
var ErrUserExists = errors.New("user already exists")

// Base User model reflecting the updated schema
type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	DisplayName  string    `json:"display_name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	AvatarKey    string    `json:"avatar_key"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type UserRepository interface {
	CreateUser(ctx context.Context, user *User) error
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	GetUserByID(ctx context.Context, id int64) (*User, error)
}

// In-memory repository for initial bootstrapping
type memoryUserRepo struct {
	users     map[int64]*User
	byEmail   map[string]int64
	snowflake *snowflake.Node
}

func NewMemoryUserRepository() UserRepository {
	node, _ := snowflake.NewNode(1)
	return &memoryUserRepo{
		users:     make(map[int64]*User),
		byEmail:   make(map[string]int64),
		snowflake: node,
	}
}

func (r *memoryUserRepo) CreateUser(ctx context.Context, user *User) error {
	if _, exists := r.byEmail[user.Email]; exists {
		return ErrUserExists
	}
	user.ID = r.snowflake.Generate().Int64()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	r.users[user.ID] = user
	r.byEmail[user.Email] = user.ID
	return nil
}

func (r *memoryUserRepo) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	id, exists := r.byEmail[email]
	if !exists {
		return nil, ErrUserNotFound
	}
	return r.users[id], nil
}

func (r *memoryUserRepo) GetUserByID(ctx context.Context, id int64) (*User, error) {
	user, exists := r.users[id]
	if !exists {
		return nil, ErrUserNotFound
	}
	return user, nil
}
