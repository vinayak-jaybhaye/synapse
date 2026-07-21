package blocks

import "time"

type UserBlock struct {
	BlockerID int64     `json:"blocker_id"`
	BlockedID int64     `json:"blocked_id"`
	CreatedAt time.Time `json:"created_at"`
}

type OutboxEvent struct {
	ID            int64
	AggregateType string
	AggregateID   int64
	EventType     string
	Payload       []byte
	PartitionKey  int16
}
