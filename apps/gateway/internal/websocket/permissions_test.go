package websocket

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestResolveChannelAccess_NonMember(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("Failed to open mock db: %s", err)
	}
	defer db.Close()

	// 1. Channel exists, has guild_id = 456
	mock.ExpectQuery("SELECT guild_id FROM channels").
		WithArgs(100).
		WillReturnRows(sqlmock.NewRows([]string{"guild_id"}).AddRow(456))

	// 2. User is NOT a member of guild 456
	mock.ExpectQuery("SELECT EXISTS\\(SELECT 1 FROM guild_members").
		WithArgs(456, 1).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	perm, err := ResolveChannelAccess(context.Background(), db, 1, 100)
	if err != nil {
		t.Fatalf("Unexpected error: %s", err)
	}

	if perm != 0 {
		t.Errorf("Expected 0 permissions for non-member, got %d", perm)
	}
}

func TestResolveChannelAccess_AdministratorBypass(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("Failed to open mock db: %s", err)
	}
	defer db.Close()

	// 1. Guild ID
	mock.ExpectQuery("SELECT guild_id FROM channels").
		WithArgs(100).
		WillReturnRows(sqlmock.NewRows([]string{"guild_id"}).AddRow(456))

	// 2. Member check
	mock.ExpectQuery("SELECT EXISTS\\(SELECT 1 FROM guild_members").
		WithArgs(456, 1).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	// 3. Union query for permissions (returns administrator permission 8)
	mock.ExpectQuery("SELECT permissions FROM roles").
		WithArgs(456, 1).
		WillReturnRows(sqlmock.NewRows([]string{"permissions"}).AddRow(int64(ADMINISTRATOR)))

	// 4. Default role ID
	mock.ExpectQuery("SELECT id FROM roles").
		WithArgs(456).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(10))

	perm, err := ResolveChannelAccess(context.Background(), db, 1, 100)
	if err != nil {
		t.Fatalf("Unexpected error: %s", err)
	}

	if !HasPermission(perm, VIEW_CHANNEL) {
		t.Errorf("Expected administrator to bypass overrides and have VIEW_CHANNEL, got %d", perm)
	}
}

func TestResolveChannelAccess_DenyAllowOrder(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("Failed to open mock db: %s", err)
	}
	defer db.Close()

	// 1. Guild ID
	mock.ExpectQuery("SELECT guild_id FROM channels").
		WithArgs(100).
		WillReturnRows(sqlmock.NewRows([]string{"guild_id"}).AddRow(456))

	// 2. Member check
	mock.ExpectQuery("SELECT EXISTS\\(SELECT 1 FROM guild_members").
		WithArgs(456, 1).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	// 3. Union base roles (base permissions has VIEW_CHANNEL set)
	mock.ExpectQuery("SELECT permissions FROM roles").
		WithArgs(456, 1).
		WillReturnRows(sqlmock.NewRows([]string{"permissions"}).AddRow(int64(VIEW_CHANNEL)))

	// 4. Default role ID
	mock.ExpectQuery("SELECT id FROM roles").
		WithArgs(456).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(10))

	// 5. Member custom roles (user has custom role 20)
	mock.ExpectQuery("SELECT role_id FROM member_roles").
		WithArgs(456, 1).
		WillReturnRows(sqlmock.NewRows([]string{"role_id"}).AddRow(20))

	// 6. Overrides lookup
	// Default role denies VIEW_CHANNEL. Custom role 20 allows VIEW_CHANNEL.
	// Deny-then-allow ordering means custom role allow override should take priority and set it.
	mock.ExpectQuery("SELECT role_id, allow_permissions, deny_permissions FROM channel_role_permissions").
		WithArgs(100).
		WillReturnRows(sqlmock.NewRows([]string{"role_id", "allow_permissions", "deny_permissions"}).
			AddRow(10, 0, int64(VIEW_CHANNEL)).
			AddRow(20, int64(VIEW_CHANNEL), 0))

	perm, err := ResolveChannelAccess(context.Background(), db, 1, 100)
	if err != nil {
		t.Fatalf("Unexpected error: %s", err)
	}

	if !HasPermission(perm, VIEW_CHANNEL) {
		t.Errorf("Expected VIEW_CHANNEL allowed due to deny-then-allow order, got %d", perm)
	}
}

func TestResolveChannelAccessBatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("Failed to open mock db: %s", err)
	}
	defer db.Close()

	// 1. Guild ID
	mock.ExpectQuery("SELECT guild_id FROM channels").
		WithArgs(100).
		WillReturnRows(sqlmock.NewRows([]string{"guild_id"}).AddRow(456))

	// 2. Members check for users [1, 2]
	mock.ExpectQuery("SELECT user_id FROM guild_members").
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow(1).AddRow(2))

	// 3. Default role
	mock.ExpectQuery("SELECT id, permissions FROM roles").
		WithArgs(456).
		WillReturnRows(sqlmock.NewRows([]string{"id", "permissions"}).AddRow(10, int64(VIEW_CHANNEL)))

	// 4. Custom role permissions
	mock.ExpectQuery("SELECT mr.user_id, r.id, r.permissions").
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "role_id", "permissions"}).
			AddRow(1, 20, int64(0)).
			AddRow(2, 30, int64(0)))

	// 5. Channel overrides
	mock.ExpectQuery("SELECT role_id, allow_permissions, deny_permissions FROM channel_role_permissions").
		WithArgs(100).
		WillReturnRows(sqlmock.NewRows([]string{"role_id", "allow_permissions", "deny_permissions"}).
			AddRow(10, 0, 0).
			AddRow(20, 0, int64(VIEW_CHANNEL))) // User 1 custom role denies VIEW_CHANNEL

	// 6. Owner lookup
	mock.ExpectQuery("SELECT owner_id FROM guilds").
		WithArgs(456).
		WillReturnRows(sqlmock.NewRows([]string{"owner_id"}).AddRow(999))

	res, err := ResolveChannelAccessBatch(context.Background(), db, []int64{1, 2}, 100)
	if err != nil {
		t.Fatalf("Unexpected error: %s", err)
	}

	if HasPermission(res[1], VIEW_CHANNEL) {
		t.Errorf("User 1 should be denied VIEW_CHANNEL, got perms %d", res[1])
	}
	if !HasPermission(res[2], VIEW_CHANNEL) {
		t.Errorf("User 2 should retain VIEW_CHANNEL, got perms %d", res[2])
	}
}

