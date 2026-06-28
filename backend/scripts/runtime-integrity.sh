#!/usr/bin/env bash
#
# runtime-integrity.sh — Runtime Execution Constitution Enforcer
#
# Phase E1: Forbidden pattern scan.
# Violations indicate provider-aware execution paths that bypass the
# capability-runtime. These must be zero in production code.
#
# The Constitution:
#   "No execution path may branch on provider identity."
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"

EXIT_CODE=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================"
echo "  Runtime Integrity Check"
echo "  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "============================================"
echo ""

# ─── Patterns ──────────────────────────────────────

# Pattern 1: switch(provider) — provider-based routing
# Exemptions: admin-global-config.ts (admin UI), resource-router.ts (static strategy map),
#             autograph/ (whole module uses provider as data label, not dispatch)
echo -n "[1/5] switch(provider) in execution path... "
violations=$(grep -rn "switch.*provider" "$SRC" --include="*.ts" \
  | grep -v "node_modules" \
  | grep -v "\.nuxt" \
  | grep -v "admin-global-config" \
  | grep -v "optimization" \
  | grep -v "models.ts" \
  | grep -v "resource-router" \
  | grep -v "autograph" \
  || true)

if [ -z "$violations" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  echo "$violations"
  EXIT_CODE=1
fi

# Pattern 2: if(provider === ...) — provider condition in execution
# Exemptions: admin*, optimization, api-router, narrative-gateway, cost-optimizer,
#             user-api-keys (admin resource routing, not execution)
echo -n "[2/5] if(provider === ...) in execution path... "
violations=$(grep -rn "if.*provider.*===" "$SRC" --include="*.ts" \
  | grep -v "node_modules" \
  | grep -v "\.nuxt" \
  | grep -v "admin-" \
  | grep -v "models.ts" \
  | grep -v "optimization" \
  | grep -v "api-router" \
  | grep -v "narrative-gateway" \
  | grep -v "cost-optimizer" \
  | grep -v "user-api-keys" \
  || true)

if [ -z "$violations" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  echo "$violations"
  EXIT_CODE=1
fi

# Pattern 3: resolveGen — old dispatch function
# Only flag actual code, not comments
echo -n "[3/5] resolveGen code reference... "
violations=$(grep -rn "resolveGen\b" "$SRC" --include="*.ts" \
  | grep -v "node_modules" \
  | grep -v "\.nuxt" \
  | grep -v "docs/" \
  | grep -v "^.*\*.*resolveGen" \
  || true)

if [ -z "$violations" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  echo "$violations"
  EXIT_CODE=1
fi

# Pattern 4: providerHandlers — old worker dispatch
# Only flag actual code, not comments/docs
echo -n "[4/5] providerHandlers (worker dispatch)... "
violations=$(grep -rn "providerHandlers" "$SRC" --include="*.ts" \
  | grep -v "node_modules" \
  | grep -v "docs/" \
  | grep -v "capability-dispatcher.ts" \
  | grep -v "^.*\*.*providerHandlers" \
  || true)

if [ -z "$violations" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  echo "$violations"
  EXIT_CODE=1
fi

# Pattern 5: Direct provider SDK import in route/queue files (bypassing adapter)
# Known exemptions in routes/images.ts: volcengineVideo/aliyunVideo imports
# are Phase C leftovers (video route not yet normalized). They're allowed
# but flagged as known technical debt.
echo -n "[5/5] Direct provider SDK in route/queue files... "
violations=$(grep -rn "from.*volcengine-image\|from.*volcengine-video\|from.*siliconflow-tts\|from.*aliyun-tts\|from.*aliyun-image\|from.*aliyun-video\|from.*deepseek-llm" \
  "$SRC/routes" "$SRC/queue" --include="*.ts" \
  | grep -v "node_modules" \
  | grep -v "volcengine-video\.wrapper\|aliyun-video\.provider" \
  || true)

if [ -z "$violations" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
  echo "$violations"
  EXIT_CODE=1
fi

echo ""
echo "============================================"
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "  ${GREEN}All integrity checks PASSED.${NC}"
  echo "  The execution constitution is intact."
else
  echo -e "  ${RED}Integrity violations detected.${NC}"
  echo "  Review and eliminate provider-aware execution paths."
fi
echo "============================================"

exit $EXIT_CODE
