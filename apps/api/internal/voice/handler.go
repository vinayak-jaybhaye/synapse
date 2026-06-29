package voice

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/synapse/api/internal/errors"
)

// Handler holds all HTTP handlers for voice operations.
type Handler struct {
	svc      Service
	guildSvc channelGuildResolver
}

// channelGuildResolver is a minimal interface to resolve guildID from channelID.
// Satisfied by the channels.Repository.
type channelGuildResolver interface {
	GetGuildIDForChannel(ctx context.Context, channelID int64) (int64, error)
}

// NewHandler creates a voice HTTP handler.
func NewHandler(svc Service, resolver channelGuildResolver) *Handler {
	return &Handler{svc: svc, guildSvc: resolver}
}

// JOIN / LEAVE

// JoinVoice handles POST /channels/:channelID/voice/join
// @Summary Join Voice Channel
// @Description Connect to a voice channel, returning LiveKit credentials
// @Tags voice
// @Accept json
// @Produce json
// @Param channelID path string true "Channel Snowflake ID"
// @Success 200 {object} JoinVoiceResponse
// @Failure 400 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /channels/{channelID}/voice/join [post]
func (h *Handler) JoinVoice(c *gin.Context) {
	channelID, guildID, userID, ok := h.parseChannelContext(c)
	if !ok {
		return
	}

	resp, err := h.svc.JoinVoiceChannel(c.Request.Context(), guildID, channelID, userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// LeaveVoice handles DELETE /channels/:channelID/voice/leave
// @Summary Leave Voice Channel
// @Description Disconnect from the current voice channel, clearing voice state
// @Tags voice
// @Param channelID path string true "Channel Snowflake ID"
// @Success 204 "No Content"
// @Failure 400 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /channels/{channelID}/voice/leave [delete]
func (h *Handler) LeaveVoice(c *gin.Context) {
	channelID, guildID, userID, ok := h.parseChannelContext(c)
	if !ok {
		return
	}

	if err := h.svc.LeaveVoiceChannel(c.Request.Context(), guildID, channelID, userID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// GetVoiceStates handles GET /channels/:channelID/voice
// @Summary Get Voice States
// @Description List all users currently active in this voice channel
// @Tags voice
// @Accept json
// @Produce json
// @Param channelID path string true "Channel Snowflake ID"
// @Success 200 {array} VoiceState
// @Failure 400 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /channels/{channelID}/voice [get]
func (h *Handler) GetVoiceStates(c *gin.Context) {
	channelID, guildID, _, ok := h.parseChannelContext(c)
	if !ok {
		return
	}

	states, err := h.svc.GetChannelVoiceStates(c.Request.Context(), guildID, channelID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	if states == nil {
		states = []VoiceState{}
	}

	c.JSON(http.StatusOK, states)
}

// MODERATOR ACTIONS 

// ModServerMute handles POST/DELETE /channels/:channelID/voice/members/:targetUserID/mute
// @Summary Moderator Server Mute
// @Description Mute or unmute a target user in a voice channel (requires MUTE_MEMBERS)
// @Tags voice
// @Param channelID path string true "Channel Snowflake ID"
// @Param targetUserID path string true "Target User Snowflake ID"
// @Success 204 "No Content"
// @Failure 400 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /channels/{channelID}/voice/members/{targetUserID}/mute [post]
func (h *Handler) ModServerMute(c *gin.Context) {
	channelID, guildID, actorID, ok := h.parseChannelContext(c)
	if !ok {
		return
	}
	targetID, ok := h.parseTargetUserID(c)
	if !ok {
		return
	}

	muted := c.Request.Method == http.MethodPost
	if err := h.svc.ServerMute(c.Request.Context(), guildID, channelID, actorID, targetID, muted); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// ModServerDeafen handles POST/DELETE /channels/:channelID/voice/members/:targetUserID/deafen
// @Summary Moderator Server Deafen
// @Description Deafen or undeafen a target user in a voice channel (requires DEAFEN_MEMBERS)
// @Tags voice
// @Param channelID path string true "Channel Snowflake ID"
// @Param targetUserID path string true "Target User Snowflake ID"
// @Success 204 "No Content"
// @Failure 400 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /channels/{channelID}/voice/members/{targetUserID}/deafen [post]
func (h *Handler) ModServerDeafen(c *gin.Context) {
	channelID, guildID, actorID, ok := h.parseChannelContext(c)
	if !ok {
		return
	}
	targetID, ok := h.parseTargetUserID(c)
	if !ok {
		return
	}

	deafened := c.Request.Method == http.MethodPost
	if err := h.svc.ServerDeafen(c.Request.Context(), guildID, channelID, actorID, targetID, deafened); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// ModDisconnect handles POST /channels/:channelID/voice/members/:targetUserID/disconnect
// @Summary Moderator Disconnect Member
// @Description Forcefully disconnect a member from the voice channel (requires MOVE_MEMBERS)
// @Tags voice
// @Param channelID path string true "Channel Snowflake ID"
// @Param targetUserID path string true "Target User Snowflake ID"
// @Success 204 "No Content"
// @Failure 400 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /channels/{channelID}/voice/members/{targetUserID}/disconnect [post]
func (h *Handler) ModDisconnect(c *gin.Context) {
	channelID, guildID, actorID, ok := h.parseChannelContext(c)
	if !ok {
		return
	}
	targetID, ok := h.parseTargetUserID(c)
	if !ok {
		return
	}

	if err := h.svc.DisconnectMember(c.Request.Context(), guildID, channelID, actorID, targetID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// LIVEKIT WEBHOOK

// Webhook handles POST /voice/webhook (no auth middleware — signature verified internally)
// @Summary LiveKit Webhook
// @Description Webhook endpoint for LiveKit room/participant events, signature-verified internally
// @Tags voice
// @Accept json
// @Success 200 "OK"
// @Failure 400 {object} errors.APIError
// @Router /voice/webhook [post]
func (h *Handler) Webhook(c *gin.Context) {
	if err := h.svc.HandleWebhook(c.Request); err != nil {
		errors.HandleError(c, err)
		return
	}
	c.Status(http.StatusOK)
}

// HELPERS

// parseChannelContext extracts channelID, guildID (via resolver), and userID.
func (h *Handler) parseChannelContext(c *gin.Context) (channelID, guildID, userID int64, ok bool) {
	channelID, err := strconv.ParseInt(c.Param("channelID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID"))
		return
	}

	userID = c.GetInt64("user_id")

	guildID, err = h.guildSvc.GetGuildIDForChannel(c.Request.Context(), channelID)
	if err != nil {
		errors.HandleError(c, errors.NewNotFound("channel not found"))
		return
	}

	return channelID, guildID, userID, true
}

func (h *Handler) parseTargetUserID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("targetUserID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid target user ID"))
		return 0, false
	}
	return id, true
}
