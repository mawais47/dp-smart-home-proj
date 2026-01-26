package handlers

import (
	"iot-message/models"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // Allow Angular development server
}

type Hub struct {
	Clients    map[*websocket.Conn]bool
	Broadcast  chan models.DeviceMessage
	Register   chan *websocket.Conn
	Unregister chan *websocket.Conn
	Mu         sync.Mutex
}

func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[*websocket.Conn]bool),
		Broadcast:  make(chan models.DeviceMessage),
		Register:   make(chan *websocket.Conn),
		Unregister: make(chan *websocket.Conn),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case conn := <-h.Register:
			h.Mu.Lock()
			h.Clients[conn] = true
			h.Mu.Unlock()
		case conn := <-h.Unregister:
			h.Mu.Lock()
			if _, ok := h.Clients[conn]; ok {
				delete(h.Clients, conn)
				conn.Close()
			}
			h.Mu.Unlock()
		case message := <-h.Broadcast:
			h.Mu.Lock()
			for client := range h.Clients {
				err := client.WriteJSON(message)
				if err != nil {
					log.Printf("WebSocket error: %v", err)
					client.Close()
					delete(h.Clients, client)
				}
			}
			h.Mu.Unlock()
		}
	}
}

func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	hub.Register <- conn

	// Read loop to detect disconnection
	go func() {
		defer func() {
			hub.Unregister <- conn
		}()
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()
}
