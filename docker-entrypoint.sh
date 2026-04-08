#!/bin/bash
set -e

# Default mode is dashboard (API + frontend serving)
RUN_MODE="${RUN_MODE:-dashboard}"

echo "=============================================="
echo "IKS ML Observatory - Starting in ${RUN_MODE} mode"
echo "=============================================="

if [ "$RUN_MODE" = "monitor" ]; then
    echo "[Mode] Running one-time monitor job..."
    exec python3 /app/automated_monitor.py \
        --days "${MONITOR_DAYS:-7}" \
        --email-type "${EMAIL_TYPE:-consolidated}"

elif [ "$RUN_MODE" = "monitor-http" ]; then
    echo "[Mode] Running HTTP endpoint for scheduler..."
    exec python3 /app/monitor_http.py

else
    # --- 1. Start Access Control Server (Node.js) on port 3001 ---
    echo "[1/3] Starting Access Control Server on port 3001..."
    (cd /app/access-server && node index.js) &
    ACCESS_PID=$!
    sleep 1

    # --- 2. Start Flask/Gunicorn API on internal port 8511 ---
    echo "[2/3] Starting Flask API on internal port 8511..."
    gunicorn --bind 127.0.0.1:8511 \
        --workers 4 \
        --threads 2 \
        --timeout 120 \
        --access-logfile - \
        --error-logfile - \
        'api.app:app' &
    GUNICORN_PID=$!
    sleep 1

    # --- 3. Start nginx reverse proxy on port 8510 (foreground) ---
    echo "[3/3] Starting nginx reverse proxy on port 8510..."
    echo "=============================================="
    echo "Main app:    http://0.0.0.0:8510"
    echo "Admin panel: http://0.0.0.0:3001"
    echo "=============================================="
    exec nginx -g "daemon off;" -c /etc/nginx/nginx.conf
fi
