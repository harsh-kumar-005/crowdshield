<div align="center">

# 🏟️ CrowdShield
### AI-Powered Crowd Management & Safety Platform

*Inspired by the Chinnaswamy Stadium stampede — June 4, 2025 — which killed 11 people and injured 50+.*

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)

</div>

---

## 🎯 What Is CrowdShield?

CrowdShield is a **real-time, AI-powered crowd monitoring and safety platform** that gives venue managers the intelligence to prevent tragedies before they happen.

The platform combines:
- **Live crowd density monitoring** via WebSocket-powered dashboards
- **AI/ML risk prediction** using a trained Random Forest model
- **YOLOv8 computer vision** to count people from camera images
- **Agent-based crowd simulation** to model stampede risk before events
- **Interactive venue maps** with real-time density overlays

> *"If a system like this had been deployed at M Chinnaswamy Stadium on June 4, 2025, the dangerous compression at the tunnel gate would have been flagged as CRITICAL 8 minutes before the surge."*

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              FRONTEND — React + TypeScript           │
│   Dashboard │ Map │ Events │ AI Detection │ Simulation│
└─────────────┬────────────────────────┬──────────────┘
              │ REST + WebSocket        │ HTTP
              ▼                        ▼
┌─────────────────────┐   ┌───────────────────────────┐
│  BACKEND            │   │  ML ENGINE                │
│  Node.js + Express  │──►│  Python + FastAPI         │
│  Socket.io          │   │                           │
│  JWT Auth           │   │  • Density Analysis       │
│  PostgreSQL         │   │  • Risk Prediction (RF)   │
└─────────────────────┘   │  • YOLOv8 Detection       │
         │                │  • Simulation Engine      │
         ▼                └───────────────────────────┘
┌─────────────────────┐
│  PostgreSQL          │
│  • users             │
│  • venues            │
│  • events            │
│  • crowd_data        │ ← time-series ML risk readings
└─────────────────────┘
```

---

## ✨ Features

| Feature | Tech | Description |
|---------|------|-------------|
| **Live Dashboard** | React, Socket.io | Real-time crowd stats updating every 4 seconds |
| **ML Risk Score** | scikit-learn RandomForest | 0–100 risk gauge calculated by actual ML inference |
| **Interactive Map** | Leaflet.js | Live crowd density circles on a real venue map |
| **Event Management** | PostgreSQL CRUD | Create and manage events with venue assignment |
| **AI Person Detection** | YOLOv8 nano | Upload any crowd photo → get count + annotated image |
| **Crowd Simulation** | Social Force Model | Agent-based simulation with 5 emergency scenarios |
| **Chinnaswamy Scenario** | Agent simulation | Reproduce the June 2025 incident and watch the bottleneck form |
| **Historical Charts** | PostgreSQL + Recharts | Real trend data from the database, not fake |
| **JWT Authentication** | bcrypt + JWT | Secure login/register system |
| **Docker Ready** | Docker Compose | Full stack in one command |

---

## 🚀 Quick Start

### Option 1 — Docker (Recommended)

```bash
# Clone repository
git clone https://github.com/harsh-kumar-005/crowdshield.git
cd crowdshield

# Copy env example and set your values
cp backend/.env.example backend/.env

# Run everything
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| ML Engine | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

---

### Option 2 — Manual Setup

**Prerequisites:** Node.js 20+, Python 3.12+, PostgreSQL 16+

#### 1. Database
```bash
psql -U postgres -c "CREATE DATABASE crowdshield;"
```

#### 2. Backend
```bash
cd backend
cp .env.example .env         # Fill in your DB credentials
npm install
npm run dev                  # Starts on :5000
```

#### 3. ML Engine
```bash
cd ml-engine
python -m venv venv
.\venv\Scripts\activate      # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### 4. Frontend
```bash
cd frontend
npm install
npm run dev                  # Starts on :5173
```

> The YOLOv8 model (~6MB) downloads automatically on first inference request.

---

## 🧠 AI/ML Details

### Risk Prediction Model
A **Random Forest Classifier** (sklearn, 100 trees) trained on domain-modelled crowd scenarios. Features:
- Venue density percentage
- Gate flow rate (people per minute)
- Time of day
- Post-event flag (exit rush behaviour)

Output: 0–100 risk score + risk level (`low / medium / high / critical`) + recommended actions.

### Person Detection (YOLOv8)
Uses `yolov8n.pt` (nano variant, ~6MB, CPU-only, ~80 FPS):
1. Accepts an uploaded image
2. Filters class 0 (`person`) only
3. Returns count, average confidence, and base64-encoded annotated image

### Crowd Simulation
Implements a simplified **Social Force Model** (Helbing et al., 1995):
- Each agent has a driving force toward its target gate
- Separation force from nearby agents (reduced in panic → compression)
- Wall repulsion force
- Panic triggers: speed increases, separation decreases → dangerous clustering

**Scenarios:**
| Scenario | Description |
|---------|-------------|
| 🟢 Normal | Standard post-event dispersal |
| 🟡 Gate Failure | Gate closes mid-event, crowd redirects |
| 🔴 Fire Alert | Panic behaviour triggered at t=5s |
| 🔵 Rain Delay | Crowd clusters under covered sections |
| 🚨 Chinnaswamy | June 4, 2025 recreation — 2 gates closed, tunnel bottleneck |

---

## 📡 API Reference

### Backend (:5000)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new user account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/venues` | List all venues |
| POST | `/api/venues` | Create venue |
| GET | `/api/events` | List all events |
| POST | `/api/events` | Create event |
| GET | `/api/crowd-history` | Last 60 ML readings from DB |
| GET | `/api/ml/status` | Check if ML engine is reachable |
| GET | `/api/health` | Service + DB health check |

### ML Engine (:8000) — see `/docs` for Swagger UI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/density/analyze` | Classify crowd density and get recommendations |
| POST | `/detection/count` | YOLOv8 person detection from uploaded image |
| POST | `/risk/predict` | ML risk score from crowd parameters |
| GET | `/simulation/scenarios` | List available simulation presets |
| POST | `/simulation/run` | Run agent-based crowd simulation |

---

## 🗂️ Project Structure

```
crowdshield/
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/     # Dashboard, MapView, Events, Detection, Simulation
│   │   ├── components/# Sidebar, Layout
│   │   ├── context/   # SocketContext (shared WebSocket)
│   │   └── hooks/
│   └── Dockerfile
├── backend/           # Node.js + Express + Socket.io
│   ├── src/
│   │   ├── routes/    # authRoutes, apiRoutes, mlRoutes
│   │   ├── controllers/
│   │   ├── config/    # PostgreSQL pool
│   │   └── websocket/ # Socket.io → ML risk loop
│   └── Dockerfile
├── ml-engine/         # Python + FastAPI
│   ├── routers/
│   │   ├── density.py
│   │   ├── detection.py  # YOLOv8
│   │   ├── risk.py       # Random Forest
│   │   └── simulation.py # Social Force Model
│   └── Dockerfile
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## 🛡️ Security Notes

- JWT tokens signed with a configurable secret (rotate in production)
- Passwords hashed with bcrypt (cost factor 10)
- CORS policies restrict origins in production
- All environment variables externalized via `.env`

---

## 📝 License

MIT License — see [LICENSE](LICENSE)

---

<div align="center">

Built with purpose. In memory of the 11 lives lost at Chinnaswamy Stadium.

**[⭐ Star this repo](https://github.com/harsh-kumar-005/crowdshield)** if you found it useful.

</div>
