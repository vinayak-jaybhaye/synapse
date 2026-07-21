package events

import "context"

// Domain events

type DomainEventMessageCreated struct {
	Ctx              context.Context
	MessageID        int64
	ChannelID        int64
	AuthorID         int64
	GuildID          *int64
	Content          string
	ReplyToID        *int64
	MentionedUserIDs []int64 // pre-extracted mentioned user IDs
}

type DomainEventReactionAdded struct {
	Ctx       context.Context
	MessageID int64
	ChannelID int64
	AuthorID  int64 // author of the message
	UserID    int64 // person who reacted
	GuildID   *int64
	Emoji     string
}

type DomainEventFriendRequestCreated struct {
	Ctx         context.Context
	RequesterID int64
	TargetID    int64
}

type DomainEventFriendRequestAccepted struct {
	Ctx         context.Context
	TargetID    int64 // person who accepted it
	RequesterID int64 // original person who requested
}
