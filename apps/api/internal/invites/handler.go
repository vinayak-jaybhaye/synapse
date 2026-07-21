package invites

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/synapse/api/internal/errors"
)

type Handler struct {
	svc Service
}

// NewHandler creates a new instance of Handler for invite-related routes.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// CreateInvite handles the HTTP request to create a new invite link for a guild.
// @Summary CreateInvite
// @Description Create a new invite code for a guild
// @Tags invites
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Param request body CreateInviteRequest true "Invite Info"
// @Success 201 {object} Invite
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Router /guilds/{guildID}/invites [post]
func (h *Handler) CreateInvite(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	userID := c.GetInt64("user_id")

	var req CreateInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	invite, err := h.svc.CreateInvite(c.Request.Context(), guildID, userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, invite)
}

// GetInvite handles the HTTP request to retrieve metadata of an invite code.
// @Summary GetInvite
// @Description Get details of a guild invite using its unique code
// @Tags invites
// @Accept json
// @Produce json
// @Param code path string true "Unique Invite Code"
// @Success 200 {object} InviteMetadata
// @Failure 400 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /invites/{code} [get]
func (h *Handler) GetInvite(c *gin.Context) {
	code := c.Param("code")

	meta, err := h.svc.GetInvite(c.Request.Context(), code)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, meta)
}

// JoinGuild handles the HTTP request for a user to join a guild using an invite code.
// @Summary JoinGuild
// @Description Join a guild using a unique invite code
// @Tags invites
// @Accept json
// @Produce json
// @Param code path string true "Unique Invite Code"
// @Success 200 {object} map[string]string "successfully joined guild"
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /invites/{code}/join [post]
func (h *Handler) JoinGuild(c *gin.Context) {
	code := c.Param("code")
	userID := c.GetInt64("user_id")

	err := h.svc.JoinGuild(c.Request.Context(), code, userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "successfully joined guild"})
}

// GetGuildInvites handles the HTTP request to list all invites for a guild.
func (h *Handler) GetGuildInvites(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	userID := c.GetInt64("user_id")

	invites, err := h.svc.GetGuildInvites(c.Request.Context(), guildID, userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, invites)
}

// DeleteInvite handles the HTTP request to delete / revoke an invite code.
func (h *Handler) DeleteInvite(c *gin.Context) {
	code := c.Param("code")
	userID := c.GetInt64("user_id")

	err := h.svc.DeleteInvite(c.Request.Context(), code, userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "invite successfully deleted"})
}
