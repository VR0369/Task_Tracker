# Single-service image: build the React SPA, then have FastAPI serve both the
# API and the built frontend from one origin. Used by Render (render.yaml) and
# runnable locally with `docker build -t orbit . && docker run -p 8000:8000 orbit`.

# ---- frontend build stage ----
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Same-origin API path — the backend serves this bundle, so /api/v1 is relative.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---- backend runtime stage ----
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .

# Built SPA lands in ./static, which app/main.py detects and serves.
COPY --from=frontend /fe/dist ./static

EXPOSE 8000
# Render (and most PaaS) inject $PORT; fall back to 8000 for local runs.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
