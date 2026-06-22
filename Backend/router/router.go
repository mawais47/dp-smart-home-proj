package router

import (
	"iot-message/auth"
	"iot-message/config"
	"iot-message/database"
	"iot-message/handlers"
	"iot-message/middleware"
	"iot-message/mqtt"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Setup(hub *handlers.Hub, mqttClient *mqtt.MQTTClient, authService *auth.Service, db *database.DB, cfg config.Config) *gin.Engine {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "X-Session-ID"},
		AllowCredentials: true,
	}))

	authHandler := handlers.NewAuthHandler(authService)
	apiHandler := handlers.NewAPIHandler(db, mqttClient)

	r.GET("/ws", middleware.RequireAuth(authService), func(c *gin.Context) {
		handlers.ServeWs(hub, c.Writer, c.Request)
	})

	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/login", authHandler.Login)
		authGroup.POST("/logout", authHandler.Logout)
		authGroup.GET("/me", authHandler.Me)
	}

	api := r.Group("/api", middleware.RequireAuth(authService))
	{
		api.GET("/devices", apiHandler.ListDevices)
		api.POST("/command", apiHandler.SendCommand)
		api.GET("/status", apiHandler.Status)

		admin := api.Group("", middleware.RequireAdmin())
		{
			admin.POST("/devices", apiHandler.RegisterDevice)
			admin.POST("/devices/delete", apiHandler.DeleteDevice)
		}
	}

	return r
}
