package database

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"iot-message/models"
)

func (db *DB) migrateDevices() error {
	_, err := db.conn.Exec(`
CREATE TABLE IF NOT EXISTS devices (
	id TEXT PRIMARY KEY,
	type TEXT NOT NULL,
	interval_seconds INTEGER NOT NULL DEFAULT 60,
	brightness INTEGER,
	speed INTEGER,
	temperature INTEGER,
	curtain_position TEXT,
	power TEXT NOT NULL DEFAULT 'on',
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`)
	return err
}

func defaultDeviceState(deviceType string) models.StoredDevice {
	device := models.StoredDevice{
		Type:            deviceType,
		IntervalSeconds: 60,
		Power:           "on",
	}

	switch deviceType {
	case "bulb":
		value := 100
		device.Brightness = &value
	case "fan":
		value := 1
		device.Speed = &value
	case "ac":
		value := 24
		device.Temperature = &value
	case "curtains":
		position := "full"
		device.CurtainPosition = &position
	case "automatic_cleaner":
		value := 1
		device.Speed = &value
	}

	return device
}

func (db *DB) SaveDevice(device models.StoredDevice) error {
	_, err := db.conn.Exec(`
INSERT INTO devices (
	id, type, interval_seconds, brightness, speed, temperature, curtain_position, power, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
	type = excluded.type,
	interval_seconds = excluded.interval_seconds,
	brightness = excluded.brightness,
	speed = excluded.speed,
	temperature = excluded.temperature,
	curtain_position = excluded.curtain_position,
	power = excluded.power,
	updated_at = CURRENT_TIMESTAMP
`, device.ID, device.Type, device.IntervalSeconds,
		nullableInt(device.Brightness),
		nullableInt(device.Speed),
		nullableInt(device.Temperature),
		nullableString(device.CurtainPosition),
		device.Power,
	)
	return err
}

func (db *DB) ListDevices() ([]models.StoredDevice, error) {
	rows, err := db.conn.Query(`
SELECT id, type, interval_seconds, brightness, speed, temperature, curtain_position, power, created_at, updated_at
FROM devices
ORDER BY id ASC
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	devices := []models.StoredDevice{}
	for rows.Next() {
		device, err := scanDevice(rows)
		if err != nil {
			return nil, err
		}
		devices = append(devices, device)
	}
	return devices, rows.Err()
}

func (db *DB) GetDevice(id string) (*models.StoredDevice, error) {
	row := db.conn.QueryRow(`
SELECT id, type, interval_seconds, brightness, speed, temperature, curtain_position, power, created_at, updated_at
FROM devices WHERE id = ?
`, id)

	device, err := scanDevice(row)
	if err != nil {
		return nil, err
	}
	return &device, nil
}

func (db *DB) DeleteDevice(id string) error {
	_, err := db.conn.Exec(`DELETE FROM devices WHERE id = ?`, id)
	return err
}

func (db *DB) ApplyCommand(deviceID, payload string) (*models.StoredDevice, error) {
	device, err := db.GetDevice(deviceID)
	if err != nil {
		return nil, err
	}

	ApplyCommandPayload(device, payload)
	if err := db.SaveDevice(*device); err != nil {
		return nil, err
	}
	return device, nil
}

func ApplyCommandPayload(device *models.StoredDevice, payload string) {
	upper := strings.ToUpper(payload)
	lower := strings.ToLower(payload)

	switch {
	case lower == "offline", lower == "off":
		device.Power = "off"
	case lower == "online", lower == "on":
		device.Power = "on"
	case strings.HasPrefix(upper, "SET_INTERVAL_"):
		secondsStr := strings.TrimPrefix(upper, "SET_INTERVAL_")
		if seconds, err := strconv.Atoi(secondsStr); err == nil && seconds > 0 {
			device.IntervalSeconds = seconds
		}
	case strings.HasPrefix(upper, "BRIGHTNESS_"):
		valueStr := strings.TrimPrefix(upper, "BRIGHTNESS_")
		if value, err := strconv.Atoi(valueStr); err == nil {
			value = clamp(value, 0, 100)
			device.Brightness = &value
			if value > 0 {
				device.Power = "on"
			}
		}
	case strings.HasPrefix(upper, "SPEED_"):
		valueStr := strings.TrimPrefix(upper, "SPEED_")
		if value, err := strconv.Atoi(valueStr); err == nil {
			device.Speed = &value
			device.Power = "on"
		}
	case strings.HasPrefix(upper, "TEMP_"):
		valueStr := strings.TrimPrefix(upper, "TEMP_")
		if value, err := strconv.Atoi(valueStr); err == nil {
			value = clamp(value, 16, 30)
			device.Temperature = &value
			device.Power = "on"
		}
	case upper == "CURTAIN_FULL":
		position := "full"
		device.CurtainPosition = &position
	case upper == "CURTAIN_HALF":
		position := "half"
		device.CurtainPosition = &position
	case upper == "CURTAIN_0":
		position := "0"
		device.CurtainPosition = &position
	}
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanDevice(scanner rowScanner) (models.StoredDevice, error) {
	var device models.StoredDevice
	var brightness, speed, temperature sql.NullInt64
	var curtainPosition sql.NullString

	err := scanner.Scan(
		&device.ID,
		&device.Type,
		&device.IntervalSeconds,
		&brightness,
		&speed,
		&temperature,
		&curtainPosition,
		&device.Power,
		&device.CreatedAt,
		&device.UpdatedAt,
	)
	if err != nil {
		return device, err
	}

	device.Brightness = intPtrFromNull(brightness)
	device.Speed = intPtrFromNull(speed)
	device.Temperature = intPtrFromNull(temperature)
	device.CurtainPosition = stringPtrFromNull(curtainPosition)
	return device, nil
}

func nullableInt(value *int) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableString(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func intPtrFromNull(value sql.NullInt64) *int {
	if !value.Valid {
		return nil
	}
	v := int(value.Int64)
	return &v
}

func stringPtrFromNull(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	v := value.String
	return &v
}

func clamp(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func InferDeviceType(deviceID string) string {
	parts := strings.Split(deviceID, "_")
	if len(parts) == 0 {
		return "unknown"
	}
	return parts[0]
}

func BuildDevice(deviceID, deviceType string) models.StoredDevice {
	device := defaultDeviceState(deviceType)
	device.ID = deviceID
	if device.Type == "" {
		device.Type = InferDeviceType(deviceID)
	}
	return device
}

func (db *DB) EnsureDeviceMigrated() error {
	if err := db.migrateDevices(); err != nil {
		return fmt.Errorf("migrate devices: %w", err)
	}
	return nil
}
