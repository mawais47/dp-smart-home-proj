package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"iot-message/database"
	"iot-message/models"
	"iot-message/mqtt"

	"github.com/gin-gonic/gin"
)

type APIHandler struct {
	DB   *database.DB
	MQTT *mqtt.MQTTClient
}

func NewAPIHandler(db *database.DB, mqttClient *mqtt.MQTTClient) *APIHandler {
	return &APIHandler{DB: db, MQTT: mqttClient}
}

func (h *APIHandler) ListDevices(c *gin.Context) {
	devices, err := h.DB.ListDevices()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load devices"})
		return
	}
	c.JSON(http.StatusOK, devices)
}

func (h *APIHandler) SendCommand(c *gin.Context) {
	var cmd models.DeviceMessage
	if err := c.ShouldBindJSON(&cmd); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if cmd.DeviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "deviceId is required"})
		return
	}

	log.Printf("Received command for %s: %s", cmd.DeviceID, cmd.Payload)

	topic := fmt.Sprintf("iot/devices/%s/commands", cmd.DeviceID)
	h.MQTT.Publish(topic, cmd.Payload)

	device, err := h.DB.ApplyCommand(cmd.DeviceID, cmd.Payload)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
		return
	}

	if isIntervalCommand(cmd.Payload) && device.Power != "off" {
		h.MQTT.StartHeartbeat(device.ID, time.Duration(device.IntervalSeconds)*time.Second)
	}
	if isOfflineCommand(cmd.Payload) {
		h.MQTT.StopHeartbeat(device.ID)
	}
	if isOnlineCommand(cmd.Payload) {
		h.MQTT.StartHeartbeat(device.ID, time.Duration(device.IntervalSeconds)*time.Second)
	}

	c.JSON(http.StatusOK, gin.H{"status": "command_sent", "topic": topic, "device": device})
	log.Printf("Command sent to MQTT for %s", cmd.DeviceID)
}

func (h *APIHandler) RegisterDevice(c *gin.Context) {
	var req models.RegisterDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "deviceId and deviceType are required"})
		return
	}

	device := database.BuildDevice(req.DeviceID, req.DeviceType)
	if err := h.DB.SaveDevice(device); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save device"})
		return
	}

	log.Printf("Registered device: %s (%s)", req.DeviceID, req.DeviceType)
	h.MQTT.StartHeartbeat(req.DeviceID, time.Duration(device.IntervalSeconds)*time.Second)

	if device.Type == "bulb" && device.Brightness != nil {
		topic := fmt.Sprintf("iot/devices/%s/commands", device.ID)
		h.MQTT.Publish(topic, fmt.Sprintf("BRIGHTNESS_%d", *device.Brightness))
	}

	c.JSON(http.StatusOK, gin.H{"status": "device_registered", "device": device})
}

func (h *APIHandler) DeleteDevice(c *gin.Context) {
	var req struct {
		DeviceID string `json:"deviceId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "deviceId is required"})
		return
	}

	log.Printf("Stopping heartbeat and deleting device: %s", req.DeviceID)
	h.MQTT.StopHeartbeat(req.DeviceID)
	if err := h.DB.DeleteDevice(req.DeviceID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete device"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "device_deleted", "deviceId": req.DeviceID})
}

func (h *APIHandler) Status(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":         "running",
		"mqtt_connected": h.MQTT.Client.IsConnected(),
	})
}

func isIntervalCommand(payload string) bool {
	return strings.HasPrefix(strings.ToUpper(payload), "SET_INTERVAL_")
}

func isOfflineCommand(payload string) bool {
	lower := strings.ToLower(payload)
	return lower == "offline" || lower == "off"
}

func isOnlineCommand(payload string) bool {
	lower := strings.ToLower(payload)
	return lower == "online" || lower == "on"
}
