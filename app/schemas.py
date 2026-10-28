"""
app/schemas.py
==============
PURPOSE:
    Defines all Pydantic models used for API request validation and
    response serialisation.

WHY PYDANTIC?
    FastAPI uses Pydantic under the hood to:
        1. VALIDATE incoming JSON request bodies automatically
           (e.g. reject cpu_percent=150 before it reaches our code)
        2. SERIALISE Python dicts/objects to JSON responses automatically
        3. DOCUMENT the API — FastAPI generates OpenAPI/Swagger docs from
           these models with zero extra work

WHY SEPARATE FROM main.py?
    Keeping schemas in their own file means:
        - main.py stays focused on routing and HTTP logic
        - Schemas can be imported by tests without loading the whole app
        - If we later add more endpoints, we add schemas here — one place

PYDANTIC FIELD() EXPLAINED:
    Field(...) sets metadata on a model attribute:
        ge=0      → greater than or equal to 0
        le=100    → less than or equal to 100
        default=  → the value used when the client does not supply the field
        ge/le with query params → FastAPI automatically returns 422 Unprocessable
                                   Entity if the client violates these constraints
"""

from pydantic import BaseModel, Field
from typing import Optional


# ─── Request Models ───────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """
    JSON body expected by POST /predict.

    FastAPI validates this BEFORE our handler runs.
    If cpu_percent > 100, the client gets a 422 error automatically.
    We never see invalid data inside the handler.
    """
    cpu_percent: float = Field(
        ...,            # ... means the field is REQUIRED (no default)
        ge=0.0,
        le=100.0,
        description="CPU usage percentage. Must be between 0 and 100.",
        json_schema_extra={"example": 25.5},
    )
    mem_percent: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Memory usage percentage. Must be between 0 and 100.",
        json_schema_extra={"example": 67.3},
    )


# ─── Response Models ──────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    """Response shape for GET /health."""
    status: str             # "ok" or "degraded"
    model_loaded: bool      # True only if the .joblib file exists and loads cleanly
    model_path: str         # Path shown so users know where to put the model file
    message: str            # Human-readable summary


class MetricRecord(BaseModel):
    """One row from the metrics CSV — used in both /metrics/current and /metrics/history."""
    timestamp:   str
    cpu_percent: float
    mem_percent: float


class CurrentMetricsResponse(BaseModel):
    """Response shape for GET /metrics/current."""
    latest: MetricRecord
    total_records: int      # total rows in CSV (useful for debugging)


class HistoryResponse(BaseModel):
    """Response shape for GET /metrics/history."""
    records: list[MetricRecord]
    count:   int            # number of records actually returned
    limit:   int            # the limit that was applied


class PredictResponse(BaseModel):
    """Response shape for POST /predict."""
    label:       str        # "NORMAL" or "ANOMALY"
    is_anomaly:  bool
    score:       float      # anomaly score (NOT a probability — more negative = more anomalous)
    cpu_percent: float      # echoed back from the request
    mem_percent: float      # echoed back from the request
    score_note:  str        # human-readable interpretation of the score


class AnomalyRecord(BaseModel):
    """One anomalous observation — used in GET /anomalies."""
    timestamp:   str
    cpu_percent: float
    mem_percent: float
    score:       float
    label:       str


class AnomaliesResponse(BaseModel):
    """Response shape for GET /anomalies."""
    anomalies: list[AnomalyRecord]
    count:     int
    source:    str          # explains where these anomalies came from
