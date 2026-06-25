package messages

import (
	"context"
	"errors"
	"testing"

	"github.com/synapse/api/internal/channels"
	domainErrors "github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/permissions"
)

// mockMessageRepo implements Repository for testing.
type mockMessageRepo struct {
	messages        map[int64]*Message
	dmParticipants  map[string]bool // key: channelID:userID -> isMember
	outboxEvents    []*OutboxEvent
	createErr       error
	updateErr       error
	softDeleteErr   error
	isDMParticipant bool
	listMessages    []MessageResponse
	listMessagesErr error
}

func (m *mockMessageRepo) GetByID(ctx context.Context, id int64) (*Message, error) {
	if msg, ok := m.messages[id]; ok {
		return msg, nil
	}
	return nil, nil
}

func (m *mockMessageRepo) ListMessagesCursor(ctx context.Context, channelID, beforeID int64, limit int) ([]MessageResponse, error) {
	if m.listMessagesErr != nil {
		return nil, m.listMessagesErr
	}
	return m.listMessages, nil
}

func (m *mockMessageRepo) CreateMessageWithOutbox(ctx context.Context, msg *Message, event *OutboxEvent) error {
	if m.createErr != nil {
		return m.createErr
	}
	m.messages[msg.ID] = msg
	m.outboxEvents = append(m.outboxEvents, event)
	return nil
}

func (m *mockMessageRepo) Update(ctx context.Context, msg *Message) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	m.messages[msg.ID] = msg
	return nil
}

func (m *mockMessageRepo) SoftDelete(ctx context.Context, id int64) error {
	if m.softDeleteErr != nil {
		return m.softDeleteErr
	}
	delete(m.messages, id)
	return nil
}

func (m *mockMessageRepo) AddReaction(ctx context.Context, messageID, userID int64, emoji string) error {
	return nil
}

func (m *mockMessageRepo) RemoveReaction(ctx context.Context, messageID, userID int64, emoji string) error {
	return nil
}

func (m *mockMessageRepo) UpdateReadStatePostgres(ctx context.Context, channelID, userID, lastReadMessageID int64) error {
	return nil
}

func (m *mockMessageRepo) IsDMParticipant(ctx context.Context, channelID int64, userID int64) (bool, error) {
	return m.isDMParticipant, nil
}

// mockChannelRepo implements channels.Repository for testing.
type mockChannelRepo struct {
	channels map[int64]*channels.Channel
}

func (m *mockChannelRepo) GetByID(ctx context.Context, id int64) (*channels.Channel, error) {
	return m.channels[id], nil
}

func (m *mockChannelRepo) ListGuildChannels(ctx context.Context, guildID int64) ([]channels.Channel, error) {
	return nil, nil
}

func (m *mockChannelRepo) Create(ctx context.Context, ch *channels.Channel) error {
	return nil
}

func (m *mockChannelRepo) Update(ctx context.Context, ch *channels.Channel) error {
	return nil
}

func (m *mockChannelRepo) SoftDelete(ctx context.Context, id int64) error {
	return nil
}

func (m *mockChannelRepo) GetMaxPosition(ctx context.Context, guildID int64) (int, error) {
	return 0, nil
}

func (m *mockChannelRepo) GetRoleOverrides(ctx context.Context, channelID int64) ([]channels.ChannelRolePermissionOverride, error) {
	return nil, nil
}

func (m *mockChannelRepo) PutRoleOverride(ctx context.Context, override *channels.ChannelRolePermissionOverride) error {
	return nil
}

func (m *mockChannelRepo) DeleteRoleOverride(ctx context.Context, channelID, roleID int64) error {
	return nil
}

// mockPermissionsService implements permissions.Service for testing.
type mockPermissionsService struct {
	channelPerms map[int64]permissions.Permission // key: channelID -> permissions
}

func (m *mockPermissionsService) ResolveGuildPermissions(ctx context.Context, guildID int64, userID int64) (permissions.Permission, error) {
	return 0, nil
}

func (m *mockPermissionsService) ResolveChannelPermissions(ctx context.Context, guildID int64, channelID int64, userID int64) (permissions.Permission, error) {
	return m.channelPerms[channelID], nil
}

func (m *mockPermissionsService) HasGuildPermission(ctx context.Context, guildID int64, userID int64, perm permissions.Permission) (bool, error) {
	return false, nil
}

func (m *mockPermissionsService) HasChannelPermission(ctx context.Context, guildID int64, channelID int64, userID int64, perm permissions.Permission) (bool, error) {
	return false, nil
}

func isForbidden(err error) bool {
	if apiErr, ok := err.(*domainErrors.APIError); ok {
		return apiErr.Status == 403
	}
	return false
}

