"""
metrics/collector.py
====================
PURPOSE:
    This module is the very first building block of our MLOps pipeline.
    Its only job is to ask the operating system:
        "How busy is the CPU right now?"
        "How much RAM is being used right now?"
    ...and return that information in a clean, structured way.

WHY psutil?
    psutil (Process and System Utilities) is a cross-platform library that
    lets Python talk to the OS to read hardware stats. Without it, you'd need
    to write different code for Windows, macOS, and Linux. psutil handles all
    of that for you.

HOW DATA FLOWS (big picture):
    [This file] --> [CSV Logger] --> [ML Model] --> [API] --> [Dashboard]
    We are building the very first arrow in this pipeline today.
"""

import psutil       # Reads CPU, memory, disk, network stats from the OS
import datetime     # Python's built-in module for working with dates and times


def get_cpu_usage() -> float:
    """
    Ask the OS what percentage of CPU capacity is currently being used.

    psutil.cpu_percent(interval=1) works like this:
        - It samples CPU usage over 1 second (the 'interval' parameter).
        - It returns a float between 0.0 and 100.0.
        - Example: 23.5 means 23.5% of the CPU is busy.

    WHY interval=1?
        If you use interval=0 or None, psutil compares against the LAST call,
        which can give misleading results on the first call. Using interval=1
        forces a fresh, accurate measurement every time.

    Returns:
        float: CPU usage as a percentage (e.g., 45.2 for 45.2%)
    """
    return psutil.cpu_percent(interval=1)


def get_memory_usage() -> dict:
    """
    Ask the OS about RAM (Random Access Memory) usage.

    psutil.virtual_memory() returns a named tuple with many fields.
    We extract only the ones we need:
        - total:    Total physical RAM installed (in bytes)
        - used:     RAM currently in use (in bytes)
        - percent:  Percentage of RAM used (e.g., 67.3)

    WHY bytes?
        The OS always reports memory in bytes. We convert to megabytes (MB)
        ourselves by dividing by 1024 * 1024 (= 1,048,576).
        This makes it human-readable in logs and dashboards.

    Returns:
        dict: A dictionary with keys 'total_mb', 'used_mb', 'percent'
    """
    mem = psutil.virtual_memory()

    return {
        "total_mb": round(mem.total / (1024 * 1024), 2),   # bytes → MB
        "used_mb":  round(mem.used  / (1024 * 1024), 2),   # bytes → MB
        "percent":  mem.percent,                             # already a %
    }


def collect_metrics() -> dict:
    """
    The main public function of this module.

    It combines CPU and memory readings into a single snapshot dictionary,
    and stamps it with the current date and time.

    WHY a timestamp?
        We will be collecting metrics repeatedly over time (every few seconds).
        Without a timestamp, we can't tell WHEN a reading was taken, which
        makes the data useless for time-series analysis or anomaly detection.

    WHY datetime.utcnow()?
        UTC (Coordinated Universal Time) is the global standard for timestamps.
        Using UTC means our data is consistent regardless of the server's
        local timezone. This is a professional best practice.

    Returns:
        dict: A complete snapshot with keys:
            - 'timestamp'   (str) ISO 8601 format, e.g. "2025-01-15T10:30:00"
            - 'cpu_percent' (float) e.g. 23.5
            - 'mem_total_mb'(float) e.g. 16384.0
            - 'mem_used_mb' (float) e.g. 8200.5
            - 'mem_percent' (float) e.g. 50.0
    """
    # datetime.now(datetime.UTC) is the modern, timezone-aware way to get
    # the current UTC time. The older datetime.utcnow() is deprecated in Python 3.12+.
    # .strftime() converts the datetime object into a readable string.
    timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%S")
    cpu       = get_cpu_usage()
    memory    = get_memory_usage()

    return {
        "timestamp":    timestamp,
        "cpu_percent":  cpu,
        "mem_total_mb": memory["total_mb"],
        "mem_used_mb":  memory["used_mb"],
        "mem_percent":  memory["percent"],
    }


# ─── Manual Run ───────────────────────────────────────────────────────────────
# This block only runs when you execute this file DIRECTLY:
#   python metrics/collector.py
#
# It does NOT run when another file imports it:
#   from metrics.collector import collect_metrics  ← __name__ is NOT "__main__"
#
# This is a Python convention that makes every module both importable
# AND runnable as a standalone script for quick testing.
if __name__ == "__main__":
    print("[*] Collecting system metrics...\n")
    snapshot = collect_metrics()

    print(f"  Timestamp : {snapshot['timestamp']}")
    print(f"  CPU Usage : {snapshot['cpu_percent']}%")
    print(f"  RAM Total : {snapshot['mem_total_mb']} MB")
    print(f"  RAM Used  : {snapshot['mem_used_mb']} MB")
    print(f"  RAM Usage : {snapshot['mem_percent']}%")
    print("\n[OK] Metrics collected successfully!")
