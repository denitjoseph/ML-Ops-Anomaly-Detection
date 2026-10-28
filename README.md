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
api/             -> FastAPI REST endpoints (Phase 4)
dashboard/       -> HTML/CSS/JS frontend (Phase 5)
tests/           -> unit tests (all phases)
run_collector.py -> entry-point: starts the collection loop
```

## Phase 3: Training and Prediction Commands

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

**Run all tests (Phases 1, 2 and 3):**
```powershell
.\venv\Scripts\pytest tests\ -v
```

## Development Phases
- [x] Phase 1: Metrics Collection
- [x] Phase 2: CSV Logger
- [x] Phase 3: ML Model (Isolation Forest)
- [ ] Phase 4: FastAPI Backend
- [ ] Phase 5: Web Dashboard
