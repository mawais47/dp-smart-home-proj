package mqtt

import (
	"fmt"
	"iot-message/models"
	"strconv"
	"strings"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

type MQTTClient struct {
	Client     mqtt.Client
	Heartbeats map[string]chan struct{}
	Intervals  map[string]time.Duration
}

func NewMQTTClient(brokerURL string, onMessageReceived func(models.DeviceMessage)) *MQTTClient {
	m := &MQTTClient{
		Heartbeats: make(map[string]chan struct{}),
		Intervals:  make(map[string]time.Duration),
	}

	opts := mqtt.NewClientOptions().AddBroker(brokerURL)
	opts.SetClientID("go_iot_backend")

	opts.SetDefaultPublishHandler(func(client mqtt.Client, msg mqtt.Message) {
		topic := msg.Topic()
		payload := string(msg.Payload())
		parts := strings.Split(topic, "/")
		deviceID := ""
		if len(parts) >= 3 {
			deviceID = parts[2]
		}

		// Simulation logic for responding to commands
		if len(parts) >= 4 && parts[3] == "commands" && deviceID != "" {
			m.handleCommandSimulation(deviceID, payload)
		}

		message := models.DeviceMessage{
			DeviceID:  deviceID,
			Topic:     topic,
			Payload:   payload,
			Timestamp: time.Now(),
		}
		onMessageReceived(message)
	})

	client := mqtt.NewClient(opts)
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		panic(token.Error())
	}
	m.Client = client

	// Subscribe to all IoT topics
	client.Subscribe("iot/devices/#", 1, nil)
	fmt.Println("MQTT Client Connected and Subscribed")

	return m
}

func (m *MQTTClient) handleCommandSimulation(deviceID, payload string) {
	statusTopic := fmt.Sprintf("iot/devices/%s/status", deviceID)

	m.Publish(statusTopic, "RECEIVED")

	lowerPayload := strings.ToLower(payload)
	upperPayload := strings.ToUpper(payload)

	switch {
	case lowerPayload == "offline":
		fmt.Printf("Device %s going offline via command\n", deviceID)
		m.StopHeartbeat(deviceID)
		m.Publish(statusTopic, "OFFLINE")
	case lowerPayload == "online", lowerPayload == "on":
		fmt.Printf("Device %s coming online via command\n", deviceID)
		interval, exists := m.Intervals[deviceID]
		if !exists {
			interval = 1 * time.Minute
		}
		m.StartHeartbeat(deviceID, interval)
	case strings.HasPrefix(lowerPayload, "set_interval_"):
		secondsStr := strings.TrimPrefix(lowerPayload, "set_interval_")
		seconds, err := strconv.Atoi(secondsStr)
		if err == nil {
			fmt.Printf("Updating heartbeat interval for %s to %d seconds\n", deviceID, seconds)
			m.StartHeartbeat(deviceID, time.Duration(seconds)*time.Second)
		}
	case strings.HasPrefix(upperPayload, "BRIGHTNESS_"):
		value := strings.TrimPrefix(upperPayload, "BRIGHTNESS_")
		m.Publish(statusTopic, fmt.Sprintf("BRIGHTNESS:%s", value))
	case strings.HasPrefix(upperPayload, "SPEED_"):
		value := strings.TrimPrefix(upperPayload, "SPEED_")
		m.Publish(statusTopic, fmt.Sprintf("SPEED:%s", value))
	case strings.HasPrefix(upperPayload, "TEMP_"):
		value := strings.TrimPrefix(upperPayload, "TEMP_")
		m.Publish(statusTopic, fmt.Sprintf("TEMP:%s", value))
	case upperPayload == "CURTAIN_FULL":
		m.Publish(statusTopic, "CURTAIN:full")
	case upperPayload == "CURTAIN_HALF":
		m.Publish(statusTopic, "CURTAIN:half")
	case upperPayload == "CURTAIN_0":
		m.Publish(statusTopic, "CURTAIN:0")
	}
}

func (m *MQTTClient) Publish(topic string, payload string) {
	// Publish without waiting for confirmation to keep API response fast
	m.Client.Publish(topic, 1, false, payload)
}

func (m *MQTTClient) StartHeartbeat(deviceID string, interval time.Duration) {
	// Stop existing if any
	m.StopHeartbeat(deviceID)
	
	// Store the interval for persistence
	m.Intervals[deviceID] = interval

	stopChan := make(chan struct{})
	m.Heartbeats[deviceID] = stopChan

	ticker := time.NewTicker(interval)
	go func() {
		// Send initial heartbeat
		topic := fmt.Sprintf("iot/devices/%s/status", deviceID)
		m.Publish(topic, "ONLINE")

		for {
			select {
			case <-ticker.C:
				m.Publish(topic, "ONLINE")
			case <-stopChan:
				ticker.Stop()
				return
			}
		}
	}()
}

func (m *MQTTClient) StopHeartbeat(deviceID string) {
	if stopChan, ok := m.Heartbeats[deviceID]; ok {
		close(stopChan)
		delete(m.Heartbeats, deviceID)
	}
}
