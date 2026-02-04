FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PostgreSQL and pgvector
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser

# Copy and install dependencies first (better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only necessary application files (not tests, docs, etc.)
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY scripts/startup.py ./scripts/startup.py
COPY alembic.ini .

# Remove any Python cache files
RUN find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
RUN find . -type f -name "*.pyc" -delete 2>/dev/null || true
RUN find . -type f -name "*.pyo" -delete 2>/dev/null || true

# Set proper permissions
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Run with production settings
CMD python scripts/startup.py && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log
