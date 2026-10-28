"""
tests/test_collector.py
========================
PURPOSE:
    This file verifies that our metrics collector works correctly.

WHAT IS PYTEST?
    Pytest is a testing framework. It automatically finds and runs any function
    whose name starts with 'test_'. If the function raises no errors, the test
    passes (✅). If it raises an AssertionError or any exception, it fails (❌).

WHAT IS AN ASSERTION?
    An assertion is a statement that says "I GUARANTEE this is true."
    If it's not true, Python raises an AssertionError and the test fails.
    Syntax: assert <condition>, "message shown if condition is False"

WHY TEST AT ALL?
    Right now our code is simple. But as we add more features (CSV writing,
    ML model, API), a bug in the collector could silently break everything
    downstream. Tests catch regressions — bugs introduced by later changes.
"""

from metrics.collector import get_cpu_usage, get_memory_usage, collect_metrics


# ─── Test 1: CPU Usage ────────────────────────────────────────────────────────

def test_cpu_usage_returns_float():
    """
    Verify that get_cpu_usage() returns a number (float or int).

    WHY isinstance check?
        psutil guarantees a float, but we check explicitly so if something
        goes wrong (e.g., psutil returns None due to a permissions error),
        our test will catch it and tell us exactly what happened.
    """
    result = get_cpu_usage()
    assert isinstance(result, float), (
        f"Expected a float, but got {type(result).__name__}: {result}"
    )


def test_cpu_usage_in_valid_range():
    """
    Verify that CPU usage is between 0% and 100%.

    A CPU cannot be -5% busy or 150% busy. If we ever get a value outside
    this range, something is seriously wrong with the OS call or our math.
    """
    result = get_cpu_usage()
    assert 0.0 <= result <= 100.0, (
        f"CPU usage {result}% is outside the valid range [0, 100]"
    )


# ─── Test 2: Memory Usage ─────────────────────────────────────────────────────

def test_memory_usage_returns_dict():
    """
    Verify that get_memory_usage() returns a dictionary.

    We need a dict because our CSV logger and ML model will access values
    by key name (e.g., memory['percent']). If it's not a dict, those will crash.
    """
    result = get_memory_usage()
    assert isinstance(result, dict), (
        f"Expected a dict, but got {type(result).__name__}"
    )


def test_memory_usage_has_required_keys():
    """
    Verify that all three expected keys are present in the returned dict.

    The downstream CSV logger will break if any of these keys are missing.
    This test acts as a "contract" — it ensures the function's output shape
    never changes unexpectedly.
    """
    result = get_memory_usage()
    required_keys = {"total_mb", "used_mb", "percent"}

    # set.issubset() checks if all required_keys exist inside result.keys()
    assert required_keys.issubset(result.keys()), (
        f"Missing keys: {required_keys - result.keys()}"
    )


def test_memory_percent_in_valid_range():
    """
    Verify that memory usage percent is between 0% and 100%.
    Same reasoning as the CPU range test.
    """
    result = get_memory_usage()
    assert 0.0 <= result["percent"] <= 100.0, (
        f"Memory percent {result['percent']}% is outside the valid range [0, 100]"
    )


def test_memory_used_not_greater_than_total():
    """
    A physical sanity check: you can't use MORE RAM than you have installed.

    If used_mb > total_mb, something is very wrong with our unit conversion
    (bytes → MB math). This test would catch that immediately.
    """
    result = get_memory_usage()
    assert result["used_mb"] <= result["total_mb"], (
        f"used_mb ({result['used_mb']}) > total_mb ({result['total_mb']}) — impossible!"
    )


def test_memory_values_are_positive():
    """
    RAM sizes cannot be negative. This guards against any accidental
    negation in the math (e.g., if someone accidentally wrote -mem.used).
    """
    result = get_memory_usage()
    assert result["total_mb"] > 0, "total_mb should be greater than 0"
    assert result["used_mb"]  > 0, "used_mb should be greater than 0"


# ─── Test 3: collect_metrics (the combined snapshot) ─────────────────────────

def test_collect_metrics_returns_dict():
    """Verify the main function returns a dictionary."""
    result = collect_metrics()
    assert isinstance(result, dict)


def test_collect_metrics_has_all_keys():
    """
    Verify the combined snapshot has all 5 expected keys.
    This is the most important test — it validates the full data contract
    that every other module (CSV, ML, API) will depend on.
    """
    result = collect_metrics()
    expected_keys = {"timestamp", "cpu_percent", "mem_total_mb", "mem_used_mb", "mem_percent"}
    assert expected_keys.issubset(result.keys()), (
        f"Missing keys: {expected_keys - result.keys()}"
    )


def test_collect_metrics_timestamp_is_string():
    """
    The timestamp must be a string so it can be written to CSV and JSON.
    If it were a datetime object, CSV/JSON serialization would break later.
    """
    result = collect_metrics()
    assert isinstance(result["timestamp"], str), (
        f"Expected timestamp to be a str, got {type(result['timestamp']).__name__}"
    )


def test_collect_metrics_timestamp_format():
    """
    Verify the timestamp matches ISO 8601 format: YYYY-MM-DDTHH:MM:SS
    Example valid timestamp: "2025-01-15T10:30:00"

    WHY this format?
        It's the international standard for date/time strings. Pandas,
        databases, and APIs all parse this format automatically.
    """
    import re
    result = collect_metrics()
    pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$"

    assert re.match(pattern, result["timestamp"]), (
        f"Timestamp '{result['timestamp']}' does not match format YYYY-MM-DDTHH:MM:SS"
    )
