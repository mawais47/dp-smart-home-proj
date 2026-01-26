package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"iot-message/handlers"
	"iot-message/models"
	"iot-message/mqtt"
)

// cors adds CORS headers and handles OPTIONS so Angular (e.g. localhost:4200) can call /api/*.
func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func main() {
	// 1. Initialize the WebSocket Hub
	// This will manage all Angular browser connections
	hub := handlers.NewHub()
	go hub.Run()

	// 2. Initialize the MQTT Client (subscribes to iot/devices/#)
	// Event Logging & Alerts: device events (e.g. iot/devices/{id}/status, /response) -> Hub -> WebSocket
	// Two-Way Communication: device acknowledgements on /status or /response are forwarded to the UI
	mqttClient := mqtt.NewMQTTClient("tcp://localhost:1883", func(msg models.DeviceMessage) {
		log.Printf("MQTT -> Hub: [%s] %s", msg.Topic, msg.Payload)
		hub.Broadcast <- msg
	})

	// 3. Define WebSocket Route
	// Angular will connect to ws://localhost:8080/ws
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handlers.ServeWs(hub, w, r)
	})

	// 4. Define Command Route (Objective 6.2)
	// Allows Angular to send commands (e.g., {"deviceId": "led1", "payload": "ON"})
	http.HandleFunc("/api/command", cors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var cmd models.DeviceMessage
		if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if cmd.DeviceID == "" {
			http.Error(w, "deviceId is required", http.StatusBadRequest)
			return
		}

		log.Printf("Received command for %s: %s", cmd.DeviceID, cmd.Payload)

		// Publish to MQTT topic: iot/devices/{id}/commands (Remote Command Execution)
		topic := fmt.Sprintf("iot/devices/%s/commands", cmd.DeviceID)
		mqttClient.Publish(topic, cmd.Payload)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "command_sent", "topic": topic})
		log.Printf("Command sent to MQTT and response returned for %s", cmd.DeviceID)
	}))

	// 5. Register Device Route - Starts a simulated heartbeat for the device
	http.HandleFunc("/api/devices", cors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			DeviceID string `json:"deviceId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if req.DeviceID == "" {
			http.Error(w, "deviceId is required", http.StatusBadRequest)
			return
		}

		log.Printf("Starting heartbeat simulation for device: %s", req.DeviceID)
		mqttClient.StartHeartbeat(req.DeviceID, 1*time.Minute)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "heartbeat_started", "deviceId": req.DeviceID})
	}))

	// 6. Delete Device Route - Stops heartbeat and allows frontend to remove device
	http.HandleFunc("/api/devices/delete", cors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			DeviceID string `json:"deviceId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if req.DeviceID == "" {
			http.Error(w, "deviceId is required", http.StatusBadRequest)
			return
		}

		log.Printf("Stopping heartbeat and deleting device: %s", req.DeviceID)
		mqttClient.StopHeartbeat(req.DeviceID)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "device_deleted", "deviceId": req.DeviceID})
	}))

	// 7. Health Check Route
	http.HandleFunc("/api/status", cors(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Backend is running. MQTT Connected: %v", mqttClient.Client.IsConnected())
	}))

	// Start the server
	port := ":8080"
	log.Printf("Backend Service started on http://localhost%s", port)
	log.Fatal(http.ListenAndServe(port, nil))
}
