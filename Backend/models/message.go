package models

import "time"

type DeviceMessage struct {
	DeviceID  string    `json:"deviceId"`
	Payload   string    `json:"payload"`
	Topic     string    `json:"topic"`
	Type      string    `json:"type"` // "event", "status", or "command"
	Timestamp time.Time `json:"timestamp"`
}
