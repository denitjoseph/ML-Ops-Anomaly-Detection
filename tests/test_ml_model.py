"""
tests/test_ml_model.py
=======================
PURPOSE:
    Verify that the training and prediction modules work correctly using
    synthetic (fake) data — so tests are fast, deterministic, and never
    depend on whether data/metrics.csv exists or how much data it has.

KEY DESIGN DECISIONS:
    1. ALL test data is synthetic (generated with NumPy random).
       We never call psutil or read the real metrics.csv during tests.

    2. Tests use temporary directories (tmp_path) for any files written
       to disk, so they never touch models/anomaly_model.joblib.

    3. We test BEHAVIOUR, not exact numbers:
       - Does the model flag extreme values as anomalies?
       - Does the result dict have the right shape?
       - Does the model refuse bad inputs?
       We do NOT assert that a specific reading MUST be flagged because
       the threshold depends on training data distribution.

SYNTHETIC DATA STRATEGY:
    "Normal" data: cpu_percent ~N(30, 10), mem_percent ~N(55, 10)
        Simulates a typical lightly-loaded machine.

    "Anomalous" data: cpu_percent ~99, mem_percent ~98
        Simulates an overloaded machine — far from the normal cluster.
        With enough normal training samples, Isolation Forest should
        reliably flag these as anomalies.

    We use random_state seeds so the tests are reproducible.

HONESTY NOTE:
    A real production model requires months of diverse operational data.
    Our synthetic tests prove the code works correctly, but they do NOT
    prove the model will catch every real-world anomaly pattern.
"""

import numpy as np
import pandas as pd
import joblib
import pytest
from pathlib import Path

from model.train_model import (
    load_and_validate_csv,
    train_and_save_model,
    FEATURE_COLUMNS,
    MIN_TRAINING_ROWS,
)
from model.predict_anomaly import (
    load_model,
    validate_input,
    predict,
)


# ─── Synthetic Data Helpers ───────────────────────────────────────────────────

def make_normal_csv(tmp_path: Path, n_rows: int = 200, seed: int = 42) -> Path:
    """
    Create a synthetic CSV that looks like normal machine metrics.

    Uses NumPy's random number generator with a fixed seed for reproducibility.
    np.random.default_rng(seed) is the modern NumPy random API (preferred over
    the older np.random.seed() global state approach).

    Data shape:
        cpu_percent:  Normal distribution centered at 30%, std 10%
        mem_percent:  Normal distribution centered at 55%, std 8%
    Values are clipped to [1, 95] to stay in valid range.

    Args:
        tmp_path: Pytest temp directory.
        n_rows:   Number of rows to generate. Default 200 > MIN_TRAINING_ROWS.
        seed:     Random seed for reproducibility.

    Returns:
        Path: Path to the created CSV file.
    """
    rng = np.random.default_rng(seed)

    cpu = rng.normal(loc=30, scale=10, size=n_rows).clip(1, 95)
    mem = rng.normal(loc=55, scale=8,  size=n_rows).clip(1, 95)

    df = pd.DataFrame({
        "timestamp":   [f"2025-01-15T10:{i//60:02d}:{i%60:02d}" for i in range(n_rows)],
        "cpu_percent": cpu.round(2),
        "mem_percent": mem.round(2),
    })

    csv_path = tmp_path / "metrics.csv"
    df.to_csv(csv_path, index=False)
    return csv_path


def make_trained_model(tmp_path: Path, n_rows: int = 200) -> tuple[Path, dict]:
    """
    Train a model on synthetic normal data and save it.

    Returns both the model path and the training summary dict so tests can
    inspect either without duplicating the setup logic.

    Args:
        tmp_path: Pytest temp directory (for both CSV and model file).
        n_rows:   Number of normal training rows.

    Returns:
        tuple: (model_path, summary_dict)
    """
    csv_path   = make_normal_csv(tmp_path, n_rows=n_rows)
    model_path = tmp_path / "test_model.joblib"

    summary = train_and_save_model(
        csv_path=csv_path,
        model_path=model_path,
        contamination=0.05,
        random_state=42,
    )
    return model_path, summary


# ─── Tests: load_and_validate_csv ─────────────────────────────────────────────

