Markdown
# IoT Chat & Device Management System

A full-stack IoT orchestration platform that allows for real-time communication, logical device grouping, and health monitoring using a Go backend and an Angular frontend.

## 🚀 Overview

This system manages IoT nodes (like bulbs and fans) through a "Chat" style interface. It allows users to control individual devices or entire rooms (groups) simultaneously. The project implements a robust **Heartbeat** and **Acknowledgment (ACK)** system to ensure device state accuracy.

## ✨ Key Features

- **Real-time Messaging:** Low-latency communication via WebSockets and MQTT.
- **Logical Grouping:** Assign devices to groups (e.g., *Living Room*, *Bedroom*) and control them with a single command.
- **Variable Heartbeat Monitoring:** Supports configurable device heartbeats (1s, 30s, 1m, 2m, 5m, 10m) to monitor "Online/Offline" status.
- **ACK System:** Commands sent to devices require an Acknowledgment message back to verify the action was successful.
- **Responsive Dashboard:** Built with Angular for a modern, real-time user experience.

## 🛠️ Tech Stack

- **Backend:** [Go (Golang)](https://go.dev/)
- **Frontend:** [Angular](https://angular.io/) & [TypeScript](https://www.typescriptlang.org/)
- **Messaging:** [Mosquitto MQTT Broker](https://mosquitto.org/)
- **Communication:** WebSockets & MQTT Protocol

## 📋 Prerequisites

Ensure you have the following installed:
- **Node.js** (v18+)
- **Angular CLI** (`npm install -g @angular/cli`)
- **Go** (v1.20+)
- **Mosquitto MQTT**

## 🚦 Getting Started

### 1. Start MQTT Broker
Open a terminal and run the Mosquitto broker in verbose mode:
```powershell
cd backend
& "C:\Program Files\mosquitto\mosquitto.exe" -v


2. Start the Backend (Go)
Open a second terminal and run the Go server:

PowerShell
cd backend
go run main.go


3. Start the Frontend (Angular)
Open a third terminal, install dependencies, and start the app:

PowerShell
cd frontend/iot-frontend
npm install
ng serve
The application will be available at: http://localhost:4200

📖 System Logic
Device Grouping
Devices like bulb_01 and fan_01 can be controlled individually. However, they are also associated with a group ID (e.g., living_room). Sending an OFF command to the living_room group will iterate through all linked devices and update their state.

Heartbeat & Status
Online: Device sends a message; the backend marks it active.

Offline: Can be triggered manually by a user message or automatically if the heartbeat interval (e.g., 30s) is exceeded without a ping.

ACK: Every command sent from the dashboard waits for a confirmation message from the device to ensure reliability.

👤 Author
Muhammad Awais

Student ID: 7199627

GitHub: @mawais47
