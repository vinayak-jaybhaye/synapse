package auth

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/synapse/api/internal/config"
	apierrors "github.com/synapse/api/internal/errors"
)

type AuthHandler struct {
	svc     AuthService
	sessSvc SessionService
	cfg     *config.Config
}

func NewAuthHandler(svc AuthService, sessSvc SessionService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		svc:     svc,
		sessSvc: sessSvc,
		cfg:     cfg,
	}
}

// @Summary Register
// @Description Register a new user account with session cookies
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "Registration Info"
// @Success 201 {object} AuthResponse
// @Failure 400 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	ipAddress := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	resp, rawToken, err := h.sessSvc.Register(c.Request.Context(), &req, ipAddress, userAgent)
	if err != nil {
		if errors.Is(err, ErrUserExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "user with this email already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register user"})
		return
	}

	// Set session cookie
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		h.cfg.SessionCookieName,
		rawToken,
		int(h.cfg.SessionTTL.Seconds()),
		"/",
		"",
		h.cfg.SessionCookieSecure,
		true,
	)

	c.JSON(http.StatusCreated, resp)
}

// @Summary Login
// @Description Log in to an existing user account and issue a session cookie
// @Tags auth
// @Accept json
// @Produce json
// @Param request body LoginRequest true "Login Credentials"
// @Success 200 {object} AuthResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	ipAddress := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	resp, rawToken, err := h.sessSvc.Login(c.Request.Context(), &req, ipAddress, userAgent)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": ErrInvalidCredentials.Error()})
		return
	}

	// Set session cookie
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		h.cfg.SessionCookieName,
		rawToken,
		int(h.cfg.SessionTTL.Seconds()),
		"/",
		"",
		h.cfg.SessionCookieSecure,
		true,
	)

	c.JSON(http.StatusOK, resp)
}

// @Summary Me
// @Description Get current user details (Legacy endpoint)
// @Tags auth
// @Accept json
// @Produce json
// @Success 200 {object} UserDTO
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /auth/me [get]
func (h *AuthHandler) Me(c *gin.Context) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	userID, ok := userIDValue.(int64)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user id in context"})
		return
	}

	user, err := h.svc.GetUserDetails(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// POST /auth/logout (current session only)
func (h *AuthHandler) Logout(c *gin.Context) {
	var tokenStr string
	cookieVal, err := c.Cookie(h.cfg.SessionCookieName)
	if err == nil && cookieVal != "" {
		tokenStr = cookieVal
	}

	if tokenStr == "" {
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenStr = parts[1]
			}
		}
	}

	if tokenStr != "" {
		_ = h.sessSvc.Logout(c.Request.Context(), tokenStr)
	}

	// Clear session cookie
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		h.cfg.SessionCookieName,
		"",
		-1,
		"/",
		"",
		h.cfg.SessionCookieSecure,
		true,
	)

	c.JSON(http.StatusOK, gin.H{"message": "successfully logged out"})
}

// POST /auth/logout-all
func (h *AuthHandler) LogoutAll(c *gin.Context) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	userID, ok := userIDValue.(int64)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user id"})
		return
	}

	if err := h.sessSvc.LogoutAll(c.Request.Context(), userID); err != nil {
		apierrors.HandleError(c, err)
		return
	}

	// Clear session cookie
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		h.cfg.SessionCookieName,
		"",
		-1,
		"/",
		"",
		h.cfg.SessionCookieSecure,
		true,
	)

	c.JSON(http.StatusOK, gin.H{"message": "successfully logged out from all devices"})
}

// GET /users/me/devices
func (h *AuthHandler) GetDevices(c *gin.Context) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		apierrors.HandleError(c, apierrors.NewUnauthorized("unauthorized"))
		return
	}
	userID := userIDValue.(int64)

	devices, err := h.sessSvc.ListDevices(c.Request.Context(), userID)
	if err != nil {
		apierrors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, devices)
}

// GET /users/me/sessions
func (h *AuthHandler) GetSessions(c *gin.Context) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		apierrors.HandleError(c, apierrors.NewUnauthorized("unauthorized"))
		return
	}
	userID := userIDValue.(int64)

	sessions, err := h.sessSvc.ListSessions(c.Request.Context(), userID)
	if err != nil {
		apierrors.HandleError(c, err)
		return
	}

	// Include the current session ID so the client can highlight it
	currentSessionID := int64(0)
	if v, ok := c.Get("session_id"); ok {
		currentSessionID = v.(int64)
	}

	c.JSON(http.StatusOK, gin.H{
		"sessions":           sessions,
		"current_session_id": strconv.FormatInt(currentSessionID, 10),
	})
}

// DELETE /users/me/devices/:id
func (h *AuthHandler) DeleteDevice(c *gin.Context) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		apierrors.HandleError(c, apierrors.NewUnauthorized("unauthorized"))
		return
	}
	userID := userIDValue.(int64)

	idStr := c.Param("id")
	deviceID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		apierrors.HandleError(c, apierrors.NewBadRequest("invalid device id"))
		return
	}

	err = h.sessSvc.RevokeDevice(c.Request.Context(), userID, deviceID)
	if err != nil {
		if errors.Is(err, ErrDeviceNotFound) {
			apierrors.HandleError(c, apierrors.NewNotFound("device not found"))
			return
		}
		apierrors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "device revoked successfully"})
}

// DELETE /users/me/sessions/:id
func (h *AuthHandler) DeleteSession(c *gin.Context) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		apierrors.HandleError(c, apierrors.NewUnauthorized("unauthorized"))
		return
	}
	userID := userIDValue.(int64)

	idStr := c.Param("id")
	sessionID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		apierrors.HandleError(c, apierrors.NewBadRequest("invalid session id"))
		return
	}

	err = h.sessSvc.RevokeSession(c.Request.Context(), userID, sessionID)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			apierrors.HandleError(c, apierrors.NewNotFound("session not found"))
			return
		}
		apierrors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "session revoked successfully"})
}
