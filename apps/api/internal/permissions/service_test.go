package permissions

import (
	"context"
	"errors"
	"testing"
)

// mockRoleRepo mocks RoleRepository.
type mockRoleRepo struct {
	members     map[int64]bool
	memberRoles map[int64][]Role
	owners      map[int64]int64
}

func (m *mockRoleRepo) GetMemberRoles(ctx context.Context, guildID int64, userID int64) ([]Role, error) {
	return m.memberRoles[userID], nil
}

func (m *mockRoleRepo) IsMember(ctx context.Context, guildID int64, userID int64) (bool, error) {
	return m.members[userID], nil
}

func (m *mockRoleRepo) GetGuildOwner(ctx context.Context, guildID int64) (int64, error) {
	if m.owners == nil {
		return 0, nil
	}
	return m.owners[guildID], nil
}

// mockChannelRepo mocks ChannelPermissionRepository.
type mockChannelRepo struct {
	guilds    map[int64]int64
	overrides map[int64][]ChannelRolePermission
}

func (m *mockChannelRepo) GetRoleOverrides(ctx context.Context, channelID int64) ([]ChannelRolePermission, error) {
	return m.overrides[channelID], nil
}

func (m *mockChannelRepo) GetChannelGuildID(ctx context.Context, channelID int64) (int64, error) {
	gID, ok := m.guilds[channelID]
	if !ok {
		return 0, ErrChannelNotFound
	}
	return gID, nil
}

func TestPermissionUtilities(t *testing.T) {
	// AddPermission
	mask := Permission(0)
	mask = AddPermission(mask, VIEW_CHANNEL)
	if !HasPermission(mask, VIEW_CHANNEL) {
		t.Error("expected mask to have VIEW_CHANNEL")
	}

	// RemovePermission
	mask = RemovePermission(mask, VIEW_CHANNEL)
	if HasPermission(mask, VIEW_CHANNEL) {
		t.Error("expected mask to not have VIEW_CHANNEL")
	}

	// ADMINISTRATOR automatically grants all
	adminMask := Permission(ADMINISTRATOR)
	if !HasPermission(adminMask, BAN_MEMBERS) {
		t.Error("expected ADMINISTRATOR to automatically grant BAN_MEMBERS")
	}

	// ApplyChannelOverrides - simple allow and deny
	base := VIEW_CHANNEL | SEND_MESSAGES
	// Deny SEND_MESSAGES (1 << 11), Allow ADD_REACTIONS (1 << 6)
	overridden := ApplyChannelOverrides(base, ADD_REACTIONS, SEND_MESSAGES)
	if !HasPermission(overridden, VIEW_CHANNEL) {
		t.Error("expected VIEW_CHANNEL to persist")
	}
	if HasPermission(overridden, SEND_MESSAGES) {
		t.Error("expected SEND_MESSAGES to be denied")
	}
	if !HasPermission(overridden, ADD_REACTIONS) {
		t.Error("expected ADD_REACTIONS to be allowed")
	}

	// ApplyChannelOverrides - administrator bypass
	adminBase := ADMINISTRATOR | VIEW_CHANNEL
	overriddenAdmin := ApplyChannelOverrides(adminBase, 0, VIEW_CHANNEL)
	if !HasPermission(overriddenAdmin, VIEW_CHANNEL) {
		t.Error("expected administrator bypass to prevent VIEW_CHANNEL from being denied")
	}
}

func TestPermissionNames(t *testing.T) {
	name := PermissionName(ADMINISTRATOR)
	if name != "ADMINISTRATOR" {
		t.Errorf("expected string to be ADMINISTRATOR, got %s", name)
	}

	unknown := PermissionName(Permission(1 << 62))
	if unknown != "UNKNOWN" {
		t.Errorf("expected unknown permission to return UNKNOWN, got %s", unknown)
	}

	strings := PermissionsToStrings(VIEW_CHANNEL | SEND_MESSAGES)
	if len(strings) != 2 {
		t.Errorf("expected 2 permission names, got %d", len(strings))
	}

	// Administrator string conversion returns all permission names
	adminStrings := PermissionsToStrings(ADMINISTRATOR)
	if len(adminStrings) != len(allPermissions) {
		t.Errorf("expected administrator strings to contain all %d permissions, got %d", len(allPermissions), len(adminStrings))
	}
}