func TestSendMessage(t *testing.T) {
	ctx := context.Background()
	guildID := int64(10)

	msgRepo := &mockMessageRepo{messages: make(map[int64]*Message)}
	chanRepo := &mockChannelRepo{channels: make(map[int64]*channels.Channel)}
	permSvc := &mockPermissionsService{channelPerms: make(map[int64]permissions.Permission)}

	svc := NewService(msgRepo, chanRepo, permSvc, nil)

	// Setup Guild Channel
	channelID := int64(100)
	chanRepo.channels[channelID] = &channels.Channel{
		ID:      channelID,
		GuildID: &guildID,
		Name:    "general",
		Type:    0,
	}

	// 1. Success case: user has SEND_MESSAGES permission
	permSvc.channelPerms[channelID] = permissions.VIEW_CHANNEL | permissions.SEND_MESSAGES
	req := &CreateMessageRequest{Content: "Hello world!"}
	resp, err := svc.SendMessage(ctx, channelID, 1, req)
	if err != nil {
		t.Fatalf("expected SendMessage success, got: %v", err)
	}
	if resp.Content != "Hello world!" {
		t.Errorf("expected content 'Hello world!', got: %s", resp.Content)
	}
	if len(msgRepo.outboxEvents) != 1 {
		t.Fatalf("expected 1 outbox event to be created, got: %d", len(msgRepo.outboxEvents))
	}
	event := msgRepo.outboxEvents[0]
	if event.EventType != MessageCreatedEvent {
		t.Errorf("expected outbox event type %s, got: %s", MessageCreatedEvent, event.EventType)
	}

	// 2. Permission Denied case
	permSvc.channelPerms[channelID] = permissions.VIEW_CHANNEL // missing SEND_MESSAGES
	_, err = svc.SendMessage(ctx, channelID, 1, req)
	if !isForbidden(err) {
		t.Errorf("expected ErrForbidden status 403, got: %v", err)
	}

	// 3. Validation Empty Content
	permSvc.channelPerms[channelID] = permissions.VIEW_CHANNEL | permissions.SEND_MESSAGES
	_, err = svc.SendMessage(ctx, channelID, 1, &CreateMessageRequest{Content: ""})
	if !errors.Is(err, ErrContentEmpty) {
		t.Errorf("expected ErrContentEmpty, got: %v", err)
	}

	// 4. Validation Too Long Content
	tooLongContent := make([]byte, 2001)
	for i := range tooLongContent {
		tooLongContent[i] = 'a'
	}
	_, err = svc.SendMessage(ctx, channelID, 1, &CreateMessageRequest{Content: string(tooLongContent)})
	if !errors.Is(err, ErrContentTooLong) {
		t.Errorf("expected ErrContentTooLong, got: %v", err)
	}

	// 5. Valid Reply Target
	parentID := int64(999)
	msgRepo.messages[parentID] = &Message{ID: parentID, ChannelID: channelID, Content: "parent"}
	resp, err = svc.SendMessage(ctx, channelID, 1, &CreateMessageRequest{Content: "reply", ReplyToMessageID: &parentID})
	if err != nil {
		t.Fatalf("expected reply SendMessage success, got: %v", err)
	}
	if *resp.ReplyToMessageID != parentID {
		t.Errorf("expected reply target message ID %d, got: %d", parentID, *resp.ReplyToMessageID)
	}

	// 6. Invalid Reply Target: Missing
	missingParentID := int64(888)
	_, err = svc.SendMessage(ctx, channelID, 1, &CreateMessageRequest{Content: "reply", ReplyToMessageID: &missingParentID})
	if !errors.Is(err, ErrReplyTargetNotFound) {
		t.Errorf("expected ErrReplyTargetNotFound, got: %v", err)
	}

	// 7. Invalid Reply Target: Channel Mismatch
	otherChannelID := int64(200)
	chanRepo.channels[otherChannelID] = &channels.Channel{ID: otherChannelID, GuildID: &guildID, Name: "other", Type: 0}
	permSvc.channelPerms[otherChannelID] = permissions.VIEW_CHANNEL | permissions.SEND_MESSAGES
	otherMsgID := int64(777)
	msgRepo.messages[otherMsgID] = &Message{ID: otherMsgID, ChannelID: otherChannelID, Content: "other channel parent"}
	_, err = svc.SendMessage(ctx, channelID, 1, &CreateMessageRequest{Content: "reply", ReplyToMessageID: &otherMsgID})
	if !errors.Is(err, ErrReplyTargetMismatch) {
		t.Errorf("expected ErrReplyTargetMismatch, got: %v", err)
	}

	// 8. Transaction Rollback
	msgRepo.createErr = errors.New("database insert error")
	_, err = svc.SendMessage(ctx, channelID, 1, req)
	if err == nil || err.Error() != "database insert error" {
		t.Errorf("expected database insert error, got: %v", err)
	}
}

