package permissions

// HasPermission checks if a bitmask contains the specified permission.
// Administrator permission automatically overrides and grants all permissions.
func HasPermission(mask Permission, perm Permission) bool {
	if (mask & ADMINISTRATOR) == ADMINISTRATOR {
		return true
	}
	return (mask & perm) == perm
}

// AddPermission adds the specified permission to the mask.
func AddPermission(mask Permission, perm Permission) Permission {
	return mask | perm
}

// RemovePermission removes the specified permission from the mask.
func RemovePermission(mask Permission, perm Permission) Permission {
	return mask & ^perm
}

// ApplyChannelOverrides calculates the new permission mask after applying allow and deny override bitmasks.
// If the base permissions contain the ADMINISTRATOR flag, overrides are bypassed.
func ApplyChannelOverrides(base Permission, allow Permission, deny Permission) Permission {
	if (base & ADMINISTRATOR) == ADMINISTRATOR {
		return base
	}
	return (base & ^deny) | allow
}

// HasAllPermissions checks if a bitmask contains all of the specified permissions.
// Administrator permission automatically grants everything.
func HasAllPermissions(mask Permission, perms ...Permission) bool {
	if (mask & ADMINISTRATOR) == ADMINISTRATOR {
		return true
	}
	for _, perm := range perms {
		if (mask & perm) != perm {
			return false
		}
	}
	return true
}

// HasAnyPermission checks if a bitmask contains any of the specified permissions.
// Administrator permission automatically grants everything.
func HasAnyPermission(mask Permission, perms ...Permission) bool {
	if (mask & ADMINISTRATOR) == ADMINISTRATOR {
		return len(perms) > 0
	}
	for _, perm := range perms {
		if (mask & perm) == perm {
			return true
		}
	}
	return false
}