func TestResolveGuildPermissions(t *testing.T) {
	roleRepo := &mockRoleRepo{
		members: map[int64]bool{
			1: true, // exists
		},
		memberRoles: map[int64][]Role{
			1: {
				{ID: 101, Permissions: VIEW_CHANNEL, IsDefault: true},
				{ID: 102, Permissions: SEND_MESSAGES, IsDefault: false},
			},
		},
	}
	channelRepo := &mockChannelRepo{}
	svc := NewService(roleRepo, channelRepo)

	ctx := context.Background()

	// Aggregated permissions (multiple roles)
	mask, err := svc.ResolveGuildPermissions(ctx, 1, 1)
	if err != nil {
		t.Fatalf("unexpected error resolving guild permissions: %v", err)
	}
	if !HasPermission(mask, VIEW_CHANNEL) || !HasPermission(mask, SEND_MESSAGES) {
		t.Error("expected both roles permissions to be aggregated")
	}

	// ADMINISTRATOR override
	roleRepo.memberRoles[1] = []Role{
		{ID: 101, Permissions: ADMINISTRATOR, IsDefault: true},
	}
	mask, err = svc.ResolveGuildPermissions(ctx, 1, 1)
	if err != nil {
		t.Fatalf("unexpected error resolving admin permissions: %v", err)
	}
	if !HasPermission(mask, KICK_MEMBERS) {
		t.Error("expected administrator role to grant all permissions")
	}

	// Missing member
	_, err = svc.ResolveGuildPermissions(ctx, 1, 99)
	if !errors.Is(err, ErrMemberNotFound) {
		t.Errorf("expected ErrMemberNotFound, got %v", err)
	}

	// Owner bypass test
	roleRepo.owners = map[int64]int64{
		1: 999, // user 999 is the owner of guild 1
	}
	ownerMask, err := svc.ResolveGuildPermissions(ctx, 1, 999)
	if err != nil {
		t.Fatalf("unexpected error resolving owner permissions: %v", err)
	}
	if !HasPermission(ownerMask, KICK_MEMBERS) || !HasPermission(ownerMask, SEND_MESSAGES) {
		t.Error("expected owner to bypass and have all permissions")
	}
}

