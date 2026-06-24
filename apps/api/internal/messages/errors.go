package messages

import "github.com/synapse/api/internal/errors"

var (
	// ErrContentEmpty represents an error when message content is empty.
	ErrContentEmpty = errors.NewBadRequest("message content cannot be empty")

	// ErrContentTooLong represents an error when message content exceeds limits.
	ErrContentTooLong = errors.NewBadRequest("message content exceeds maximum length of 2000 characters")

	// ErrReplyTargetNotFound represents an error when the reply target message does not exist.
	ErrReplyTargetNotFound = errors.NewNotFound("reply target message not found")

	// ErrReplyTargetMismatch represents an error when the reply target message is in another channel.
	ErrReplyTargetMismatch = errors.NewBadRequest("reply target message does not belong to the same channel")
)