func TestDMChannelAuthorization(t *testing.T) {
	ctx := context.Background()

	msgRepo := &mockMessageRepo{messages: make(map[int64]*Message)}
	chanRepo := &mockChannelRepo{channels: make(map[int64]*channels.Channel)}
	permSvc := &mockPermissionsService{}

	svc := NewService(msgRepo, chanRepo, permSvc, nil)

	dmChannelID := int64(500)
	chanRepo.channels[dmChannelID] = &channels.Channel{
		ID:      dmChannelID,
		GuildID: nil, // DM channel
		Name:    "direct",
		Type:    3,
	}

	// 1. Participant Access (Allowed)
	msgRepo.isDMParticipant = true
	req := &CreateMessageRequest{Content: "DM Hello"}
	resp, err := svc.SendMessage(ctx, dmChannelID, 1, req)
	if err != nil {
		t.Fatalf("expected DM SendMessage success, got: %v", err)
	}
	if resp.Content != "DM Hello" {
		t.Errorf("expected content 'DM Hello', got: %s", resp.Content)
	}

	// 2. Non-Participant Access (Denied)
	msgRepo.isDMParticipant = false
	_, err = svc.SendMessage(ctx, dmChannelID, 999, req)
	if !isForbidden(err) {
		t.Errorf("expected ErrForbidden status 403, got: %v", err)
	}
}

func TestSyncReadState(t *testing.T) {
	ctx := context.Background()
	guildID := int64(10)

	msgRepo := &mockMessageRepo{}
	chanRepo := &mockChannelRepo{channels: make(map[int64]*channels.Channel)}
	permSvc := &mockPermissionsService{channelPerms: make(map[int64]permissions.Permission)}

	svc := NewService(msgRepo, chanRepo, permSvc, nil)

	channelID := int64(100)
	chanRepo.channels[channelID] = &channels.Channel{ID: channelID, GuildID: &guildID}

	// Case 1: Member has access
	permSvc.channelPerms[channelID] = permissions.VIEW_CHANNEL
	err := svc.SyncReadState(ctx, channelID, 1, 12345)
	if err != nil {
		t.Fatalf("expected SyncReadState success, got: %v", err)
	}

	// Case 2: Member has no access
	permSvc.channelPerms[channelID] = 0 // missing VIEW_CHANNEL
	err = svc.SyncReadState(ctx, channelID, 1, 12345)
	if !isForbidden(err) {
		t.Errorf("expected ErrForbidden, got: %v", err)
	}
}

func TestEditMessage(t *testing.T) {
	ctx := context.Background()
	guildID := int64(10)

	msgRepo := &mockMessageRepo{messages: make(map[int64]*Message)}
	chanRepo := &mockChannelRepo{channels: make(map[int64]*channels.Channel)}
	permSvc := &mockPermissionsService{channelPerms: make(map[int64]permissions.Permission)}

	svc := NewService(msgRepo, chanRepo, permSvc, nil)

	channelID := int64(100)
	chanRepo.channels[channelID] = &channels.Channel{ID: channelID, GuildID: &guildID}
	permSvc.channelPerms[channelID] = permissions.VIEW_CHANNEL

	msgID := int64(55)
	msgRepo.messages[msgID] = &Message{ID: msgID, ChannelID: channelID, AuthorID: 1, Content: "old content"}

	// Case 1: Author edits own message
	resp, err := svc.EditMessage(ctx, channelID, msgID, 1, &UpdateMessageRequest{Content: "new content"})
	if err != nil {
		t.Fatalf("expected EditMessage success, got: %v", err)
	}
	if resp.Content != "new content" {
		t.Errorf("expected updated content 'new content', got: %s", resp.Content)
	}

	// Case 2: Edit other user's message (Denied)
	_, err = svc.EditMessage(ctx, channelID, msgID, 999, &UpdateMessageRequest{Content: "hacked"})
	if !isForbidden(err) {
		t.Errorf("expected ErrForbidden, got: %v", err)
	}
}