func TestResolveChannelPermissions(t *testing.T) {
	ctx := context.Background()

	roleRepo := &mockRoleRepo{
		members: map[int64]bool{
			1: true, // member exists
		},
		memberRoles: map[int64][]Role{
			1: {
				{ID: 101, Permissions: VIEW_CHANNEL | SEND_MESSAGES, IsDefault: true}, // everyone
				{ID: 102, Permissions: CONNECT | SPEAK, IsDefault: false},             // member specific role
			},
		},
	}

	channelRepo := &mockChannelRepo{
		guilds: map[int64]int64{
			200: 10, // channel 200 belongs to guild 10
		},
		overrides: map[int64][]ChannelRolePermission{
			200: {
				// @everyone role gets SEND_MESSAGES denied
				{ChannelID: 200, RoleID: 101, AllowPermissions: 0, DenyPermissions: SEND_MESSAGES},
				// Specific role gets MUTE_MEMBERS allowed
				{ChannelID: 200, RoleID: 102, AllowPermissions: MUTE_MEMBERS, DenyPermissions: 0},
			},
		},
	}

	svc := NewService(roleRepo, channelRepo)

	// Resolve channel permissions successfully
	mask, err := svc.ResolveChannelPermissions(ctx, 10, 200, 1)
	if err != nil {
		t.Fatalf("unexpected error resolving channel permissions: %v", err)
	}

	// VIEW_CHANNEL is allowed via everyone base
	if !HasPermission(mask, VIEW_CHANNEL) {
		t.Error("expected VIEW_CHANNEL to be allowed")
	}
	// SEND_MESSAGES is denied via everyone override
	if HasPermission(mask, SEND_MESSAGES) {
		t.Error("expected SEND_MESSAGES to be denied")
	}
	// CONNECT and SPEAK allowed via role base
	if !HasPermission(mask, CONNECT) || !HasPermission(mask, SPEAK) {
		t.Error("expected CONNECT and SPEAK to be allowed")
	}
	// MUTE_MEMBERS allowed via role-specific override
	if !HasPermission(mask, MUTE_MEMBERS) {
		t.Error("expected MUTE_MEMBERS to be allowed via override")
	}

	// Missing channel
	_, err = svc.ResolveChannelPermissions(ctx, 10, 999, 1)
	if !errors.Is(err, ErrChannelNotFound) {
		t.Errorf("expected ErrChannelNotFound, got %v", err)
	}

	// Wrong guild ID mismatch
	_, err = svc.ResolveChannelPermissions(ctx, 999, 200, 1)
	if !errors.Is(err, ErrChannelNotFound) {
		t.Errorf("expected ErrChannelNotFound on guild ID mismatch, got %v", err)
	}

	// Missing member
	_, err = svc.ResolveChannelPermissions(ctx, 10, 200, 999)
	if !errors.Is(err, ErrMemberNotFound) {
		t.Errorf("expected ErrMemberNotFound, got %v", err)
	}

	// Administrator override bypasses channel overrides
	roleRepo.memberRoles[1] = []Role{
		{ID: 101, Permissions: ADMINISTRATOR, IsDefault: true},
	}
	adminMask, err := svc.ResolveChannelPermissions(ctx, 10, 200, 1)
	if err != nil {
		t.Fatalf("unexpected error resolving channel perms: %v", err)
	}
	// Administrator bypasses SEND_MESSAGES deny override
	if !HasPermission(adminMask, SEND_MESSAGES) {
		t.Error("expected ADMINISTRATOR to bypass channel denies")
	}

	// Owner bypasses channel overrides
	roleRepo.owners = map[int64]int64{
		10: 999, // user 999 is owner of guild 10
	}
	ownerChannelMask, err := svc.ResolveChannelPermissions(ctx, 10, 200, 999)
	if err != nil {
		t.Fatalf("unexpected error resolving owner channel permissions: %v", err)
	}
	if !HasPermission(ownerChannelMask, SEND_MESSAGES) {
		t.Error("expected owner to bypass channel overrides and have SEND_MESSAGES")
	}
}

func TestHasGuildAndChannelPermission(t *testing.T) {
	ctx := context.Background()

	roleRepo := &mockRoleRepo{
		members: map[int64]bool{
			1: true,
		},
		memberRoles: map[int64][]Role{
			1: {
				{ID: 101, Permissions: VIEW_CHANNEL | SEND_MESSAGES, IsDefault: true},
			},
		},
	}

	channelRepo := &mockChannelRepo{
		guilds: map[int64]int64{
			200: 10,
		},
		overrides: map[int64][]ChannelRolePermission{
			200: {
				{ChannelID: 200, RoleID: 101, AllowPermissions: 0, DenyPermissions: SEND_MESSAGES},
			},
		},
	}

	svc := NewService(roleRepo, channelRepo)

	// HasGuildPermission checks
	has, err := svc.HasGuildPermission(ctx, 10, 1, VIEW_CHANNEL)
	if err != nil || !has {
		t.Errorf("expected HasGuildPermission true, got %v, err=%v", has, err)
	}

	has, err = svc.HasGuildPermission(ctx, 10, 1, KICK_MEMBERS)
	if err != nil || has {
		t.Errorf("expected HasGuildPermission false, got %v, err=%v", has, err)
	}

	// HasChannelPermission checks
	has, err = svc.HasChannelPermission(ctx, 10, 200, 1, VIEW_CHANNEL)
	if err != nil || !has {
		t.Errorf("expected HasChannelPermission true, got %v, err=%v", has, err)
	}

	has, err = svc.HasChannelPermission(ctx, 10, 200, 1, SEND_MESSAGES)
	if err != nil || has {
		t.Errorf("expected HasChannelPermission false, got %v, err=%v", has, err)
	}
}
