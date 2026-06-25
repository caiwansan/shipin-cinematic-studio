#!/bin/bash
set -e

echo "========================================"
echo "  V2 Runtime Verification — 真实运行验证"
echo "========================================"
echo ""

API="http://127.0.0.1:4002"

# 1. 检查 PM2 日志中 V1 READ 活动
echo "[1] LEGACY-V1-READ 活动追踪（最近30条）"
echo "----------------------------------------"
LOGS=$(grep "LEGACY-V1-READ" /root/.pm2/logs/api-server-aigc-out.log 2>/dev/null | tail -30)
if [ -z "$LOGS" ]; then
  echo "  ✅ 无 V1 READ 记录（正常——说明最近没有请求走 V1 路径）"
else
  echo "$LOGS"
fi
echo ""

# 2. ModelAdapterRegistry 注册状态
echo "[2] ModelAdapterRegistry 注册状态"
echo "----------------------------------------"
grep "ModelAdapterRegistry\|adapter.*register\|registry.*frozen\|adapter.*execute" /root/.pm2/logs/api-server-aigc-out.log 2>/dev/null | tail -10 || echo "  ⚠️ 未找到注册记录"
echo ""

# 3. API Key missing 错误追踪
echo "[3] API Key 相关错误"
echo "----------------------------------------"
API_ERR=$(grep -i "api key\|API_KEY\|missing.*key\|key.*not.*found" /root/.pm2/logs/api-server-aigc-error.log 2>/dev/null | tail -10)
if [ -z "$API_ERR" ]; then
  echo "  ✅ 无 API Key 相关错误"
else
  echo "$API_ERR"
fi
echo ""

# 4. 系统健康检查
echo "[4] 系统健康检查"
echo "----------------------------------------"
curl -s -o /dev/null -w "  HTTP Status: %{http_code}\n" "$API/api/v1/system/health" 2>/dev/null || echo "  ⚠️ 健康检查端点不可达"
echo ""

# 5. 检查是否有 provider bypass
echo "[5] Provider Bypass 检测"
echo "----------------------------------------"
BYPASS=$(grep -rn "volcengineVideo\." /root/shipin-cinematic-studio/backend/src/runtime/ --include="*.ts" 2>/dev/null | grep -v "Adapter\|adapter\|test\|spec" | head -5)
if [ -z "$BYPASS" ]; then
  echo "  ✅ 无 provider bypass detected"
else
  echo "  ⚠️ 发现 bypass:"
  echo "$BYPASS"
fi
echo ""

echo "========================================"
echo "  验证完成"
echo "========================================"
echo ""
echo "下一步操作指南："
echo "  1. 在浏览器操作：登录 → 保存大模型设置 → F5 刷新 → 生成图片 → 生成视频"
echo "  2. 每次操作后运行：bash scripts/verify-v2-runtime.sh"
echo "  3. 查看实时 V1 READ 追踪：tail -f /root/.pm2/logs/api-server-aigc-out.log | grep LEGACY-V1-READ"
