package audit

import (
	"context"
	"testing"

	"github.com/synapse/api/internal/permissions"
)

type mockAuditRepo struct {
	entries []AuditLogEntry
}

func (m *mockAuditRepo) Create(ctx context.Context, entry *AuditLogEntry) error {
	m.entries = append(m.entries, *entry)
	return nil
}

func (m *mockAuditRepo) ListGuildLogs(ctx context.Context, guildID int64, filter AuditLogFilter) ([]AuditLogEntry, error) {
	var result []AuditLogEntry
	for _, e := range m.entries {
		if e.GuildID != guildID {
			continue
		}
		if filter.BeforeID != nil && e.ID >= *filter.BeforeID {
			continue
		}
		if filter.Action != nil && e.Action != *filter.Action {
			continue
		}
		if filter.ActorID != nil && (e.ActorID == nil || *e.ActorID != *filter.ActorID) {
			continue
		}
		if filter.TargetType != nil && e.TargetType != *filter.TargetType {
			continue
		}
		if filter.TargetID != nil && (e.TargetID == nil || *e.TargetID != *filter.TargetID) {
			continue
		}
		result = append(result, e)
	}
	return result, nil
}

type mockPermService struct {
	permissions.Service
	allowed bool
}

func (m *mockPermService) HasGuildPermission(ctx context.Context, guildID, userID int64, perm permissions.Permission) (bool, error) {
	return m.allowed, nil
}

func TestChangesBuilder(t *testing.T) {
	builder := NewChanges()
	builder.Add("name", "general", "announcements")
	builder.Add("topic", "Old Topic", "Old Topic") // Should be ignored as unchanged
	builder.Add("position", 1, 2)

	changes := builder.Build()
	if len(changes) != 2 {
		t.Fatalf("expected 2 changed fields, got %d", len(changes))
	}
	if changes["name"].Old != "general" || changes["name"].New != "announcements" {
		t.Errorf("unexpected name diff: %+v", changes["name"])
	}
	if _, exists := changes["topic"]; exists {
		t.Errorf("expected unchanged topic field to be omitted")
	}

	emptyBuilder := NewChanges()
	emptyBuilder.Add("name", "same", "same")
	if emptyBuilder.Build() != nil {
		t.Errorf("expected Build() on unchanged fields to return nil")
	}
}

func TestAuditServiceLogging(t *testing.T) {
	repo := &mockAuditRepo{}
	permSvc := &mockPermService{allowed: true}
	svc := NewService(repo, nil, permSvc)

	ctx := context.Background()
	guildID := int64(1001)
	actorID := int64(2001)
	channelID := int64(3001)

	changes := NewChanges().Add("name", "old-name", "new-name").Build()

	err := svc.NewEntry().
		Guild(guildID).
		ActorUser(actorID, "alice", "Alice W.", "avatars/alice.jpg").
		Action(ActionChannelUpdate).
		TargetResource(TargetChannel, &channelID, "#new-name").
		Reason("Renaming channel").
		Changes(changes).
		Log(ctx)

	if err != nil {
		t.Fatalf("unexpected log error: %v", err)
	}

	if len(repo.entries) != 1 {
		t.Fatalf("expected 1 entry logged, got %d", len(repo.entries))
	}

	entry := repo.entries[0]
	if entry.GuildID != guildID {
		t.Errorf("expected GuildID %d, got %d", guildID, entry.GuildID)
	}
	if entry.ActorUsername != "alice" {
		t.Errorf("expected ActorUsername alice, got %s", entry.ActorUsername)
	}
	if entry.TargetDisplay != "#new-name" {
		t.Errorf("expected TargetDisplay #new-name, got %s", entry.TargetDisplay)
	}
	if entry.Reason == nil || *entry.Reason != "Renaming channel" {
		t.Errorf("expected reason Renaming channel, got %v", entry.Reason)
	}

	// Test Listing & Permission Checks
	logs, err := svc.ListGuildLogs(ctx, guildID, actorID, AuditLogFilter{Limit: 10})
	if err != nil {
		t.Fatalf("failed to list audit logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected 1 audit log response, got %d", len(logs))
	}
	if logs[0].Action != "CHANNEL_UPDATE" {
		t.Errorf("expected Action CHANNEL_UPDATE, got %s", logs[0].Action)
	}

	// Permission Denial Test
	deniedSvc := NewService(repo, nil, &mockPermService{allowed: false})
	_, err = deniedSvc.ListGuildLogs(ctx, guildID, actorID, AuditLogFilter{})
	if err == nil {
		t.Errorf("expected forbidden error when user lacks VIEW_AUDIT_LOG permission")
	}
}

func TestAuditLogFilters(t *testing.T) {
	repo := &mockAuditRepo{}
	permSvc := &mockPermService{allowed: true}
	svc := NewService(repo, nil, permSvc)
	ctx := context.Background()

	actor1 := int64(101)
	actor2 := int64(102)
	target1 := int64(201)
	target2 := int64(202)

	e1 := AuditLogEntry{ID: 100, GuildID: 1, ActorID: &actor1, Action: ActionChannelCreate, TargetType: TargetChannel, TargetID: &target1}
	e2 := AuditLogEntry{ID: 101, GuildID: 1, ActorID: &actor1, Action: ActionChannelDelete, TargetType: TargetChannel, TargetID: &target1}
	e3 := AuditLogEntry{ID: 102, GuildID: 1, ActorID: &actor2, Action: ActionMemberBan, TargetType: TargetUser, TargetID: &target2}

	_ = repo.Create(ctx, &e1)
	_ = repo.Create(ctx, &e2)
	_ = repo.Create(ctx, &e3)

	// 1. Filter by Action: ActionMemberBan
	banAction := ActionMemberBan
	logs, err := svc.ListGuildLogs(ctx, 1, actor1, AuditLogFilter{Action: &banAction})
	if err != nil || len(logs) != 1 || logs[0].ID != 102 {
		t.Fatalf("filter by action failed: expected entry 102, got %v", logs)
	}

	// 2. Filter by ActorID: actor1
	logs, err = svc.ListGuildLogs(ctx, 1, actor1, AuditLogFilter{ActorID: &actor1})
	if err != nil || len(logs) != 2 {
		t.Fatalf("filter by actorID failed: expected 2 entries, got %d", len(logs))
	}

	// 3. Filter by TargetType: TargetUser
	userTarget := TargetUser
	logs, err = svc.ListGuildLogs(ctx, 1, actor1, AuditLogFilter{TargetType: &userTarget})
	if err != nil || len(logs) != 1 || logs[0].ID != 102 {
		t.Fatalf("filter by targetType failed: expected entry 102, got %v", logs)
	}

	// 4. Filter by BeforeID cursor pagination
	beforeID := int64(102)
	logs, err = svc.ListGuildLogs(ctx, 1, actor1, AuditLogFilter{BeforeID: &beforeID})
	if err != nil || len(logs) != 2 {
		t.Fatalf("filter by beforeID failed: expected 2 entries, got %d", len(logs))
	}
}
