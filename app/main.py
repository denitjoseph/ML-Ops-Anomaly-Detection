"""
app/main.py
===========
PURPOSE:
    The FastAPI application entry point. This file wires together:
        - The FastAPI app instance and its configuration
        - CORS middleware (needed for the browser dashboard in Phase 5)
        - All API route handlers
        - Startup/shutdown events

WHY FastAPI?
    FastAPI is a modern Python web framework that:
        1. Uses Python type hints to validate requests automatically
        2. Generates interactive API documentation (Swagger UI) with zero
           extra configuration — just visit /docs in your browser
        3. Is built on Starlette (ASGI), making it asynchronous-ready
        4. Uses Pydantic for request/response validation

WHAT IS CORS?
    CORS (Cross-Origin Resource Sharing) is a browser security rule that
    blocks JavaScript from calling a server on a DIFFERENT origin.

    Example: Your dashboard (http://localhost:3000) tries to call this API
    (http://localhost:8000). The browser blocks it unless the API explicitly
    says "requests from localhost:3000 are allowed."

    allow_origins=["*"] allows ALL origins — fine for local development,
    never use in production without an allowlist.

WHAT IS AN ASGI APP?
    ASGI (Asynchronous Server Gateway Interface) is the modern standard for
    Python web applications. Uvicorn is the ASGI server that runs our app.

HTTP STATUS CODE CONVENTIONS USED HERE:
    200 OK                → success
    404 Not Found         → resource doesn't exist (e.g. CSV not found)
    422 Unprocessable     → validation error (handled automatically by FastAPI)
    503 Service Unavailable → server is up but a dependency is missing (model)
"""

import logging
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import (
    HealthResponse,
    CurrentMetricsResponse,
    HistoryResponse,
    MetricRecord,
    PredictRequest,
    PredictResponse,
    AnomaliesResponse,
    AnomalyRecord,
)
from app import services

# Configure logging so we see informational messages in the Uvicorn console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)s  %(levelname)s  %(message)s",
)
logger = logging.getLogger(__name__)


# ─── App Instance ─────────────────────────────────────────────────────────────
# title, description and version appear in the Swagger UI at /docs
app = FastAPI(
    title="ML-Ops Anomaly Detection API",
    description=(
        "REST API for collecting system metrics and detecting CPU/memory anomalies "
        "using an Isolation Forest machine learning model.\n\n"
        "**Phase 4** of the ML-Ops-Anomaly-Detection portfolio project."
    ),
    version="0.4.0",
    docs_url="/docs",       # Swagger UI URL
    redoc_url="/redoc",     # ReDoc UI URL (alternative documentation)
)


# ─── CORS Middleware ──────────────────────────────────────────────────────────
# allow_origins=["*"] is fine for local dev. Change to specific origins in prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],            # Allow all origins (Phase 5 dashboard needs this)
    allow_credentials=True,
    allow_methods=["*"],            # Allow GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],            # Allow all headers
)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    tags=["System"],
)
def health_check():
    """
    Check whether the API is running and whether the ML model is ready.

    Returns 200 in all cases (the API IS running). The 'status' field
    in the body indicates whether the model is available:
        "ok"       → everything works
        "degraded" → API is up but model is missing (train first)

    WHY always 200 for health?
        Load balancers and monitoring tools expect 200 to mean "I am alive."
        A 503 health check would cause the load balancer to restart the
        server, which is wrong — the server is working fine; only the model
        needs to be trained.
    """
    result = services.check_health()
    logger.info("Health check: %s", result["status"])
    return result


@app.get(
    "/metrics/current",
    response_model=CurrentMetricsResponse,
    summary="Latest metrics reading",
    tags=["Metrics"],
)
def get_current_metrics():
    """
    Return the most recent CPU and memory reading from the metrics CSV.

    Reads the CSV file on every call so it always reflects the latest data
    written by the collector.

    Returns 404 if no data is available yet.
    """
    try:
        rows = services.read_metrics_csv()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # The last row is the most recent (CSV is written chronologically)
    latest = rows[-1]
    return {
        "latest":        MetricRecord(**latest),
        "total_records": len(rows),
    }


@app.get(
    "/metrics/history",
    response_model=HistoryResponse,
    summary="Historical metrics",
    tags=["Metrics"],
)
def get_metrics_history(
    limit: int = Query(
        default=100,
        ge=1,
        le=1000,
        description="Number of most recent records to return. Min: 1, Max: 1000.",
    ),
):
    """
    Return up to 'limit' most recent metric records from the CSV.

    WHY validate limit with ge/le on the Query parameter?
        FastAPI automatically returns 422 if the client sends limit=0 or
        limit=9999. We never need to write validation code for it.

    Records are returned in ascending time order (oldest first in the slice),
    so clients can plot them as a time-series without resorting.
    """
    try:
        rows = services.read_metrics_csv(limit=limit)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {
        "records": [MetricRecord(**r) for r in rows],
        "count":   len(rows),
        "limit":   limit,
    }


@app.post(
    "/predict",
    response_model=PredictResponse,
    summary="Predict anomaly for a CPU/memory reading",
    tags=["Predictions"],
)
def predict_anomaly(request: PredictRequest):
    """
    Classify a single CPU/memory reading as NORMAL or ANOMALOUS.

    FastAPI validates the request body against PredictRequest automatically:
        - cpu_percent and mem_percent must be numbers between 0 and 100
        - Both fields are required

    The model is loaded from disk once and cached for subsequent requests.

    Returns 503 if the model file is missing (train the model first).

    NOTE: The 'score' in the response is NOT a probability.
          It is the Isolation Forest anomaly score (more negative = more anomalous).
    """
    try:
        result = services.run_prediction(request.cpu_percent, request.mem_percent)
    except FileNotFoundError as exc:
        # Model file is missing — tell the client how to fix it
        # 503 = server is up but a required dependency is unavailable
        raise HTTPException(
            status_code=503,
            detail="Model not found. Train the model first: python -m model.train_model",
        )
    except Exception as exc:
        logger.error("Prediction failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="Prediction failed due to an internal error.",
        )

    return result


@app.get(
    "/anomalies",
    response_model=AnomaliesResponse,
    summary="Historical anomalies",
    tags=["Predictions"],
)
def get_anomalies():
    """
    Classify all historical metrics records and return the anomalous ones.

    This endpoint applies the trained model RETROSPECTIVELY to the full
    history of collected metrics. It does NOT retrain the model.

    If no data or no model is available, returns an empty list with a
    descriptive 'source' field explaining why.

    IMPORTANT: These anomalies were not detected in real-time. They are
    the result of running the trained model over historical data now.
    """
    result = services.get_anomalies_from_history()
    return {
        "anomalies": [AnomalyRecord(**a) for a in result["anomalies"]],
        "count":     result["count"],
        "source":    result["source"],
    }
