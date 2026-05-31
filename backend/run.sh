#!/bin/bash
set -e

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

ENV="${ENVIRONMENT:-development}"

# Apply any pending database migrations before starting the server
echo "Running database migrations..."
alembic upgrade head

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
