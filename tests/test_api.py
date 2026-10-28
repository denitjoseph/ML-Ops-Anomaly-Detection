"""
tests/test_api.py
==================
PURPOSE:
    Integration tests for the FastAPI application using FastAPI's TestClient.

WHAT IS TESTCLIENT?
    FastAPI ships with a TestClient (backed by httpx) that lets you send
    real HTTP requests to your app — without starting a live server.

    This means tests are:
        - Fast (no network, no port binding)
        - Isolated (each test controls its own data)
        - Accurate (same request/response cycle as a real HTTP call)

MOCKING STRATEGY:
    Many endpoints depend on external resources:
        - data/metrics.csv  (may not exist during tests)
        - models/anomaly_model.joblib (may not exist during tests)

    We use pytest's 'monkeypatch' fixture to temporarily replace service
    functions with controlled fakes. This means:
        - Tests don't depend on whether the real CSV exists
        - Tests don't depend on whether a real model is trained
        - Tests are fast (no disk I/O during patching)
        - Tests are deterministic (same output every time)

    'monkeypatch' is a built-in pytest fixture — no imports needed for it.

WHAT IS monkeypatch?
    monkeypatch.setattr(module, 'function_name', replacement)
    temporarily replaces 'function_name' in 'module' with 'replacement'.
    After the test finishes, the original is automatically restored.

    Example:
        monkeypatch.setattr(services, 'read_metrics_csv', lambda **kw: [...])
        Now when the endpoint calls read_metrics_csv(), it gets our fake.
"""

import csv
import tempfile
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
import joblib
import pytest
from fastapi.testclient import TestClient
from sklearn.ensemble import IsolationForest

from app.main import app
from app import services


# ─── TestClient fixture ───────────────────────────────────────────────────────

@pytest.fixture
def client():
    """
    Provide a TestClient for each test.

    Using a fixture ensures every test gets a fresh client instance and
    prevents side effects from bleeding between tests.
    """
    return TestClient(app)


# ─── Helpers ──────────────────────────────────────────────────────────────────

SAMPLE_ROWS = [
    {"timestamp": "2025-01-15T10:00:00", "cpu_percent": 25.0, "mem_percent": 60.0},
    {"timestamp": "2025-01-15T10:00:05", "cpu_percent": 30.0, "mem_percent": 65.0},
    {"timestamp": "2025-01-15T10:00:10", "cpu_percent": 22.0, "mem_percent": 58.0},
]

SAMPLE_ANOMALY_ROWS = [
    {"timestamp": "2025-01-15T10:00:00", "cpu_percent": 25.0, "mem_percent": 60.0,
     "score": -0.05, "label": "NORMAL"},
    {"timestamp": "2025-01-15T10:00:05", "cpu_percent": 99.0, "mem_percent": 98.0,
     "score": -0.48, "label": "ANOMALY"},
]


def make_real_model(tmp_path: Path) -> Path:
    """
    Train a minimal real Isolation Forest and save it to a temp path.
    Used for tests that need a genuine model file, not a mock.
    """
    rng = np.random.default_rng(42)
    X = np.column_stack([
        rng.normal(30, 10, 200).clip(1, 95),
        rng.normal(55, 8,  200).clip(1, 95),
    ])
    model = IsolationForest(n_estimators=10, random_state=42)
    model.fit(X)
    payload = {"model": model, "features": ["cpu_percent", "mem_percent"]}
    model_path = tmp_path / "model.joblib"
    joblib.dump(payload, model_path)
    return model_path


def make_real_csv(tmp_path: Path, n_rows: int = 5) -> Path:
    """Create a minimal real CSV file for tests that need disk data."""
    csv_path = tmp_path / "metrics.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "cpu_percent", "mem_percent"])
        writer.writeheader()
        for i in range(n_rows):
            writer.writerow({
                "timestamp":   f"2025-01-15T10:00:{i:02d}",
                "cpu_percent": 25.0 + i,
                "mem_percent": 60.0 + i,
            })
    return csv_path


# ─── Tests: GET /health ───────────────────────────────────────────────────────

