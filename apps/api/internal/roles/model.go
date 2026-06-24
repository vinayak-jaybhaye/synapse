package roles

type Role struct {
	ID          int64  `json:"id,string"`
	GuildID     int64  `json:"guild_id,string"`
	Name        string `json:"name"`
	Color       *int   `json:"color,omitempty"`
	Position    int    `json:"position"`
	Permissions int64  `json:"permissions,string"`
	IsDefault   bool   `json:"is_default"`
	Version     int    `json:"version"`
}

type CreateRoleRequest struct {
	Name        string `json:"name" binding:"required,min=1,max=64"`
	Color       *int   `json:"color,omitempty"`
	Permissions *int64 `json:"permissions,string,omitempty"`
}

type UpdateRoleRequest struct {
	Name        *string `json:"name,omitempty"`
	Color       *int    `json:"color,omitempty"`
	Permissions *int64  `json:"permissions,string,omitempty"`
	Position    *int    `json:"position,omitempty"`
}
