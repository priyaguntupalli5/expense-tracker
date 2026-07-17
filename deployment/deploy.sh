#!/bin/bash
# Pull and (re)start the expense-tracker container. The image is built and
# pushed to GHCR by the GitHub Actions workflow, not on this box.
# Run from the repo root: bash deployment/deploy.sh
#
# Required environment variables (set in .env or export before running):
#   DB_URL       e.g. jdbc:mysql://<RDS-ENDPOINT>:3306/expensetracker?createDatabaseIfNotExist=true&serverTimezone=UTC
#   DB_USER      RDS master username
#   DB_PASS      RDS master password
#   JWT_SECRET   Long random string (min 32 chars)
#   IMAGE        Docker image to pull (defaults to the GHCR image for this repo)

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

IMAGE="${IMAGE:-ghcr.io/priyaguntupalli5/expense-tracker:latest}"

echo "==> Pulling Docker image ($IMAGE)..."
docker pull "$IMAGE"

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
    "$IMAGE"

if [ "$1" = "--non-interactive" ] || [ ! -t 1 ]; then
    echo "==> Waiting for container to become healthy..."
    for i in $(seq 1 30); do
        if curl -fs http://localhost/ >/dev/null 2>&1; then
            echo "==> App is up and responding."
            docker logs --tail 50 expense-tracker
            exit 0
        fi
        sleep 2
    done
    echo "==> App did not respond after 60s. Recent logs:"
    docker logs --tail 100 expense-tracker
    exit 1
else
    echo "==> Container started. Tailing logs (Ctrl-C to exit)..."
    docker logs -f expense-tracker
fi
