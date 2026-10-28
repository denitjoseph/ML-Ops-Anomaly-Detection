"""
app/services.py
===============
PURPOSE:
    This module contains the business logic the API endpoints delegate to.
    It bridges the gap between FastAPI (HTTP layer) and our existing modules
    (ML layer, CSV layer).

WHY A SERVICES LAYER?
    Without this layer, all logic lives inside route handlers. That makes
    handlers long, hard to test, and hard to reuse.

    With this layer:
        - Handlers stay thin: validate input → call service → return response
        - Services are pure Python: testable without HTTP, without mocking FastAPI
        - Existing modules (collector.py, csv_logger.py, predict_anomaly.py)
          are reused, not duplicated

MODEL CACHING EXPLAINED:
    Loading a scikit-learn model from disk with joblib.load() takes time.
    Loading it on EVERY request (every POST /predict) would add latency.

    Solution: module-level cache variable (_model_cache).
    On first request: load from disk → store in _model_cache.
    On subsequent requests: return _model_cache immediately (no disk I/O).

    This is called the "singleton pattern" for the model.
    The cache is invalidated (set to None) if we detect the model file
    changed, or you can force a reload by restarting the server.

    WHY NOT use Python's @functools.lru_cache?
        lru_cache would also work, but it's harder to test and reset.
        An explicit module-level variable is more transparent.
"""

import csv
import logging
from pathlib import Path
from typing import Optional

from model.predict_anomaly import load_model, predict
from model.train_model import DEFAULT_MODEL, DEFAULT_CSV

# Module-level logger — always use a logger rather than print() in server code.
# Logging can be directed to files, monitoring systems, etc. print() cannot.
logger = logging.getLogger(__name__)

# ─── Model Cache ──────────────────────────────────────────────────────────────
# None means "not yet loaded". Dict means "loaded and ready".
_model_cache: Optional[dict] = None


def get_cached_model(model_path: Path = None) -> dict:
    """
    Return the trained model payload, loading from disk only once.

    WHY 'global _model_cache'?
        To write to a module-level variable inside a function, Python
        requires the 'global' declaration. Without it, Python would create
        a new local variable instead of updating the module-level one.

    Args:
        model_path (Path): Path to the .joblib file. Defaults to DEFAULT_MODEL.

    Returns:
        dict: {'model': IsolationForest, 'features': [...]}

    Raises:
        FileNotFoundError: If the model file does not exist.
    """
    global _model_cache
    if model_path is None:
        model_path = DEFAULT_MODEL

    if _model_cache is None:
        logger.info("Loading model from disk: %s", model_path)
        _model_cache = load_model(model_path)
        logger.info("Model loaded and cached successfully.")

    return _model_cache


def reset_model_cache() -> None:
    """
    Force the next call to get_cached_model() to reload from disk.

    Used in tests so each test starts with a clean slate and isn't
    affected by what a previous test loaded.
    """
    global _model_cache
    _model_cache = None


# ─── Health Check ─────────────────────────────────────────────────────────────

def check_health(model_path: Path = None) -> dict:
    """
    Report whether the API is healthy and whether the model is available.

    We deliberately do NOT cache the health result — it should reflect
    the current state of the model file at the time of the call.

    'status' is "ok" only when the model is available. This follows the
    convention used by production health check systems:
        - "ok"       → all systems go
        - "degraded" → running but some features unavailable

    Returns:
        dict matching HealthResponse schema
    """
    if model_path is None:
        model_path = DEFAULT_MODEL

    model_available = False
    try:
        load_model(model_path)          # just probe — don't cache here
        model_available = True
        message = "API is healthy and model is ready for predictions."
    except FileNotFoundError:
        message = (
            "API is running but no trained model was found. "
            "Run: python -m model.train_model"
        )
    except Exception as exc:
        logger.warning("Health check: model load failed: %s", exc)
        message = f"Model file exists but failed to load: {type(exc).__name__}"

    return {
        "status":       "ok" if model_available else "degraded",
        "model_loaded": model_available,
        "model_path":   str(model_path),
        "message":      message,
    }


# ─── Metrics CSV Reading ──────────────────────────────────────────────────────

