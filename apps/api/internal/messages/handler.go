package messages

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/media"
)

type Handler struct {
	svc Service
}

// NewHandler creates a new instance of Handler for message-related routes.
func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// GetMessages handles the HTTP request to retrieve messages in a channel, with pagination support.
// @Summary GetMessages
// @Description Retrieve a list of messages in a channel, paginated using a "before" message ID cursor.
// @Tags messages
// @Accept json
// @Produce json
// @Param channelID path string true "Channel Snowflake ID"
// @Param before query string false "Get messages before this message ID"
// @Param limit query integer false "Max number of messages to return"
// @Success 200 {array} MessageResponse
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Router /channels/{channelID}/messages [get]
func (h *Handler) GetMessages(c *gin.Context) {
	channelID, err := strconv.ParseInt(c.Param("channelID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID"))
		return
	}

	userID := c.GetInt64("user_id")

	// Cursor parameters query binding
	var beforeID int64 = 0
	beforeStr := c.Query("before")
	if beforeStr != "" {
		if val, err := strconv.ParseInt(beforeStr, 10, 64); err == nil {
			beforeID = val
		}
	}

	limit := 50
	limitStr := c.Query("limit")
	if limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil {
			limit = val
		}
	}

	messages, err := h.svc.GetMessages(c.Request.Context(), channelID, userID, beforeID, limit)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, messages)
}

// SendMessage handles the HTTP request to send a message to a channel.
// @Summary SendMessage
// @Description Send a new message to a channel
// @Tags messages
// @Accept json
// @Produce json
// @Param channelID path string true "Channel Snowflake ID"
// @Param request body CreateMessageRequest true "Message Content"
// @Success 201 {object} MessageResponse
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Router /channels/{channelID}/messages [post]
func (h *Handler) SendMessage(c *gin.Context) {
	channelID, err := strconv.ParseInt(c.Param("channelID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID"))
		return
	}

	userID := c.GetInt64("user_id")

	var req CreateMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Println("DEBUG SendMessage ShouldBindJSON error:", err)
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	msg, err := h.svc.SendMessage(c.Request.Context(), channelID, userID, &req)
	if err != nil {
		log.Println("DEBUG SendMessage service error:", err)
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, msg)
}

// EditMessage handles the HTTP request to edit an existing message.
// @Summary EditMessage
// @Description Edit the content of an existing message
// @Tags messages
// @Accept json
// @Produce json
// @Param channelID path string true "Channel Snowflake ID"
// @Param messageID path string true "Message Snowflake ID"
// @Param request body UpdateMessageRequest true "Updated Message Content"
// @Success 200 {object} MessageResponse
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /channels/{channelID}/messages/{messageID} [patch]
func (h *Handler) EditMessage(c *gin.Context) {
	channelID, err := strconv.ParseInt(c.Param("channelID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID"))
		return
	}

	messageID, err := strconv.ParseInt(c.Param("messageID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid message ID"))
		return
	}

	userID := c.GetInt64("user_id")

	var req UpdateMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	msg, err := h.svc.EditMessage(c.Request.Context(), channelID, messageID, userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, msg)
}

