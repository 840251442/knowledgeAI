#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "docker 未安装"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon 未运行，请先启动 Docker Desktop"
  exit 1
fi

NAME="${MYSQL_CONTAINER_NAME:-knowledgeai-mysql}"
PORT="${MYSQL_PORT:-3306}"
DB="${MYSQL_DATABASE:-knowledgeai}"
USER="${MYSQL_USER:-knowledgeai}"
PASSWORD="${MYSQL_PASSWORD:-knowledgeai_dev}"
ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-knowledgeai_root}"

if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  docker start "$NAME" >/dev/null
else
  docker run -d \
    --name "$NAME" \
    -e MYSQL_ROOT_PASSWORD="$ROOT_PASSWORD" \
    -e MYSQL_DATABASE="$DB" \
    -e MYSQL_USER="$USER" \
    -e MYSQL_PASSWORD="$PASSWORD" \
    -p "${PORT}:3306" \
    --health-cmd="mysqladmin ping -h 127.0.0.1 -u root -p$ROOT_PASSWORD" \
    --health-interval=5s \
    --health-timeout=3s \
    --health-retries=30 \
    mysql:8.0
fi

echo "容器: $NAME"
echo "端口: $PORT"
echo "DATABASE_URL=mysql://$USER:$PASSWORD@localhost:$PORT/$DB"
