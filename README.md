# ML-Ops Anomaly Detection

A portfolio project that collects system metrics (CPU & memory), detects anomalies
using machine learning (Isolation Forest), exposes predictions via a REST API (FastAPI),
and displays results on a live web dashboard.

## Tech Stack
- **Python 3.13** — core language
- **psutil** — system metrics collection
- **Pandas & NumPy** — data manipulation
- **Scikit-learn** — Isolation Forest anomaly detection
- **FastAPI + Uvicorn** — REST API backend
- **HTML/CSS/JavaScript** — frontend dashboard
- **Pytest** — testing

## Project Structure
```
metrics/         -> CPU & memory data collection + CSV writing
data/            -> auto-generated CSV logs (git-ignored)
model/           -> Isolation Forest training and prediction
models/          -> saved trained model file (git-ignored)
app/             -> FastAPI REST API backend
dashboard/       -> HTML/CSS/JS frontend (Phase 5)
tests/           -> unit & integration tests (113 passing)
run_collector.py -> entry-point: starts the collection loop
```

## Phase 4: FastAPI REST API Commands

**Start the FastAPI Development Server:**
```powershell
.\venv\Scripts\uvicorn app.main:app --reload --port 8000
```
- Interactive Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Alternative ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### API Endpoints
- `GET  /health` — System health and model availability status
- `GET  /metrics/current` — Latest CPU and memory reading from CSV
- `GET  /metrics/history?limit=100` — Recent metrics records (time-series)
- `POST /predict` — Classify CPU & memory reading (`{"cpu_percent": 25.0, "mem_percent": 60.0}`)
- `GET  /anomalies` — Historical anomalies detected by applying the model

## Phase 3: ML Model Commands

**Step 1 — Collect at least 50 rows of data:**
```powershell
.\venv\Scripts\python run_collector.py --interval 5
```

**Step 2 — Train the Isolation Forest model:**
```powershell
.\venv\Scripts\python -m model.train_model
```

**Step 3 — Run sample predictions:**
```powershell
.\venv\Scripts\python -m model.predict_anomaly
```

**Run All Tests (Phases 1, 2, 3 & 4):**
```powershell
.\venv\Scripts\pytest tests\ -v
```

## Phase 5: React + Vite MLOps Dashboard

**Step 1 — Install frontend dependencies:**
```powershell
cd dashboard
npm install
```

**Step 2 — Launch the React development server:**
```powershell
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

**Running Backend and Dashboard Together:**
- **Terminal 1 (Backend API):**
  ```powershell
  .\venv\Scripts\uvicorn app.main:app --reload --port 8000
  ```
- **Terminal 2 (Telemetry Collector):**
  ```powershell
  .\venv\Scripts\python run_collector.py --interval 2
  ```
- **Terminal 3 (Dashboard UI):**
  ```powershell
  cd dashboard
  npm run dev
  ```

### Dashboard Features
- **Dashboard Overview:** Real-time gauges, core CPU & memory time-series area charts, latest anomaly classification, and recent anomalies table.
- **Live Monitoring:** Real-time radial meters, polling cadence controls (2s, 5s, 10s, 30s), and live incoming reading stream.
- **Metrics History:** Query limit filtering (50 to 1000 records), search/sort, pagination, and direct CSV export.
- **Anomalies Analytics:** Retrospective anomaly rates, critical vs moderate outlier breakdown, and Isolation Forest score diagnostics.
- **Model Information & Sandbox:** Architectural specifications and interactive What-If prediction simulator with preset scenarios.
- **Settings:** Dynamic API Base URL configuration, offline demo stream mode, and automated endpoint healthcheck diagnostic suite.

## Development Phases
- [x] Phase 1: Metrics Collection
- [x] Phase 2: CSV Logger
- [x] Phase 3: ML Model (Isolation Forest)
- [x] Phase 4: FastAPI Backend
- [x] Phase 5: Web Dashboard
