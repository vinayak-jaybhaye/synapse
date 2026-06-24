package roles

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/synapse/api/internal/errors"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// @Summary GetRoles
// @Description Retrieve list of all roles in a guild
// @Tags roles
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Success 200 {array} Role
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Router /guilds/{guildID}/roles [get]
func (h *Handler) GetRoles(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	userID := c.GetInt64("user_id")

	rlist, err := h.svc.GetRoles(c.Request.Context(), guildID, userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, rlist)
}

// @Summary CreateRole
// @Description Create a new role in a guild
// @Tags roles
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Param request body CreateRoleRequest true "Role Info"
// @Success 201 {object} Role
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Router /guilds/{guildID}/roles [post]
func (h *Handler) CreateRole(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	userID := c.GetInt64("user_id")

	var req CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	rl, err := h.svc.CreateRole(c.Request.Context(), guildID, userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, rl)
}

// @Summary UpdateRole
// @Description Update settings of a role in a guild
// @Tags roles
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Param roleID path string true "Role Snowflake ID"
// @Param request body UpdateRoleRequest true "Update Info"
// @Success 200 {object} Role
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /guilds/{guildID}/roles/{roleID} [patch]
func (h *Handler) UpdateRole(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	roleID, err := strconv.ParseInt(c.Param("roleID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid role ID"))
		return
	}

	userID := c.GetInt64("user_id")

	var req UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	rl, err := h.svc.UpdateRole(c.Request.Context(), guildID, roleID, userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, rl)
}

// @Summary DeleteRole
// @Description Delete a role from a guild
// @Tags roles
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Param roleID path string true "Role Snowflake ID"
// @Success 204 {interface} nil
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /guilds/{guildID}/roles/{roleID} [delete]
func (h *Handler) DeleteRole(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	roleID, err := strconv.ParseInt(c.Param("roleID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid role ID"))
		return
	}

	userID := c.GetInt64("user_id")

	err = h.svc.DeleteRole(c.Request.Context(), guildID, roleID, userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// @Summary PutMemberRole
// @Description Assign a role to a member in a guild
// @Tags roles
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Param userID path string true "Member User Snowflake ID"
// @Param roleID path string true "Role Snowflake ID"
// @Success 204 {interface} nil
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /guilds/{guildID}/members/{userID}/roles/{roleID} [put]
func (h *Handler) PutMemberRole(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	targetUserID, err := strconv.ParseInt(c.Param("userID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid target user ID"))
		return
	}

	roleID, err := strconv.ParseInt(c.Param("roleID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid role ID"))
		return
	}

	requesterUserID := c.GetInt64("user_id")

	err = h.svc.AssignRole(c.Request.Context(), guildID, targetUserID, roleID, requesterUserID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}