def read_metrics_csv(
    csv_path: Path = None,
    limit: Optional[int] = None,
) -> list[dict]:
    """
    Read metrics from the CSV file and return as a list of dicts.

    WHY re-read on every request?
        The CSV is being appended to by run_collector.py. If we cached
        the CSV content, the API would serve stale data. Re-reading is
        the correct trade-off for a file that changes frequently.

        In a production system this would be replaced by a database query.

    WHY reversed order for 'limit'?
        We want the NEWEST rows when limit is applied.
        The CSV is written chronologically (oldest first).
        We read all rows, reverse, then slice — giving the newest 'limit' rows.

    Args:
        csv_path (Path): Path to metrics.csv. Defaults to DEFAULT_CSV.
        limit (int):     Max number of records to return (newest first).
                         None means return all.

    Returns:
        list[dict]: Each dict has keys 'timestamp', 'cpu_percent', 'mem_percent'.

    Raises:
        FileNotFoundError: CSV file does not exist.
        ValueError:        CSV is empty or has no data rows.
    """
    if csv_path is None:
        csv_path = DEFAULT_CSV

    if not csv_path.exists():
        raise FileNotFoundError(
            f"Metrics CSV not found at {csv_path}. "
            "Run the collector first: python run_collector.py"
        )

    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rows.append({
                    "timestamp":   row["timestamp"],
                    "cpu_percent": float(row["cpu_percent"]),
                    "mem_percent": float(row["mem_percent"]),
                })
            except (KeyError, ValueError):
                # Skip malformed rows rather than crashing the whole endpoint
                logger.warning("Skipping malformed CSV row: %s", row)
                continue

    if not rows:
        raise ValueError(
            "Metrics CSV exists but contains no valid data rows. "
            "Run the collector to populate it."
        )

    # Apply limit to the NEWEST rows (reverse chronological → slice → restore order)
    if limit is not None:
        rows = rows[-limit:]    # last N rows = newest N rows

    return rows


# ─── Prediction Service ───────────────────────────────────────────────────────

def run_prediction(
    cpu_percent: float,
    mem_percent: float,
    model_path: Path = None,
) -> dict:
    """
    Run inference using the cached model and return a result dict
    suitable for the PredictResponse schema.

    WHY call predict() from predict_anomaly.py instead of duplicating?
        predict() already handles: validation, model loading, NumPy array
        creation, score extraction. Calling it here keeps this service thin.

        The only addition here is the 'score_note' field — a human-readable
        interpretation of the score added for the API's benefit.

    Returns:
        dict matching PredictResponse schema
    """
    if model_path is None:
        model_path = DEFAULT_MODEL

    # Ensure the model is cached before calling predict()
    # predict() calls load_model() internally, but that would bypass our cache.
    # So we load via cache first, then call predict() with the same path.
    get_cached_model(model_path)

    result = predict(cpu_percent, mem_percent, model_path)

    # Add human-readable score note (score is NOT a probability)
    score = result["score"]
    if score > -0.1:
        score_note = "Very normal — difficult to isolate from the crowd."
    elif score > -0.3:
        score_note = "Borderline — somewhat unusual but not strongly anomalous."
    else:
        score_note = "Strong anomaly — easy to isolate; significantly different from normal."

    return {**result, "score_note": score_note}


# ─── Anomaly Detection over Historical Data ───────────────────────────────────

def get_anomalies_from_history(
    csv_path: Path = None,
    model_path: Path = None,
) -> dict:
    """
    Classify all historical records using the trained model and return
    only the anomalous ones.

    DESIGN DECISION — why classify history here?
        We do not store prediction results in a separate file (that would
        require a Phase 5+ persistence layer). Instead, we classify
        historical rows on-demand when this endpoint is called.

        This is honest: we never claim anomalies were detected live.
        We're applying the model retrospectively to the collected history.

        The 'source' field in the response makes this explicit.

    WHY not retrain here?
        The model was trained once (train_model.py). We reuse that model.
        Retraining on every request would be slow and violate the
        separation principle from Phase 3.

    Returns:
        dict matching AnomaliesResponse schema
    """
    if csv_path is None:
        csv_path = DEFAULT_CSV
    if model_path is None:
        model_path = DEFAULT_MODEL

    # Try to read historical data
    try:
        all_rows = read_metrics_csv(csv_path)
    except (FileNotFoundError, ValueError):
        return {
            "anomalies": [],
            "count":     0,
            "source":    "No historical metrics available. Run the collector first.",
        }

    # Try to use the model
    try:
        get_cached_model(model_path)
    except FileNotFoundError:
        return {
            "anomalies": [],
            "count":     0,
            "source":    "No trained model found. Train the model first: python -m model.train_model",
        }

    anomalies = []
    for row in all_rows:
        try:
            result = predict(row["cpu_percent"], row["mem_percent"], model_path)
            if result["is_anomaly"]:
                anomalies.append({
                    "timestamp":   row["timestamp"],
                    "cpu_percent": row["cpu_percent"],
                    "mem_percent": row["mem_percent"],
                    "score":       result["score"],
                    "label":       result["label"],
                })
        except Exception as exc:
            logger.warning("Skipping row during anomaly scan: %s — %s", row, exc)
            continue

    return {
        "anomalies": anomalies,
        "count":     len(anomalies),
        "source":    (
            f"Classified {len(all_rows)} historical records using the trained model. "
            "These anomalies were detected retrospectively, not in real-time."
        ),
    }
