#!/bin/bash
# =============================================================================
# pre-edit.sh v2 — 编辑前检查：index lookup → 显示完整函数边界
# =============================================================================
# 用法: ./tools/pre-edit.sh <file> <function-name>
# 示例: ./tools/pre-edit.sh frontend/pages/studio/production.vue onScriptParsed
#
# 功能:
#   1. 先查 function-index.json（确定边界）→ 没有则 fallback 到 awk 扫描
#   2. 备份文件到 tools/.pre-edit-backups/
#   3. 在编辑前显示完整函数体 + 行号范围
#   4. 显示函数的大括号平衡状态
#   5. 把函数体写到临时文件，方便 edit 时直接引用
# =============================================================================

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "用法: $0 <file> <function-name>"
  echo "示例: $0 frontend/pages/studio/production.vue onScriptParsed"
  exit 1
fi

FILE="$1"
FUNC="$2"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INDEX="$PROJECT_ROOT/tools/structure-index/function-index.json"

if [ ! -f "$FILE" ]; then
  echo "❌ 文件不存在: $FILE"
  exit 1
fi

# ── 备份 ──
BACKUP_DIR="$(dirname "$0")/.pre-edit-backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/$(basename "$FILE").$(date +%Y%m%d_%H%M%S).bak"
cp "$FILE" "$BACKUP_FILE"
echo "📦 Backed up to: $BACKUP_FILE"
echo ""

echo "=========================================="
echo "📍 Pre-edit boundary inspection"
echo "=========================================="
echo "File: $FILE"
echo "Target: $FUNC"
echo ""

# ── Phase 1: 从 index 查找函数边界 ──
START_LINE=""
END_LINE=""
FOUND_INDEX=false

if [ -f "$INDEX" ] && command -v jq &>/dev/null; then
  # 转义文件路径
  ESCAPED_FILE=$(echo "$FILE" | sed 's|/|\\/|g')
  
  # 用 jq 查找函数
  RESULT=$(jq -r --arg f "$FILE" --arg n "$FUNC" '
    (.[$f][] // []) | select(.name == $n) | "\(.startLine):\(.endLine):\(.type)"
  ' "$INDEX" 2>/dev/null || true)

  if [ -n "$RESULT" ]; then
    START_LINE=$(echo "$RESULT" | cut -d: -f1)
    END_LINE=$(echo "$RESULT" | cut -d: -f2)
    FOUND_INDEX=true
    echo "📦 Found in index: deterministic boundary"
  fi
fi

# ── Phase 2: fallback — brute force scan ──
if ! $FOUND_INDEX; then
  echo "⚠️  Not in index — scanning file directly..."
  
  # 找到函数声明行
  FUNC_LINE=$(grep -nE "(function ${FUNC}|${FUNC}\s*[:=]\s*(function|async|\([^)]*\)\s*=>)|export (default )?(function|const) ${FUNC}|const ${FUNC}\s*=" "$FILE" | head -1 || true)

  if [ -z "$FUNC_LINE" ]; then
    echo "❌ 未找到函数 '$FUNC'"
    echo "   附近匹配行:"
    grep -n "${FUNC}" "$FILE" | head -5 || echo "   无匹配"
    exit 1
  fi

  START_LINE=$(echo "$FUNC_LINE" | cut -d: -f1)
  
  # 从声明行开始跟踪大括号深度
  TOTAL=$(wc -l < "$FILE")
  DEPTH=0
  STARTED=false
  for ((i=START_LINE; i<=TOTAL; i++)); do
    line=$(sed -n "${i}p" "$FILE")
    ob=$(echo "$line" | grep -o '{' | wc -l)
    cb=$(echo "$line" | grep -o '}' | wc -l)
    
    if ! $STARTED && [ "$ob" -gt 0 ]; then
      STARTED=true
    fi
    DEPTH=$((DEPTH + ob - cb))
    if $STARTED && [ "$DEPTH" -le 0 ] && [ "$i" -gt "$START_LINE" ]; then
      END_LINE=$i
      break
    fi
    END_LINE=$i
  done
fi

echo "📏 Range: ${START_LINE} → ${END_LINE}"
echo ""

# ── 显示函数体 ──
echo "──────────────────────────────────────────"
echo "📄 Function body (lines $START_LINE to $END_LINE):"
echo "──────────────────────────────────────────"
sed -n "${START_LINE},${END_LINE}p" "$FILE" | nl -ba -v "$START_LINE"
echo "──────────────────────────────────────────"
echo ""

# ── 大括号平衡 ──
FUNC_BODY=$(sed -n "${START_LINE},${END_LINE}p" "$FILE")
OPEN_COUNT=$(echo "$FUNC_BODY" | grep -o '{' | wc -l)
CLOSE_COUNT=$(echo "$FUNC_BODY" | grep -o '}' | wc -l)
if [ "$OPEN_COUNT" -eq "$CLOSE_COUNT" ]; then
  echo "✅ Braces balanced: $OPEN_COUNT open / $CLOSE_COUNT close"
else
  echo "⚠️  Braces UNBALANCED: $OPEN_COUNT open / $CLOSE_COUNT close"
fi
echo ""

# ── 把函数体写入临时文件 ──
TMP_FILE="/tmp/pre-edit-${FUNC}.txt"
echo "$FUNC_BODY" > "$TMP_FILE"
echo "📝 Function body saved to: $TMP_FILE"
echo ""

# ── 生成 edit 用的 oldText 首尾各5行预览 ──
echo "=========================================="
echo "✏️  Edit hints — whole-function replace only:"
echo "=========================================="
echo ""
echo "oldText (first 5 lines of function body):"
echo "$FUNC_BODY" | head -5
echo "..."
echo ""
echo "oldText (last 5 lines of function body):"
echo "$FUNC_BODY" | tail -5
echo ""
echo "==> 修改后运行: ./tools/post-edit-validate.sh $FILE"
echo ""
echo "ℹ️  To rebuild index: ./tools/build-function-index.sh"
