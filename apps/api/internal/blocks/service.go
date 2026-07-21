package blocks

import (
	"context"
	"encoding/json"
	"strconv"

	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/events"
)

type Service interface {
	BlockUser(ctx context.Context, blockerID, blockedID int64) error
	UnblockUser(ctx context.Context, blockerID, blockedID int64) error
	GetBlockedUsers(ctx context.Context, blockerID int64) ([]int64, error)
	CanDM(ctx context.Context, userA, userB int64) (bool, error)
	CheckMutualBlock(ctx context.Context, userA, userB int64) (bool, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) BlockUser(ctx context.Context, blockerID, blockedID int64) error {
	if blockerID == blockedID {
		return errors.NewBadRequest("cannot block yourself")
	}

	payload, _ := json.Marshal(map[string]any{
		"blocker_id": strconv.FormatInt(blockerID, 10),
		"blocked_id": strconv.FormatInt(blockedID, 10),
	})

	event := &OutboxEvent{
		AggregateType: "user",
		AggregateID:   blockerID,
		EventType:     events.UserBlockAdd,
		Payload:       payload,
		PartitionKey:  int16(blockerID % 16),
	}

	return s.repo.BlockUser(ctx, blockerID, blockedID, event)
}

func (s *service) UnblockUser(ctx context.Context, blockerID, blockedID int64) error {
	payload, _ := json.Marshal(map[string]any{
		"blocker_id": strconv.FormatInt(blockerID, 10),
		"blocked_id": strconv.FormatInt(blockedID, 10),
	})

	event := &OutboxEvent{
		AggregateType: "user",
		AggregateID:   blockerID,
		EventType:     events.UserBlockRemove,
		Payload:       payload,
		PartitionKey:  int16(blockerID % 16),
	}

	return s.repo.UnblockUser(ctx, blockerID, blockedID, event)
}

func (s *service) GetBlockedUsers(ctx context.Context, blockerID int64) ([]int64, error) {
	return s.repo.GetBlockedUsers(ctx, blockerID)
}

func (s *service) CanDM(ctx context.Context, userA, userB int64) (bool, error) {
	hasBlock, err := s.repo.CheckMutualBlock(ctx, userA, userB)
	if err != nil {
		return false, err
	}
	return !hasBlock, nil
}
func (s *service) CheckMutualBlock(ctx context.Context, userA, userB int64) (bool, error) {
	return s.repo.CheckMutualBlock(ctx, userA, userB)
}
