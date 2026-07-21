package notifications

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/synapse/api/internal/channels"
	"github.com/synapse/api/internal/guilds"
	"github.com/synapse/api/internal/permissions"
)

// Mock repository implementations
type mockRepository struct {
	settings map[string]*NotificationSettings // Key format: "userID:guildID:channelID"
	dmMember map[string]bool                  // Key format: "channelID:userID"
}

func (m *mockRepository) GetUserSettings(ctx context.Context, userID int64) ([]NotificationSettings, error) {
	var res []NotificationSettings
	for _, s := range m.settings {
		if s.UserID == userID {
			res = append(res, *s)
		}
	}
	return res, nil
}

func (m *mockRepository) CreateOrUpdate(ctx context.Context, notif *Notification) error {
	return nil
}

func (m *mockRepository) MarkRead(ctx context.Context, recipientID, notificationID int64) error {
	return nil
}

func (m *mockRepository) MarkAllRead(ctx context.Context, recipientID int64) error {
	return nil
}

func (m *mockRepository) Delete(ctx context.Context, recipientID, notificationID int64) (bool, error) {
	return false, nil
}

func (m *mockRepository) GetInbox(ctx context.Context, recipientID int64, beforeID *int64, limit int) ([]Notification, error) {
	return nil, nil
}

func (m *mockRepository) GetUnreadCount(ctx context.Context, recipientID int64) (int, error) {
	return 0, nil
}

func (m *mockRepository) GetMessageAuthor(ctx context.Context, messageID int64) (int64, error) {
	return 0, nil
}

func (m *mockRepository) InsertOutboxEvent(ctx context.Context, eventType string, aggregateID int64, payload []byte) error {
	return nil
}

func (m *mockRepository) PutSettings(ctx context.Context, s *NotificationSettings) error {
	var gidStr, cidStr string
	if s.GuildID != nil {
		gidStr = fmt.Sprintf("%d", *s.GuildID)
	}
	if s.ChannelID != nil {
		cidStr = fmt.Sprintf("%d", *s.ChannelID)
	}
	key := fmt.Sprintf("%d:%s:%s", s.UserID, gidStr, cidStr)
	m.settings[key] = s
	return nil
}

func (m *mockRepository) IsDMParticipant(ctx context.Context, channelID, userID int64) (bool, error) {
	key := fmt.Sprintf("%d:%d", channelID, userID)
	return m.dmMember[key], nil
}

type mockGuildRepository struct {
	guilds.Repository
	members map[string]*guilds.GuildMember
}

func (m *mockGuildRepository) GetMember(ctx context.Context, guildID, userID int64) (*guilds.GuildMember, error) {
	key := fmt.Sprintf("%d:%d", guildID, userID)
	return m.members[key], nil
}

type mockChannelRepository struct {
	channels.Repository
	channels map[int64]*channels.Channel
}

func (m *mockChannelRepository) GetByID(ctx context.Context, channelID int64) (*channels.Channel, error) {
	return m.channels[channelID], nil
}

type mockPermissionsService struct {
	permissions.Service
	channelPerms map[string]bool // Key format: "channelID:userID"
}

func (m *mockPermissionsService) HasChannelPermission(ctx context.Context, guildID, channelID, userID int64, perm permissions.Permission) (bool, error) {
	key := fmt.Sprintf("%d:%d", channelID, userID)
	return m.channelPerms[key], nil
}

