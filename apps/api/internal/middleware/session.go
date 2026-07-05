package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/synapse/api/internal/auth"
	"github.com/synapse/api/internal/errors"
)

func SessionMiddleware(sessionSvc auth.SessionService, cookieName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenStr string

		// 1. Try to extract from cookie
		cookieVal, err := c.Cookie(cookieName)
		if err == nil && cookieVal != "" {
			tokenStr = cookieVal
		}

		// 2. Fall back to Authorization header
		if tokenStr == "" {
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" {
				parts := strings.Split(authHeader, " ")
				if len(parts) == 2 && parts[0] == "Bearer" {
					tokenStr = parts[1]
				}
			}
		}

		if tokenStr == "" {
			errors.HandleError(c, errors.NewUnauthorized("Authentication credentials missing"))
			c.Abort()
			return
		}

		session, err := sessionSvc.ValidateSessionToken(c.Request.Context(), tokenStr)
		if err != nil {
			errors.HandleError(c, errors.NewUnauthorized("Invalid or expired session"))
			c.Abort()
			return
		}

		// Inject details in context
		c.Set("user_id", session.UserID)
		c.Set("session_id", session.ID)
		c.Set("device_id", session.DeviceID)

		c.Next()
	}
}
