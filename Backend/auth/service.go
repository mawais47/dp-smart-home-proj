package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"iot-message/database"
	"iot-message/models"

	"golang.org/x/crypto/bcrypt"
)

const SessionCookieName = "session_id"

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrRoleMismatch       = errors.New("role mismatch")
	ErrSessionNotFound    = errors.New("session not found")
	ErrSessionExpired     = errors.New("session expired")
)

type Service struct {
	db         *database.DB
	sessionTTL time.Duration
}

func NewService(db *database.DB, sessionTTL time.Duration) *Service {
	return &Service{db: db, sessionTTL: sessionTTL}
}

func (s *Service) Login(username, password, expectedRole string) (string, *models.User, error) {
	user, err := s.db.GetUserByUsername(username)
	if err != nil {
		return "", nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", nil, ErrInvalidCredentials
	}

	if user.Role != expectedRole {
		return "", nil, ErrRoleMismatch
	}

	sessionID, err := generateSessionID()
	if err != nil {
		return "", nil, err
	}

	expiresAt := time.Now().UTC().Add(s.sessionTTL)
	if err := s.db.CreateSession(sessionID, user.ID, expiresAt); err != nil {
		return "", nil, err
	}

	return sessionID, user, nil
}

func (s *Service) ValidateSession(sessionID string) (*models.User, error) {
	_ = s.db.DeleteExpiredSessions()

	session, user, err := s.db.GetSession(sessionID)
	if err != nil {
		return nil, ErrSessionNotFound
	}

	if time.Now().UTC().After(session.ExpiresAt) {
		_ = s.db.DeleteSession(sessionID)
		return nil, ErrSessionExpired
	}

	return user, nil
}

func (s *Service) Logout(sessionID string) error {
	return s.db.DeleteSession(sessionID)
}

func (s *Service) SessionTTL() time.Duration {
	return s.sessionTTL
}

func generateSessionID() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
