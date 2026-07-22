#!/bin/bash
# scripts/sentinel-check.sh
# Architecture Sentinel — 防止未来代码产生新的 Authority 冲突
# 版本: Phase C v1.2

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
SRC_DIR="$BACKEND_DIR/src"

PASS=0
FAIL=0
WARN=0
BASELINE_FILE="$PROJECT_DIR/.architecture/sentinel-baseline.txt"

# 参数解析
BASELINE_MODE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline) BASELINE_MODE=true; shift ;;
    *) shift ;;
  esac
done

log_pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
log_fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
log_warn() { echo "  ⚠️  $1"; WARN=$((WARN + 1)); }
log_info() { echo "  ℹ️  $1"; }

# 辅助函数：grep 并排除白名单
grep_excluding() {
  local pattern="$1"
  local dirs="$2"
  local whitelist="$3"
  
  grep -rE "$pattern" $dirs --include="*.ts" 2>/dev/null \
    | grep -vE "$whitelist" \
    || true
}

# 检查是否在 baseline 中
is_baseline() {
  local violation="$1"
  if [ -f "$BASELINE_FILE" ] && grep -qF "$violation" "$BASELINE_FILE" 2>/dev/null; then
    return 0
  fi
  return 1
}

# 初始化 baseline
init_baseline() {
  echo "# Architecture Sentinel Baseline" > "$BASELINE_FILE"
  echo "# 日期: $(date)" >> "$BASELINE_FILE"
  echo "# 此文件记录已知的 legacy 违规，不阻塞 CI" >> "$BASELINE_FILE"
  echo "" >> "$BASELINE_FILE"
}

echo "============================================"
echo "  Architecture Sentinel Check"
echo "  Date: $(date)"
if $BASELINE_MODE; then
  echo "  Mode: BASELINE (已知 legacy 违规不阻塞)"
fi
echo "============================================"
echo ""

# 初始化 baseline 文件（如果不存在）
[ ! -f "$BASELINE_FILE" ] && init_baseline

# ── Rule 1: No Direct Credential Access ──
echo "Rule 1: No Direct Credential Access"
VIOLATIONS=$(grep_excluding \
  "prisma\.(userModelConfigV2|enterpriseLLMConfig|resourceCredential)\.(findUnique|findMany|findFirst|upsert|create|update|delete)" \
  "$SRC_DIR/routes $SRC_DIR/controllers $SRC_DIR/services" \
  "credential-resolver\.ts|vault-service\.ts|credential-adapter\.ts|legacy-usage-monitor\.ts|migration-scripts/")

if [ -n "$VIOLATIONS" ]; then
  NEW_COUNT=0
  BASELINE_COUNT=0
  while IFS= read -r line; do
    if is_baseline "$line"; then
      BASELINE_COUNT=$((BASELINE_COUNT + 1))
    else
      if [ $NEW_COUNT -lt 3 ]; then
        echo "    $line"
      fi
      NEW_COUNT=$((NEW_COUNT + 1))
    fi
  done <<< "$VIOLATIONS"
  
  if [ $NEW_COUNT -gt 0 ]; then
    log_fail "$NEW_COUNT new violations ($BASELINE_COUNT in baseline)"
  else
    log_pass "All $BASELINE_COUNT violations tracked in baseline"
  fi
else
  log_pass "No direct credential access"
fi
echo ""

# ── Rule 2: No Decrypt in Business Code ──
echo "Rule 2: No Decrypt in Business Code"
VIOLATIONS=$(grep_excluding \
  "decryptKey\s*\(" \
  "$SRC_DIR/routes $SRC_DIR/controllers $SRC_DIR/services" \
  "credential-resolver\.ts|vault-service\.ts|crypto\.service\.ts|legacy-usage-monitor\.ts")

if [ -n "$VIOLATIONS" ]; then
  NEW_COUNT=0
  BASELINE_COUNT=0
  while IFS= read -r line; do
    if is_baseline "$line"; then
      BASELINE_COUNT=$((BASELINE_COUNT + 1))
    else
      if [ $NEW_COUNT -lt 3 ]; then
        echo "    $line"
      fi
      NEW_COUNT=$((NEW_COUNT + 1))
    fi
  done <<< "$VIOLATIONS"
  
  if [ $NEW_COUNT -gt 0 ]; then
    log_fail "$NEW_COUNT new violations ($BASELINE_COUNT in baseline)"
  else
    log_pass "All $BASELINE_COUNT violations tracked in baseline"
  fi
