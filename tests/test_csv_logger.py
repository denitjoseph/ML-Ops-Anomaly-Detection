"""
tests/test_csv_logger.py
=========================
PURPOSE:
    Verify that csv_logger.py creates files, writes headers, appends rows,
    and preserves existing data across multiple calls — all without touching
    the real data/metrics.csv file.

KEY TESTING CONCEPT: Temporary Files
    We use Python's built-in 'tempfile' module to create a throwaway CSV
    file for each test. When the test finishes, the file is deleted
    automatically. This means:
        - Tests never pollute your real data/
        - Tests are independent — one test's output doesn't affect another
        - You can run tests as many times as you want safely

KEY TESTING CONCEPT: Fixtures (the @pytest.fixture decorator)
    A fixture is a reusable setup function. Instead of creating a temp file
    in every single test function, we define it ONCE as a fixture.
    Any test that lists 'tmp_csv_path' as a parameter will automatically
    receive a fresh temporary file path.

    Pytest sees the parameter name, finds a matching fixture, runs it,
    and passes the result to the test. This is called "dependency injection."
"""

import csv
import tempfile
from pathlib import Path

import pytest

from metrics.csv_logger import (
    CSV_COLUMNS,
    append_metrics_to_csv,
    csv_file_exists,
    ensure_data_directory,
    get_default_csv_path,
)


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def tmp_csv_path(tmp_path):
    """
    Provide a temporary CSV file path for each test.

    'tmp_path' is a built-in pytest fixture that gives us a fresh,
    empty temporary directory for each test. We add 'metrics.csv' to it.

    WHY not use tempfile.NamedTemporaryFile directly?
        We want a PATH to a file that does NOT yet exist (so we can test
        that our code creates it). NamedTemporaryFile creates the file
        immediately. tmp_path / "metrics.csv" gives us a path to a
        non-existent file in an existing directory — exactly what we need.

    Args:
        tmp_path: Built-in pytest fixture — a fresh temp directory per test.

    Yields:
        Path: Path to a temporary metrics.csv (does not exist yet).
    """
    return tmp_path / "metrics.csv"


@pytest.fixture
def sample_snapshot():
    """
    A fake metrics snapshot that looks like the output of collect_metrics().

    WHY fake data instead of calling collect_metrics()?
        Tests should be FAST and DETERMINISTIC. collect_metrics() takes
        ~1 second (cpu_percent interval) and returns different values every
        time. Fake data is instant and predictable, making test failures
        easier to diagnose.
    """
    return {
        "timestamp":    "2025-01-15T10:30:00",
        "cpu_percent":  23.5,
        "mem_total_mb": 16384.0,    # present in snapshot but NOT saved to CSV
        "mem_used_mb":  8200.0,     # present in snapshot but NOT saved to CSV
        "mem_percent":  67.3,
    }


@pytest.fixture
def second_snapshot():
    """A second fake snapshot with different values for append testing."""
    return {
        "timestamp":    "2025-01-15T10:30:05",
        "cpu_percent":  45.0,
        "mem_total_mb": 16384.0,
        "mem_used_mb":  9000.0,
        "mem_percent":  72.1,
    }


# ─── Helper: read CSV rows back from disk ─────────────────────────────────────

