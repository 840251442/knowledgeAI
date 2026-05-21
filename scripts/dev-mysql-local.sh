#!/usr/bin/env bash
set -euo pipefail

BREW_MYSQL_BIN="/usr/local/opt/mysql@8.4/bin"
MYSQLD="$BREW_MYSQL_BIN/mysqld"
MYSQL="$BREW_MYSQL_BIN/mysql"
MYSQLADMIN="$BREW_MYSQL_BIN/mysqladmin"

if [ ! -x "$MYSQLD" ]; then
  echo "未找到 mysqld：$MYSQLD"
  echo "请先安装：brew install mysql@8.4"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${ROOT_DIR}/.local/mysql/data"
RUN_DIR="${ROOT_DIR}/.local/mysql/run"
LOG_DIR="${ROOT_DIR}/.local/mysql/log"

PORT="${MYSQL_PORT:-3307}"
SOCK="${RUN_DIR}/mysql.sock"
PID_FILE="${RUN_DIR}/mysqld.pid"
ERR_LOG="${LOG_DIR}/mysqld.err"

DB="${MYSQL_DATABASE:-knowledgeai}"
USER="${MYSQL_USER:-knowledgeai}"
PASSWORD="${MYSQL_PASSWORD:-knowledgeai_dev}"

mkdir -p "$DATA_DIR" "$RUN_DIR" "$LOG_DIR"

if [ ! -d "$DATA_DIR/mysql" ]; then
  echo "初始化 MySQL 数据目录：$DATA_DIR"
  "$MYSQLD" \
    --initialize-insecure \
    --basedir="/usr/local/opt/mysql@8.4" \
    --datadir="$DATA_DIR" \
    --lower_case_table_names=2
fi

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" >/dev/null 2>&1; then
  echo "MySQL 已在运行 (pid=$(cat "$PID_FILE"))"
else
  echo "启动 MySQL（端口 ${PORT}）"
  "$MYSQLD" \
    --basedir="/usr/local/opt/mysql@8.4" \
    --datadir="$DATA_DIR" \
    --port="${PORT}" \
    --socket="$SOCK" \
    --pid-file="$PID_FILE" \
    --log-error="$ERR_LOG" \
    --lower_case_table_names=2 \
    --bind-address=127.0.0.1 \
    --skip-networking=0 \
    --mysqlx=0 \
    >/dev/null 2>&1 &
fi

echo "等待 MySQL 就绪..."
for i in {1..60}; do
  if "$MYSQLADMIN" --socket="$SOCK" -u root ping >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! "$MYSQLADMIN" --socket="$SOCK" -u root ping >/dev/null 2>&1; then
  echo "MySQL 启动失败，查看日志：$ERR_LOG"
  tail -n 80 "$ERR_LOG" || true
  exit 1
fi

echo "创建数据库与用户..."
"$MYSQL" --socket="$SOCK" -u root -e "CREATE DATABASE IF NOT EXISTS \`${DB}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
"$MYSQL" --socket="$SOCK" -u root -e "CREATE USER IF NOT EXISTS '${USER}'@'127.0.0.1' IDENTIFIED BY '${PASSWORD}';"
"$MYSQL" --socket="$SOCK" -u root -e "GRANT ALL PRIVILEGES ON \`${DB}\`.* TO '${USER}'@'127.0.0.1'; FLUSH PRIVILEGES;"

echo ""
echo "本地 MySQL 已就绪："
echo "- socket: $SOCK"
echo "- port:   ${PORT}"
echo ""
echo "用于项目的 DATABASE_URL："
echo "mysql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}"

echo ""
echo "也可用 localhost（需要用户允许 localhost）："
echo "mysql://${USER}:${PASSWORD}@localhost:${PORT}/${DB}"