func TestHub_HandleChannelPermissionsUpdate_GainingLosing(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("Failed to open mock db: %s", err)
	}
	defer db.Close()

	hub := NewHub(db)

	c1 := &Client{
		hub:        hub,
		userID:     1,
		channelIDs: []int64{100},
		send:       make(chan []byte, 10),
	}
	c2 := &Client{
		hub:        hub,
		userID:     2,
		channelIDs: []int64{},
		send:       make(chan []byte, 10),
	}

	hub.clients[c1] = true
	hub.clients[c2] = true

	hub.guildClients[456] = map[*Client]bool{c1: true, c2: true}
	hub.channelClients[100] = map[*Client]bool{c1: true}

	// 1. Mock queries for ResolveChannelAccessBatch
	// Guild ID
	mock.ExpectQuery("SELECT guild_id FROM channels").
		WithArgs(100).
		WillReturnRows(sqlmock.NewRows([]string{"guild_id"}).AddRow(456))

	// Members check for users [1, 2]
	mock.ExpectQuery("SELECT user_id FROM guild_members").
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow(1).AddRow(2))

	// Default role
	mock.ExpectQuery("SELECT id, permissions FROM roles").
		WithArgs(456).
		WillReturnRows(sqlmock.NewRows([]string{"id", "permissions"}).AddRow(10, int64(VIEW_CHANNEL)))

	// Custom role permissions (user 1 has custom role 20; user 2 has custom role 30)
	mock.ExpectQuery("SELECT mr.user_id, r.id, r.permissions").
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "role_id", "permissions"}).
			AddRow(1, 20, int64(0)).
			AddRow(2, 30, int64(0)))

	// Overrides lookup
	// Default role allows VIEW_CHANNEL. Custom role 20 denies VIEW_CHANNEL.
	mock.ExpectQuery("SELECT role_id, allow_permissions, deny_permissions FROM channel_role_permissions").
		WithArgs(100).
		WillReturnRows(sqlmock.NewRows([]string{"role_id", "allow_permissions", "deny_permissions"}).
			AddRow(10, 0, 0).
			AddRow(20, 0, int64(VIEW_CHANNEL)))

	// Owner lookup
	mock.ExpectQuery("SELECT owner_id FROM guilds").
		WithArgs(456).
		WillReturnRows(sqlmock.NewRows([]string{"owner_id"}).AddRow(999))

	hub.HandleChannelPermissionsUpdate(context.Background(), 456, 100, true)

	// User 1 should have lost access (unsubscribed)
	hub.mu.RLock()
	if hub.channelClients[100][c1] {
		t.Error("Expected c1 to be unsubscribed from channel 100")
	}
	// User 2 should have gained access (subscribed)
	if !hub.channelClients[100][c2] {
		t.Error("Expected c2 to be subscribed to channel 100")
	}
	hub.mu.RUnlock()

	// Assert c1 received CHANNEL_DELETE dispatch notice
	select {
	case msg := <-c1.send:
		if len(msg) == 0 {
			t.Error("Expected lost access dispatch notice")
		}
	default:
		t.Error("No notice was sent to c1")
	}
}

func TestHub_HandleGuildRoleUpdate_GrantsAdminFastPath(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("Failed to open mock db: %s", err)
	}
	defer db.Close()

	hub := NewHub(db)

	c1 := &Client{
		hub:        hub,
		userID:     1,
		channelIDs: []int64{},
		send:       make(chan []byte, 10),
	}
	hub.clients[c1] = true
	hub.guildClients[456] = map[*Client]bool{c1: true}

	// 1. Mock query for role holders
	mock.ExpectQuery("SELECT user_id FROM member_roles").
		WithArgs(456, 20).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow(1))

	// 2. Mock restricted channels
	mock.ExpectQuery("SELECT DISTINCT channel_id FROM channel_role_permissions").
		WithArgs(456).
		WillReturnRows(sqlmock.NewRows([]string{"channel_id"}).AddRow(100))

	// Call HandleGuildRoleUpdate with grantsAdmin = true
	// We expect NO per-channel ResolveChannelAccessBatch query! (If it attempts to run it, sqlmock will fail with "unexpected query").
	hub.HandleGuildRoleUpdate(context.Background(), 456, 20, true)

	hub.mu.RLock()
	if !hub.channelClients[100][c1] {
		t.Error("Expected c1 to be subscribed directly to channel 100 via ADMINISTRATOR fast path")
	}
	hub.mu.RUnlock()
}
