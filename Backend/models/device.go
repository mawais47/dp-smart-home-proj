package models

import "time"

type StoredDevice struct {
	ID              string    `json:"id"`
	Type            string    `json:"type"`
	IntervalSeconds int       `json:"interval"`
	Brightness      *int      `json:"brightness,omitempty"`
	Speed           *int      `json:"speed,omitempty"`
	Temperature     *int      `json:"temperature,omitempty"`
	CurtainPosition *string   `json:"curtainPosition,omitempty"`
	Power           string    `json:"power"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type RegisterDeviceRequest struct {
	DeviceID   string `json:"deviceId" binding:"required"`
	DeviceType string `json:"deviceType" binding:"required"`
}
