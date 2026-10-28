"""
model/train_model.py
====================
PURPOSE:
    This module trains an Isolation Forest model on historical CPU and memory
    metrics collected by Phase 1 and Phase 2. It saves the trained model to
    disk so it can be loaded quickly during prediction — without retraining.

WHY SEPARATION OF TRAINING AND PREDICTION?
    Training is slow and should only happen deliberately:
        - After collecting enough historical data
        - When the system's behaviour changes significantly
        - On a scheduled basis (e.g. weekly retraining in production)

    Prediction must be fast — ideally sub-millisecond. Loading a pre-trained
    model from disk is nearly instant. Retraining on every prediction would
    be absurdly slow and defeat the purpose of ML.

    Rule: NEVER call train_and_save_model() from predict_anomaly.py.

WHAT IS ISOLATION FOREST?
    Isolation Forest is an UNSUPERVISED anomaly detection algorithm.
    "Unsupervised" means we never show it labelled examples of anomalies.
    Instead, it learns what "normal" looks like and flags anything that
    deviates significantly from that learned pattern.

    How it works (intuition):
        Imagine you're trying to isolate a specific person in a crowd.
        An anomalous person (very unusual height, clothing) is easy to
        isolate with just a few random "cuts." A normal person requires
        many more cuts to isolate because they blend in with the crowd.
        The model measures how many random cuts it takes to isolate each
        data point. Few cuts = anomaly. Many cuts = normal.

    Output:
        - Returns +1 for normal observations
        - Returns -1 for anomalies (flagged as outliers)
        - The "anomaly score" is the average path length (more negative = more anomalous)

WHAT IS CONTAMINATION?
    Contamination is our ASSUMPTION about what proportion of the training
    data is anomalous. It does NOT guarantee that exactly that fraction of
    future predictions will be flagged as anomalies.

    Default: 0.05 means we assume ~5% of historical readings were unusual.
    In production, you would tune this based on domain knowledge.

HOW DATA FLOWS:
    [data/metrics.csv] --> [train_model.py] --> [models/anomaly_model.joblib]
                                                        |
                                              [predict_anomaly.py]
"""

import pandas as pd          # Tabular data manipulation
import numpy as np           # Numerical operations (used implicitly by sklearn)
import joblib                # Saves/loads Python objects efficiently (model persistence)
from pathlib import Path
from sklearn.ensemble import IsolationForest


# ─── Path Constants ───────────────────────────────────────────────────────────
# All paths are computed relative to THIS file's location so the code
# works regardless of which directory you run it from.

PROJECT_ROOT  = Path(__file__).parent.parent
DEFAULT_CSV   = PROJECT_ROOT / "data"  / "metrics.csv"
DEFAULT_MODEL = PROJECT_ROOT / "models" / "anomaly_model.joblib"

# Minimum number of rows required to train a meaningful model.
# Isolation Forest needs enough data to establish what "normal" looks like.
# With fewer than this, we refuse to train and ask the user to collect more.
MIN_TRAINING_ROWS = 50

# The exact column names we expect in the CSV — matches csv_logger.py exactly
FEATURE_COLUMNS = ["cpu_percent", "mem_percent"]
REQUIRED_COLUMNS = ["timestamp"] + FEATURE_COLUMNS


# ─── Data Loading & Validation ────────────────────────────────────────────────

def load_and_validate_csv(csv_path: Path = None) -> pd.DataFrame:
    """
    Load the metrics CSV and validate it is ready for training.

    This function is strict by design. Garbage in = garbage model.
    It performs four checks in order:
        1. File exists
        2. Required columns are present
        3. Enough rows exist to train meaningfully
        4. Feature values are valid numbers in the 0–100 range

    WHY Pandas?
        Unlike Python's built-in csv module (used in Phase 2 for writing),
        Pandas excels at reading, filtering and transforming tabular data.
        pd.read_csv() handles type inference, missing values, and large
        files gracefully — all in one line.

    WHY reject values outside 0–100?
        CPU and memory percentages are physically bounded: a CPU cannot be
        -5% or 150% busy. Values outside this range indicate corrupt or
        erroneous readings that would skew the model's understanding of normal.

    Args:
        csv_path (Path): Path to the CSV file. Defaults to data/metrics.csv.

    Returns:
        pd.DataFrame: Clean DataFrame with at least FEATURE_COLUMNS present
                      and all values in range [0, 100].

    Raises:
        FileNotFoundError:  CSV file does not exist at the given path.
        ValueError:         Missing columns, too few rows, or invalid values.
    """
    if csv_path is None:
        csv_path = DEFAULT_CSV

    # Check 1: Does the file exist?
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Metrics CSV not found at: {csv_path}\n"
            f"Run the collector first:  .\\venv\\Scripts\\python run_collector.py"
        )

    # Load CSV into a DataFrame. dtype=str avoids pandas silently converting
    # corrupt values — we handle conversion ourselves below.
    df = pd.read_csv(csv_path)

    # Check 2: Are all required columns present?
    missing = set(REQUIRED_COLUMNS) - set(df.columns)
    if missing:
        raise ValueError(
            f"CSV is missing required columns: {missing}\n"
            f"Expected: {REQUIRED_COLUMNS}\n"
            f"Found:    {list(df.columns)}"
        )

    # Convert feature columns to numeric, coercing invalid strings to NaN
    # pd.to_numeric(..., errors='coerce') turns "abc" → NaN instead of crashing
    for col in FEATURE_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop rows where conversion failed (NaN values in feature columns)
    rows_before = len(df)
    df = df.dropna(subset=FEATURE_COLUMNS)
    dropped = rows_before - len(df)
    if dropped > 0:
        print(f"  [WARNING] Dropped {dropped} rows with non-numeric values in features.")

    # Check 3: Do we have enough data to train?
    if len(df) < MIN_TRAINING_ROWS:
        raise ValueError(
            f"Not enough data to train. Found {len(df)} valid rows, "
            f"need at least {MIN_TRAINING_ROWS}.\n"
            f"Keep running the collector to gather more readings."
        )

    # Check 4: Are feature values in the valid physical range [0, 100]?
    for col in FEATURE_COLUMNS:
        out_of_range = df[(df[col] < 0) | (df[col] > 100)]
        if not out_of_range.empty:
            raise ValueError(
                f"Column '{col}' contains {len(out_of_range)} value(s) outside [0, 100].\n"
                f"Invalid values: {out_of_range[col].tolist()[:5]}..."
            )

    return df


