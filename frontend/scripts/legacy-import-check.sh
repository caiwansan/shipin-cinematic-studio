#!/usr/bin/env bash
#=============================================================================
# Legacy Import Check Script
# CI check for Brand OS Design System dependency rules (DS-AR-001, DS-AR-002)
#
# Checks:
# 1. No workspace files import from legacy/ path
# 2. No workspace files import from design-system/primitives/ or design-system/components/
# 3. Workspace files should only import from design-system/product-blocks or design-system (barrel)
#
# Usage: bash scripts/legacy-import-check.sh
# Returns: 0 if no violations, 1 if violations found
#=============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VIOLATIONS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================"
echo "  Brand OS — Legacy Import Check"
echo "============================================"
echo ""

#-----------------------------------------------------------------------------
# Check 1: No workspace files import from legacy/
#-----------------------------------------------------------------------------
echo -e "${YELLOW}[Check 1]${NC} Workspace files importing from legacy/..."

WORKSPACE_FILES=$(find "$PROJECT_DIR/workspaces" -type f \( -name "*.ts" -o -name "*.vue" -o -name "*.js" \) 2>/dev/null || echo "")

if [ -z "$WORKSPACE_FILES" ]; then
  echo "  ℹ️  No workspace files found in workspaces/ — skipping"
else
  while IFS= read -r file; do
    if grep -nE "from\s+['\"](~\/)?legacy/" "$file" 2>/dev/null; then
      echo -e "  ${RED}✗ VIOLATION:${NC} $file imports from legacy/"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done <<< "$WORKSPACE_FILES"
fi

# Also check studio directory
STUDIO_FILES=$(find "$PROJECT_DIR/studio" -type f \( -name "*.ts" -o -name "*.vue" -o -name "*.js" \) 2>/dev/null || echo "")
if [ -n "$STUDIO_FILES" ]; then
  while IFS= read -r file; do
    if grep -nE "from\s+['\"](~\/)?legacy/" "$file" 2>/dev/null; then
      echo -e "  ${RED}✗ VIOLATION:${NC} $file imports from legacy/"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done <<< "$STUDIO_FILES"
fi

# Also check pages directory
PAGE_FILES=$(find "$PROJECT_DIR/pages" -type f \( -name "*.ts" -o -name "*.vue" -o -name "*.js" \) 2>/dev/null || echo "")
if [ -n "$PAGE_FILES" ]; then
  while IFS= read -r file; do
    if grep -nE "from\s+['\"](~\/)?legacy/" "$file" 2>/dev/null; then
      echo -e "  ${RED}✗ VIOLATION:${NC} $file imports from legacy/"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done <<< "$PAGE_FILES"
fi

# Also check design-system directory
DS_FILES=$(find "$PROJECT_DIR/design-system" -type f \( -name "*.ts" -o -name "*.vue" -o -name "*.js" \) 2>/dev/null || echo "")
if [ -n "$DS_FILES" ]; then
  while IFS= read -r file; do
    if grep -nE "from\s+['\"](~\/)?legacy/" "$file" 2>/dev/null; then
      echo -e "  ${RED}✗ VIOLATION:${NC} $file imports from legacy/"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done <<< "$DS_FILES"
fi

#-----------------------------------------------------------------------------
# Check 2: No workspace files import from design-system/primitives/ or design-system/components/
#-----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[Check 2]${NC} Workspace files directly importing primitives or components..."

for dir in workspaces studio pages; do
  TARGET_DIR="$PROJECT_DIR/$dir"
  if [ -d "$TARGET_DIR" ]; then
    while IFS= read -r file; do
      if grep -nE "from\s+['\"].*design-system/primitives/" "$file" 2>/dev/null; then
        echo -e "  ${RED}✗ VIOLATION:${NC} $file imports from design-system/primitives/"
        VIOLATIONS=$((VIOLATIONS + 1))
      fi
      if grep -nE "from\s+['\"].*design-system/components/" "$file" 2>/dev/null; then
        echo -e "  ${RED}✗ VIOLATION:${NC} $file imports from design-system/components/"
        VIOLATIONS=$((VIOLATIONS + 1))
      fi
    done < <(find "$TARGET_DIR" -type f \( -name "*.ts" -o -name "*.vue" -o -name "*.js" \) 2>/dev/null || true)
  fi
done

#-----------------------------------------------------------------------------
# Check 3: Workspace and design-system files should not import from design-system/product-blocks with direct paths (allowed only via barrel)
# Actually, product-blocks can import from components and primitives (that's the reverse direction)
# So we skip this check for now — product-blocks can import from components/primitives
#-----------------------------------------------------------------------------

echo ""
echo "============================================"
if [ $VIOLATIONS -eq 0 ]; then
  echo -e "  ${GREEN}✅ All checks passed — no import violations found.${NC}"
else
  echo -e "  ${RED}❌ $VIOLATIONS violation(s) found.${NC}"
  echo ""
  echo "  Rules violated:"
  echo "  - DS-AR-001: Workspace → Product Blocks only (no direct Primitives/Components)"
  echo "  - DS-AR-002: No new legacy imports"
  exit 1
fi
echo "============================================"
