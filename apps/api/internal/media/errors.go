package media

import "github.com/synapse/api/internal/errors"

var (
	ErrInvalidCategory = errors.NewBadRequest("invalid media category")
	ErrInvalidMimeType = errors.NewBadRequest("invalid mime type for category")
	ErrFileTooLarge    = errors.NewBadRequest("file size exceeds maximum allowed for category")
	ErrStorageFailure  = errors.NewInternal("storage operation failed")
)
