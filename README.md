# MechCareX

**IoT-Based Predictive Maintenance and Real-Time Health Monitoring System for Rotating Mechanical Machines**

MechCareX is a virtual IoT predictive-maintenance platform that simulates rotating industrial machines, detects faults in real time, analyses vibration spectra, and provides AI-powered maintenance insights.

---

## Architecture

```
Virtual Factory (localhost:8000)
        │
        │  WebSocket (1s tick) + REST API
        ▼
FastAPI Backend
        │
        ├── Health Scoring (weighted sensor sub-scores)
        ├── Anomaly Detection (rule-based, per-sensor thresholds)
        ├── Fault Classification (anomaly combination + FFT harmonics)
        ├── FFT Vibration Analysis (256-sample Hanning-windowed rfft)
        ├── Persistent Alerts (PostgreSQL + in-memory RT)
        ├── Maintenance Records (PostgreSQL)
        ├── Gemini AI Analysis (on-demand, fingerprint-cached)
        └── PDF Report Generation (ReportLab)
        │
        │  REST API
        ▼
Next.js Dashboard (localhost:3000)
        │
        ├── Real-time Dashboard
        ├── Machine Detail Pages
        ├── Analytics
        ├── Alerts
        ├── AI Insights (Gemini)
        ├── Maintenance Records
        ├── Reports + PDF Export
        └── Demo Mode
```

---

## Technologies

**Backend**
- FastAPI 0.111 — REST API + WebSocket
- SQLAlchemy 2.0 async + asyncpg — PostgreSQL ORM
- PostgreSQL 15 — sensor readings, alerts, maintenance records, AI cache, reports
- NumPy — vibration signal generation and FFT
- SciPy — signal processing utilities
- Google Generative AI — Gemini 1.5 Flash AI analysis
- ReportLab — professional PDF report generation
- Pydantic v2 — data validation and settings

**Frontend**
- Next.js 14 (App Router)
- Recharts — live trend charts, health radar, FFT spectrum
- Lucide React — icons
- TypeScript — full type coverage

---

## Setup

Follow these steps **in order**. The whole process takes about 5–10 minutes on a fresh machine.

---

### Prerequisites

Before you begin, make sure the following tools are installed:

