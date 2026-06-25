#!/bin/bash
# TASK-OPS-HEALTH-DASHBOARD-001 — 3秒健康面板

source /www/server/nvm/nvm.sh 2>/dev/null
nvm use 22.23.1 2>/dev/null

NODE_OK=$(node --version 2>/dev/null | grep -q "v22.23.1" && echo "✅" || echo "❌")
PM2_OK=$(pm2 list 2>/dev/null | grep -q "online" && echo "✅" || echo "❌")
PORT4001=$(ss -tlnp | grep -q ":4001 " && echo "✅" || echo "❌")
PORT4002=$(ss -tlnp | grep -q ":4002 " && echo "✅" || echo "❌")
PGSQL=$(docker exec scs-postgres pg_isready 2>/dev/null | grep -q "accepting" && echo "✅" || echo "❌")
REDIS=$(redis-cli ping 2>/dev/null | grep -q "PONG" && echo "✅" || echo "❌")
DISK=$(df -h / | awk "NR==2 {print \$5}" | sed "s/%//")
DISK_OK=$([ "$DISK" -lt 85 ] 2>/dev/null && echo "✅" || echo "❌")

echo "KLJ-HEALTH Node:$NODE_OK PM2:$PM2_OK FE:$PORT4001 API:$PORT4002 PGSQL:$PGSQL REDIS:$REDIS DISK:${DISK}%${DISK_OK}"
