#!/usr/bin/env bash
# ============================================================================
# 盘古斧 AI OS — Phase 7A-BOOT 三端启动脚本
# 同时启动：后端 API Gateway (4002) + 前端 Workbench (4001)
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║    盘古斧 AI OS — Phase 7A-BOOT 系统激活             ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "  后端:   localhost:4002 (scs-backend + Gateway + SSE)"
echo "  前端:   localhost:4001 (Workbench + Admin Panel)"
echo "  SSE:    http://localhost:4002/api/events"
echo "  Health: http://localhost:4002/api/health"
echo ""

# ── 停止已有进程 ────────────────────────────────────────────

echo "  [1/3] 停止已有进程..."
npx pm2 delete pangu-7a-boot-backend 2>/dev/null || true
npx pm2 delete pangu-7a-boot-frontend 2>/dev/null || true
echo "  ✅ 已清理"

# ── 启动后端 ────────────────────────────────────────────────

echo ""
echo "  [2/3] 启动后端 API Gateway (port 4002)..."
cd "$BACKEND_DIR"
npx pm2 start npm --name "pangu-7a-boot-backend" -- run dev 2>&1 | tail -1
echo "  ✅ 后端启动中..."

# ── 启动前端 ────────────────────────────────────────────────

echo ""
echo "  [3/3] 启动前端 Workbench (port 4001)..."
cd "$FRONTEND_DIR"
npx pm2 start npm --name "pangu-7a-boot-frontend" -- run dev 2>&1 | tail -1
echo "  ✅ 前端启动中..."

# ── 验证 ────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  等待服务就绪..."

for i in $(seq 1 10); do
  if curl -s http://localhost:4002/api/health > /dev/null 2>&1; then
    echo "  ✅ 后端 /api/health 响应正常"
    break
  fi
  sleep 1
done

echo ""
echo "  🔥 三端系统已激活"
echo ""
echo "  前端:   http://localhost:4001/workbench/console"
echo "  后端:   http://localhost:4002/api/health"
echo "  SSE:    http://localhost:4002/api/events"
echo "  PM2:    pm2 logs pangu-7a-boot-backend"
echo "  PM2:    pm2 logs pangu-7a-boot-frontend"
echo ""
echo "  🧱 盘古斧 AI OS — System is ALIVE."
echo ""
