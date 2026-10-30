# Image for test and production: Django serves the API and the React build (ADR-0006).

# ---- Stage 1: build the portal ----
FROM node:22-alpine AS portal
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Python only, with the built portal ----
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    FRONTEND_DIST=/app/frontend/dist
WORKDIR /app/backend

RUN useradd --create-home --uid 10001 app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=portal /app/frontend/dist /app/frontend/dist

# collectstatic does not touch the database; these values exist only for this step.
RUN DJANGO_SECRET_KEY=build-only DATABASE_URL=sqlite:////tmp/build.db python manage.py collectstatic --noinput

USER app
EXPOSE 8080
# Migrations run as a separate step before each deploy (see README), never at container start.
CMD ["sh", "-c", "exec gunicorn config.wsgi --bind 0.0.0.0:${PORT} --workers 2 --threads 4 --timeout 30"]
