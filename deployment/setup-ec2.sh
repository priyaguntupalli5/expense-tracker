#!/bin/bash
# Run once on a fresh Amazon Linux 2023 t2.micro instance.
# Usage: bash setup-ec2.sh

set -e

echo "==> Installing Docker and Nginx..."
sudo dnf install -y docker nginx git

echo "==> Enabling services..."
sudo systemctl enable --now docker
sudo systemctl enable nginx
sudo usermod -aG docker "$USER"

echo "==> Copying Nginx config..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sudo cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/conf.d/app.conf
sudo rm -f /etc/nginx/conf.d/default.conf

echo "==> Testing Nginx config..."
sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "Done. Log out and back in so the docker group takes effect, then run deploy.sh."