class TestHealthEndpoint:

    def test_health_returns_200(self, client, monkeypatch):
        """Health endpoint must always return 200 (API is alive)."""
        monkeypatch.setattr(services, "check_health", lambda **kw: {
            "status": "ok", "model_loaded": True,
            "model_path": "/fake/model.joblib", "message": "All good."
        })
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_ok_when_model_loaded(self, client, monkeypatch):
        """When model is available, status should be 'ok' and model_loaded True."""
        monkeypatch.setattr(services, "check_health", lambda **kw: {
            "status": "ok", "model_loaded": True,
            "model_path": "/fake/model.joblib", "message": "Ready."
        })
        body = client.get("/health").json()
        assert body["status"] == "ok"
        assert body["model_loaded"] is True

    def test_health_degraded_when_model_missing(self, client, monkeypatch):
        """When model is absent, status should be 'degraded' and model_loaded False."""
        monkeypatch.setattr(services, "check_health", lambda **kw: {
            "status": "degraded", "model_loaded": False,
            "model_path": "/fake/model.joblib", "message": "Train first."
        })
        body = client.get("/health").json()
        assert body["status"] == "degraded"
        assert body["model_loaded"] is False

    def test_health_response_has_required_fields(self, client, monkeypatch):
        """Response must contain all required fields."""
        monkeypatch.setattr(services, "check_health", lambda **kw: {
            "status": "ok", "model_loaded": True,
            "model_path": "/fake/path", "message": "ok"
        })
        body = client.get("/health").json()
        for field in ("status", "model_loaded", "model_path", "message"):
            assert field in body, f"Missing field: {field}"

    def test_health_with_real_model(self, client, tmp_path):
        """Integration test: health is 'ok' when a real model file exists."""
        model_path = make_real_model(tmp_path)
        services.reset_model_cache()
        result = services.check_health(model_path=model_path)
        assert result["status"] == "ok"
        assert result["model_loaded"] is True
        services.reset_model_cache()

    def test_health_with_missing_model(self, tmp_path):
        """Integration test: health is 'degraded' when model file is absent."""
        result = services.check_health(model_path=tmp_path / "ghost.joblib")
        assert result["status"] == "degraded"
        assert result["model_loaded"] is False


# ─── Tests: GET /metrics/current ─────────────────────────────────────────────

class TestCurrentMetricsEndpoint:

    def test_returns_200_with_data(self, client, monkeypatch):
        """Should return 200 when CSV data is available."""
        monkeypatch.setattr(services, "read_metrics_csv", lambda **kw: SAMPLE_ROWS)
        response = client.get("/metrics/current")
        assert response.status_code == 200

    def test_returns_latest_row(self, client, monkeypatch):
        """Should return the LAST row in the CSV as the 'latest' reading."""
        monkeypatch.setattr(services, "read_metrics_csv", lambda **kw: SAMPLE_ROWS)
        body = client.get("/metrics/current").json()
        assert body["latest"]["timestamp"] == "2025-01-15T10:00:10"
        assert body["latest"]["cpu_percent"] == 22.0

    def test_returns_total_records_count(self, client, monkeypatch):
        """total_records should equal the number of rows in the CSV."""
        monkeypatch.setattr(services, "read_metrics_csv", lambda **kw: SAMPLE_ROWS)
        body = client.get("/metrics/current").json()
        assert body["total_records"] == 3

    def test_returns_404_when_csv_missing(self, client, monkeypatch):
        """Should return 404 when no CSV exists."""
        monkeypatch.setattr(
            services, "read_metrics_csv",
            lambda **kw: (_ for _ in ()).throw(FileNotFoundError("No CSV"))
        )
        response = client.get("/metrics/current")
        assert response.status_code == 404

    def test_returns_404_when_csv_empty(self, client, monkeypatch):
        """Should return 404 when CSV has no data rows."""
        monkeypatch.setattr(
            services, "read_metrics_csv",
            lambda **kw: (_ for _ in ()).throw(ValueError("Empty CSV"))
        )
        response = client.get("/metrics/current")
        assert response.status_code == 404

    def test_response_has_required_fields(self, client, monkeypatch):
        """Response body must have 'latest' and 'total_records'."""
        monkeypatch.setattr(services, "read_metrics_csv", lambda **kw: SAMPLE_ROWS)
        body = client.get("/metrics/current").json()
        assert "latest" in body
        assert "total_records" in body

    def test_latest_has_metric_fields(self, client, monkeypatch):
        """'latest' must have timestamp, cpu_percent, mem_percent."""
        monkeypatch.setattr(services, "read_metrics_csv", lambda **kw: SAMPLE_ROWS)
        latest = client.get("/metrics/current").json()["latest"]
        assert "timestamp" in latest
        assert "cpu_percent" in latest
        assert "mem_percent" in latest


