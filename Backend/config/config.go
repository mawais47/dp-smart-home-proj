package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	MQTTBrokerURL  string
	ServerPort     string
	CORSOrigins    []string
	DatabasePath   string
	SessionTTLHours int
}

func Load() Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables and defaults")
	}

	port := getEnv("SERVER_PORT", "8080")
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	corsOrigins := strings.Split(getEnv("CORS_ORIGINS", "http://localhost:4200"), ",")
	for i, origin := range corsOrigins {
		corsOrigins[i] = strings.TrimSpace(origin)
	}

	return Config{
		MQTTBrokerURL:   getEnv("MQTT_BROKER_URL", "tcp://localhost:1883"),
		ServerPort:      port,
		CORSOrigins:     corsOrigins,
		DatabasePath:    getEnv("DATABASE_PATH", "./iot-message.db"),
		SessionTTLHours: getEnvInt("SESSION_TTL_HOURS", 24),
	}
}

func getEnvInt(key string, fallback int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return fallback
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
