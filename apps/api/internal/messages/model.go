package messages

import "time"

type Message struct {
	ID               int64         `json:"id,string"`
	ChannelID        int64         `json:"channel_id,string"`
	AuthorID         int64         `json:"author_id,string"`
	Author           UserSummary   `json:"author"`
	ReplyToMessageID *int64        `json:"reply_to_message_id,string,omitempty"`
	ReplyPreview     *ReplyPreview `json:"reply_preview,omitempty"`
	MessageType      int           `json:"message_type"`
	Content          string        `json:"content"`
	Metadata         []byte        `json:"metadata,omitempty"`
	CreatedAt        time.Time     `json:"created_at"`
	EditedAt         *time.Time    `json:"edited_at,omitempty"`
	DeletedAt        *time.Time    `json:"-"`
	Attachments      []Attachment  `json:"attachments,omitempty"`
}

type ReplyPreview struct {
	ID       int64  `json:"id,string"`
	AuthorID int64  `json:"author_id,string"`
	Username string `json:"username"`
	Content  string `json:"content"`
	Deleted  bool   `json:"deleted"`
}

type Attachment struct {
	ID         int64  `json:"id,string"`
	MessageID  int64  `json:"-"`
	StorageKey string `json:"-"`
	FileName   string `json:"file_name"`
	FileSize   int64  `json:"file_size"`
	MimeType   string `json:"mime_type"`
}

type UserSummary struct {
	ID          int64  `json:"id,string"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	AvatarKey   string `json:"avatar_key"`
	BannerKey   string `json:"banner_key,omitempty"`
	Bio         string `json:"bio,omitempty"`
}

type MessageResponse struct {
	ID               int64             `json:"id,string"`
	ChannelID        int64             `json:"channel_id,string"`
	AuthorID         int64             `json:"author_id,string"`
	Author           UserSummary       `json:"author"`
	ReplyToMessageID *int64            `json:"reply_to_message_id,string,omitempty"`
	ReplyPreview     *ReplyPreview     `json:"reply_preview,omitempty"`
	MessageType      int               `json:"message_type"`
	Content          string            `json:"content"`
	CreatedAt        time.Time         `json:"created_at"`
	EditedAt         *time.Time        `json:"edited_at,omitempty"`
	Attachments      []Attachment      `json:"attachments,omitempty"`
	Reactions        []ReactionSummary `json:"reactions,omitempty"`
	Deleted          bool              `json:"deleted"`
}

type ReactionSummary struct {
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
}

type CreateMessageRequest struct {
	Content             string   `json:"content"`
	ReplyToMessageID    *int64   `json:"reply_to_message_id,string,omitempty"`
	AttachmentUploadIDs []string `json:"attachment_upload_ids,omitempty"`
}

type UpdateMessageRequest struct {
	Content string `json:"content" binding:"required,min=1"`
}

type ReadMarkerRequest struct {
	LastReadMessageID int64 `json:"last_read_message_id,string" binding:"required"`
}

// Outbox event types centralized
const (
	MessageCreatedEvent = "MESSAGE_CREATED"
	MessageUpdatedEvent = "MESSAGE_UPDATED"
	MessageDeletedEvent = "MESSAGE_DELETED"
)

// OutboxEvent represents a transactional outbox record
type OutboxEvent struct {
	ID            int64
	AggregateType string
	AggregateID   int64
	EventType     string
	Payload       []byte
}