# ─── Tests: GET /metrics/history ─────────────────────────────────────────────

class TestHistoryEndpoint:

    def test_returns_200_with_data(self, client, monkeypatch):
        monkeypatch.setattr(services, "read_metrics_csv", lambda **kw: SAMPLE_ROWS)
        assert client.get("/metrics/history").status_code == 200

    def test_default_limit_is_applied(self, client, monkeypatch):
        """Without a limit param, the default (100) should be used."""
        monkeypatch.setattr(services, "read_metrics_csv", lambda **kw: SAMPLE_ROWS)
        body = client.get("/metrics/history").json()
        assert body["limit"] == 100

    def test_custom_limit_returned_in_response(self, client, monkeypatch):
        """The limit param provided by the client should appear in the response."""
        monkeypatch.setattr(services, "read_metrics_csv", lambda **kw: SAMPLE_ROWS)
        body = client.get("/metrics/history?limit=10").json()
        assert body["limit"] == 10

    def test_rejects_limit_zero(self, client):
        """limit=0 should fail FastAPI validation with 422."""
        response = client.get("/metrics/history?limit=0")
        assert response.status_code == 422

    def test_rejects_limit_above_maximum(self, client):
        """limit=1001 should fail validation with 422."""
        response = client.get("/metrics/history?limit=1001")
        assert response.status_code == 422

    def test_accepts_limit_at_max_boundary(self, client, monkeypatch):
        """limit=1000 (the exact maximum) should be accepted."""
        monkeypatch.setattr(services, "read_metrics_csv", lambda **kw: SAMPLE_ROWS)
        assert client.get("/metrics/history?limit=1000").status_code == 200

    def test_records_count_in_response(self, client, monkeypatch):
        """'count' should reflect the number of records actually returned."""
        monkeypatch.setattr(services, "read_metrics_csv", lambda **kw: SAMPLE_ROWS)
        body = client.get("/metrics/history").json()
        assert body["count"] == len(SAMPLE_ROWS)

    def test_returns_404_when_csv_missing(self, client, monkeypatch):
        monkeypatch.setattr(
            services, "read_metrics_csv",
            lambda **kw: (_ for _ in ()).throw(FileNotFoundError("No CSV"))
        )
        assert client.get("/metrics/history").status_code == 404

    def test_each_record_has_required_fields(self, client, monkeypatch):
        monkeypatch.setattr(services, "read_metrics_csv", lambda **kw: SAMPLE_ROWS)
        records = client.get("/metrics/history").json()["records"]
        for rec in records:
            assert "timestamp" in rec
            assert "cpu_percent" in rec
            assert "mem_percent" in rec


# ─── Tests: POST /predict ─────────────────────────────────────────────────────

