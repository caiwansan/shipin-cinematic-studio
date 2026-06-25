#!/bin/bash
# TASK-RUNTIME-DRIFT-GUARD-001 — 启动前版本检查

set -e

NODE_REQUIRED="22.23.1"
PM2_REQUIRED="6.0.14"

echo "[DriftGuard] 检查 Node 版本..."
NODE_ACTUAL=$(node --version | sed "s/v//")
if [ "$NODE_ACTUAL" != "$NODE_REQUIRED" ]; then
  echo "[FATAL] Node 版本不匹配: 需要 $NODE_REQUIRED, 当前 $NODE_ACTUAL"
  exit 1
fi
echo "[OK] Node $NODE_ACTUAL"

echo "[DriftGuard] 检查 PM2 版本..."
PM2_ACTUAL=$(pm2 --version)
if [ "$PM2_ACTUAL" != "$PM2_REQUIRED" ]; then
  echo "[FATAL] PM2 版本不匹配: 需要 $PM2_REQUIRED, 当前 $PM2_ACTUAL"
  exit 1
fi
echo "[OK] PM2 $PM2_ACTUAL"

echo "[DriftGuard] 检查端口占用..."
for port in 4001 4002; do
  if ss -tlnp | grep -q ":$port "; then
    echo "[FATAL] 端口 $port 已被占用"
    exit 1
  fi
done
echo "[OK] 端口空闲"

echo "[DriftGuard] 全部检查通过 ✅"