class TestLoadAndValidateCsv:
    """
    Tests for the data loading and validation function.
    Grouped in a class to keep them organised — pytest discovers
    methods starting with 'test_' inside classes automatically.
    """

    def test_raises_when_file_missing(self, tmp_path):
        """FileNotFoundError if the CSV does not exist."""
        missing = tmp_path / "does_not_exist.csv"
        with pytest.raises(FileNotFoundError, match="not found"):
            load_and_validate_csv(missing)

    def test_raises_when_required_column_missing(self, tmp_path):
        """ValueError if a required column is absent."""
        # Write a CSV with only 'timestamp' and 'cpu_percent' — mem_percent missing
        df = pd.DataFrame({
            "timestamp":   ["2025-01-15T10:00:00"] * 60,
            "cpu_percent": [25.0] * 60,
            # mem_percent deliberately omitted
        })
        csv_path = tmp_path / "incomplete.csv"
        df.to_csv(csv_path, index=False)

        with pytest.raises(ValueError, match="missing required columns"):
            load_and_validate_csv(csv_path)

    def test_raises_when_too_few_rows(self, tmp_path):
        """ValueError if row count is below MIN_TRAINING_ROWS."""
        # Create a CSV with MIN_TRAINING_ROWS - 1 rows
        n = MIN_TRAINING_ROWS - 1
        df = pd.DataFrame({
            "timestamp":   [f"2025-01-15T10:00:{i:02d}" for i in range(n)],
            "cpu_percent": [25.0] * n,
            "mem_percent": [55.0] * n,
        })
        csv_path = tmp_path / "too_small.csv"
        df.to_csv(csv_path, index=False)

        with pytest.raises(ValueError, match="Not enough data"):
            load_and_validate_csv(csv_path)

    def test_raises_when_values_out_of_range(self, tmp_path):
        """ValueError if any feature value is outside [0, 100]."""
        df = pd.DataFrame({
            "timestamp":   [f"2025-01-15T10:00:{i:02d}" for i in range(60)],
            "cpu_percent": [25.0] * 59 + [150.0],   # 150 is invalid
            "mem_percent": [55.0] * 60,
        })
        csv_path = tmp_path / "out_of_range.csv"
        df.to_csv(csv_path, index=False)

        with pytest.raises(ValueError, match=r"outside \[0, 100\]"):
            load_and_validate_csv(csv_path)

    def test_returns_dataframe_for_valid_csv(self, tmp_path):
        """Valid CSV should return a DataFrame without raising."""
        csv_path = make_normal_csv(tmp_path, n_rows=200)
        df = load_and_validate_csv(csv_path)

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 200

    def test_returned_dataframe_has_feature_columns(self, tmp_path):
        """Returned DataFrame must contain the feature columns."""
        csv_path = make_normal_csv(tmp_path, n_rows=200)
        df = load_and_validate_csv(csv_path)

        for col in FEATURE_COLUMNS:
            assert col in df.columns, f"Missing column: {col}"

    def test_feature_columns_are_numeric(self, tmp_path):
        """Feature columns must be numeric dtype after loading."""
        csv_path = make_normal_csv(tmp_path, n_rows=200)
        df = load_and_validate_csv(csv_path)

        for col in FEATURE_COLUMNS:
            assert pd.api.types.is_numeric_dtype(df[col]), (
                f"Column '{col}' should be numeric, got {df[col].dtype}"
            )

    def test_drops_rows_with_non_numeric_values(self, tmp_path):
        """Rows with non-parsable feature values should be silently dropped."""
        rng = np.random.default_rng(0)
        n = 210
        df = pd.DataFrame({
            "timestamp":   [f"2025-01-15T10:00:{i:02d}" for i in range(n)],
            "cpu_percent": list(rng.uniform(10, 50, n - 5).round(2)) + ["N/A", "err", "", "?", "nan"],
            "mem_percent": [55.0] * n,
        })
        csv_path = tmp_path / "corrupt.csv"
        df.to_csv(csv_path, index=False)

        # Should not raise — should just drop the 5 bad rows
        result = load_and_validate_csv(csv_path)
        assert len(result) == n - 5


# ─── Tests: train_and_save_model ──────────────────────────────────────────────

