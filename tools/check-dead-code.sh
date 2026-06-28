#!/bin/bash
# =============================================================================
# check-dead-code.sh v2 — index-aware 孤立代码检测
# =============================================================================
# 用 function-index.json 验证：
#   1. 所有 indexed 函数在文件中仍存在
#   2. 没有缺失的函数定义
#   3. 大括号平衡
#   4. 结构完整性（替代之前容易误报的 grep heuristic）
#
# 使用: ./tools/check-dead-code.sh
# =============================================================================

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$(dirname "$0")/..")"
INDEX="tools/structure-index/function-index.json"

EXIT_CODE=0
MISSING_COUNT=0
SCOPE_ISSUES=0

echo "=========================================="
echo "🔍 Structural validation (index-aware)"
echo "=========================================="
echo ""

# ── 1. 确保 index 存在 ──
if [ ! -f "$INDEX" ]; then
  echo "⚠️  Function index not found. Run ./tools/build-function-index.sh first."
  echo "   Falling back to basic checks..."
  
  # fallback: 基础 brace check
  FILES=$(find frontend backend -type f \( -name "*.vue" -o -name "*.ts" \) \
    ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.nuxt/*" ! -path "*/.output/*" 2>/dev/null || true)
  
  for FILE in $FILES; do
    OPEN=$(grep -o '{' "$FILE" | wc -l)
    CLOSE=$(grep -o '}' "$FILE" | wc -l)
    if [ "$OPEN" -ne "$CLOSE" ]; then
      echo "❌ [SCOPE] $FILE — braces $OPEN:$CLOSE"
      SCOPE_ISSUES=$((SCOPE_ISSUES + 1))
    fi
  done
  
  if [ "$SCOPE_ISSUES" -eq 0 ]; then
    echo "✅ All files pass basic scope check"
  fi
  exit $SCOPE_ISSUES
fi

# ── 2. Iterate over indexed files ──
echo "Checking function integrity from index..."
echo ""

FILES_IN_INDEX=$(jq -r 'keys[]' "$INDEX" 2>/dev/null || true)

for FILE in $FILES_IN_INDEX; do
  # 文件是否还存在
  if [ ! -f "$FILE" ]; then
    echo "⚠️  [DELETED] $FILE — indexed but no longer exists"
    continue
  fi

  # 大括号平衡
  local OPEN=$(grep -o '{' "$FILE" | wc -l)
  local CLOSE=$(grep -o '}' "$FILE" | wc -l)
  if [ "$OPEN" -ne "$CLOSE" ]; then
    echo "❌ [SCOPE] $FILE — braces $OPEN:$CLOSE"
    SCOPE_ISSUES=$((SCOPE_ISSUES + 1))
  fi

  # 对每个 indexed function 验证存在性
  jq -r --arg f "$FILE" '
    .[$f][] | select(.type=="function") | "\(.name):\(.startLine):\(.endLine)"
  ' "$INDEX" 2>/dev/null | while IFS=: read -r name start end; do
    body=$(sed -n "${start},${end}p" "$FILE" 2>/dev/null || true)
    if [ -z "$body" ]; then
      echo "❌ [ORPHAN] Function '$name' in $FILE — body missing (range $start-$end)"
      MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
  done
done

echo ""
echo "=========================================="
echo "📊 Summary"
echo "=========================================="
echo "  Scope issues:   $SCOPE_ISSUES"
echo "  Missing funcs:  $MISSING_COUNT"
echo ""

if [ "$SCOPE_ISSUES" -eq 0 ] && [ "$MISSING_COUNT" -eq 0 ]; then
  echo "✅ All structural validations passed"
else
  echo "⚠️  Issues found — review before build"
  EXIT_CODE=1
fi

exit $EXIT_CODE
