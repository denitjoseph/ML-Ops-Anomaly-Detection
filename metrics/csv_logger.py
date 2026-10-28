"""
metrics/csv_logger.py
=====================
PURPOSE:
    This module has ONE job: take a metrics snapshot (a Python dict) and
    save it as a row in a CSV file.

    It does NOT collect metrics — that's collector.py's job.
    It does NOT analyse data — that's the ML model's job.
    This separation is the Single Responsibility Principle in action.

WHY CSV?
    CSV (Comma-Separated Values) is the simplest possible format for
    storing tabular data. It is:
        - Human-readable (open it in Notepad or Excel)
        - Supported by every data tool (Pandas, Excel, SQL importers)
        - Trivially appendable — just write a new line

WHY Python's built-in 'csv' module instead of Pandas?
    We could use pandas.DataFrame.to_csv(), but that would be overkill
    for simply appending a single row. The built-in 'csv' module:
        - Ships with Python (zero extra dependencies)
        - Is fast for row-by-row writing
        - Works identically on Windows, macOS, Linux

WHY pathlib instead of os.path?
    pathlib.Path is the modern, object-oriented way to work with file
    paths in Python (introduced in Python 3.4). It is more readable than
    the old os.path style:
        OLD: os.path.join(os.path.dirname(__file__), '..', 'data')
        NEW: Path(__file__).parent.parent / 'data'
    The / operator on Path objects builds paths — much cleaner.

HOW DATA FLOWS:
    [collector.py] -- dict --> [csv_logger.py] -- row --> [metrics.csv]
"""

import csv                      # Built-in: reads and writes CSV files
from pathlib import Path        # Built-in: cross-platform file path handling


# ─── Column Definitions ───────────────────────────────────────────────────────
# We only save 3 of the 5 fields from collect_metrics().
# 'mem_total_mb' and 'mem_used_mb' are excluded for now because:
#   - The ML model only needs percentages (0-100 range, easy to compare)
#   - Total RAM never changes, so it adds no information per row
#   - We keep the CSV lean — fewer columns = faster to read and train on
#
# This list is the single source of truth for column order.
# If you add a column here, it will automatically appear in the CSV header
# and in every row written by append_metrics_to_csv().
CSV_COLUMNS = ["timestamp", "cpu_percent", "mem_percent"]


def get_default_csv_path() -> Path:
    """
    Return the absolute path to data/metrics.csv.

    WHY compute it here instead of hardcoding?
        This function uses __file__ (the path of THIS script) as an anchor
        point to find the project root. That means the path works correctly
        no matter what directory you run the script from.

    How it works:
        __file__          → .../metrics/csv_logger.py
        Path(__file__)    → Path object pointing to csv_logger.py
        .parent           → .../metrics/
        .parent.parent    → .../ (project root)
        / "data"          → .../data/
        / "metrics.csv"   → .../data/metrics.csv

    Returns:
        Path: Absolute path to data/metrics.csv
    """
    project_root = Path(__file__).parent.parent
    return project_root / "data" / "metrics.csv"


def ensure_data_directory(csv_path: Path) -> None:
    """
    Create the directory containing the CSV file if it doesn't exist.

    WHY this is needed:
        When you run the project for the very first time, the 'data/'
        folder does not exist. Python's open() will raise a FileNotFoundError
        if the parent directory is missing. This function prevents that.

    mkdir() arguments explained:
        parents=True  → also create any missing parent directories
                         e.g. if 'data/archive/' doesn't exist either
        exist_ok=True → do NOT raise an error if the directory already exists
                         (safe to call every time)

    Args:
        csv_path (Path): The full path to the CSV file (not the directory).
    """
    csv_path.parent.mkdir(parents=True, exist_ok=True)


def csv_file_exists(csv_path: Path) -> bool:
    """
    Check whether the CSV file already exists on disk.

    This is used to decide whether to write the header row.
    We only write headers the FIRST time the file is created.
    On subsequent runs, the file already exists so we skip the header,
    which prevents duplicate header rows like:
        timestamp,cpu_percent,mem_percent   ← first run (correct)
        timestamp,cpu_percent,mem_percent   ← second run (WRONG, duplicate)
        2025-01-15T10:30:00,23.5,67.3

    Args:
        csv_path (Path): Path to check.

    Returns:
        bool: True if the file exists, False otherwise.
    """
    return csv_path.exists()


def append_metrics_to_csv(snapshot: dict, csv_path: Path = None) -> None:
    """
    Write one metrics snapshot as a new row in the CSV file.

    This is the main function of this module. It does three things:
        1. Makes sure the data/ directory exists.
        2. Writes the header row if this is the first time the file is created.
        3. Appends the snapshot data as a new row.

    WHY 'a' mode (append) instead of 'w' (write)?
        open(path, 'w') OVERWRITES the entire file every time — you'd lose
        all previous readings. open(path, 'a') adds to the END of the file,
        preserving all existing rows. This is what we want.

    WHY newline='' on Windows?
        On Windows, Python's text mode adds an extra carriage return (\r),
        resulting in blank lines between rows in CSV files. Passing newline=''
        tells Python NOT to add its own newlines and lets the csv module
        handle line endings correctly. This is the official Python docs
        recommendation for csv.writer on Windows.

    WHY csv.DictWriter instead of csv.writer?
        csv.writer writes rows as lists:  writer.writerow([val1, val2, val3])
        csv.DictWriter writes rows as dicts: writer.writerow({'col': val, ...})
        DictWriter is safer because it maps values to columns BY NAME,
        so column order in the code doesn't need to match the dict order.

    Args:
        snapshot (dict): The metrics dict from collect_metrics(). Must contain
                         keys: 'timestamp', 'cpu_percent', 'mem_percent'.
        csv_path (Path): Where to save the CSV. Defaults to data/metrics.csv.
    """
    if csv_path is None:
        csv_path = get_default_csv_path()

    # Step 1: Make sure the folder exists before trying to open a file in it
    ensure_data_directory(csv_path)

    # Step 2: Check existence BEFORE opening the file.
    # If we checked AFTER, the file would already exist (we just opened it).
    file_already_existed = csv_file_exists(csv_path)

    # Step 3: Open the file in APPEND mode. newline='' is required on Windows.
    with open(csv_path, mode="a", newline="", encoding="utf-8") as csv_file:

        # DictWriter links column names (CSV_COLUMNS) to dict keys (snapshot)
        writer = csv.DictWriter(csv_file, fieldnames=CSV_COLUMNS)

        # Write the header ONLY on the very first run (when file didn't exist)
        if not file_already_existed:
            writer.writeheader()   # writes: timestamp,cpu_percent,mem_percent

        # extrasaction='ignore' tells DictWriter to silently skip any keys
        # in the snapshot that are NOT in CSV_COLUMNS (e.g. mem_total_mb).
        # Without this, it would raise a ValueError.
        writer.writerow({
            "timestamp":   snapshot["timestamp"],
            "cpu_percent": snapshot["cpu_percent"],
            "mem_percent": snapshot["mem_percent"],
        })
