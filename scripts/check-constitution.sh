#!/bin/bash
# ============================================================
# Constitution CI Check — v2.0
# P0-5.4: Truth Governance
#
# 在 PR 阶段自动运行，检查：
#   1. Never Rules（第七章）— 禁止模式
#   2. Layer Jump（第一章）— Route 不能直接调 Engine
#   3. Repository Bypass（第十四章）— 跳过 Repository 直接写 DB
#   4. Timeline 统一（第十章）— 禁止内联 recordTimelineEvent
#   5. Snapshot Immutable（P0-5.1）— 禁止 UPDATE/UPSERT
# ============================================================

set -euo pipefail

ERRORS=0
WARNINGS=0
BASE_DIR="${1:-.}"
# Try common backend source paths
if [ -d "$BASE_DIR/backend/src/services/geo" ]; then
  GEO_SRC="$BASE_DIR/backend/src/services/geo"
elif [ -d "$BASE_DIR/src/services/geo" ]; then
  GEO_SRC="$BASE_DIR/src/services/geo"
else
  GEO_SRC="$BASE_DIR"
fi

echo "=============================================="
echo "  Constitution CI Check — v2.0"
echo "  Date: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "  Scanning: $GEO_SRC"
echo "=============================================="

# ── Helper: check pattern ──
check_pattern() {
  local pattern="$1"
  local message="$2"
  local path="${3:-$GEO_SRC}"
  local exclude="${4:-}"

  if [ -n "$exclude" ]; then
    # Build grep -v exclude patterns from pipe-separated list
    local grep_exclude=()
    IFS='|' read -ra EXCL_PATTERNS <<< "$exclude"
    for excl in "${EXCL_PATTERNS[@]}"; do
      grep_exclude+=(-e "$excl")
    done
    if grep -rn "$pattern" "$path" --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v "${grep_exclude[@]}" > /dev/null 2>&1; then
      echo "🔴 FAIL: $message"
      grep -rn "$pattern" "$path" --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v "${grep_exclude[@]}" | head -5
      ERRORS=$((ERRORS+1))
    else
      echo "  ✅ $message"
    fi
  else
    if grep -rn "$pattern" "$path" --include="*.ts" 2>/dev/null | grep -v node_modules > /dev/null 2>&1; then
      echo "🔴 FAIL: $message"
      grep -rn "$pattern" "$path" --include="*.ts" 2>/dev/null | grep -v node_modules | head -5
      ERRORS=$((ERRORS+1))
    else
      echo "  ✅ $message"
    fi
  fi
}

echo ""
echo "=== 1. Never Rules (Constitution Chapter 7) ==="

# Never Rule B: Math.random in Engine code (engines, not routes)
check_pattern "Math\.random" "Rule B: Math.random() found in Engine code" "$GEO_SRC" "\.test\.|routes/|\.route\.ts"

# Never Rule G: new PrismaClient in Engine code
check_pattern "new PrismaClient\(\)" "Rule G: new PrismaClient() found (bypass Repository)" "$GEO_SRC" ".test.|verification/index\.ts"

echo ""
echo "=== 2. Layer Jump (Constitution Chapter 1) ==="
echo "   Route Layer (L5) must not call Engine Layer (L4) directly"

# Rule D/F: Route directly calling Engine
check_pattern "presenceEngine\.checkAll\|engine\.checkAll\|\.checkAll(" "Rule D/F: Route calls Engine directly (Layer Jump)" "$GEO_SRC/routes"

# Rule: Route importing from engine/* (non-repository path)
check_pattern "from.*\/engine\/" "Route imports from engine/* (potential Layer Jump)" "$GEO_SRC/routes" ".test."

echo ""
echo "=== 3. Repository Bypass (Constitution Chapter 14) ==="
echo "   Engine/Route must use Repository, not Prisma directly"

# Direct Prisma usage in Engine code (skipping Repository)
check_pattern "prisma\.[a-zA-Z]" "Engine bypasses Repository — uses prisma directly" "$GEO_SRC" ".test.|repositories/|runtime/|normalizers/|workspace/timeline\.ts|workspace/mission-control|verification/index\.ts"

echo ""
echo "=== 4. Timeline Unification (Constitution Chapter 10) ==="
echo "   All Timeline events must use unified format"

# Inline recordTimelineEvent (presence-scan.worker)
check_pattern "async function recordTimelineEvent" "Inline recordTimelineEvent() — must use timelineEngine.record()" "$GEO_SRC"

# Legacy recordHealthRecalculated direct calls (prefer unified record)
check_pattern "\.recordHealthRecalculated\(" "Legacy recordHealthRecalculated() — prefer unified record()" "$GEO_SRC"

echo ""
echo "=== 5. Snapshot Immutable Rule ==="
echo "   Snapshots are append-only — no UPDATE/UPSERT"

check_pattern "geoScoreSnapshotRepository\.update\|geoScoreSnapshotRepository\.upsert" "Snapshot UPDATE/UPSERT found (Immutable Rule)" "$GEO_SRC"

echo ""
echo "=== Summary ==="
if [ $ERRORS -gt 0 ]; then
  echo "  ❌ $ERRORS violation(s) found (MUST FIX before merge)"
else
  echo "  ✅ No violations found"
fi

if [ $WARNINGS -gt 0 ]; then
  echo "  ⚠️  $WARNINGS warning(s) (review recommended)"
fi

echo "=============================================="

exit $ERRORS
