#!/bin/bash
# === 昆仑镜 Post-Freeze 验收脚本 ===
# 用法: ./scripts/verify-freeze.sh
# I1-I5 不变量全部通过后才确认冻结有效
set +e  # 手动管理退出码

PASS=0
FAIL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

check() {
  local name="$1"
  local cmd="$2"
  if eval "$cmd" 2>/dev/null; then
    echo -e "  ${GREEN}✅ PASS:${NC} $name"
    ((PASS++))
  else
    echo -e "  ${RED}❌ FAIL:${NC} $name"
    ((FAIL++))
  fi
}

echo "=========================================="
echo "  昆仑镜 — 冻结验收脚本 (Freeze Verify)"
echo "=========================================="
echo ""

echo "=== I1: PM2 Recovery ==="
check "pm2 进程数=2"    '[[ $(pm2 list 2>&1 | grep -c "online") -eq 2 ]]'
check "frontend 存在"    'pm2 show frontend 2>&1 | grep -c "status.*online"'
check "backend 存在"     'pm2 show backend 2>&1 | grep -c "status.*online"'

echo "=== I2: Frontend Availability ==="
check "HTTP 200"         '[[ $(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/) -eq 200 ]]'
check "HTML 响应"        'curl -s http://127.0.0.1:3000/ | head -c 50 | grep -cE "<[a-zA-Z]"'
check "响应时间 < 3s"    '[[ $(curl -s -o /dev/null -w "%{time_total}" http://127.0.0.1:3000/) < 3 ]]'

echo "=== I3: Backend Health ==="
check "health ok"        'curl -s http://127.0.0.1:4002/healthz | grep -c "status\":\"ok"'
check "响应时间 < 200ms" '[[ $(curl -s -o /dev/null -w "%{time_total}" http://127.0.0.1:4002/health) < 0.2 ]]'

echo "=== I4: Nginx Routing ==="
check "无 502"           '[[ $(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/) != 502 ]]'

echo "=== I5: No Dev Runtime Leak ==="
check "frontend 非 dev"  'pm2 show frontend 2>&1 | grep "script args" | grep -cv "run dev"'
check "backend-tsx(ok)"  'pm2 show backend 2>&1 | grep "script args" | grep -c "run dev"'

echo ""
echo "=========================================="
echo -e "  结果: ${GREEN}$PASS 通过${NC} / ${RED}$FAIL 失败${NC}"
echo "=========================================="
if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}  ✅ 全部通过 — 冻结状态有效${NC}"
  exit 0
else
  echo -e "${RED}  ❌ 存在失败项 — 冻结状态失效${NC}"
  exit 1
fi
