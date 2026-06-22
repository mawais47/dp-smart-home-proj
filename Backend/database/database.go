package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"iot-message/models"

	_ "modernc.org/sqlite"
	"golang.org/x/crypto/bcrypt"
)

type DB struct {
	conn *sql.DB
}

func Open(path string) (*DB, error) {
	conn, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	conn.SetMaxOpenConns(1)

	db := &DB{conn: conn}
	if err := db.migrate(); err != nil {
		conn.Close()
		return nil, err
	}
	if err := db.EnsureDeviceMigrated(); err != nil {
		conn.Close()
		return nil, err
	}
	if err := db.seed(); err != nil {
		conn.Close()
		return nil, err
	}

	return db, nil
}

func (db *DB) Close() error {
	return db.conn.Close()
}

func (db *DB) migrate() error {
	schema := `
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL CHECK(role IN ('user', 'admin')),
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL,
	expires_at DATETIME NOT NULL,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`
	_, err := db.conn.Exec(schema)
	return err
}

func (db *DB) seed() error {
	defaults := []struct {
		username string
		password string
		role     string
	}{
		{username: "admin", password: "admin123", role: "admin"},
		{username: "user", password: "user123", role: "user"},
	}

	for _, account := range defaults {
		var count int
		if err := db.conn.QueryRow(`SELECT COUNT(*) FROM users WHERE username = ?`, account.username).Scan(&count); err != nil {
			return err
		}
		if count > 0 {
			continue
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(account.password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}

		_, err = db.conn.Exec(
			`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
			account.username, string(hash), account.role,
		)
		if err != nil {
			return err
		}
		log.Printf("Seeded default %s account: %s", account.role, account.username)
	}

	return nil
}

func (db *DB) GetUserByUsername(username string) (*models.User, error) {
	row := db.conn.QueryRow(
		`SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?`,
		username,
	)

	var user models.User
	if err := row.Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role, &user.CreatedAt); err != nil {
		return nil, err
	}
	return &user, nil
}

func (db *DB) CreateSession(sessionID string, userID int64, expiresAt time.Time) error {
	_, err := db.conn.Exec(
		`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
		sessionID, userID, expiresAt.UTC(),
	)
	return err
}

func (db *DB) GetSession(sessionID string) (*models.Session, *models.User, error) {
	row := db.conn.QueryRow(`
SELECT s.id, s.user_id, s.expires_at, s.created_at,
       u.id, u.username, u.password_hash, u.role, u.created_at
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.id = ?
`, sessionID)

	var session models.Session
	var user models.User
	if err := row.Scan(
		&session.ID, &session.UserID, &session.ExpiresAt, &session.CreatedAt,
		&user.ID, &user.Username, &user.PasswordHash, &user.Role, &user.CreatedAt,
	); err != nil {
		return nil, nil, err
	}
	return &session, &user, nil
}

func (db *DB) DeleteSession(sessionID string) error {
	_, err := db.conn.Exec(`DELETE FROM sessions WHERE id = ?`, sessionID)
	return err
}

func (db *DB) DeleteExpiredSessions() error {
	_, err := db.conn.Exec(`DELETE FROM sessions WHERE expires_at <= ?`, time.Now().UTC())
	return err
}
