package models

import "time"

type DeviceMessage struct {
	DeviceID  string    `json:"deviceId"`
	Payload   string    `json:"payload"`
	Topic     string    `json:"topic"`
	Timestamp time.Time `json:"timestamp"`
}
