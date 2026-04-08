# =============================================================================
# Multi-stage production Dockerfile for IKS ML Observatory
# Single container: nginx (reverse proxy) + Flask API + Node Access Server
# =============================================================================

# -------- Stage 1: Build React Frontend --------
FROM node:20-alpine AS frontend-build

WORKDIR /app

# Copy package files for caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build

# -------- Stage 2: Production Runtime --------
FROM python:3.11-slim

# Environment configuration
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8510 \
    PUBLIC_OUTAGE_MODE=false

# Install system dependencies (nginx + nodejs + npm)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    nginx \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash mlops

WORKDIR /app

# Embed service account keys (needed for Release Notes, ITTT, and AR Backlog)
COPY secrets/agentic-ai-key.json /app/secrets/agentic-ai-key.json
COPY secrets/mlflow-sa-prod.json /app/secrets/mlflow-sa-prod.json

# Copy Python requirements and install dependencies
COPY requirements.txt ./
RUN python -m pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy backend API code
COPY mlops-feature-dev_react@660c70449d5/api ./api
COPY mlops-feature-dev_react@660c70449d5/Vertex_ai ./Vertex_ai
COPY mlops-feature-dev_react@660c70449d5/*.py ./
COPY mlops-feature-dev_react@660c70449d5/config.ini ./config.ini

# Copy data file if exists (for local development fallback)
COPY mlops-feature-dev_react@660c70449d5/model_data2.csv ./model_data2.csv
COPY GIA_Data_Analysis_New.csv ./
COPY ["GIA NPNR calculation (1).xlsx", "./"]
COPY ["GIA NPNR last left after work .xlsx", "./"]

# Copy and install access server
COPY access-server ./access-server
RUN cd access-server && npm install --production

# Copy built frontend from Stage 1
COPY --from=frontend-build /app/dist ./frontend/dist

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create nginx temp directories and set permissions
RUN mkdir -p /tmp/client_body /tmp/proxy /tmp/fastcgi /tmp/uwsgi /tmp/scgi \
    && mkdir -p /var/log/nginx /var/lib/nginx \
    && chown -R mlops:mlops /app /tmp/client_body /tmp/proxy /tmp/fastcgi /tmp/uwsgi /tmp/scgi \
    && chown -R mlops:mlops /var/log/nginx /var/lib/nginx /run

# Switch to non-root user
USER mlops

# Expose ports: 8510 (main app via nginx), 3001 (admin panel direct access)
EXPOSE 8510 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8510/api/health || exit 1

# Default command
ENTRYPOINT ["./docker-entrypoint.sh"]
