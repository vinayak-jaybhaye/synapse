package messages

import "time"

type Message struct {
	ID                int64      `json:"id,string"`
	ChannelID         int64      `json:"channel_id,string"`
	AuthorID          int64      `json:"author_id,string"`
	ReplyToMessageID  *int64     `json:"reply_to_message_id,string,omitempty"`
	MessageType       int        `json:"message_type"`
	Content           string     `json:"content"`
	Metadata          []byte     `json:"metadata,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	EditedAt          *time.Time `json:"edited_at,omitempty"`
	DeletedAt         *time.Time `json:"-"`
}

type MessageResponse struct {
	ID               int64             `json:"id,string"`
	ChannelID        int64             `json:"channel_id,string"`
	AuthorID         int64             `json:"author_id,string"`
	ReplyToMessageID *int64            `json:"reply_to_message_id,string,omitempty"`
	MessageType      int               `json:"message_type"`
	Content          string            `json:"content"`
	CreatedAt        time.Time         `json:"created_at"`
	EditedAt         *time.Time        `json:"edited_at,omitempty"`
	Reactions        []ReactionSummary `json:"reactions,omitempty"`
}

type ReactionSummary struct {
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
}

type CreateMessageRequest struct {
	Content          string `json:"content" binding:"required,min=1"`
	ReplyToMessageID *int64 `json:"reply_to_message_id,string,omitempty"`
}

type UpdateMessageRequest struct {
	Content string `json:"content" binding:"required,min=1"`
}

type ReadMarkerRequest struct {
	LastReadMessageID int64 `json:"last_read_message_id,string" binding:"required"`
}
