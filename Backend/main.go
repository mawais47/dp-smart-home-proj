package main

import (
	"log"
	"time"

	"iot-message/auth"
	"iot-message/config"
	"iot-message/database"
	"iot-message/handlers"
	"iot-message/models"
	"iot-message/mqtt"
	"iot-message/router"
)

func main() {
	cfg := config.Load()

	db, err := database.Open(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	authService := auth.NewService(db, time.Duration(cfg.SessionTTLHours)*time.Hour)

	hub := handlers.NewHub()
	go hub.Run()

	mqttClient := mqtt.NewMQTTClient(cfg.MQTTBrokerURL, func(msg models.DeviceMessage) {
		log.Printf("MQTT -> Hub: [%s] %s", msg.Topic, msg.Payload)
		hub.Broadcast <- msg
	})

	restoreDeviceHeartbeats(db, mqttClient)

	r := router.Setup(hub, mqttClient, authService, db, cfg)

	log.Printf("Backend started on http://localhost%s", cfg.ServerPort)
	log.Fatal(r.Run(cfg.ServerPort))
}

func restoreDeviceHeartbeats(db *database.DB, mqttClient *mqtt.MQTTClient) {
	devices, err := db.ListDevices()
	if err != nil {
		log.Printf("Failed to restore devices: %v", err)
		return
	}

	for _, device := range devices {
		if device.Power == "off" {
			continue
		}
		mqttClient.StartHeartbeat(device.ID, time.Duration(device.IntervalSeconds)*time.Second)
		log.Printf("Restored heartbeat for %s every %ds", device.ID, device.IntervalSeconds)
	}
}
