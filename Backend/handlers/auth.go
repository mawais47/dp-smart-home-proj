package handlers

import (
	"net/http"

	"iot-message/auth"
	"iot-message/models"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	Auth *auth.Service
}

func NewAuthHandler(authService *auth.Service) *AuthHandler {
	return &AuthHandler{Auth: authService}
}

func sessionIDFromRequest(c *gin.Context) string {
	if cookie, err := c.Cookie(auth.SessionCookieName); err == nil && cookie != "" {
		return cookie
	}
	if sessionID := c.Query("session_id"); sessionID != "" {
		return sessionID
	}
	return c.GetHeader("X-Session-ID")
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username, password, and role are required"})
		return
	}

	sessionID, user, err := h.Auth.Login(req.Username, req.Password, req.Role)
	if err != nil {
		switch err {
		case auth.ErrRoleMismatch:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials for selected login type"})
		default:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
		}
		return
	}

	maxAge := int(h.Auth.SessionTTL().Seconds())
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(auth.SessionCookieName, sessionID, maxAge, "/", "", false, true)

	c.JSON(http.StatusOK, models.AuthResponse{
		Username:  user.Username,
		Role:      user.Role,
		SessionID: sessionID,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	if sessionID := sessionIDFromRequest(c); sessionID != "" {
		_ = h.Auth.Logout(sessionID)
	}

	c.SetCookie(auth.SessionCookieName, "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"status": "logged_out"})
}

func (h *AuthHandler) Me(c *gin.Context) {
	sessionID := sessionIDFromRequest(c)
	if sessionID == "" {
		c.JSON(http.StatusOK, gin.H{"authenticated": false})
		return
	}

	user, err := h.Auth.ValidateSession(sessionID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"authenticated": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"authenticated": true,
		"username":      user.Username,
		"role":          user.Role,
	})
}
