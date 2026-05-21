#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="${ROOT_DIR}/.local/mysql/run"
PID_FILE="${RUN_DIR}/mysqld.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "未找到 pid 文件：$PID_FILE"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" >/dev/null 2>&1; then
  kill "$PID"
  echo "已停止 MySQL (pid=$PID)"
else
  echo "进程不存在 (pid=$PID)"
fi

rm -f "$PID_FILE"