| Tool | Version | How to check | Install |
|------|---------|--------------|---------|
| Docker Desktop | Any recent | `docker --version` | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| Python | 3.12 | `python3.12 --version` | [python.org](https://www.python.org) or `brew install python@3.12` |
| Node.js | 18 or newer | `node --version` | [nodejs.org](https://nodejs.org) or `brew install node` |
| npm | comes with Node | `npm --version` | — |

> **macOS note:** Python 3.12 installed via Homebrew lives at `/opt/homebrew/bin/python3.12`. If you used the official installer it may be at `/usr/local/bin/python3.12`. Run `which python3.12` to confirm your path.

---

### Step 1 — Clone the project

```bash
git clone <repo-url>
cd MechCareX
```

---

### Step 2 — Create the environment file

The project needs a `.env` file at the project root. Copy the example file and fill it in:

```bash
cp .env.example .env
```

Open `.env` in any text editor. It will look like this:

```env
# Database — leave these exactly as-is unless you changed docker-compose.yml
DATABASE_URL=postgresql+asyncpg://rotaryguard:rotaryguard_secret@localhost:5432/rotaryguard
POSTGRES_USER=rotaryguard
POSTGRES_PASSWORD=rotaryguard_secret
POSTGRES_DB=rotaryguard

# Server ports
BACKEND_PORT=8000
FRONTEND_PORT=3000

# Optional — Gemini AI (leave blank to skip AI features)
GEMINI_API_KEY=
```

- **Database values:** Do not change these unless you modified `docker-compose.yml`. They must match exactly.
- **GEMINI_API_KEY:** Leave blank for now — all core features (dashboard, alerts, FFT, reports) work without it. You can add it later (see Step 6).

---

### Step 3 — Start the database

MechCareX uses PostgreSQL running inside Docker. Make sure Docker Desktop is open and running, then:

```bash
# From the project root (MechCareX/)
docker compose up -d postgres
```

**What this does:** Pulls the `postgres:15-alpine` image (first time only), creates the database, and starts it in the background on port `5432`.

**Verify it's running:**
```bash
docker ps
```
You should see a container named `rotaryguard_db` with status `Up` and `healthy`.

> If the container exits immediately, run `docker compose logs postgres` to see what went wrong. The most common cause is port 5432 already being used by another PostgreSQL installation — stop the other one first.

---

### Step 4 — Set up and start the backend

Open a terminal window (keep it open — the backend runs here):

```bash
# 1. Go into the backend folder
cd backend

# 2. Create a Python virtual environment
#    Use whichever path matches your Python 3.12 installation
/opt/homebrew/bin/python3.12 -m venv venv

# 3. Activate the virtual environment
#    You should see (venv) appear in your prompt after this
source venv/bin/activate

# 4. Install all Python dependencies
#    This takes 1–2 minutes the first time
pip install -r requirements.txt

# 5. Start the backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**You'll know it's working when you see:**
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Verify it's working** — open a second terminal and run:
```bash
curl http://localhost:8000/health
```
You should get back `{"service": "mechcarex-backend", "status": "ok", ...}`.

> **Leave this terminal open.** The backend must stay running the whole time you use the dashboard.

> **Common issue — ModuleNotFoundError:** Make sure you ran `source venv/bin/activate` before `pip install` and `uvicorn`. Your prompt should start with `(venv)`.

---

### Step 5 — Set up and start the frontend

Open a **new** terminal window (keep the backend terminal from Step 4 open):

```bash
# 1. Go into the frontend folder (from the project root)
cd frontend

# 2. Install JavaScript dependencies
#    This takes 1–3 minutes the first time (downloads node_modules)
npm install

# 3. Start the Next.js dev server
npm run dev
```

**You'll know it's working when you see:**
```
▲ Next.js 14.x.x
  - Local: http://localhost:3000
✓ Ready in ~1s
```

**Open the dashboard:** Go to [http://localhost:3000](http://localhost:3000) in your browser.

You should see the MechCareX dashboard with 3 machines (M01, M02, M03) showing live sensor data updating every second.

> **Leave this terminal open too.** You now have two terminals running — one for the backend (port 8000) and one for the frontend (port 3000).

---

### Step 6 — (Optional) Add a Gemini API key for AI features

The AI Insights page and "Analyze with Gemini" button require a Google Gemini API key.

**Get a free key:**
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with a Google account
3. Click **Get API Key** → **Create API key**
4. Copy the key

**Add it to your `.env` file:**
```env
GEMINI_API_KEY=your_key_here
```

**Restart the backend** (stop with `Ctrl+C` in the backend terminal, then run `uvicorn` again) — the backend reads the key at startup.

The AI feature is completely optional. Every other page — Dashboard, Machines, Alerts, Analytics, Maintenance, Reports, Demo Mode — works without it.

---

### Ports at a glance

| Port | Service | URL |
|------|---------|-----|
| 3000 | Monitoring Dashboard (Next.js frontend) | http://localhost:3000 |
| 8000 | Virtual Factory / API (FastAPI backend) | http://localhost:8000 |
| 5432 | PostgreSQL database (Docker) | — internal only — |

---

### Stopping everything

```bash
# Stop the frontend: Ctrl+C in the frontend terminal

# Stop the backend: Ctrl+C in the backend terminal

# Stop the database
docker compose down
```

To also delete the stored sensor data and alerts:
```bash
docker compose down -v   # removes the postgres_data volume
```

---

### Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| `connection refused` on port 8000 | Backend not running | Run `uvicorn` again in the backend terminal |
| `connection refused` on port 5432 | Docker not running or container stopped | Open Docker Desktop, then `docker compose up -d postgres` |
| `ModuleNotFoundError` in backend | venv not activated | Run `source venv/bin/activate` first |
| Frontend shows "Connecting…" forever | Backend is down | Restart the backend |
| `port already in use` on 3000 or 8000 | Another process using that port | `lsof -i :8000` to find and kill it |
| Gemini button gives error | API key missing or wrong | Check `GEMINI_API_KEY` in `.env` and restart backend |

---

## Machines

| Code | Name | Type | RPM | Power |
|------|------|------|-----|-------|
| M01 | Industrial Motor 01 | Three-phase induction motor | 1450 | 2.2 kW |
| M02 | Centrifugal Pump 02 | Single-stage centrifugal pump | 1750 | 3.7 kW |
| M03 | Cooling Fan 03 | Industrial axial fan | 1200 | 1.1 kW |

---

## Sensor Simulation

Each machine generates 5 sensors per tick (1-second interval):

| Sensor | Unit | Description |
|--------|------|-------------|
| Temperature | °C | Bearing and motor winding temperature |
| Vibration | g | RMS vibration amplitude |
| Current | A | Motor phase current draw |
| RPM | rpm | Shaft rotational speed |
| Acoustic | dB | Structural acoustic emission |

Sensors use deterministic per-machine RNG seeded from the machine code, ensuring consistent noise character while remaining reproducible.

---

## Fault Models

| Fault | Primary Effects |
|-------|----------------|
| BEARING_FAILURE | Vibration ↑↑, temperature ↑, current ↑, acoustic ↑, RPM ↓ |
| IMBALANCE | 1× RPM vibration dominant ↑↑, stable RPM |
| MISALIGNMENT | 2× RPM vibration dominant ↑↑ |
| OVERLOAD | Current ↑↑, RPM ↓, temperature ↑ |
| OVERHEATING | Temperature ↑↑ only |
| RPM_ANOMALY | RPM deviation, elevated vibration |
| ACOUSTIC_ANOMALY | Acoustic emission elevated only |

---

## Health Score

Weighted average of 5 sensor sub-scores (0–100):

| Sensor | Weight |
|--------|--------|
| Vibration | 30% |
| Temperature | 20% |
| Current | 20% |
| RPM | 15% |
| Acoustic | 15% |

**Thresholds:** HEALTHY ≥ 90 · WARNING ≥ 70 · DEGRADED ≥ 40 · CRITICAL < 40

---

## FFT / Vibration Analysis

- 256 samples per tick at 5 kHz sampling rate
- Hanning window applied before rfft to reduce spectral leakage
- Frequency bins trimmed to 200 Hz
- 1×, 2×, 3× RPM harmonic reference lines
- Dominant harmonic used for fault classification:
  - 1× dominant → IMBALANCE
  - 2× dominant → MISALIGNMENT
  - Sub- and super-harmonics → BEARING_FAILURE

---

## AI Integration

Gemini AI receives a structured engineering analysis — not raw sensor streams:

```
Machine state (engine)
        ↓
Health scoring
        ↓
Anomaly detection
        ↓
Fault classification
        ↓
FFT harmonic analysis
        ↓
Structured context (machine, baselines, deviations, anomalies, FFT)
        ↓
Gemini 1.5 Flash
        ↓
Structured JSON response (summary, cause, risk, evidence, recommendations)
        ↓
Fingerprint-cached in PostgreSQL
```

AI responses are cached by condition fingerprint (machine + fault + severity + health quartile). Gemini is never called automatically — only on explicit user request.

---

## Reports

Reports are generated on demand via `POST /api/reports/generate`:
- Current sensor values vs. baselines
- Health sub-scores
- Detected anomalies
- Fault classification
- FFT vibration analysis
- AI assessment (if available in DB)
- Maintenance records

PDF export via `POST /api/reports/generate/pdf` uses ReportLab with MechCareX branding and colour palette.

---

## API Endpoints

```
GET  /health                               System health check
WS   /ws                                   Real-time telemetry WebSocket

GET  /api/machines                         List machines
GET  /api/machines/{code}/health           Health + anomaly analysis
GET  /api/machines/{code}/vibration-spectrum  FFT spectrum

POST /api/simulation/machines/{code}/fault  Inject fault
POST /api/simulation/machines/{code}/reset  Reset to normal

GET  /api/alerts                           All alerts (in-memory + DB history)
GET  /api/alerts/active                    Active alerts only
POST /api/alerts/{id}/acknowledge          Acknowledge alert

GET  /api/maintenance                      List maintenance records
POST /api/maintenance                      Create record
PATCH /api/maintenance/{id}               Update status/notes

POST /api/ai/machines/{code}/analyze       Run Gemini AI analysis
GET  /api/ai/machines/{code}/latest        Latest cached AI analysis

POST /api/reports/generate                 Generate report (JSON)
POST /api/reports/generate/pdf             Generate PDF report
GET  /api/reports/history                  Report generation history

GET  /api/analytics/overview               Factory-level summary
```

---

## Faculty Demonstration Flow (5–7 minutes)

1. Open `localhost:3000` — show factory overview with 3 healthy machines
2. Open `localhost:8000` — demonstrate Virtual Factory UI simulation
3. Navigate to **Demo Mode** → select Machine M02 → Bearing Failure → Start Demo
4. Switch to **Dashboard** — watch health score drop, alert appear in real time
5. Open **Machine M02** detail — show sensor cards, trend charts, vibration spectrum (1× harmonic)
6. Navigate to **AI Insights** → select M02 → click "Analyze with Gemini"
7. Review AI summary, risk level, evidence, and recommendations
8. In Machine M02 detail — click "Create Maintenance Record"
9. Navigate to **Maintenance** → advance record: OPEN → IN PROGRESS → COMPLETED
10. Navigate to **Reports** → select M02, Last 24 Hours → Generate Report
11. Click **Export PDF** → open and review the professional document
12. Return to **Demo Mode** → Stop Demo (M02 resets to normal)
13. Navigate to **Alerts** — show resolved alert in history
14. Navigate to **Analytics** — show health comparison and radar chart

Total duration: approximately 6 minutes.
