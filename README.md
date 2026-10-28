# 🚀 ML-Ops Anomaly Detection Pipeline & Observability Dashboard

[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.162-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.9.1-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Pytest](https://img.shields.io/badge/Pytest-113%20Passed-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white)](https://pytest.org/)

An end-to-end, production-style **MLOps** portfolio project that continuously gathers operating system telemetry (CPU and RAM utilization), persists timestamped time-series records, detects abnormal system behaviors using an unsupervised **Isolation Forest** machine learning algorithm, exposes predictions through a high-performance **FastAPI REST API**, and renders real-time insights on a modern **React observability dashboard**.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [How It Works: End-to-End Pipeline](#-how-it-works-end-to-end-pipeline)
  - [Phase 1: Hardware Telemetry Collector](#phase-1-hardware-telemetry-collector)
  - [Phase 2: CSV Data Logger & Ingestion](#phase-2-csv-data-logger--ingestion)
  - [Phase 3: Machine Learning Engine (Isolation Forest)](#phase-3-machine-learning-engine-isolation-forest)
  - [Phase 4: FastAPI REST Backend](#phase-4-fastapi-rest-backend)
  - [Phase 5: React Observability Dashboard](#phase-5-react-observability-dashboard)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started & Installation](#-getting-started--installation)
- [How to Run the Project](#-how-to-run-the-project)
- [REST API Specifications](#-rest-api-specifications)
- [Machine Learning Deep Dive](#-machine-learning-deep-dive)
- [Test Suite & Quality Assurance](#-test-suite--quality-assurance)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PHYSICAL MACHINE / HOST OS                      │
│                                                                        │
│   psutil Telemetry Collector (run_collector.py / metrics_collector.py) │
│        │                                                               │
│        ▼                                                               │
│   data/metrics.csv  ◄─── Append-only timestamped hardware logs         │
└────────┬───────────────────────────────────────────────────────────────┘
         │
         ├───► [Offline / Scheduled Training: model/train_model.py]
         │          │
         │          ▼
         │     models/anomaly_model.joblib (Trained Isolation Forest)
         │          │
         ▼          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     FASTAPI REST API BACKEND (Port 8000)               │
│                                                                        │
│   • Model Singleton Cache (_model_cache in app/services.py)            │
│   • CORS Middleware (open to all browser origins)                      │
│   • Pydantic Request Validation & Serialisation                        │
│                                                                        │
│   GET  /health            GET  /metrics/current    GET /metrics/history │
│   POST /predict           GET  /anomalies          GET /docs (Swagger)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     VITE + REACT DASHBOARD (Port 5173)                 │
│                                                                        │
│   • Executive Overview & Summary Cards (CPU, RAM, Status, Counts)     │
│   • Recharts Dual Time-Series Area Visualizations with Thresholds      │
│   • Real-Time Radial Arc Meters & Live Polling Ticker                  │
│   • Historical Explorer with Filtering, Pagination & CSV Export        │
│   • Retrospective Anomaly Diagnostics & Severity Breakdown            │
│   • Interactive What-If Prediction Sandbox with Scenario Presets       │
│   • Diagnostics Healthcheck Suite & Offline Demo Telemetry Mode        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🔬 How It Works: End-to-End Pipeline

The project is structured into five cohesive, decoupled engineering phases:

### Phase 1: Hardware Telemetry Collector
- **Location:** [`metrics/metrics_collector.py`](file:///c:/Users/ASUS/Desktop/ML-Ops-Anomaly-Detection/metrics/metrics_collector.py)
- **Mechanism:** Leverages Python's cross-platform `psutil` library to collect:
  - `cpu_percent`: Non-blocking CPU utilization over system execution threads.
  - `mem_percent`: System physical RAM allocation percentage.
- **Output:** Structured snapshot dictionary with ISO-8601 timestamps:
  ```json
  {
    "timestamp": "2026-10-28T15:30:00.123456",
    "cpu_percent": 24.5,
    "mem_percent": 58.2
  }
  ```

### Phase 2: CSV Data Logger & Ingestion
- **Location:** [`metrics/csv_logger.py`](file:///c:/Users/ASUS/Desktop/ML-Ops-Anomaly-Detection/metrics/csv_logger.py)
- **Mechanism:** Provides safe, atomic persistence to `data/metrics.csv` using Python's standard `csv.DictWriter` and `pathlib.Path`.
- **Key Safety Guarantees:**
  - Automatically creates the `data/` directory if missing.
  - Header idempotency: writes column headers (`timestamp,cpu_percent,mem_percent`) only on file creation. Subsequent sessions append without duplicating headers or truncating historical data.
  - Runner utility ([`run_collector.py`](file:///c:/Users/ASUS/Desktop/ML-Ops-Anomaly-Detection/run_collector.py)) allows configurable polling intervals (e.g. `--interval 2`).

### Phase 3: Machine Learning Engine (Isolation Forest)
- **Location:** [`model/train_model.py`](file:///c:/Users/ASUS/Desktop/ML-Ops-Anomaly-Detection/model/train_model.py) & [`model/predict_anomaly.py`](file:///c:/Users/ASUS/Desktop/ML-Ops-Anomaly-Detection/model/predict_anomaly.py)
- **Algorithm:** Scikit-learn's `IsolationForest` (unsupervised ensemble of isolation trees).
- **Core Principle:** Instead of modeling dense clusters (like k-means or Gaussian mixtures), the algorithm recursively isolates observations with random binary splits. Outliers and anomalous spikes are rare and distant, meaning they require **fewer splits** (shorter tree path lengths) to isolate.
- **Features:** 2-dimensional continuous telemetry space: `[cpu_percent, mem_percent]`.
- **Contamination:** Configured to `0.05` (assumes ~5% of observations represent atypical workloads).
- **Persistence:** Trained artifact and feature schema are serialized via `joblib` to [`models/anomaly_model.joblib`](file:///c:/Users/ASUS/Desktop/ML-Ops-Anomaly-Detection/models/).

### Phase 4: FastAPI REST Backend
- **Location:** [`app/main.py`](file:///c:/Users/ASUS/Desktop/ML-Ops-Anomaly-Detection/app/main.py), [`app/services.py`](file:///c:/Users/ASUS/Desktop/ML-Ops-Anomaly-Detection/app/services.py), [`app/schemas.py`](file:///c:/Users/ASUS/Desktop/ML-Ops-Anomaly-Detection/app/schemas.py)
- **Architecture:** Clean layered design separating HTTP routing from business logic:
  - **Route Handlers (`main.py`):** Lean endpoints managing status codes and OpenAPI metadata.
  - **Pydantic Schemas (`schemas.py`):** Strict boundary validation (`0.0 <= percentage <= 100.0`), returning HTTP 422 automatically for malformed requests.
  - **Service Layer (`services.py`):** Houses the **Model Singleton Cache** (`_model_cache`), ensuring the `.joblib` model is loaded into memory only once rather than incurring disk I/O on every incoming request.
  - **CORS Middleware:** Configured with `allow_origins=["*"]` to allow seamless local browser dashboard requests.

### Phase 5: React Observability Dashboard
- **Location:** [`dashboard/`](file:///c:/Users/ASUS/Desktop/ML-Ops-Anomaly-Detection/dashboard/)
- **Technology:** React 19, Vite, Recharts, Lucide-React.
- **UI/UX Aesthetics:** Deep navy dark theme (`#070b13`) with subtle glassmorphic panels and color-coded telemetry indicators:
  - 🟢 **Emerald:** Nominal system behavior and healthy baseline.
  - 🟡 **Amber:** Elevated memory pressure or warning loads (`> 70%`).
  - 🔴 **Rose:** Anomaly detection alerts and severe processor spikes (`> 85%`).
- **Features:**
  - **Collapsible Navigation:** Fast switching between Dashboard, Live Monitoring, Metrics History, Anomalies, Model Information, and Settings.
  - **Dual Time-Series Charts:** Responsive SVG area charts with custom tooltips, gradients, and reference threshold lines.
  - **Interactive What-If Prediction Sandbox:** Users can manipulate CPU/RAM sliders or select workload presets to get instantaneous inference directly from the backend model.
  - **Built-in Diagnostics & Demo Mode:** Automated endpoint ping tester with latency tracking, plus an offline demo stream toggle for UI reviews when the backend is not running.

---

## 📂 Project Directory Structure

```text
ML-Ops-Anomaly-Detection/
│
├── metrics/                        # Phase 1 & 2: Telemetry collection and CSV persistence
│   ├── __init__.py                 # Makes metrics/ a Python package
│   ├── metrics_collector.py        # psutil wrappers for CPU & RAM sampling
│   └── csv_logger.py               # Append-only CSV logger with header management
│
├── model/                          # Phase 3: Machine learning engine
│   ├── __init__.py                 # Makes model/ a Python package
│   ├── train_model.py              # Loads CSV data, validates, and fits IsolationForest
│   └── predict_anomaly.py          # Loads cached artifact, validates inputs, infers labels
│
├── app/                            # Phase 4: FastAPI REST API backend
│   ├── __init__.py                 # Makes app/ a Python package
│   ├── main.py                     # FastAPI application instance, CORS, and route definitions
│   ├── schemas.py                  # Pydantic models for request & response validation
│   └── services.py                 # Business logic, CSV reader, and model singleton caching
│
├── dashboard/                      # Phase 5: Modern React observability dashboard
│   ├── .env                        # Default backend URL configuration (VITE_API_BASE_URL)
│   ├── index.html                  # HTML entry point with fonts & dark theme meta tags
│   ├── package.json                # Frontend dependencies: React, Recharts, Lucide-React
│   ├── vite.config.js              # Vite build and development configuration
│   └── src/
│       ├── index.css               # Design system tokens, glassmorphism, animations
│       ├── App.jsx                 # Application layout, state coordination, polling timer
│       ├── services/
│       │   └── api.js              # Client HTTP module with timeout & error handling
│       ├── components/
│       │   ├── TopNav.jsx          # Connection indicator, refresh trigger, live toggle
│       │   ├── Sidebar.jsx         # Collapsible navigation sidebar with badge counters
│       │   ├── SummaryCards.jsx    # Real-time metric cards with progress meters
│       │   ├── MetricsCharts.jsx   # Recharts dual-area plots with alert threshold lines
│       │   ├── RecentAnomaliesTable.jsx # Recent anomaly logs with severity badges
│       │   └── SystemStatusBar.jsx # Status banner for FastAPI, model, and CSV logs
│       └── views/
│           ├── DashboardView.jsx   # Main monitoring overview
│           ├── LiveMonitoringView.jsx # Radial arc meters & real-time telemetry stream
│           ├── HistoryView.jsx     # Historical explorer with search, pagination & CSV export
│           ├── AnomaliesView.jsx   # Retrospective anomaly analytics & rate breakdown
│           ├── ModelInfoView.jsx   # Model architecture & interactive What-If sandbox
│           └── SettingsView.jsx    # API URL configuration & diagnostic suite
│
├── tests/                          # Automated Pytest suite (113 passing tests)
│   ├── __init__.py                 # Makes tests/ a Python package
│   ├── test_collector.py           # Phase 1 unit tests
│   ├── test_csv_logger.py          # Phase 2 unit tests
│   ├── test_ml_model.py            # Phase 3 ML model validation & training tests
│   └── test_api.py                 # Phase 4 FastAPI TestClient integration tests
│
├── data/                           # Generated metrics CSV logs (git-ignored)
│   └── metrics.csv                 # Continuous hardware telemetry dataset
│
├── models/                         # Serialized ML artifacts (git-ignored)
│   └── anomaly_model.joblib        # Trained Isolation Forest model artifact
│
├── requirements.txt                # Pinned Python package dependencies
├── run_collector.py                # Standalone background collector loop executable
└── README.md                       # Comprehensive project documentation
```

---

## ⚡ Getting Started & Installation

### Prerequisites
- **Python:** Version 3.10 or higher (Python 3.13 tested and confirmed).
- **Node.js:** Version 18.0 or higher (Node 24 tested and confirmed).
- **Git:** Standard git version control.

### 1. Clone the Repository
```powershell
git clone https://github.com/denitjoseph/ML-Ops-Anomaly-Detection.git
cd ML-Ops-Anomaly-Detection
```

### 2. Setup Python Virtual Environment
```powershell
# Create virtual environment
python -m venv venv

# Activate on Windows PowerShell
.\venv\Scripts\Activate.ps1

# Install backend dependencies
pip install -r requirements.txt
```

### 3. Setup Frontend Dashboard
```powershell
cd dashboard
npm install
cd ..
```

---

## 🎮 How to Run the Project

### Initial Setup: Collect Data & Train Model

Before launching the full pipeline for the first time, collect a sample baseline and train your model:

```powershell
# Step 1: Run collector for 1-2 minutes to gather 50+ rows
.\venv\Scripts\python run_collector.py --interval 2
# (Press Ctrl+C after ~1 minute)

# Step 2: Train the Isolation Forest model
.\venv\Scripts\python -m model.train_model
```

---

### Running the Complete Stack (3 Terminals)

Open **three separate PowerShell terminals** in the project root:

#### 🖥️ Terminal 1 — Telemetry Collector
Continuously measures CPU and memory usage every 2 seconds:
```powershell
.\venv\Scripts\python run_collector.py --interval 2
```

#### ⚙️ Terminal 2 — FastAPI REST Backend
Starts the ASGI server on port `8000`:
```powershell
.\venv\Scripts\uvicorn app.main:app --reload --port 8000
```
- Interactive Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Alternative ReDoc UI: [http://localhost:8000/redoc](http://localhost:8000/redoc)

#### 🌐 Terminal 3 — React Dashboard Frontend
Serves the web application on port `5173`:
```powershell
cd dashboard
npm run dev
```
- Open in your browser: **[http://localhost:5173](http://localhost:5173)**

---

## 📡 REST API Specifications

The FastAPI backend exposes five REST endpoints adhering to standard HTTP semantics:

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/health` | Verifies server readiness and model availability | `200 OK` |
| `GET` | `/metrics/current` | Returns the most recent hardware telemetry reading | `200 OK`, `404 Not Found` |
| `GET` | `/metrics/history?limit=100` | Retrieves chronological time-series slice (1 to 1000 items) | `200 OK`, `404 Not Found`, `422 Unprocessable` |
| `POST` | `/predict` | Classifies a CPU/RAM coordinate as `NORMAL` or `ANOMALY` | `200 OK`, `422 Unprocessable`, `503 Unavailable` |
| `GET` | `/anomalies` | Retrospectively identifies all historical outlier events | `200 OK` |

### Sample Endpoints & Payloads

#### `GET /health`
```json
{
  "status": "ok",
  "model_loaded": true,
  "model_path": "c:\\Users\\ASUS\\Desktop\\ML-Ops-Anomaly-Detection\\models\\anomaly_model.joblib",
  "message": "API is healthy and model is ready for predictions."
}
```

#### `GET /metrics/current`
```json
{
  "latest": {
    "timestamp": "2026-10-28T15:30:15.102345",
    "cpu_percent": 24.8,
    "mem_percent": 61.4
  },
  "total_records": 128
}
```

#### `POST /predict`
- **Request Body:**
  ```json
  {
    "cpu_percent": 98.5,
    "mem_percent": 96.0
  }
  ```
- **Response Payload:**
  ```json
  {
    "label": "ANOMALY",
    "is_anomaly": true,
    "score": -0.4851,
    "cpu_percent": 98.5,
    "mem_percent": 96.0,
    "score_note": "Strong anomaly — easy to isolate; significantly different from normal."
  }
  ```

---

## 🧠 Machine Learning Deep Dive

### Why Isolation Forest for Server Telemetry?

Traditional anomaly detection algorithms (such as k-Means or DBSCAN) rely on density estimation or distance metrics. In real-world computing environments:
1. Normal workloads vary dynamically across time.
2. Distance-based metrics suffer from computational bottlenecks during real-time inference.
3. Isolation Forest operates with $O(n \cdot \log n)$ training complexity and $O(t \cdot \log n)$ inference complexity, where $t$ is the number of trees.

### Anomaly Score Interpretation

The Isolation Forest assigns an anomaly score $s(x, n)$ based on the expected tree depth $E(h(x))$:

$$s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$

In Scikit-learn's implementation:
- **Positive Scores / Near Zero (`score > -0.10`):** Observation falls into a dense cluster of baseline activity. Requires many random cuts to isolate. Classified as **NORMAL**.
- **Borderline Scores (`-0.30 <= score <= -0.10`):** Moderately unusual workload (e.g. temporary build task).
- **Strong Negative Scores (`score < -0.30`):** Extreme outlier (e.g. runaway infinite loop or memory leak). Easily partitioned with very few cuts. Classified as **ANOMALY**.

---

## 🧪 Test Suite & Quality Assurance

The project enforces strict software engineering standards with **113 automated unit and integration tests** implemented in Pytest:

```powershell
.\venv\Scripts\pytest tests/ -v
```

### Test Coverage Summary

```text
============================== 113 passed in 14.45s ==============================
  • Phase 1 (Collector Tests):     11 passed   (psutil bounds, types, ISO formats)
  • Phase 2 (CSV Logger Tests):    13 passed   (atomic append, idempotency, schemas)
  • Phase 3 (ML Model Tests):      40 passed   (validation, training, joblib, edge cases)
  • Phase 4 (FastAPI API Tests):   49 passed   (TestClient integration, CORS, mocking)
```

---

## 🛠️ Troubleshooting & FAQs

### 1. Frontend shows "Offline" badge
- **Cause:** The FastAPI server is not running on port `8000`.
- **Solution:** In Terminal 2, start the server:
  ```powershell
  .\venv\Scripts\uvicorn app.main:app --reload --port 8000
  ```

### 2. Frontend shows "Model Missing" / Status 503
- **Cause:** The model artifact `models/anomaly_model.joblib` has not been generated yet.
- **Solution:** Collect at least 50 metrics rows, then run:
  ```powershell
  .\venv\Scripts\python -m model.train_model
  ```

### 3. Metrics History shows "No Data Recorded Yet" / Status 404
- **Cause:** `data/metrics.csv` does not exist or has zero data rows.
- **Solution:** Start the collector in Terminal 1:
  ```powershell
  .\venv\Scripts\python run_collector.py --interval 2
  ```

### 4. How do I change the backend port?
- Start Uvicorn on your desired port:
  ```powershell
  .\venv\Scripts\uvicorn app.main:app --port 8080
  ```
- Open the dashboard at [http://localhost:5173](http://localhost:5173), navigate to **Settings**, change the **Backend API Base URL** to `http://127.0.0.1:8080`, and click **Save URL**.

---

## 📜 License

This project is licensed under the MIT License — open for academic, educational, and portfolio use.
