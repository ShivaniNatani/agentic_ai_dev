#!/bin/bash
set -e

RUN_MODE="${RUN_MODE:-dashboard}"

if [ "$RUN_MODE" = "monitor" ]; then
    echo "Running in MONITOR mode (one-time execution)..."
    exec python3 /app/automated_monitor.py --days "${MONITOR_DAYS:-7}" --email-type "${EMAIL_TYPE:-consolidated}"
elif [ "$RUN_MODE" = "monitor-http" ]; then
    echo "Running in MONITOR-HTTP mode (HTTP endpoint for scheduler)..."
    exec python3 /app/monitor_http.py
else
    echo "Running in DASHBOARD mode (React + API)..."
    exec python3 /app/api/app.py
fi
