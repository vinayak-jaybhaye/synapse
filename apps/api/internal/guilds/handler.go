package guilds

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/media"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// @Summary CreateGuild
// @Description Create a new guild with default @everyone role and owner member
// @Tags guilds
// @Accept json
// @Produce json
// @Param request body CreateGuildRequest true "Guild Info"
// @Success 201 {object} Guild
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /guilds [post]
func (h *Handler) CreateGuild(c *gin.Context) {
	ownerID := c.GetInt64("user_id")

	var req CreateGuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	g, err := h.svc.CreateGuild(c.Request.Context(), ownerID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, g)
}

// @Summary GetGuild
// @Description Get guild metadata by ID
// @Tags guilds
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Success 200 {object} Guild
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /guilds/{guildID} [get]
func (h *Handler) GetGuild(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	userID := c.GetInt64("user_id")

	g, err := h.svc.GetGuild(c.Request.Context(), guildID, userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, g)
}

// @Summary GetGuildMembers
// @Description List members of the guild using cursor-based pagination
// @Tags guilds
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Param after query string false "User ID cursor for pagination"
// @Param limit query integer false "Max number of items to return"
// @Success 200 {array} MemberWithUser
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Router /guilds/{guildID}/members [get]
func (h *Handler) GetGuildMembers(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	userID := c.GetInt64("user_id")

	// Cursor query binding
	var afterUserID int64 = 0
	afterStr := c.Query("after")
	if afterStr != "" {
		if val, err := strconv.ParseInt(afterStr, 10, 64); err == nil {
			afterUserID = val
		}
	}

	limit := 50
	limitStr := c.Query("limit")
	if limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil {
			limit = val
		}
	}

	members, err := h.svc.GetGuildMembers(c.Request.Context(), guildID, userID, afterUserID, limit)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, members)
}

// @Summary PatchGuildMember
// @Description Update settings of a member in a guild
// @Tags guilds
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Param userID path string true "Member User Snowflake ID"
// @Param request body UpdateMemberRequest true "Update Info"
// @Success 200 {object} GuildMember
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /guilds/{guildID}/members/{userID} [patch]
func (h *Handler) PatchGuildMember(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	targetUserID, err := strconv.ParseInt(c.Param("userID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid user ID"))
		return
	}

	requesterUserID := c.GetInt64("user_id")

	var req UpdateMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	m, err := h.svc.UpdateGuildMember(c.Request.Context(), guildID, targetUserID, requesterUserID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, m)
}

// @Summary Generate Guild Icon Upload URL
// @Description Generates a presigned S3 URL for uploading a guild icon
// @Tags guilds
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Param request body media.UploadRequest true "Upload Info"
// @Success 200 {object} media.UploadResponse
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /guilds/{guildID}/icons/upload-url [post]
func (h *Handler) GenerateIconUploadURL(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	userID := c.GetInt64("user_id")

	var req media.UploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	resp, err := h.svc.GenerateIconUploadURL(c.Request.Context(), guildID, userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// @Summary Generate Guild Banner Upload URL
// @Description Generates a presigned S3 URL for uploading a guild banner
// @Tags guilds
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Param request body media.UploadRequest true "Upload Info"
// @Success 200 {object} media.UploadResponse
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /guilds/{guildID}/banners/upload-url [post]
func (h *Handler) GenerateBannerUploadURL(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	userID := c.GetInt64("user_id")

	var req media.UploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	resp, err := h.svc.GenerateBannerUploadURL(c.Request.Context(), guildID, userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) UpdateGuild(c *gin.Context) {
	userID := c.GetInt64("user_id")
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	var req UpdateGuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body"))
		return
	}
	g, err := h.svc.UpdateGuild(c.Request.Context(), guildID, userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}
	c.JSON(200, g)
}
