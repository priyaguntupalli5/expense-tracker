#!/bin/bash
# Build and (re)start the expense-tracker container.
# Run from the repo root: bash deployment/deploy.sh
#
# Required environment variables (set in .env or export before running):
#   DB_URL       e.g. jdbc:mysql://<RDS-ENDPOINT>:3306/expensetracker?createDatabaseIfNotExist=true&serverTimezone=UTC
#   DB_USER      RDS master username
#   DB_PASS      RDS master password
#   JWT_SECRET   Long random string (min 32 chars)

set -e

ENV_FILE="$(dirname "$0")/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

: "${DB_URL:?DB_URL is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASS:?DB_PASS is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"

echo "==> Building Docker image..."
docker build -t expense-tracker .

echo "==> Stopping old container (if running)..."
docker stop expense-tracker 2>/dev/null || true
docker rm   expense-tracker 2>/dev/null || true

echo "==> Starting container..."
docker run -d \
    --name expense-tracker \
    --restart unless-stopped \
    -p 8080:8080 \
    -e SPRING_DATASOURCE_URL="$DB_URL" \
    -e SPRING_DATASOURCE_USERNAME="$DB_USER" \
    -e SPRING_DATASOURCE_PASSWORD="$DB_PASS" \
    -e JWT_SECRET="$JWT_SECRET" \
    expense-tracker

echo "==> Container started. Tailing logs (Ctrl-C to exit)..."
docker logs -f expense-tracker
