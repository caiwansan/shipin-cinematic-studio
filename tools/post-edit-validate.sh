#!/bin/bash
# =============================================================================
# post-edit-validate.sh v2 — 编辑后结构校验 + index range check
# =============================================================================
# 在每次 edit/write 操作后执行，检查：
#   1. 大括号平衡
#   2. function range consistency（index lookup 验证函数完整）
#   3. 可疑 orphan block
#   4. Vue 文件的 <script> 标签闭合
#
# 用法: ./tools/post-edit-validate.sh <file>
# 批量: ./tools/post-edit-validate.sh --all
# =============================================================================

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "$(dirname "$0")/..")"
INDEX="tools/structure-index/function-index.json"

validate_file() {
  local FILE="$1"
  local HAS_ISSUE=false

  echo "🧪 Validating: $FILE"

  # ── 1. 大括号平衡 ──
  local OPEN=$(grep -o '{' "$FILE" | wc -l)
  local CLOSE=$(grep -o '}' "$FILE" | wc -l)
  if [ "$OPEN" -ne "$CLOSE" ]; then
    echo "  ❌ [BRACE] Unbalanced braces: $OPEN open / $CLOSE close"
    HAS_ISSUE=true
  fi

  # ── 2. Vue 文件 script 标签闭合 ──
  if echo "$FILE" | grep -q '\.vue$'; then
    local SCRIPT_OPEN=$(grep -c '<script' "$FILE" || true)
    local SCRIPT_CLOSE=$(grep -c '</script>' "$FILE" || true)
    if [ "$SCRIPT_OPEN" -ne "$SCRIPT_CLOSE" ]; then
      echo "  ❌ [SCRIPT] <script> tag mismatch: $SCRIPT_OPEN open / $SCRIPT_CLOSE close"
      HAS_ISSUE=true
    fi
  fi

  # ── 3. Index-based function range validation（核心升级） ──
  if [ -f "$INDEX" ] && command -v jq &>/dev/null; then
    local FUNCTIONS=$(jq -r --arg f "$FILE" '.[$f][]? | select(.name != null and .type=="function") | "\(.name):\(.startLine):\(.endLine)"' "$INDEX" 2>/dev/null || true)

    if [ -n "$FUNCTIONS" ]; then
      echo "$FUNCTIONS" | while IFS=: read -r name start end; do
        # 检查函数体在文件中是否存在（非空）
        local body=$(sed -n "${start},${end}p" "$FILE" 2>/dev/null || true)
        if [ -z "$body" ]; then
          echo "  ❌ [MISSING] Function '$name' (line $start-$end) — body not found in file"
          HAS_ISSUE=true
        fi

        # 检查函数体内大括号平衡
        local fn_open=$(echo "$body" | grep -o '{' | wc -l)
        local fn_close=$(echo "$body" | grep -o '}' | wc -l)
        if [ "$fn_open" -ne "$fn_close" ]; then
          echo "  ❌ [FN_SCOPE] Function '$name' (line $start-$end) — unbalanced: $fn_open open / $fn_close close"
          HAS_ISSUE=true
        fi
      done

      # 检查函数间是否有重叠（无 overlap 保证）
      local OVERLAP=$(jq -r --arg f "$FILE" '
        [.[$f][] | select(.type=="function") | {name, start: .startLine, end: .endLine}]
        | sort_by(.start)
        | [range(0; length-1) as $i | if (.[$i].end >= .[$i+1].start) then "\(.[$i].name) overlaps \(.[$i+1].name)" else empty end]
        | .[]
      ' "$INDEX" 2>/dev/null || true)
      if [ -n "$OVERLAP" ]; then
        echo "  ⚠️  [OVERLAP] Function range overlap detected:"
        echo "    $OVERLAP"
      fi
    fi
  fi

  # ── 4. 函数截断检查（fallback for files not in index） ──
  grep -nE "function [a-zA-Z_][a-zA-Z0-9_]*" "$FILE" | while read -r match; do
    local FN_LINE=$(echo "$match" | cut -d: -f1)
    local FN_NAME=$(echo "$match" | sed 's/.*function \([a-zA-Z_][a-zA-Z0-9_]*\).*/\1/')
    local FOLLOWING=$(tail -n "+${FN_LINE}" "$FILE" | head -50)
    local CLOSING=$(echo "$FOLLOWING" | grep -c '}' 2>/dev/null || true)
    if [ "$CLOSING" -eq 0 ]; then
      echo "  ⚠️  [TRUNCATED] Function '$FN_NAME' at line $FN_LINE — no closing brace within 50 lines"
    fi
  done

  # ── 5. 可疑 orphan 检测 ──
  if echo "$FILE" | grep -q '\.vue$'; then
    local IN_SCRIPT=false
    local SCRIPT_BLOCK=""
    while IFS= read -r line; do
      if echo "$line" | grep -q '<script[^>]*>'; then
        IN_SCRIPT=true
        SCRIPT_BLOCK=""
        continue
      fi
      if $IN_SCRIPT; then
        if echo "$line" | grep -q '</script>'; then
          IN_SCRIPT=false
          local DEPTH=0
          while IFS= read -r sline; do
            local trimmed_line=$(echo "$sline" | sed 's/^[[:space:]]*//')
            [ -z "$trimmed_line" ] && continue
            echo "$trimmed_line" | grep -q '^//' && continue
            echo "$trimmed_line" | grep -qE '^/\*' && continue

            local INDENT=$(echo "$sline" | sed 's/[^ ].*$//' | wc -c | tr -d ' ')
            INDENT=$((INDENT - 1))
            local OPEN_BR=$(echo "$trimmed_line" | grep -o '{' | wc -l)
            local CLOSE_BR=$(echo "$trimmed_line" | grep -o '}' | wc -l)
            DEPTH=$((DEPTH + OPEN_BR - CLOSE_BR))

            if [ "$INDENT" -eq 0 ] && [ "$DEPTH" -le 0 ]; then
              if ! echo "$trimmed_line" | grep -qE '^(export |import |type |interface |enum |declare |const |let |var |//|/\*|\* |}|#|<|"|'"'"')' && \
                 [ -n "$trimmed_line" ] && \
                 ! echo "$trimmed_line" | grep -qE '^[[:space:]]*$'; then
                echo "  ⚠️  [ORPHAN] Possible orphan top-level: $trimmed_line"
              fi
            fi
          done <<< "$SCRIPT_BLOCK"
          continue
        fi
        SCRIPT_BLOCK="${SCRIPT_BLOCK}${line}"$'\n'
      fi
    done < "$FILE"
  fi

  if ! $HAS_ISSUE; then
    echo "  ✅ Passed all checks"
  fi
  echo ""
}

# ── 主逻辑 ──
if [ $# -eq 0 ]; then
  echo "用法: $0 <file> | --all"
  exit 1
fi

if [ "$1" = "--all" ]; then
  echo "=========================================="
  echo "🔍 Post-edit validation (all files)"
  echo "=========================================="
  echo ""
  FILES=$(find frontend backend -type f \( -name "*.vue" -o -name "*.ts" \) \
    ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.nuxt/*" \
    ! -path "*/.output/*" 2>/dev/null || true)
  for f in $FILES; do
    validate_file "$f"
  done
  echo "=========================================="
  echo "✅ Batch validation complete"
  echo "=========================================="
else
  validate_file "$1"
fi