else
  log_pass "No decryptKey in business code"
fi
echo ""

# ── Rule 3: No Governance Write ──
echo "Rule 3: No Governance Write"
VIOLATIONS=$(grep_excluding \
  "prisma\.(governance_user|governance_tenant|governance_subscription)\.(create|update|upsert|delete|createMany|updateMany|deleteMany)" \
  "$SRC_DIR/" \
  "migration-scripts/|deprecated/")

if [ -n "$VIOLATIONS" ]; then
  echo "$VIOLATIONS" | head -10
  log_fail "Found $(echo "$VIOLATIONS" | wc -l) violations"
else
  log_pass "No governance writes"
fi
echo ""

# ── Rule 4: TenantId from JWT Only ──
echo "Rule 4: TenantId from JWT Only"
VIOLATIONS=$(grep_excluding \
  "req\.(body|query|params|headers)\.tenantId" \
  "$SRC_DIR/routes $SRC_DIR/controllers" \
  "tenant-guard\.ts")

if [ -n "$VIOLATIONS" ]; then
  echo "$VIOLATIONS" | head -10
  log_fail "Found $(echo "$VIOLATIONS" | wc -l) violations"
else
  log_pass "TenantId from JWT only"
fi
echo ""

# ── Rule 5: Provider Name in Code (Warning) ──
echo "Rule 5: Provider Name in Code (Warning)"
VIOLATIONS=$(grep_excluding \
  "if\s*\([^)]*provider\s*===?\s*['\"](deepseek|openai|volcengine)['\"]" \
  "$SRC_DIR/routes $SRC_DIR/controllers $SRC_DIR/services" \
  "provider-registry\.ts|credential-resolver\.ts|vault-service\.ts|provider-config\.ts")

if [ -n "$VIOLATIONS" ]; then
  echo "$VIOLATIONS" | head -10
  log_warn "Found $(echo "$VIOLATIONS" | wc -l) potential issues (warning only)"
else
  log_pass "No hardcoded provider checks"
fi
echo ""

# ── Rule 6: No Process.env Direct Key Access (Warning) ──
echo "Rule 6: No Process.env Direct Key Access (Warning)"
VIOLATIONS=$(grep_excluding \
  "process\.env\.[A-Z_]*(API_KEY|SECRET|TOKEN|APIKEY)[A-Z_]*" \
  "$SRC_DIR/routes $SRC_DIR/controllers $SRC_DIR/services" \
  "env-config\.ts|credential-resolver\.ts|jwt|JWT|auth|secret|BIND_SECRET|REFRESH_SECRET|JWT_SECRET|middleware")

if [ -n "$VIOLATIONS" ]; then
  echo "$VIOLATIONS" | head -10
  log_warn "Found $(echo "$VIOLATIONS" | wc -l) potential issues (warning only)"
else
  log_pass "No direct env key access"
fi
echo ""

# ── Summary ──
echo "============================================"
echo "  Summary"
echo "============================================"
echo ""
echo "  Passed:  $PASS"
echo "  Failed:  $FAIL"
echo "  Warnings: $WARN"
echo ""

if [ $FAIL -gt 0 ]; then
  echo "  ❌ Sentinel Check FAILED"
  echo ""
  if $BASELINE_MODE; then
    echo "  (Baseline 模式: 已知违规不阻塞，但新违规仍需处理)"
  fi
  echo "  提示: 将已知 legacy 违规加入 .architecture/sentinel-baseline.txt"
  echo ""
  # Baseline 模式下不退出
  if $BASELINE_MODE; then
    echo "  ✅ Baseline 模式: 允许通过 (baseline 违规不阻塞)"
    exit 0
  fi
  exit 1
else
  echo "  ✅ Sentinel Check PASSED"
  echo ""
  exit 0
fi