def read_csv_rows(csv_path: Path) -> list[dict]:
    """
    Helper function: reads all rows from a CSV file and returns them as
    a list of dicts (one dict per row).

    This is purely for test assertions. We use csv.DictReader which
    automatically uses the first row as column names (keys).

    Returns:
        list[dict]: Each element is one row, e.g.:
            [{'timestamp': '...', 'cpu_percent': '23.5', 'mem_percent': '67.3'}]
    """
    with open(csv_path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ─── Tests: Directory & File Creation ─────────────────────────────────────────

def test_ensure_data_directory_creates_folder(tmp_path):
    """
    Verify that ensure_data_directory() creates the parent folder
    if it doesn't exist.

    We point it at a deeply nested path that definitely doesn't exist,
    then confirm the directory was created.
    """
    nested_csv = tmp_path / "a" / "b" / "c" / "metrics.csv"
    assert not nested_csv.parent.exists(), "Setup error: folder should not exist yet"

    ensure_data_directory(nested_csv)

    assert nested_csv.parent.exists(), "ensure_data_directory() should have created the folder"


def test_csv_file_exists_returns_false_when_missing(tmp_csv_path):
    """csv_file_exists() should return False for a file that hasn't been created yet."""
    assert csv_file_exists(tmp_csv_path) is False


def test_csv_file_exists_returns_true_after_creation(tmp_csv_path, sample_snapshot):
    """csv_file_exists() should return True after the first write."""
    append_metrics_to_csv(sample_snapshot, tmp_csv_path)
    assert csv_file_exists(tmp_csv_path) is True


def test_append_creates_csv_file(tmp_csv_path, sample_snapshot):
    """
    The most fundamental test: does append_metrics_to_csv() actually
    create the file if it doesn't exist?
    """
    assert not tmp_csv_path.exists(), "File should not exist before the call"

    append_metrics_to_csv(sample_snapshot, tmp_csv_path)

    assert tmp_csv_path.exists(), "append_metrics_to_csv() should have created the file"


# ─── Tests: Header Row ────────────────────────────────────────────────────────

def test_header_is_written_on_first_call(tmp_csv_path, sample_snapshot):
    """
    The first row of the CSV must be the header: timestamp,cpu_percent,mem_percent
    Not the data row.
    """
    append_metrics_to_csv(sample_snapshot, tmp_csv_path)

    with open(tmp_csv_path, encoding="utf-8") as f:
        first_line = f.readline().strip()

    expected_header = ",".join(CSV_COLUMNS)    # "timestamp,cpu_percent,mem_percent"
    assert first_line == expected_header, (
        f"Expected header '{expected_header}', got '{first_line}'"
    )


def test_header_appears_only_once_after_multiple_writes(
    tmp_csv_path, sample_snapshot, second_snapshot
):
    """
    After two separate calls to append_metrics_to_csv(), the CSV should
    still have only ONE header row — not two.

    This is the critical 'append without duplicating headers' test.
    """
    append_metrics_to_csv(sample_snapshot, tmp_csv_path)
    append_metrics_to_csv(second_snapshot, tmp_csv_path)

    with open(tmp_csv_path, encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]  # skip blank lines

    header = ",".join(CSV_COLUMNS)
    header_count = sum(1 for line in lines if line == header)

    assert header_count == 1, (
        f"Header appeared {header_count} times — expected exactly 1"
    )


# ─── Tests: Data Rows ─────────────────────────────────────────────────────────

def test_first_data_row_has_correct_values(tmp_csv_path, sample_snapshot):
    """
    After writing one snapshot, verify the CSV row contains the correct values
    for all three columns.
    """
    append_metrics_to_csv(sample_snapshot, tmp_csv_path)
    rows = read_csv_rows(tmp_csv_path)

    assert len(rows) == 1, f"Expected 1 data row, found {len(rows)}"
    assert rows[0]["timestamp"]   == "2025-01-15T10:30:00"
    assert rows[0]["cpu_percent"] == "23.5"      # csv.DictReader reads as strings
    assert rows[0]["mem_percent"] == "67.3"


def test_extra_snapshot_keys_are_not_saved(tmp_csv_path, sample_snapshot):
    """
    The snapshot has 5 keys but only 3 should be saved.
    mem_total_mb and mem_used_mb must NOT appear in the CSV.
    """
    append_metrics_to_csv(sample_snapshot, tmp_csv_path)
    rows = read_csv_rows(tmp_csv_path)

    assert "mem_total_mb" not in rows[0], "mem_total_mb should not be in CSV"
    assert "mem_used_mb"  not in rows[0], "mem_used_mb should not be in CSV"


def test_two_writes_produce_two_data_rows(
    tmp_csv_path, sample_snapshot, second_snapshot
):
    """
    Two calls to append_metrics_to_csv() should produce exactly 2 data rows.
    """
    append_metrics_to_csv(sample_snapshot,  tmp_csv_path)
    append_metrics_to_csv(second_snapshot,  tmp_csv_path)
    rows = read_csv_rows(tmp_csv_path)

    assert len(rows) == 2, f"Expected 2 data rows, found {len(rows)}"


def test_rows_are_appended_in_order(tmp_csv_path, sample_snapshot, second_snapshot):
    """
    Rows must appear in the order they were written (chronological).
    The first write should be row 0, the second write should be row 1.
    """
    append_metrics_to_csv(sample_snapshot, tmp_csv_path)
    append_metrics_to_csv(second_snapshot, tmp_csv_path)
    rows = read_csv_rows(tmp_csv_path)

    assert rows[0]["timestamp"] == "2025-01-15T10:30:00"
    assert rows[1]["timestamp"] == "2025-01-15T10:30:05"


# ─── Tests: Persistence (simulating a restart) ────────────────────────────────

def test_existing_rows_preserved_on_second_session(
    tmp_csv_path, sample_snapshot, second_snapshot
):
    """
    Simulate what happens when the collector is stopped and restarted.

    Session 1: write sample_snapshot
    Session 2: write second_snapshot (new process, same file)

    The file should have BOTH rows — the old one must not be deleted.

    This is the most important real-world scenario test.
    """
    # --- Session 1 ---
    append_metrics_to_csv(sample_snapshot, tmp_csv_path)

    rows_after_session_1 = read_csv_rows(tmp_csv_path)
    assert len(rows_after_session_1) == 1, "Session 1 should have written 1 row"

    # --- Session 2 (simulated restart: we just call again, file already exists) ---
    append_metrics_to_csv(second_snapshot, tmp_csv_path)

    rows_after_session_2 = read_csv_rows(tmp_csv_path)
    assert len(rows_after_session_2) == 2, (
        "After restart, both the old row AND the new row should be present"
    )
    assert rows_after_session_2[0]["timestamp"] == "2025-01-15T10:30:00", (
        "The original row from Session 1 must still be there"
    )


# ─── Tests: Default Path ──────────────────────────────────────────────────────

def test_get_default_csv_path_returns_path_object():
    """get_default_csv_path() must return a Path object, not a plain string."""
    result = get_default_csv_path()
    assert isinstance(result, Path)


def test_get_default_csv_path_ends_with_metrics_csv():
    """The default path must end with data/metrics.csv."""
    result = get_default_csv_path()
    # Use parts[-2:] to check the last two path components
    assert result.parts[-2] == "data"
    assert result.parts[-1] == "metrics.csv"
