#!/usr/bin/env bash
# scripts/check-direct-provider-calls.sh
#
# 宪法层：禁止直连 provider API 端点
# 所有 LLM/模型调用必须经过：
#   - narrativeGateway (LLM)
#   - unifiedAIGateway (通用 AI)
#   - provider adapter (图像/视频/语音)
#
# 用法：
#   bash scripts/check-direct-provider-calls.sh          # 扫描默认目录
#   bash scripts/check-direct-provider-calls.sh --fix     # 扫描并输出修复建议
#   bash scripts/check-direct-provider-calls.sh --ci      # CI 模式，发现违规则 exit 1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXIT_ON_FAIL=${2:-false}
FIX_MODE=false

for arg in "$@"; do
  case "$arg" in
    --ci) EXIT_ON_FAIL=true ;;
    --fix) FIX_MODE=true ;;
  esac
done

# 禁用的 provider 端点和域名（直接 fetch/axios）
BANNED_PATTERNS=(
  "api.openai.com"
  "api.deepseek.com"
  "api.anthropic.com"
  "dashscope.aliyuncs.com"
  "api.siliconflow.cn"
  "api.volcengine.com"
  "generativelanguage.googleapis.com"
  "openrouter.ai"
)

# 白名单文件（合法使用 gateway/adapter）
ALLOWED_FILES=(
  "/services/unified-ai-gateway.ts"     # 内置 gateway adapter
  "/services/capability.service.ts"     # 模型能力注册，非实际调用
  "/services/aliyun-image.provider.ts"  # 图片 adapter
  "/services/aliyun-video.provider.ts"  # 视频 adapter
  "/services/aliyun-tts.provider.ts"   # TTS adapter
  "/services/aliyun-llm.provider.ts"   # LLM adapter
  "/services/siliconflow-tts.provider.ts"  # TTS adapter
  "/services/voice-manager.service.ts" # 语音 adapter
  "/runtime/providers/"               # provider adapter 目录
  "/runtime/resolveRuntimeConfig.ts"   # 配置默认值
  "/runtime/runtime-gateway.ts"        # gateway 本身
  "/runtime/narrative-gateway.ts"      # gateway 本身
  "/providers/adapters/"
  "/model-adapters/"
  "/dir-v2/runtime/skeleton-compiler.ts"  # 内部 runtime
  "/routes/admin-global-config.ts"  # 枚举模型列表，非 LLM 调用
  "/routes/user-model-config.ts"    # 用户配置，非实际调用
  "/routes/payment.ts"              # 支付相关 env 配置
  "/scripts/"                       # 初始化脚本
  "/config/env.ts"                  # 环境默认值
  "/bootstrap/"                     # 启动引导
  "/production-loop/"               # 生产循环内部 adapter
  "/core/control-plane/"            # control plane 内部调用
)

EXIT_CODE=0
VIOLATIONS=0

echo "🔍 Scanning for direct provider calls..."
echo ""

for pattern in "${BANNED_PATTERNS[@]}"; do
  # 在 src/ 中搜索，排除 node_modules
  while IFS= read -r -d '' file; do
    rel_path="${file#$PROJECT_DIR/}"
    # 跳过 backend 外的文件
    if [[ "$rel_path" != "backend/src/"* ]]; then
      continue
    fi

    # 检查是否在白名单中
    IS_ALLOWED=false
    for allowed in "${ALLOWED_FILES[@]}"; do
      if [[ "$rel_path" == *"$allowed"* ]]; then
        IS_ALLOWED=true
        break
      fi
    done

    if $IS_ALLOWED; then
      continue
    fi

    # 查找匹配行
    matches=$(grep -n "$pattern" "$file" 2>/dev/null)
    if [ -n "$matches" ]; then
      VIOLATIONS=$((VIOLATIONS + 1))
      echo "  ⚠️  $rel_path"
      echo "$matches" | while IFS= read -r line; do
        echo "     $line"
      done
      echo ""
    fi
  done < <(find "$PROJECT_DIR/backend/src" -type f \( -name "*.ts" -o -name "*.js" \) -not -path "*/node_modules/*" -print0)
done

if [ $VIOLATIONS -gt 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ Found $VIOLATIONS direct provider call(s)"
  echo "   Each must either:"
  echo "   1. Migrate to narrativeGateway / unifiedAIGateway"
  echo "   2. Or add to ALLOWED_FILES in this script"
  echo ""
  if $EXIT_ON_FAIL; then
    exit 1
  fi
else
  echo "✅ No direct provider calls found — all traffic through gateway"
fi

exit 0
