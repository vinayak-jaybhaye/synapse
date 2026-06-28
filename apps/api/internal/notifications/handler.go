package notifications

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

func (h *Handler) GetUserSettings(c *gin.Context) {
	userID := c.GetInt64("user_id")

	settings, err := h.svc.GetUserSettings(c.Request.Context(), userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, settings)
}

func (h *Handler) PutGlobalSettings(c *gin.Context) {
	userID := c.GetInt64("user_id")

	var req PutNotificationSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	settings, err := h.svc.PutSettings(c.Request.Context(), userID, nil, nil, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, settings)
}

func (h *Handler) PutGuildSettings(c *gin.Context) {
	userID := c.GetInt64("user_id")

	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	var req PutNotificationSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	settings, err := h.svc.PutSettings(c.Request.Context(), userID, &guildID, nil, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, settings)
}

func (h *Handler) PutChannelSettings(c *gin.Context) {
	userID := c.GetInt64("user_id")

	channelID, err := strconv.ParseInt(c.Param("channelID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID"))
		return
	}

	var req PutNotificationSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	settings, err := h.svc.PutSettings(c.Request.Context(), userID, nil, &channelID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, settings)
}