class TestPredictEndpoint:

    VALID_PAYLOAD = {"cpu_percent": 25.0, "mem_percent": 60.0}

    NORMAL_RESULT = {
        "label": "NORMAL", "is_anomaly": False, "score": -0.05,
        "cpu_percent": 25.0, "mem_percent": 60.0,
        "score_note": "Very normal — difficult to isolate from the crowd.",
    }
    ANOMALY_RESULT = {
        "label": "ANOMALY", "is_anomaly": True, "score": -0.48,
        "cpu_percent": 99.0, "mem_percent": 98.0,
        "score_note": "Strong anomaly — easy to isolate; significantly different from normal.",
    }

    def test_returns_200_for_valid_request(self, client, monkeypatch):
        monkeypatch.setattr(services, "run_prediction", lambda cpu, mem, **kw: self.NORMAL_RESULT)
        response = client.post("/predict", json=self.VALID_PAYLOAD)
        assert response.status_code == 200

    def test_returns_normal_label(self, client, monkeypatch):
        monkeypatch.setattr(services, "run_prediction", lambda cpu, mem, **kw: self.NORMAL_RESULT)
        body = client.post("/predict", json=self.VALID_PAYLOAD).json()
        assert body["label"] == "NORMAL"
        assert body["is_anomaly"] is False

    def test_returns_anomaly_label(self, client, monkeypatch):
        monkeypatch.setattr(services, "run_prediction", lambda cpu, mem, **kw: self.ANOMALY_RESULT)
        body = client.post("/predict", json={"cpu_percent": 99.0, "mem_percent": 98.0}).json()
        assert body["label"] == "ANOMALY"
        assert body["is_anomaly"] is True

    def test_response_has_required_fields(self, client, monkeypatch):
        monkeypatch.setattr(services, "run_prediction", lambda cpu, mem, **kw: self.NORMAL_RESULT)
        body = client.post("/predict", json=self.VALID_PAYLOAD).json()
        for field in ("label", "is_anomaly", "score", "cpu_percent", "mem_percent", "score_note"):
            assert field in body, f"Missing field: {field}"

    def test_rejects_cpu_above_100(self, client):
        """FastAPI should return 422 for cpu_percent > 100 before reaching our code."""
        response = client.post("/predict", json={"cpu_percent": 150.0, "mem_percent": 60.0})
        assert response.status_code == 422

    def test_rejects_cpu_below_zero(self, client):
        response = client.post("/predict", json={"cpu_percent": -1.0, "mem_percent": 60.0})
        assert response.status_code == 422

    def test_rejects_mem_above_100(self, client):
        response = client.post("/predict", json={"cpu_percent": 25.0, "mem_percent": 101.0})
        assert response.status_code == 422

    def test_rejects_mem_below_zero(self, client):
        response = client.post("/predict", json={"cpu_percent": 25.0, "mem_percent": -5.0})
        assert response.status_code == 422

    def test_rejects_missing_cpu(self, client):
        """Both fields are required — missing one should give 422."""
        response = client.post("/predict", json={"mem_percent": 60.0})
        assert response.status_code == 422

    def test_rejects_missing_mem(self, client):
        response = client.post("/predict", json={"cpu_percent": 25.0})
        assert response.status_code == 422

    def test_accepts_boundary_values(self, client, monkeypatch):
        """cpu_percent=0 and mem_percent=100 are valid boundaries."""
        monkeypatch.setattr(services, "run_prediction", lambda cpu, mem, **kw: self.NORMAL_RESULT)
        response = client.post("/predict", json={"cpu_percent": 0.0, "mem_percent": 100.0})
        assert response.status_code == 200

    def test_returns_503_when_model_missing(self, client, monkeypatch):
        """Should return 503 when the model file is not found."""
        monkeypatch.setattr(
            services, "run_prediction",
            lambda cpu, mem, **kw: (_ for _ in ()).throw(FileNotFoundError("No model"))
        )
        response = client.post("/predict", json=self.VALID_PAYLOAD)
        assert response.status_code == 503

    def test_real_predict_endpoint(self, client, tmp_path):
        """
        Full integration test using a real model file.
        Does NOT assert a specific label — only that the response is valid.
        """
        services.reset_model_cache()
        model_path = make_real_model(tmp_path)

        # Temporarily redirect the service to use the test model
        original_run = services.run_prediction
        def patched_run(cpu, mem, **kw):
            return services.run_prediction.__wrapped__(cpu, mem) if hasattr(services.run_prediction, '__wrapped__') else \
                   __import__('app.services', fromlist=['run_prediction']).run_prediction(cpu, mem, model_path=model_path)

        with patch.object(services, "run_prediction",
                          side_effect=lambda cpu, mem, **kw: {
                              **__import__('model.predict_anomaly', fromlist=['predict']).predict(cpu, mem, model_path),
                              "score_note": "test"
                          }):
            response = client.post("/predict", json={"cpu_percent": 25.0, "mem_percent": 60.0})

        assert response.status_code == 200
        body = response.json()
        assert body["label"] in ("NORMAL", "ANOMALY")
        services.reset_model_cache()


# ─── Tests: GET /anomalies ────────────────────────────────────────────────────

