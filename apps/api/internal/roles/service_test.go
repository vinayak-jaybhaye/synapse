package roles

import (
	"context"
	"testing"
)

type mockRepository struct {
	roles          map[int64]*Role
	memberRoles    map[string][]int64 // key: guildID:userID -> list of role IDs
	guildOwner     int64
	maxPos         int
	getByIDError   error
	listRolesError error
	createError    error
	updateError    error
	deleteError    error
}

func (m *mockRepository) GetByID(ctx context.Context, id int64) (*Role, error) {
	if m.getByIDError != nil {
		return nil, m.getByIDError
	}
	return m.roles[id], nil
}

func (m *mockRepository) ListRoles(ctx context.Context, guildID int64) ([]Role, error) {
	if m.listRolesError != nil {
		return nil, m.listRolesError
	}
	var res []Role
	for _, r := range m.roles {
		if r.GuildID == guildID {
			res = append(res, *r)
		}
	}
	return res, nil
}

func (m *mockRepository) Create(ctx context.Context, role *Role) error {
	if m.createError != nil {
		return m.createError
	}
	m.roles[role.ID] = role
	return nil
}

func (m *mockRepository) Update(ctx context.Context, role *Role) error {
	if m.updateError != nil {
		return m.updateError
	}
	m.roles[role.ID] = role
	return nil
}

func (m *mockRepository) Delete(ctx context.Context, id int64) error {
	if m.deleteError != nil {
		return m.deleteError
	}
	delete(m.roles, id)
	return nil
}

func (m *mockRepository) AddMemberRole(ctx context.Context, guildID, userID, roleID int64) error {
	key := fmtKey(guildID, userID)
	m.memberRoles[key] = append(m.memberRoles[key], roleID)
	return nil
}

func (m *mockRepository) RemoveMemberRole(ctx context.Context, guildID, userID, roleID int64) error {
	key := fmtKey(guildID, userID)
	list := m.memberRoles[key]
	for i, id := range list {
		if id == roleID {
			m.memberRoles[key] = append(list[:i], list[i+1:]...)
			break
		}
	}
	return nil
}

func (m *mockRepository) GetMemberRoles(ctx context.Context, guildID, userID int64) ([]Role, error) {
	key := fmtKey(guildID, userID)
	roleIDs := m.memberRoles[key]
	var res []Role
	for _, id := range roleIDs {
		if r, ok := m.roles[id]; ok {
			res = append(res, *r)
		}
	}
	// Add default @everyone role implicitly
	for _, r := range m.roles {
		if r.GuildID == guildID && r.IsDefault {
			res = append(res, *r)
		}
	}
	return res, nil
}

func (m *mockRepository) GetGuildOwner(ctx context.Context, guildID int64) (int64, error) {
	return m.guildOwner, nil
}

func (m *mockRepository) GetMaxPosition(ctx context.Context, guildID int64) (int, error) {
	return m.maxPos, nil
}

func fmtKey(g, u int64) string {
	return string(rune(g)) + ":" + string(rune(u))
}