class TestTrainAndSaveModel:

    def test_raises_for_invalid_contamination(self, tmp_path):
        """Contamination must be in (0, 0.5]."""
        csv_path = make_normal_csv(tmp_path)
        model_path = tmp_path / "model.joblib"

        with pytest.raises(ValueError, match="contamination"):
            train_and_save_model(csv_path, model_path, contamination=0.0)

        with pytest.raises(ValueError, match="contamination"):
            train_and_save_model(csv_path, model_path, contamination=0.9)

    def test_creates_model_file(self, tmp_path):
        """Training should create a .joblib file on disk."""
        model_path, _ = make_trained_model(tmp_path)
        assert model_path.exists(), "Model file was not created"

    def test_returns_summary_dict(self, tmp_path):
        """Training should return a dict with the expected summary keys."""
        _, summary = make_trained_model(tmp_path)
        required_keys = {"n_samples", "contamination", "model_path", "features"}
        assert required_keys.issubset(summary.keys())

    def test_summary_n_samples_correct(self, tmp_path):
        """Summary should report the correct number of training samples."""
        _, summary = make_trained_model(tmp_path, n_rows=200)
        assert summary["n_samples"] == 200

    def test_summary_features_match_expected(self, tmp_path):
        """Summary should list the correct feature columns."""
        _, summary = make_trained_model(tmp_path)
        assert summary["features"] == FEATURE_COLUMNS


# ─── Tests: Model Persistence ─────────────────────────────────────────────────

class TestModelPersistence:
    """
    Verify that the saved model can be loaded back and contains
    the expected structure. This is a critical integration test:
    if joblib.dump/load breaks (e.g. version mismatch), prediction fails.
    """

    def test_saved_model_can_be_loaded(self, tmp_path):
        """load_model() must not raise for a valid model file."""
        model_path, _ = make_trained_model(tmp_path)
        payload = load_model(model_path)
        assert payload is not None

    def test_loaded_payload_has_model_key(self, tmp_path):
        """Payload must contain a 'model' key."""
        model_path, _ = make_trained_model(tmp_path)
        payload = load_model(model_path)
        assert "model" in payload

    def test_loaded_payload_has_features_key(self, tmp_path):
        """Payload must contain a 'features' key."""
        model_path, _ = make_trained_model(tmp_path)
        payload = load_model(model_path)
        assert "features" in payload

    def test_loaded_features_match_expected(self, tmp_path):
        """The feature list saved with the model must match FEATURE_COLUMNS."""
        model_path, _ = make_trained_model(tmp_path)
        payload = load_model(model_path)
        assert payload["features"] == FEATURE_COLUMNS

    def test_load_model_raises_when_file_missing(self, tmp_path):
        """load_model() should raise FileNotFoundError if model file absent."""
        missing = tmp_path / "ghost_model.joblib"
        with pytest.raises(FileNotFoundError, match="No trained model"):
            load_model(missing)


# ─── Tests: validate_input ────────────────────────────────────────────────────

class TestValidateInput:

    def test_accepts_valid_values(self):
        """Normal values should not raise."""
        validate_input(25.0, 60.0)   # should pass silently

    def test_accepts_boundary_values(self):
        """Exact boundary values 0.0 and 100.0 should be accepted."""
        validate_input(0.0, 0.0)
        validate_input(100.0, 100.0)

    def test_raises_for_cpu_below_zero(self):
        with pytest.raises(ValueError, match="cpu_percent"):
            validate_input(-1.0, 50.0)

    def test_raises_for_cpu_above_100(self):
        with pytest.raises(ValueError, match="cpu_percent"):
            validate_input(101.0, 50.0)

    def test_raises_for_mem_below_zero(self):
        with pytest.raises(ValueError, match="mem_percent"):
            validate_input(50.0, -0.1)

    def test_raises_for_mem_above_100(self):
        with pytest.raises(ValueError, match="mem_percent"):
            validate_input(50.0, 100.1)

    def test_raises_for_non_numeric_cpu(self):
        with pytest.raises(TypeError, match="cpu_percent"):
            validate_input("high", 50.0)

    def test_raises_for_non_numeric_mem(self):
        with pytest.raises(TypeError, match="mem_percent"):
            validate_input(50.0, None)