class TestAnomaliesEndpoint:

    def test_returns_200_always(self, client, monkeypatch):
        """/anomalies always returns 200, even when there's no data."""
        monkeypatch.setattr(services, "get_anomalies_from_history", lambda **kw: {
            "anomalies": [], "count": 0,
            "source": "No data available."
        })
        assert client.get("/anomalies").status_code == 200

    def test_returns_empty_list_when_no_data(self, client, monkeypatch):
        monkeypatch.setattr(services, "get_anomalies_from_history", lambda **kw: {
            "anomalies": [], "count": 0, "source": "No data."
        })
        body = client.get("/anomalies").json()
        assert body["anomalies"] == []
        assert body["count"] == 0

    def test_returns_anomaly_records(self, client, monkeypatch):
        """When anomalies exist, they should appear in the response."""
        anomalies = [SAMPLE_ANOMALY_ROWS[1]]   # the ANOMALY row
        monkeypatch.setattr(services, "get_anomalies_from_history", lambda **kw: {
            "anomalies": anomalies,
            "count": 1,
            "source": "Classified 2 historical records.",
        })
        body = client.get("/anomalies").json()
        assert body["count"] == 1
        assert body["anomalies"][0]["label"] == "ANOMALY"

    def test_response_has_required_fields(self, client, monkeypatch):
        monkeypatch.setattr(services, "get_anomalies_from_history", lambda **kw: {
            "anomalies": [], "count": 0, "source": "test"
        })
        body = client.get("/anomalies").json()
        assert "anomalies" in body
        assert "count" in body
        assert "source" in body

    def test_anomaly_record_has_required_fields(self, client, monkeypatch):
        """Each anomaly record must have timestamp, cpu_percent, mem_percent, score, label."""
        monkeypatch.setattr(services, "get_anomalies_from_history", lambda **kw: {
            "anomalies": [SAMPLE_ANOMALY_ROWS[1]],
            "count": 1, "source": "test"
        })
        record = client.get("/anomalies").json()["anomalies"][0]
        for field in ("timestamp", "cpu_percent", "mem_percent", "score", "label"):
            assert field in record, f"Missing field: {field}"

    def test_empty_list_when_model_missing(self, client, monkeypatch):
        """Should return empty anomalies with a clear message when model is absent."""
        monkeypatch.setattr(services, "get_anomalies_from_history", lambda **kw: {
            "anomalies": [],
            "count": 0,
            "source": "No trained model found. Train the model first.",
        })
        body = client.get("/anomalies").json()
        assert body["anomalies"] == []
        assert "model" in body["source"].lower()


# ─── Tests: Services Layer (pure Python, no HTTP) ─────────────────────────────

class TestServicesLayer:
    """
    Test the business logic in services.py directly — no HTTP involved.
    Faster and more targeted than going through the full HTTP stack.
    """

    def test_check_health_returns_ok_with_real_model(self, tmp_path):
        model_path = make_real_model(tmp_path)
        services.reset_model_cache()
        result = services.check_health(model_path=model_path)
        assert result["status"] == "ok"
        assert result["model_loaded"] is True
        services.reset_model_cache()

    def test_check_health_returns_degraded_without_model(self, tmp_path):
        result = services.check_health(model_path=tmp_path / "none.joblib")
        assert result["status"] == "degraded"

    def test_read_metrics_csv_raises_when_file_missing(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            services.read_metrics_csv(csv_path=tmp_path / "none.csv")

    def test_read_metrics_csv_raises_when_empty(self, tmp_path):
        csv_path = tmp_path / "empty.csv"
        csv_path.write_text("timestamp,cpu_percent,mem_percent\n", encoding="utf-8")
        with pytest.raises(ValueError, match="no valid data rows"):
            services.read_metrics_csv(csv_path=csv_path)

    def test_read_metrics_csv_returns_correct_rows(self, tmp_path):
        csv_path = make_real_csv(tmp_path, n_rows=3)
        rows = services.read_metrics_csv(csv_path=csv_path)
        assert len(rows) == 3
        assert rows[0]["cpu_percent"] == 25.0

    def test_read_metrics_csv_limit_returns_newest(self, tmp_path):
        """With limit=1, should return the LAST (newest) row."""
        csv_path = make_real_csv(tmp_path, n_rows=5)
        rows = services.read_metrics_csv(csv_path=csv_path, limit=1)
        assert len(rows) == 1
        assert rows[0]["timestamp"] == "2025-01-15T10:00:04"

    def test_model_cache_is_populated_after_get(self, tmp_path):
        """After get_cached_model(), the cache should be set."""
        model_path = make_real_model(tmp_path)
        services.reset_model_cache()
        assert services._model_cache is None
        services.get_cached_model(model_path=model_path)
        assert services._model_cache is not None
        services.reset_model_cache()

    def test_reset_model_cache_clears_cache(self, tmp_path):
        model_path = make_real_model(tmp_path)
        services.get_cached_model(model_path=model_path)
        services.reset_model_cache()
        assert services._model_cache is None
