# 🏥 AI-Powered Rural HealthTech & MedAI Platform

A full-stack AI-powered remote healthcare platform for rural and underserved populations. Features AI diagnostics, emergency triage, real-time ambulance tracking, and hospital workflow automation.

![Platform](https://img.shields.io/badge/Platform-Web-blue)
![AI](https://img.shields.io/badge/AI-Machine%20Learning-green)
![Status](https://img.shields.io/badge/Status-MVP-orange)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              Frontend (React + Vite)             │
│   Patient Portal │ Doctor Panel │ Admin Dashboard │
│   Tailwind CSS │ Framer Motion │ Three.js │ Recharts│
└──────────────────────┬──────────────────────────┘
                       │
              ┌────────▼────────┐
              │  Backend (Express│
              │  + Socket.IO)    │
              │  JWT │ AES-256   │
              └────┬───────┬────┘
                   │       │
          ┌────────▼──┐ ┌──▼─────────┐
          │ MongoDB   │ │ AI Service  │
          │ (Mongoose)│ │ (FastAPI)   │
          └───────────┘ │ scikit-learn│
                        └────────────┘
```

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS v4 |
| Animations | Framer Motion |
| Charts | Recharts |
| 3D Visualization | Three.js, @react-three/fiber |
| Maps | Leaflet.js (OpenStreetMap) |
| Backend | Node.js, Express.js, Socket.IO |
| Auth | JWT, bcryptjs, AES-256 encryption |
| Database | MongoDB, Mongoose |
| AI/ML | Python, FastAPI, Scikit-learn |

## 📋 Features

### Patient Portal
- 🩺 AI-powered symptom analysis with 3-step wizard
- 📊 Interactive diagnosis results with circular risk meter
- 📈 Health trends with 4 types of charts
- 🚨 Emergency SOS button
- ❤️ 3D Heart health visualization (Three.js)

### Hospital Admin Dashboard
- 🏥 Real-time hospital network overview
- 🛏️ Bed occupancy charts (ICU/Emergency/General)
- 👨‍⚕️ Doctor workload monitoring
- 🚑 Ambulance fleet management
- ⚡ Live emergency alerts

### Doctor Panel
- 👥 Patient queue with expandable case details
- 🧠 AI diagnosis review with explainable output
- 📊 Weekly case distribution charts
- 🔴 Emergency alert panel

### AI Diagnostic Engine
- 🤖 Decision Tree model trained on synthetic healthcare data
- 🎯 10 disease classifications
- 📊 Risk scoring (0–100%)
- 🏥 Triage: Routine / Urgent / Emergency
- 🔍 Explainable AI with feature importance

### Emergency Workflow
- 📍 Auto-find nearest hospital (Haversine distance)
- 👨‍⚕️ Auto-assign doctor by availability
- 🛏️ Auto-reserve ICU/Emergency bed
- 🚑 Auto-dispatch ambulance
- ⏱️ Real-time ETA tracking

## 🛠️ Setup Instructions

### Prerequisites
- Node.js v18+
- Python 3.8+
- MongoDB (local or Atlas)

### 1. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# AI Service
cd ../ai-service
pip install -r requirements.txt
```

### 2. Configure Environment

Create `backend/.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/rural-health
JWT_SECRET=your-secret-key
ML_SERVICE_URL=http://localhost:8000
```

### 3. Seed Database

```bash
cd backend
npm run seed
```

This creates:
- 5 hospitals (Telangana region)
- 15 doctors across specializations
- 10 ambulances
- 3 demo users

### 4. Start Services

```bash
# Terminal 1: AI Service
cd ai-service
python main.py

# Terminal 2: Backend
cd backend
npm start

# Terminal 3: Frontend
cd frontend
npm run dev
```

### 5. Access Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **AI Service**: http://localhost:8000

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Patient | patient@demo.com | password123 |
| Doctor | doctor@demo.com | password123 |
| Admin | admin@demo.com | password123 |

## 📁 Project Structure

```
├── frontend/
│   ├── src/
│   │   ├── components/     (Layout, shared components)
│   │   ├── context/        (AuthContext)
│   │   ├── pages/          (10 page components)
│   │   ├── utils/          (API client)
│   │   ├── App.jsx         (Router + auth guards)
│   │   └── index.css       (Tailwind + design system)
│   └── index.html
│
├── backend/
│   ├── config/             (Database connection)
│   ├── middleware/          (JWT auth, AES-256 encryption)
│   ├── models/             (6 Mongoose schemas)
│   ├── routes/             (Auth, Diagnosis, Hospitals, Emergency)
│   ├── index.js            (Express + Socket.IO server)
│   └── seed.js             (Demo data seeder)
│
├── ai-service/
│   ├── main.py             (FastAPI server)
│   ├── model.py            (ML model + training)
│   └── requirements.txt
│
└── README.md
```

## 🔒 Security

- **JWT Authentication** with role-based access control
- **bcrypt** password hashing (10 rounds)
- **AES-256-CBC** encryption for medical records
- **CORS** configured for frontend access
- **Protected routes** with middleware guards

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| POST | /api/diagnosis | Run AI diagnosis |
| GET | /api/diagnosis/history | Diagnosis history |
| GET | /api/hospitals | List hospitals |
| POST | /api/emergency/trigger | Trigger emergency workflow |
| GET | /api/emergency/active | Active emergencies |
| POST | /predict (AI) | ML prediction |

## 📄 License

MIT License — Built for hackathon demonstration and startup MVP development.