func TestAssignRole(t *testing.T) {
	ctx := context.Background()

	// Setup mock data
	mock := &mockRepository{
		roles:       make(map[int64]*Role),
		memberRoles: make(map[string][]int64),
		guildOwner:  999, // Owner ID
	}

	// 1. Create default role
	everyoneRole := &Role{ID: 100, GuildID: 1, Name: "@everyone", Position: 0, Permissions: 0, IsDefault: true}
	mock.roles[everyoneRole.ID] = everyoneRole

	// 2. Create admin role
	adminRole := &Role{ID: 101, GuildID: 1, Name: "Admin", Position: 10, Permissions: 0x10000008} // ADMIN + MANAGE_ROLES
	mock.roles[adminRole.ID] = adminRole

	// 3. Create normal role to assign
	targetRole := &Role{ID: 102, GuildID: 1, Name: "Moderator", Position: 5, Permissions: 0x10000000} // MANAGE_ROLES
	mock.roles[targetRole.ID] = targetRole

	svc := NewService(mock, nil)

	// Case 1: Owner assigns Moderator role (should succeed)
	err := svc.AssignRole(ctx, 1, 888, 102, 999)
	if err != nil {
		t.Fatalf("Expected owner to successfully assign role, got error: %v", err)
	}

	// Case 2: Requester with no roles tries to assign role (should fail with forbidden)
	err = svc.AssignRole(ctx, 1, 888, 102, 777)
	if err == nil {
		t.Fatal("Expected non-permissioned user to fail assigning role, but it succeeded")
	}

	// Case 3: Admin tries to assign Moderator role (Admin position 10 > Mod position 5, should succeed)
	// Bind admin user (user ID 555) to admin role
	mock.memberRoles[fmtKey(1, 555)] = []int64{101}
	err = svc.AssignRole(ctx, 1, 888, 102, 555)
	if err != nil {
		t.Fatalf("Expected Admin to successfully assign Moderator role, got error: %v", err)
	}

	// Case 4: Moderator tries to assign Admin role (Mod position 5 <= Admin position 10, should fail with forbidden)
	// Bind moderator user (user ID 444) to moderator role
	mock.memberRoles[fmtKey(1, 444)] = []int64{102}
	err = svc.AssignRole(ctx, 1, 888, 101, 444)
	if err == nil {
		t.Fatal("Expected Moderator assignment of Admin role to fail hierarchy check, but it succeeded")
	}
}

func TestUnassignRole(t *testing.T) {
	ctx := context.Background()

	// Setup mock data
	mock := &mockRepository{
		roles:       make(map[int64]*Role),
		memberRoles: make(map[string][]int64),
		guildOwner:  999, // Owner ID
	}

	// Create roles
	everyoneRole := &Role{ID: 100, GuildID: 1, Name: "@everyone", Position: 0, Permissions: 0, IsDefault: true}
	mock.roles[everyoneRole.ID] = everyoneRole

	adminRole := &Role{ID: 101, GuildID: 1, Name: "Admin", Position: 10, Permissions: 0x10000008} // ADMIN + MANAGE_ROLES
	mock.roles[adminRole.ID] = adminRole

	targetRole := &Role{ID: 102, GuildID: 1, Name: "Moderator", Position: 5, Permissions: 0x10000000} // MANAGE_ROLES
	mock.roles[targetRole.ID] = targetRole

	svc := NewService(mock, nil)

	// Bind target user (888) to Moderator role
	mock.memberRoles[fmtKey(1, 888)] = []int64{102}

	// Case 1: Try to unassign @everyone default role (should fail)
	err := svc.UnassignRole(ctx, 1, 888, 100, 999)
	if err == nil {
		t.Fatal("Expected unassigning @everyone role to fail, but it succeeded")
	}

	// Case 2: Owner unassigns Moderator role from target user (should succeed)
	err = svc.UnassignRole(ctx, 1, 888, 102, 999)
	if err != nil {
		t.Fatalf("Expected owner to successfully unassign role, got error: %v", err)
	}

	// Re-bind Moderator role to target user (888)
	mock.memberRoles[fmtKey(1, 888)] = []int64{102}

	// Case 3: Requester with no roles tries to unassign (should fail)
	err = svc.UnassignRole(ctx, 1, 888, 102, 777)
	if err == nil {
		t.Fatal("Expected non-permissioned user to fail unassigning role, but it succeeded")
	}

	// Case 4: Admin tries to unassign Moderator role (Admin pos 10 > Mod pos 5, should succeed)
	mock.memberRoles[fmtKey(1, 555)] = []int64{101}
	err = svc.UnassignRole(ctx, 1, 888, 102, 555)
	if err != nil {
		t.Fatalf("Expected Admin to successfully unassign Moderator role, got error: %v", err)
	}

	// Re-bind Moderator role to target user (888)
	mock.memberRoles[fmtKey(1, 888)] = []int64{102}

	// Case 5: Moderator tries to unassign Admin role (Mod pos 5 <= Admin pos 10, should fail)
	mock.memberRoles[fmtKey(1, 444)] = []int64{102}
	err = svc.UnassignRole(ctx, 1, 555, 101, 444)
	if err == nil {
		t.Fatal("Expected Moderator unassignment of Admin role to fail hierarchy check, but it succeeded")
	}
}
