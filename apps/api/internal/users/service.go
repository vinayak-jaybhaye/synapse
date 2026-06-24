package users

import (
	"context"
	"fmt"
	"strconv"

	"github.com/redis/go-redis/v9"
	"github.com/synapse/api/internal/errors"
)

type Service interface {
	GetUserByID(ctx context.Context, id int64) (*User, error)
	GetUserGuilds(ctx context.Context, userID int64) ([]UserGuildDTO, error)
	CreateDM(ctx context.Context, creatorID, recipientID int64) (*DMChannelResponse, error)
}

type service struct {
	repo  Repository
	rdb   *redis.Client
}

func NewService(repo Repository, rdb *redis.Client) Service {
	return &service{repo: repo, rdb: rdb}
}

func (s *service) GetUserByID(ctx context.Context, id int64) (*User, error) {
	u, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, errors.NewNotFound("user not found")
	}
	return u, nil
}

func (s *service) GetUserGuilds(ctx context.Context, userID int64) ([]UserGuildDTO, error) {
	guilds, err := s.repo.ListGuilds(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Dynamic injection of unread counts from Redis
	for i := range guilds {
		gID := guilds[i].ID
		key := fmt.Sprintf("unread:%d:%d", userID, gID)
		val, err := s.rdb.Get(ctx, key).Result()
		if err == nil {
			if count, err := strconv.Atoi(val); err == nil {
				guilds[i].UnreadCount = count
			}
		}
	}

	return guilds, nil
}

func (s *service) CreateDM(ctx context.Context, creatorID, recipientID int64) (*DMChannelResponse, error) {
	if creatorID == recipientID {
		return nil, errors.NewBadRequest("cannot create a DM channel with yourself")
	}

	// Verify recipient user exists
	recipient, err := s.repo.GetByID(ctx, recipientID)
	if err != nil {
		return nil, err
	}
	if recipient == nil {
		return nil, errors.NewNotFound("recipient user not found")
	}

	channelID, err := s.repo.CreateOrGetDM(ctx, creatorID, recipientID)
	if err != nil {
		return nil, err
	}

	return &DMChannelResponse{
		ChannelID:   channelID,
		RecipientID: recipientID,
	}, nil
}
