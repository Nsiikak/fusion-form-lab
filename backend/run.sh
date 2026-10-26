#!/bin/bash
set -e

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

ENV="${ENVIRONMENT:-development}"

# Database tables/migrations are applied by the app itself on startup (init_db.run in main.py)

if [ "$ENV" = "production" ]; then
    echo "Starting Plagohive API in PRODUCTION mode..."
    exec uvicorn main:app \
        --host 0.0.0.0 \
        --port "${PORT:-8000}" \
        --workers "${WEB_CONCURRENCY:-4}" \
        --log-level warning \
        --no-access-log
else
    echo "Starting Plagohive API in DEVELOPMENT mode..."
    exec uvicorn main:app \
        --reload \
        --host 0.0.0.0 \
        --port "${PORT:-8000}" \
        --log-level info
fi
