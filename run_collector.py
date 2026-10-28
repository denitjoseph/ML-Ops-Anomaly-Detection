"""
run_collector.py
================
PURPOSE:
    This is the ENTRY POINT for Phase 2. Run this script to start collecting
    CPU and memory metrics and saving them to data/metrics.csv automatically.

    Think of it as the "main program" that connects:
        collector.py (collects) --> csv_logger.py (saves) --> metrics.csv

HOW TO RUN:
    From the project root, with your virtual environment activated:

        .\\venv\\Scripts\\python run_collector.py

    To use a custom interval (e.g., collect every 10 seconds):

        .\\venv\\Scripts\\python run_collector.py --interval 10

    To stop: press Ctrl+C in the terminal.

WHAT IS AN ENTRY POINT?
    In a real MLOps system, this script would be run by a scheduler (like
    cron on Linux or Task Scheduler on Windows) to collect metrics continuously.
    For now, we run it manually to verify the pipeline works end-to-end.
"""

import time         # Built-in: provides time.sleep() to pause between readings
import argparse     # Built-in: parses command-line arguments (e.g. --interval)

from metrics.collector  import collect_metrics
from metrics.csv_logger import append_metrics_to_csv, get_default_csv_path


def parse_args():
    """
    Parse command-line arguments so users can customize behaviour without
    editing the source code.

    argparse is Python's built-in argument parser. It automatically:
        - Generates a --help message
        - Validates argument types (e.g. rejects --interval abc)
        - Converts strings to the correct Python types

    Returns:
        argparse.Namespace: An object where args.interval gives the value.
    """
    parser = argparse.ArgumentParser(
        description="Collect CPU and memory metrics and save them to CSV."
    )
    parser.add_argument(
        "--interval",
        type=int,           # must be an integer
        default=5,          # sensible default: collect every 5 seconds
        help="How many seconds to wait between readings (default: 5)",
    )
    return parser.parse_args()


def run_collection_loop(interval: int) -> None:
    """
    The main collection loop. Runs forever until the user presses Ctrl+C.

    HOW IT WORKS:
        1. Collect one snapshot (takes ~1 second due to cpu_percent interval)
        2. Save it to CSV
        3. Print confirmation so you know it's working
        4. Sleep for 'interval' seconds
        5. Repeat from step 1

    WHY try/except KeyboardInterrupt?
        When you press Ctrl+C, Python raises a KeyboardInterrupt exception.
        Without the try/except, you'd see an ugly traceback printed to the
        terminal. By catching it explicitly, we can print a friendly goodbye
        message and exit cleanly. This is what "graceful shutdown" means.

    WHY print the CSV path on startup?
        It removes ambiguity — you know exactly which file is being written,
        which is useful when debugging or checking the output.

    Args:
        interval (int): Seconds to wait between each collection cycle.
    """
    csv_path = get_default_csv_path()

    print("=" * 55)
    print("  ML-Ops Anomaly Detection — Metrics Collector")
    print("=" * 55)
    print(f"  Saving to : {csv_path}")
    print(f"  Interval  : every {interval} seconds")
    print("  Press Ctrl+C to stop.\n")

    reading_count = 0   # track how many rows we've written this session

    try:
        while True:                         # loop forever (until Ctrl+C)
            snapshot = collect_metrics()    # ~1 second (cpu_percent interval)
            append_metrics_to_csv(snapshot, csv_path)

            reading_count += 1
            print(
                f"  [{reading_count:>4}]  "
                f"{snapshot['timestamp']}  |  "
                f"CPU: {snapshot['cpu_percent']:5.1f}%  |  "
                f"MEM: {snapshot['mem_percent']:5.1f}%"
            )

            # Sleep for the remaining time.
            # collect_metrics() already took ~1 second (the psutil interval),
            # so we subtract 1 to keep the total cycle close to 'interval'.
            remaining = max(0, interval - 1)
            time.sleep(remaining)

    except KeyboardInterrupt:
        # Ctrl+C was pressed — exit cleanly with a summary
        print(f"\n  [STOPPED] Collected {reading_count} readings.")
        print(f"  Data saved to: {csv_path}")


if __name__ == "__main__":
    args = parse_args()
    run_collection_loop(interval=args.interval)