// DeleteMessage handles the HTTP request to delete a message.
// @Summary DeleteMessage
// @Description Delete a message from a channel
// @Tags messages
// @Accept json
// @Produce json
// @Param channelID path string true "Channel Snowflake ID"
// @Param messageID path string true "Message Snowflake ID"
// @Success 204 {interface} nil
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /channels/{channelID}/messages/{messageID} [delete]
func (h *Handler) DeleteMessage(c *gin.Context) {
	channelID, err := strconv.ParseInt(c.Param("channelID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID"))
		return
	}

	messageID, err := strconv.ParseInt(c.Param("messageID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid message ID"))
		return
	}

	userID := c.GetInt64("user_id")

	err = h.svc.DeleteMessage(c.Request.Context(), channelID, messageID, userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// SyncReadState handles the HTTP request to update the user's read state/read marker for a channel.
// @Summary SyncReadState
// @Description Sync the read state for a channel up to a specific message ID
// @Tags messages
// @Accept json
// @Produce json
// @Param channelID path string true "Channel Snowflake ID"
// @Param request body ReadMarkerRequest true "Read Marker Info"
// @Success 204 {interface} nil
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Router /channels/{channelID}/ack [post]
func (h *Handler) SyncReadState(c *gin.Context) {
	channelID, err := strconv.ParseInt(c.Param("channelID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID"))
		return
	}

	userID := c.GetInt64("user_id")

	var req ReadMarkerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	err = h.svc.SyncReadState(c.Request.Context(), channelID, userID, req.LastReadMessageID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// PutReaction handles the HTTP request to add an emoji reaction to a message.
// @Summary PutReaction
// @Description Add a reaction to a message
// @Tags messages
// @Accept json
// @Produce json
// @Param channelID path string true "Channel Snowflake ID"
// @Param messageID path string true "Message Snowflake ID"
// @Param emoji path string true "UTF-8 Emoji Character"
// @Success 204 {interface} nil
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /channels/{channelID}/messages/{messageID}/reactions/{emoji} [put]
func (h *Handler) PutReaction(c *gin.Context) {
	channelID, err := strconv.ParseInt(c.Param("channelID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID"))
		return
	}

	messageID, err := strconv.ParseInt(c.Param("messageID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid message ID"))
		return
	}

	userID := c.GetInt64("user_id")
	emoji := c.Param("emoji")

	err = h.svc.AddMessageReaction(c.Request.Context(), channelID, messageID, userID, emoji)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// DeleteReaction handles the HTTP request to remove an emoji reaction from a message.
// @Summary DeleteReaction
// @Description Remove a reaction from a message
// @Tags messages
// @Accept json
// @Produce json
// @Param channelID path string true "Channel Snowflake ID"
// @Param messageID path string true "Message Snowflake ID"
// @Param emoji path string true "UTF-8 Emoji Character"
// @Success 204 {interface} nil
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Router /channels/{channelID}/messages/{messageID}/reactions/{emoji} [delete]
func (h *Handler) DeleteReaction(c *gin.Context) {
	channelID, err := strconv.ParseInt(c.Param("channelID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID"))
		return
	}

	messageID, err := strconv.ParseInt(c.Param("messageID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid message ID"))
		return
	}

	userID := c.GetInt64("user_id")
	emoji := c.Param("emoji")

	err = h.svc.RemoveMessageReaction(c.Request.Context(), channelID, messageID, userID, emoji)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// GenerateAttachmentUploadURL handles generating a presigned URL for a message attachment.
// @Summary Generate Attachment Upload URL
// @Description Generates a presigned S3 URL for uploading an attachment directly from the client
// @Tags messages
// @Accept json
// @Produce json
// @Param channelID path string true "Channel Snowflake ID"
// @Param request body media.UploadRequest true "Upload Info"
// @Success 200 {object} media.UploadResponse
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /channels/{channelID}/attachments/upload-url [post]
func (h *Handler) GenerateAttachmentUploadURL(c *gin.Context) {
	channelID, err := strconv.ParseInt(c.Param("channelID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID"))
		return
	}

	userID := c.GetInt64("user_id")

	var req media.UploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	resp, err := h.svc.GenerateAttachmentUploadURL(c.Request.Context(), channelID, userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// DownloadAttachment handles generating a presigned URL for a message attachment and redirects the client to it.
// @Summary Download Attachment
// @Description Generates a short-lived presigned S3 URL for an attachment and redirects the client via 302
// @Tags messages
// @Param channelID path string true "Channel Snowflake ID"
// @Param attachmentID path string true "Attachment Snowflake ID"
// @Param token query string false "JWT Auth Token (fallback for query-based auth)"
// @Success 302 {string} string "Redirects to AWS S3 presigned URL"
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 403 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /channels/{channelID}/attachments/{attachmentID} [get]
func (h *Handler) DownloadAttachment(c *gin.Context) {
	channelIDStr := c.Param("channelID")
	channelID, err := strconv.ParseInt(channelIDStr, 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid channel ID format"))
		return
	}

	attachmentIDStr := c.Param("attachmentID")
	attachmentID, err := strconv.ParseInt(attachmentIDStr, 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid attachment ID format"))
		return
	}

	userID := c.GetInt64("user_id")

	downloadURL, err := h.svc.GetAttachmentDownloadURL(c.Request.Context(), channelID, attachmentID, userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, downloadURL)
}
