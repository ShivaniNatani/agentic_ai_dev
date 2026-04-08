# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim

# -----------------------------
# Environment
# -----------------------------
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    GOOGLE_APPLICATION_CREDENTIALS=/app/mlflow-sa-prod.json \
    PUBLIC_OUTAGE_MODE=false

# -----------------------------
# OS deps
# -----------------------------
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd --create-home --shell /bin/bash mlops
WORKDIR /app

# -----------------------------
# Python dependencies
# -----------------------------
COPY requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# -----------------------------
# App source
# -----------------------------
COPY . .
COPY --from=frontend /frontend/dist /app/frontend/dist

# Permissions & runtime
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
RUN chown -R mlops:mlops /app

USER mlops

# Default port for the API server (can be overridden)
ENV PORT=8510

ENTRYPOINT ["/app/docker-entrypoint.sh"]
