#!/bin/bash
# KLJ-DAILY-AUDIT-SOP — 每日健康巡检

source /www/server/nvm/nvm.sh 2>/dev/null
nvm use 22.23.1 2>/dev/null
cd /root/shipin-cinematic-studio

echo "========== KLJ 健康报告 =========="
echo "时间: $(date "+%Y-%m-%d %H:%M:%S %Z")"
echo ""
echo "Node: $(node --version)"
echo "PM2:  $(pm2 --version 2>/dev/null || echo "❌")"
echo ""
ONLINE=$(pm2 list 2>/dev/null | grep -c "online")
TOTAL=$(pm2 list 2>/dev/null | grep -cE "online|errored|stopped")
echo "PM2: $ONLINE/$TOTAL online"
echo ""
for port in 4001 4002 5432 6379; do
  ss -tlnp | grep -q ":$port " && echo "Port $port: ✅" || echo "Port $port: ❌"
done
echo ""
redis-cli ping 2>/dev/null | grep -q PONG && echo "Redis: ✅" || echo "Redis: ❌"
docker exec scs-postgres pg_isready 2>/dev/null | grep -q accepting && echo "PGSQL: ✅" || echo "PGSQL: ❌"
echo ""
echo "Disk: $(df -h / | awk "NR==2 {print \$3 \"/\" \$2 \" (\" \$5 \")\"}")"
echo ""
curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://127.0.0.1:4001/
curl -s -o /dev/null -w "API:      %{http_code}\n" http://127.0.0.1:4002/api/v1/system/health 2>/dev/null
echo ""
ERR=$(grep -c "$(date "+%d/%b/%Y")" /www/wwwlogs/aigc.fushtn.com.error.log 2>/dev/null || echo 0)
echo "今日错误: $ERR 条"
echo "================================"
