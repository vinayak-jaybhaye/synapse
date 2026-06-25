package media

import (
	"context"
	"time"
)

// Storage defines the interface for underlying object storage operations
type Storage interface {
	PresignPut(ctx context.Context, key string, contentType string, expires time.Duration) (string, error)
	PresignGet(ctx context.Context, key string, expires time.Duration) (string, error)
	Delete(ctx context.Context, key string) error
}
