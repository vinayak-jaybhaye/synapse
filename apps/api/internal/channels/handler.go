package channels

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/synapse/api/internal/errors"
)

type Handler struct {
	svc Service
}

// NewHandler creates a new instance of Handler for channel-related routes.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// GetChannels handles the HTTP request to retrieve all channels in a guild.
// @Summary GetChannels
// @Description Retrieve list of all channels in a guild
// @Tags channels
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Success 200 {array} Channel
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Router /guilds/{guildID}/channels [get]
func (h *Handler) GetChannels(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	userID := c.GetInt64("user_id")

	chList, err := h.svc.GetChannels(c.Request.Context(), guildID, userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, chList)
}

// CreateChannel handles the HTTP request to create a new channel in a guild.
// @Summary CreateChannel
// @Description Create a new channel in a guild
// @Tags channels
// @Accept json
// @Produce json
// @Param guildID path string true "Guild Snowflake ID"
// @Param request body CreateChannelRequest true "Channel Info"
// @Success 201 {object} Channel
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Router /guilds/{guildID}/channels [post]
func (h *Handler) CreateChannel(c *gin.Context) {
	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	userID := c.GetInt64("user_id")

	var req CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	ch, err := h.svc.CreateChannel(c.Request.Context(), guildID, userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, ch)
}

// UpdateChannel handles the HTTP request to update a channel's settings.
// @Summary UpdateChannel
// @Description Update settings of a channel in a guild
// @Tags channels
// @Accept json
// @Produce json
// @Param channelID path string true "Channel Snowflake ID"
// @Param request body UpdateChannelRequest true "Update Info"
// @Success 200 {object} Channel
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /channels/{channelID} [patch]
func (h *Handler) UpdateChannel(c *gin.Context) {
	channelID, err := strconv.ParseInt(c.Param("channelID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID"))
		return
	}

	userID := c.GetInt64("user_id")

	var req UpdateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	ch, err := h.svc.UpdateChannel(c.Request.Context(), channelID, userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, ch)
}

// DeleteChannel handles the HTTP request to delete a channel.
// @Summary DeleteChannel
// @Description Delete a channel from a guild
// @Tags channels
// @Accept json
// @Produce json
// @Param channelID path string true "Channel Snowflake ID"
// @Success 204 {interface} nil
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /channels/{channelID} [delete]
func (h *Handler) DeleteChannel(c *gin.Context) {
	channelID, err := strconv.ParseInt(c.Param("channelID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID"))
		return
	}

	userID := c.GetInt64("user_id")

	err = h.svc.DeleteChannel(c.Request.Context(), channelID, userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}