func TestNotificationsService(t *testing.T) {
	ctx := context.Background()

	// Initializing mock repositories
	repo := &mockRepository{
		settings: make(map[string]*NotificationSettings),
		dmMember: make(map[string]bool),
	}
	guildRepo := &mockGuildRepository{
		members: make(map[string]*guilds.GuildMember),
	}
	channelRepo := &mockChannelRepository{
		channels: make(map[int64]*channels.Channel),
	}
	permService := &mockPermissionsService{
		channelPerms: make(map[string]bool),
	}

	svc := NewService(repo, guildRepo, channelRepo, permService, nil, nil)

	userID := int64(123)
	guildID := int64(456)
	channelID := int64(789)
	dmChannelID := int64(999)

	// Setup Guild Membership
	guildRepo.members["456:123"] = &guilds.GuildMember{GuildID: guildID, UserID: userID}

	// Setup Channels
	channelRepo.channels[channelID] = &channels.Channel{ID: channelID, GuildID: &guildID}
	channelRepo.channels[dmChannelID] = &channels.Channel{ID: dmChannelID, GuildID: nil} // DM channel

	// Setup Permissions
	permService.channelPerms["789:123"] = true

	// Setup DM participant
	repo.dmMember["999:123"] = true

	muteTime := time.Now().Add(1 * time.Hour)

	// 1. Global Upsert
	t.Run("Global Upsert", func(t *testing.T) {
		req := &PutNotificationSettingsRequest{MuteUntil: &muteTime}
		s, err := svc.PutSettings(ctx, userID, nil, nil, req)
		if err != nil {
			t.Fatalf("Expected global upsert to succeed, got %v", err)
		}
		if s.UserID != userID || s.GuildID != nil || s.ChannelID != nil || s.MuteUntil != &muteTime {
			t.Fatal("Global settings returned wrong values")
		}
	})

	// 2. Guild Upsert
	t.Run("Guild Upsert", func(t *testing.T) {
		req := &PutNotificationSettingsRequest{MuteUntil: &muteTime}
		s, err := svc.PutSettings(ctx, userID, &guildID, nil, req)
		if err != nil {
			t.Fatalf("Expected guild upsert to succeed, got %v", err)
		}
		if *s.GuildID != guildID || s.ChannelID != nil {
			t.Fatal("Guild settings returned wrong values")
		}
	})

	// 3. Channel Upsert
	t.Run("Channel Upsert", func(t *testing.T) {
		req := &PutNotificationSettingsRequest{MuteUntil: &muteTime}
		s, err := svc.PutSettings(ctx, userID, nil, &channelID, req)
		if err != nil {
			t.Fatalf("Expected channel upsert to succeed, got %v", err)
		}
		if s.GuildID != nil || *s.ChannelID != channelID {
			t.Fatal("Channel settings returned wrong values")
		}
	})

	// 4. Invalid Scope (Both Guild and Channel set)
	t.Run("Invalid Scope Both Set", func(t *testing.T) {
		req := &PutNotificationSettingsRequest{MuteUntil: &muteTime}
		_, err := svc.PutSettings(ctx, userID, &guildID, &channelID, req)
		if err == nil {
			t.Fatal("Expected error when both guild and channel are specified")
		}
	})

	// 5. Guild Membership Validation
	t.Run("Guild Membership Validation", func(t *testing.T) {
		nonMemberUserID := int64(888)
		req := &PutNotificationSettingsRequest{MuteUntil: &muteTime}
		_, err := svc.PutSettings(ctx, nonMemberUserID, &guildID, nil, req)
		if err == nil {
			t.Fatal("Expected error for non-guild member config")
		}
	})

	// 6. Channel Permission Validation
	t.Run("Channel Permission Validation", func(t *testing.T) {
		noPermUserID := int64(777)
		// Set non-permissioned user as guild member
		guildRepo.members["456:777"] = &guilds.GuildMember{GuildID: guildID, UserID: noPermUserID}
		req := &PutNotificationSettingsRequest{MuteUntil: &muteTime}
		_, err := svc.PutSettings(ctx, noPermUserID, nil, &channelID, req)
		if err == nil {
			t.Fatal("Expected error for user with no VIEW_CHANNEL permission")
		}
	})

	// 7. DM Channel Participant Validation
	t.Run("DM Channel Participant Validation", func(t *testing.T) {
		noDMMemberID := int64(666)
		req := &PutNotificationSettingsRequest{MuteUntil: &muteTime}
		_, err := svc.PutSettings(ctx, noDMMemberID, nil, &dmChannelID, req)
		if err == nil {
			t.Fatal("Expected error for user not participant of DM channel")
		}
	})
}
