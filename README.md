# IoT Chat & Device Management System

A full-stack IoT orchestration platform that allows for real-time communication, logical device grouping, and health monitoring using a Go backend and an Angular frontend.

## 🚀 Overview

This system manages IoT node types (like bulbs, fans, TV, AC, curtains, and cleaners) through a "Chat" style interface. It allows users to control individual devices or entire rooms (groups) simultaneously. The project implements a robust **Heartbeat** and **Acknowledgment (ACK)** system to ensure device state accuracy, secured by role-based session authentication.

## ✨ Key Features

- **Session-Based Authentication:** Secure user sessions using cookies/sessions to differentiate access levels.
- **Role-Based Access Control (RBAC):** - **Admin:** Full control to add, configure, and delete devices from the system.
  - **User:** Can interact with devices, change operational values (e.g., speed, state), toggle offline status, and manage group assignments.
- **Real-time Messaging:** Low-latency communication via WebSockets and MQTT.
- **Logical Grouping:** Assign devices to groups (e.g., *Living Room*, *Bedroom*) and control them with a single command.
- **Variable Heartbeat Monitoring:** Supports configurable device heartbeats (1s, 30s, 1m, 2m, 5m, 10m) to monitor "Online/Offline" status.
- **ACK System:** Commands sent to devices require an Acknowledgment message back to verify the action was successful.
- **Responsive Dashboard:** Built with Angular for a modern, real-time user experience.

## 🛠️ Tech Stack

- **Backend:** [Go (Golang)](https://go.dev/) with [Gin Framework](https://gin-gonic.com/) (RESTful APIs & Session management)
- **Frontend:** [Angular](https://angular.io/) & [TypeScript](https://www.typescriptlang.org/)
- **Messaging:** [Mosquitto MQTT Broker](https://mosquitto.org/)
- **Communication:** WebSockets, MQTT Protocol, and RESTful APIs

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

<img width="1912" height="925" alt="image" src="https://github.com/user-attachments/assets/877765b6-eb00-4c1e-893b-db2b89c6f048" />
<img width="1919" height="925" alt="image" src="https://github.com/user-attachments/assets/242d7bba-a747-4723-8f41-8d17c747f593" />
<img width="1910" height="916" alt="image" src="https://github.com/user-attachments/assets/d83b2e50-3bf4-4670-9f38-d579d810568b" />




👤 Author
Muhammad Awais

Student ID: 7199627

GitHub: @mawais47