# ─── Tests: predict ───────────────────────────────────────────────────────────

class TestPredict:

    @pytest.fixture(autouse=True)
    def trained_model_path(self, tmp_path):
        """
        autouse=True means this fixture runs automatically for EVERY test
        in this class — no need to list it as a parameter.

        It trains a model once per test and stores the path on self so
        all test methods can access it via self.model_path.
        """
        model_path, _ = make_trained_model(tmp_path, n_rows=300)
        self.model_path = model_path

    def test_returns_dict(self):
        """predict() must return a dict."""
        result = predict(25.0, 60.0, self.model_path)
        assert isinstance(result, dict)

    def test_result_has_required_keys(self):
        """Result dict must contain all expected keys."""
        result = predict(25.0, 60.0, self.model_path)
        required = {"label", "score", "cpu_percent", "mem_percent", "is_anomaly"}
        assert required.issubset(result.keys())

    def test_label_is_string(self):
        result = predict(25.0, 60.0, self.model_path)
        assert isinstance(result["label"], str)

    def test_label_is_valid_value(self):
        """Label must be either 'NORMAL' or 'ANOMALY' — no other values."""
        result = predict(25.0, 60.0, self.model_path)
        assert result["label"] in ("NORMAL", "ANOMALY")

    def test_is_anomaly_is_bool(self):
        result = predict(25.0, 60.0, self.model_path)
        assert isinstance(result["is_anomaly"], bool)

    def test_label_and_is_anomaly_are_consistent(self):
        """is_anomaly must be True when label is ANOMALY, and False when NORMAL."""
        result = predict(25.0, 60.0, self.model_path)
        if result["label"] == "ANOMALY":
            assert result["is_anomaly"] is True
        else:
            assert result["is_anomaly"] is False

    def test_score_is_float(self):
        result = predict(25.0, 60.0, self.model_path)
        assert isinstance(result["score"], float)

    def test_input_values_echoed_in_result(self):
        """predict() should echo the input values back in the result."""
        result = predict(33.3, 71.1, self.model_path)
        assert result["cpu_percent"] == 33.3
        assert result["mem_percent"] == 71.1

    def test_typical_values_labelled_normal(self):
        """
        Values inside the training distribution should be labelled NORMAL.

        Training data: cpu ~N(30,10), mem ~N(55,8).
        Input: cpu=30, mem=55 — exactly the centre of the distribution.
        A properly trained model should almost certainly label this NORMAL.

        NOTE: This is an expectation, not a guarantee. If the model fails
        this test consistently, it indicates a training data or contamination
        issue worth investigating.
        """
        result = predict(30.0, 55.0, self.model_path)
        assert result["label"] == "NORMAL", (
            f"Expected NORMAL for typical values (cpu=30, mem=55), "
            f"got {result['label']} with score {result['score']}"
        )

    def test_extreme_values_labelled_anomaly(self):
        """
        Values far outside the training distribution should be ANOMALY.

        Training data centre: cpu=30, mem=55.
        Test input: cpu=99, mem=99 — many standard deviations away.
        With 300 normal training samples, this should reliably be flagged.
        """
        result = predict(99.0, 99.0, self.model_path)
        assert result["label"] == "ANOMALY", (
            f"Expected ANOMALY for extreme values (cpu=99, mem=99), "
            f"got {result['label']} with score {result['score']}"
        )

    def test_extreme_anomaly_has_lower_score_than_normal(self):
        """
        Anomaly scores should follow the expected ordering:
        normal observations score higher (closer to 0) than anomalies.
        """
        normal_result  = predict(30.0, 55.0, self.model_path)
        anomaly_result = predict(99.0, 99.0, self.model_path)
        assert anomaly_result["score"] < normal_result["score"], (
            f"Anomaly score ({anomaly_result['score']}) should be lower than "
            f"normal score ({normal_result['score']})"
        )

    def test_raises_for_invalid_cpu(self):
        with pytest.raises(ValueError):
            predict(150.0, 50.0, self.model_path)

    def test_raises_for_invalid_mem(self):
        with pytest.raises(ValueError):
            predict(50.0, -5.0, self.model_path)

    def test_raises_when_model_missing(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            predict(25.0, 60.0, tmp_path / "no_model.joblib")
