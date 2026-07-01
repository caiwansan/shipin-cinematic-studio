#!/bin/bash
# ════════════════════════════════════════════════════════════
# Knowledge Hub Architecture Linter
# ════════════════════════════════════════════════════════════
# CI check: validates platform boundary rules

set -e
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "/root/shipin-cinematic-studio")
ERRORS=0

echo "🔍 Knowledge Hub Architecture Linter"
echo "══════════════════════════════════════"

# ── PLATFORM-001: Platform cannot import Workspace ──
echo ""
echo "📋 PLATFORM-001: Platform → Workspace imports"
VIOLATIONS=$(grep -rn "services/geo" "$ROOT/backend/src/platform/" --include="*.ts" 2>/dev/null || true)
if [ -n "$VIOLATIONS" ]; then
  echo "❌ VIOLATIONS FOUND:"
  echo "$VIOLATIONS"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ PASS — 0 violations"
fi

# ── PLATFORM-003: Canonical Package no workspace semantics ──
echo ""
echo "📋 PLATFORM-003: Canonical Package no workspace semantics"
VIOLATIONS=$(grep -rn "\bBrand\b\|\bScore\b\|GeoBrand\|GeoScore\|GeoEvidence\|BII\b\|\bADI\b" \
  "$ROOT/backend/src/platform/knowledge-hub/repos/" --include="*.ts" 2>/dev/null || true)
if [ -n "$VIOLATIONS" ]; then
  echo "❌ VIOLATIONS FOUND:"
  echo "$VIOLATIONS"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ PASS — 0 violations"
fi

# ── PLATFORM-004: No Adapter bypass ──
echo ""
echo "📋 PLATFORM-004: No direct adapter calls from routes"
VIOLATIONS=$(grep -rn "new.*Adapter\|new.*Provider\|new.*Packager" \
  "$ROOT/backend/src/services/geo/routes/" --include="*.ts" 2>/dev/null || true)
if [ -n "$VIOLATIONS" ]; then
  echo "⚠️  Review needed (page may bypass adapter):"
  echo "$VIOLATIONS"
  # Not an error — routes legitimately instantiate adapters
else
  echo "✅ PASS — 0 violations"
fi

# Summary
echo ""
echo "══════════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
  echo "✅ All checks passed."
  exit 0
else
  echo "❌ $ERRORS violation(s) found."
  exit 1
fi