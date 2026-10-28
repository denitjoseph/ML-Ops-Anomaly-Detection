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
metrics/        → CPU & memory data collection
data/           → auto-generated CSV logs
model/          → Isolation Forest anomaly detector
api/            → FastAPI REST endpoints
dashboard/      → HTML/CSS/JS frontend
tests/          → unit tests
```

## Development Phases
- [x] Phase 1: Metrics Collection
- [ ] Phase 2: CSV Logging
- [ ] Phase 3: ML Model (Isolation Forest)
- [ ] Phase 4: FastAPI Backend
- [ ] Phase 5: Web Dashboard
