package middleware

import (
	"net/http"

	"iot-message/auth"
	"iot-message/models"

	"github.com/gin-gonic/gin"
)

func sessionIDFromRequest(c *gin.Context) string {
	if cookie, err := c.Cookie(auth.SessionCookieName); err == nil && cookie != "" {
		return cookie
	}
	if sessionID := c.Query("session_id"); sessionID != "" {
		return sessionID
	}
	return c.GetHeader("X-Session-ID")
}

func RequireAuth(authService *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := sessionIDFromRequest(c)
		if sessionID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		user, err := authService.ValidateSession(sessionID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired session"})
			return
		}

		c.Set("user", user)
		c.Set("session_id", sessionID)
		c.Next()
	}
}

func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		userValue, exists := c.Get("user")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		user := userValue.(*models.User)
		if user.Role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}

		c.Next()
	}
}
