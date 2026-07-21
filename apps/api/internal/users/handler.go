package users

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

// @BasePath /api/v1
// @Summary GetMe
// @Description GetMe
// @Tags users
// @Accept json
// @Produce json
// @Success 200 {object} User
// @Failure 401 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /users/@me [get]
func (h *Handler) GetMe(c *gin.Context) {
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

	user, err := h.svc.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, user)
}

// @Summary GetMeGuilds
// @Description Get current user's guild memberships
// @Tags users
// @Accept json
// @Produce json
// @Success 200 {array} UserGuildDTO
// @Failure 401 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /users/@me/guilds [get]
func (h *Handler) GetMeGuilds(c *gin.Context) {
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

	guilds, err := h.svc.GetUserGuilds(c.Request.Context(), userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, guilds)
}

// @Summary GetDMs
// @Description Get direct message channels for the current user
// @Tags users
// @Produce json
// @Success 200 {array} DMChannelResponse
// @Failure 401 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /users/@me/dms [get]
func (h *Handler) GetDMs(c *gin.Context) {
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

	dms, err := h.svc.GetDMs(c.Request.Context(), userID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, dms)
}

// @Summary CreateDM
// @Description Create or retrieve a direct message conversation
// @Tags users
// @Accept json
// @Produce json
// @Param request body CreateDMRequest true "DM Recipient ID"
// @Success 201 {object} DMChannelResponse
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /dms [post]
func (h *Handler) CreateDM(c *gin.Context) {
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

	var req CreateDMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	resp, err := h.svc.CreateDM(c.Request.Context(), userID, req.RecipientID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// @Summary GetProfile
// @Description Get user profile details
// @Tags users
// @Accept json
// @Produce json
// @Param userId path string true "User ID"
// @Success 200 {object} UserProfile
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 404 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /users/{userId}/profile [get]
func (h *Handler) GetProfile(c *gin.Context) {
	requesterIDValue, exists := c.Get("user_id")
	if !exists {
		errors.HandleError(c, errors.NewUnauthorized("unauthorized"))
		return
	}

	requesterID, ok := requesterIDValue.(int64)
	if !ok {
		errors.HandleError(c, errors.NewInternal("invalid user ID type in context"))
		return
	}

	targetIDStr := c.Param("userId")
	targetID, err := strconv.ParseInt(targetIDStr, 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid user id"))
		return
	}

	profile, err := h.svc.GetUserProfile(c.Request.Context(), requesterID, targetID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, profile)
}

// @Summary Generate Avatar Upload URL
// @Description Generates a presigned S3 URL for uploading an avatar
// @Tags users
// @Accept json
// @Produce json
// @Param request body media.UploadRequest true "Upload Info"
// @Success 200 {object} media.UploadResponse
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /users/@me/avatars/upload-url [post]
func (h *Handler) GenerateAvatarUploadURL(c *gin.Context) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		errors.HandleError(c, errors.NewUnauthorized("unauthorized"))
		return
	}
	userID := userIDValue.(int64)

	var req media.UploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	resp, err := h.svc.GenerateAvatarUploadURL(c.Request.Context(), userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// @Summary Generate Banner Upload URL
// @Description Generates a presigned S3 URL for uploading a user banner
// @Tags users
// @Accept json
// @Produce json
// @Param request body media.UploadRequest true "Upload Info"
// @Success 200 {object} media.UploadResponse
// @Failure 400 {object} errors.APIError
// @Failure 401 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /users/@me/banners/upload-url [post]
func (h *Handler) GenerateBannerUploadURL(c *gin.Context) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		errors.HandleError(c, errors.NewUnauthorized("unauthorized"))
		return
	}
	userID := userIDValue.(int64)

	var req media.UploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body: "+err.Error()))
		return
	}

	resp, err := h.svc.GenerateBannerUploadURL(c.Request.Context(), userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	userID := c.GetInt64("user_id")
	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid request body"))
		return
	}
	u, err := h.svc.UpdateProfile(c.Request.Context(), userID, &req)
	if err != nil {
		errors.HandleError(c, err)
		return
	}
	c.JSON(200, u)
}

// @Description Search users by username or ID
// @Tags users
// @Accept json
// @Produce json
// @Param q query string true "Search query"
// @Success 200 {array} UserSummary
// @Failure 401 {object} errors.APIError
// @Failure 500 {object} errors.APIError
// @Router /users/search [get]
func (h *Handler) SearchUsers(c *gin.Context) {
	query := c.Query("q")

	users, err := h.svc.SearchUsers(c.Request.Context(), query)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, users)
}
