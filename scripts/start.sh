#!/usr/bin/env bash
set -e

echo "[start] Starting FastAPI backend on :8001 ..."
cd /app/api
uvicorn main:app --host 0.0.0.0 --port 8001 --workers 1 &
FASTAPI_PID=$!

echo "[start] Starting Next.js frontend on :3000 ..."
cd /app/frontend
HOSTNAME=0.0.0.0 PORT=3000 node server.js &
NEXTJS_PID=$!

# Wait for both backends to be ready
echo "[start] Waiting for backends to start ..."
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:8001/health > /dev/null 2>&1; then
        echo "[start] FastAPI ready"
        break
    fi
    sleep 1
done

for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:3000 > /dev/null 2>&1; then
        echo "[start] Next.js ready"
        break
    fi
    sleep 1
done

echo "[start] Starting Nginx on :8080 (foreground) ..."
nginx -g "daemon off;"
