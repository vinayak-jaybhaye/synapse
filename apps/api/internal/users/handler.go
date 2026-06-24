package users

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/synapse/api/internal/errors"
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