# ─── Model Training ───────────────────────────────────────────────────────────

def train_and_save_model(
    csv_path: Path = None,
    model_path: Path = None,
    contamination: float = 0.05,
    random_state: int = 42,
) -> dict:
    """
    Train an Isolation Forest model and save it to disk.

    WHY random_state=42?
        Isolation Forest uses random splits internally. Without a fixed seed,
        you'd get slightly different results every time you train — making it
        impossible to reproduce a bug or compare two training runs.
        random_state=42 is a Python/ML convention (any integer works).

    WHY save with joblib instead of pickle?
        joblib is the recommended way to serialise scikit-learn models because:
            - It's more efficient for large numpy arrays (compression, memory-mapping)
            - It's safer across numpy versions than raw pickle
            - It's already a scikit-learn dependency, so no extra install needed

    WHAT IS SAVED?
        We save a dict containing:
            - 'model':    the trained IsolationForest object
            - 'features': the list of feature column names
        The feature list is critical — it ensures predictions always use
        the same columns in the same order as training.

    Args:
        csv_path     (Path):  Where to read the historical metrics CSV.
        model_path   (Path):  Where to save the trained model (.joblib file).
        contamination (float): Assumed fraction of anomalies in training data.
                               Must be in (0, 0.5]. Default: 0.05 (5%).
        random_state (int):   Seed for reproducibility. Default: 42.

    Returns:
        dict: Summary containing 'n_samples', 'contamination', 'model_path'.

    Raises:
        ValueError: If contamination is not in (0, 0.5].
        FileNotFoundError / ValueError: Propagated from load_and_validate_csv().
    """
    if model_path is None:
        model_path = DEFAULT_MODEL

    if not (0 < contamination <= 0.5):
        raise ValueError(
            f"contamination must be in range (0, 0.5], got {contamination}.\n"
            f"It represents the assumed fraction of anomalies (e.g. 0.05 = 5%)."
        )

    # Step 1: Load and validate the CSV data
    print(f"[*] Loading data from: {csv_path or DEFAULT_CSV}")
    df = load_and_validate_csv(csv_path)
    print(f"    Found {len(df)} valid rows.")

    # Step 2: Extract feature matrix
    # X is a 2D NumPy array: rows=samples, cols=features
    # Shape example with 200 rows: (200, 2)  — 2 columns: cpu_percent, mem_percent
    X = df[FEATURE_COLUMNS].values

    # Step 3: Create and train the model
    # n_estimators: number of isolation trees (more = more stable, slower to train)
    # 100 is the scikit-learn default and works well for most datasets.
    print(f"[*] Training Isolation Forest (contamination={contamination}, "
          f"n_estimators=100, random_state={random_state})...")
    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=random_state,
    )
    model.fit(X)    # This is where learning happens — studying "normal" patterns
    print("    Training complete.")

    # Step 4: Save the model and feature names together
    # Saving feature names alongside the model prevents a dangerous mismatch:
    # if you later rename a column, the model would silently use wrong features.
    model_path.parent.mkdir(parents=True, exist_ok=True)
    model_payload = {
        "model":    model,
        "features": FEATURE_COLUMNS,
    }
    joblib.dump(model_payload, model_path)
    print(f"[OK] Model saved to: {model_path}")

    return {
        "n_samples":     len(df),
        "contamination": contamination,
        "model_path":    str(model_path),
        "features":      FEATURE_COLUMNS,
    }


# ─── Manual Run ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    summary = train_and_save_model()
    print("\n--- Training Summary ---")
    for key, value in summary.items():
        print(f"  {key}: {value}")