func TestDeleteMessage(t *testing.T) {
	ctx := context.Background()
	guildID := int64(10)

	msgRepo := &mockMessageRepo{messages: make(map[int64]*Message)}
	chanRepo := &mockChannelRepo{channels: make(map[int64]*channels.Channel)}
	permSvc := &mockPermissionsService{channelPerms: make(map[int64]permissions.Permission)}

	svc := NewService(msgRepo, chanRepo, permSvc, nil)

	channelID := int64(100)
	chanRepo.channels[channelID] = &channels.Channel{ID: channelID, GuildID: &guildID}
	permSvc.channelPerms[channelID] = permissions.VIEW_CHANNEL

	msgID := int64(55)

	// Case 1: Author deletes own message (Allowed)
	msgRepo.messages[msgID] = &Message{ID: msgID, ChannelID: channelID, AuthorID: 1, Content: "delete me"}
	err := svc.DeleteMessage(ctx, channelID, msgID, 1)
	if err != nil {
		t.Fatalf("expected successful deletion by author, got: %v", err)
	}

	// Case 2: Non-author deletes message without MANAGE_MESSAGES permission (Denied)
	msgRepo.messages[msgID] = &Message{ID: msgID, ChannelID: channelID, AuthorID: 1, Content: "delete me"}
	permSvc.channelPerms[channelID] = permissions.VIEW_CHANNEL // missing MANAGE_MESSAGES
	err = svc.DeleteMessage(ctx, channelID, msgID, 999)
	if !isForbidden(err) {
		t.Errorf("expected ErrForbidden, got: %v", err)
	}

	// Case 3: Non-author deletes message WITH MANAGE_MESSAGES permission (Allowed)
	msgRepo.messages[msgID] = &Message{ID: msgID, ChannelID: channelID, AuthorID: 1, Content: "delete me"}
	permSvc.channelPerms[channelID] = permissions.VIEW_CHANNEL | permissions.MANAGE_MESSAGES
	err = svc.DeleteMessage(ctx, channelID, msgID, 999)
	if err != nil {
		t.Fatalf("expected successful deletion via MANAGE_MESSAGES, got: %v", err)
	}

	// Case 4: Non-author deletes message in DM channel (Always Denied)
	dmChannelID := int64(500)
	chanRepo.channels[dmChannelID] = &channels.Channel{ID: dmChannelID, GuildID: nil}
	msgRepo.isDMParticipant = true
	dmMsgID := int64(66)
	msgRepo.messages[dmMsgID] = &Message{ID: dmMsgID, ChannelID: dmChannelID, AuthorID: 1, Content: "DM message"}
	
	err = svc.DeleteMessage(ctx, dmChannelID, dmMsgID, 2)
	if !isForbidden(err) {
		t.Errorf("expected ErrForbidden deleting another user's DM message, got: %v", err)
	}
}

func TestGetMessages(t *testing.T) {
	ctx := context.Background()
	guildID := int64(10)

	msgRepo := &mockMessageRepo{messages: make(map[int64]*Message)}
	chanRepo := &mockChannelRepo{channels: make(map[int64]*channels.Channel)}
	permSvc := &mockPermissionsService{channelPerms: make(map[int64]permissions.Permission)}

	svc := NewService(msgRepo, chanRepo, permSvc, nil)

	channelID := int64(100)
	chanRepo.channels[channelID] = &channels.Channel{
		ID:      channelID,
		GuildID: &guildID,
		Name:    "general",
		Type:    0,
	}

	// 1. Success case: user has VIEW_CHANNEL and READ_MESSAGE_HISTORY permissions
	permSvc.channelPerms[channelID] = permissions.VIEW_CHANNEL | permissions.READ_MESSAGE_HISTORY
	msgRepo.listMessages = []MessageResponse{
		{ID: 101, ChannelID: channelID, Content: "Hello world!"},
		{ID: 102, ChannelID: channelID, Content: "", Deleted: true}, // Tombstone
	}

	res, err := svc.GetMessages(ctx, channelID, 1, 0, 10)
	if err != nil {
		t.Fatalf("expected successful GetMessages, got: %v", err)
	}
	if len(res) != 2 {
		t.Errorf("expected 2 messages, got: %d", len(res))
	}
	if res[0].Content != "Hello world!" {
		t.Errorf("expected msg content, got: %s", res[0].Content)
	}
	if !res[1].Deleted {
		t.Errorf("expected second message to be deleted")
	}

	// 2. Permission Denied case (missing READ_MESSAGE_HISTORY)
	permSvc.channelPerms[channelID] = permissions.VIEW_CHANNEL
	_, err = svc.GetMessages(ctx, channelID, 1, 0, 10)
	if !isForbidden(err) {
		t.Errorf("expected ErrForbidden status 403, got: %v", err)
	}

	// 3. Limit normalization
	permSvc.channelPerms[channelID] = permissions.VIEW_CHANNEL | permissions.READ_MESSAGE_HISTORY
	// Test limit clamp
	_, err = svc.GetMessages(ctx, channelID, 1, 0, -5)
	if err != nil {
		t.Fatalf("expected limit normalization success, got: %v", err)
	}
}
