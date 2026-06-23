SmartHome – IoT Chat & Device Management System
A full‑stack IoT orchestration platform enabling real‑time device control, logical grouping, and health monitoring.
Built with a Go (Golang) backend, Angular frontend, and Mosquitto MQTT messaging layer.

🚀 Overview
SmartHome manages multiple IoT device types — bulbs, fans, AC units, curtains, TVs, and smart cleaners — through a modern, chat‑style interface.
Users can control individual devices or entire rooms, while the system ensures accurate device state synchronization using a Heartbeat + ACK verification loop.

The platform is secured with session‑based authentication and role‑based access control (RBAC).

🔐 Authentication & Role Permissions
SmartHomeX uses secure session cookies and backend middleware to enforce strict access boundaries.

🛡 Admin Role
Admins have full system‑level control.

✅ Admin Can:
Add new devices

Delete devices

Set initial heartbeat interval (10s → 10m)

Fan speed

Bulb brightness

AC temperature

Curtain mode (Full / Half / Closed)

Cleaner speed

Create groups/rooms

Assign devices to groups


👤 User Role
Users interact with devices but cannot modify system structure.

✅ User Can:
Change device heartbeat interval

Change device mode / operational values

Fan speed

Bulb brightness

AC temperature

Curtain mode

Cleaner speed

Control devices in real time

Control entire groups/rooms

View device Online/Offline status

Use chat‑style interface for commands

❌ User Cannot:
Add devices

Delete devices

Modify initial device configuration

Access admin‑only APIs

✨ Key Features
⚡ Real-Time Messaging
WebSockets for instant UI updates

MQTT for device‑level communication

Low‑latency, event‑driven architecture

🏠 Logical Grouping
Create rooms (e.g., Living Room, Bedroom)

Assign multiple devices to a group

Control all devices inside a room with one command

❤️ Variable Heartbeat Monitoring
Each device reports its status at a configurable interval:

10s

30s

1m

2m

5m

10m

If a device misses its heartbeat window, it is marked Offline.

✔️ ACK Verification System
Every command sent to a device must return an ACK message.

This ensures:

No ghost states

UI always reflects the real physical device state

Reliable communication even in unstable networks


🧠 Supported Device Types
Smart Bulbs (0–100% brightness)

Fans (speed 1–5)

Air Conditioners (temperature control)

Smart Curtains (Full / Half / Closed)

Smart Cleaners (speed 1–3)

TVs (ON/OFF)

📡 Communication Flow
User/Admin sends command → WebSocket → Backend

Backend updates DB → publishes MQTT message

Device receives command → executes → sends ACK

Backend receives ACK → updates UI in real time

🔮 Future Enhancements
Mobile app (Flutter / React Native)

Push notifications for offline devices

mDNS auto‑discovery

Historical analytics & charts

AI‑based anomaly detection


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


👤 Author
Muhammad Awais

Student ID: 7199627

GitHub: @mawais47
