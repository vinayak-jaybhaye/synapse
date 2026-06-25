package media

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

// @Summary Delete Object
// @Description Deletes an object from storage
// @Tags media
// @Accept json
// @Produce json
// @Param request body DeleteRequest true "Delete Info"
// @Success 204
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /media/object [delete]
// @Summary Mark Upload Complete
// @Description Sets a pending upload to UPLOADED status after a successful S3 upload
// @Tags media
// @Param uploadID path string true "Upload ID"
// @Success 204
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /media/uploads/{uploadID}/complete [post]
func (h *Handler) MarkUploadComplete(c *gin.Context) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		errors.HandleError(c, errors.NewUnauthorized("unauthorized"))
		return
	}
	userID, ok := userIDValue.(int64)
	if !ok {
		errors.HandleError(c, errors.NewInternal("invalid user ID type in context"))
		return
	}

	uploadIDStr := c.Param("uploadID")
	uploadID, err := strconv.ParseInt(uploadIDStr, 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid upload id"))
		return
	}

	if _, err := h.svc.MarkUploadComplete(c.Request.Context(), uploadID, userID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

// @Summary Cancel Upload
// @Description Cancels a pending upload and deletes it from storage
// @Tags media
// @Param uploadID path string true "Upload ID"
// @Success 204
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /media/uploads/{uploadID} [delete]
func (h *Handler) CancelUpload(c *gin.Context) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		errors.HandleError(c, errors.NewUnauthorized("unauthorized"))
		return
	}
	userID, ok := userIDValue.(int64)
	if !ok {
		errors.HandleError(c, errors.NewInternal("invalid user ID type in context"))
		return
	}

	uploadIDStr := c.Param("uploadID")
	uploadID, err := strconv.ParseInt(uploadIDStr, 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid upload id"))
		return
	}

	if err := h.svc.CancelUpload(c.Request.Context(), uploadID, userID); err != nil {
		errors.HandleError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}
