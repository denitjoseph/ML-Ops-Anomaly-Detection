"""
model/predict_anomaly.py
=========================
PURPOSE:
    This module loads the trained Isolation Forest model from disk and
    uses it to classify a new CPU/memory reading as NORMAL or ANOMALOUS.

    This is the "inference" half of the ML pipeline. It is intentionally
    kept separate from train_model.py because:
        - Prediction happens frequently (every few seconds in production)
        - Training happens rarely (manually, or on a schedule)
        - If they were in one file, a bug in training could silently break
          prediction, and vice versa

IMPORTANT — THE ANOMALY SCORE EXPLAINED:
    IsolationForest.score_samples() returns a value typically between -0.5 and 0.
    It is NOT a probability. Do not interpret it as "60% chance of anomaly."

    Interpretation:
        Score close to  0.0  →  Very normal  (hard to isolate, blends with crowd)
        Score around   -0.3  →  Borderline
        Score close to -0.5  →  Strong anomaly (easy to isolate, stands out)

    The threshold used to label points as -1 (anomaly) vs +1 (normal) is
    determined during training by the 'contamination' parameter. Points below
    that threshold are labelled anomalies.

HOW DATA FLOWS:
    [models/anomaly_model.joblib]  →  [predict_anomaly.py]  →  result dict
                                              ↑
                              user provides: cpu_percent, mem_percent
"""

import joblib
import numpy as np
from pathlib import Path

from model.train_model import DEFAULT_MODEL, FEATURE_COLUMNS


# ─── Model Loading ────────────────────────────────────────────────────────────

def load_model(model_path: Path = None) -> dict:
    """
    Load the trained model payload from disk.

    WHY load into a dict rather than returning the model directly?
        The saved payload contains BOTH the model AND the feature names.
        Always loading both together ensures we can validate that the
        feature names match what the caller provides.

    Args:
        model_path (Path): Path to the .joblib file. Defaults to DEFAULT_MODEL.

    Returns:
        dict: {'model': IsolationForest, 'features': list[str]}

    Raises:
        FileNotFoundError: Model file does not exist (train first).
    """
    if model_path is None:
        model_path = DEFAULT_MODEL

    if not model_path.exists():
        raise FileNotFoundError(
            f"No trained model found at: {model_path}\n"
            f"Train the model first:\n"
            f"  .\\venv\\Scripts\\python -m model.train_model"
        )

    return joblib.load(model_path)


# ─── Input Validation ─────────────────────────────────────────────────────────

def validate_input(cpu_percent: float, mem_percent: float) -> None:
    """
    Validate that a new reading is physically possible before predicting.

    WHY validate here too, not just during training?
        Training validates historical data. Prediction validates live input.
        An API caller might accidentally pass cpu_percent=150 or mem_percent=-1.
        Without this guard, the model would silently produce a meaningless result.

    Args:
        cpu_percent (float): CPU usage, must be in [0, 100].
        mem_percent (float): Memory usage, must be in [0, 100].

    Raises:
        TypeError:  If inputs are not numbers.
        ValueError: If inputs are outside [0, 100].
    """
    for name, value in [("cpu_percent", cpu_percent), ("mem_percent", mem_percent)]:
        if not isinstance(value, (int, float)):
            raise TypeError(
                f"'{name}' must be a number (int or float), got {type(value).__name__}: {value!r}"
            )
        if not (0.0 <= value <= 100.0):
            raise ValueError(
                f"'{name}' must be in range [0, 100], got {value}.\n"
                f"CPU and memory percentages are physically bounded."
            )


# ─── Prediction ───────────────────────────────────────────────────────────────

def predict(
    cpu_percent: float,
    mem_percent: float,
    model_path: Path = None,
) -> dict:
    """
    Classify a single CPU/memory reading as NORMAL or ANOMALOUS.

    STEP BY STEP:
        1. Validate inputs are valid numbers in [0, 100]
        2. Load the trained model from disk
        3. Build a 2D array from the inputs (required by scikit-learn)
        4. Call model.predict() → +1 (normal) or -1 (anomaly)
        5. Call model.score_samples() → raw anomaly score (NOT a probability)
        6. Return a clean result dict

    WHY a 2D array for a single reading?
        Scikit-learn always expects input as a 2D array: shape (n_samples, n_features).
        For one reading: shape (1, 2) — one row, two columns.
        np.array([[cpu, mem]]) creates this.

    PREDICTION LABEL MAPPING:
        IsolationForest returns integers, not strings. We map them to
        human-readable labels for clarity:
            +1 → "NORMAL"
            -1 → "ANOMALY"

    Args:
        cpu_percent (float): Current CPU usage percentage (0–100).
        mem_percent (float): Current memory usage percentage (0–100).
        model_path  (Path):  Path to saved model. Defaults to DEFAULT_MODEL.

    Returns:
        dict: {
            'label':       str   — "NORMAL" or "ANOMALY"
            'score':       float — anomaly score (more negative = more anomalous)
            'cpu_percent': float — the input value (echoed back for logging)
            'mem_percent': float — the input value (echoed back for logging)
            'is_anomaly':  bool  — True if label == "ANOMALY"
        }

    Raises:
        TypeError, ValueError: From validate_input() for bad inputs.
        FileNotFoundError:     If model file does not exist.
    """
    # Step 1: Validate
    validate_input(cpu_percent, mem_percent)

    # Step 2: Load model
    payload = load_model(model_path)
    model    = payload["model"]
    features = payload["features"]

    # Step 3: Build feature array — shape must be (1, n_features)
    # We use the saved feature list to ensure correct column order
    X = np.array([[cpu_percent, mem_percent]])

    # Step 4: Predict — returns array of shape (1,) with value +1 or -1
    raw_prediction = model.predict(X)[0]          # [0] extracts the scalar

    # Step 5: Anomaly score — the lower (more negative), the more anomalous
    # score_samples returns shape (1,); [0] extracts the scalar
    score = model.score_samples(X)[0]

    # Step 6: Map integer → readable label
    label      = "ANOMALY" if raw_prediction == -1 else "NORMAL"
    is_anomaly = bool(raw_prediction == -1)   # bool() converts np.bool_ → Python bool

    return {
        "label":       label,
        "score":       round(float(score), 6),
        "cpu_percent": cpu_percent,
        "mem_percent": mem_percent,
        "is_anomaly":  is_anomaly,
    }


# ─── Manual Run ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    # Example: normal-looking reading
    print("=== Example Predictions ===\n")

    test_cases = [
        (25.0, 60.0,  "Typical workload"),
        (5.0,  30.0,  "Idle machine"),
        (98.0, 99.0,  "CPU + RAM both maxed out"),
        (1.0,  99.5,  "RAM almost full, CPU idle"),
    ]

    for cpu, mem, description in test_cases:
        try:
            result = predict(cpu, mem)
            score_note = "(very normal)" if result["score"] > -0.1 else \
                         "(borderline)"  if result["score"] > -0.3 else \
                         "(strong anomaly)"
            print(f"  [{result['label']:7}]  CPU={cpu:5.1f}%  MEM={mem:5.1f}%  "
                  f"Score={result['score']:+.4f} {score_note}  | {description}")
        except Exception as e:
            print(f"  [ERROR] {e}", file=sys.stderr)
