package models

import "time"

type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Session struct {
	ID        string
	UserID    int64
	ExpiresAt time.Time
	CreatedAt time.Time
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Role     string `json:"role" binding:"required,oneof=user admin"`
}

type AuthResponse struct {
	Username  string `json:"username"`
	Role      string `json:"role"`
	SessionID string `json:"sessionId,omitempty"`
}
