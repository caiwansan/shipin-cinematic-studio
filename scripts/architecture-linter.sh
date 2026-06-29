#!/bin/bash
# ====================================================================
# 昆仑镜 V4 Architecture Linter — C0.5 Compliance Check
# 架构合规性自动检查脚本
# Usage: bash scripts/architecture-linter.sh [--fix] [--workspace=<name>]
# Returns: exit 0 if PASS, exit 1 if FAIL
# ====================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_DIR="$ROOT_DIR/workspace"
PLATFORM_DIR="$ROOT_DIR/packages/studio-platform"
FIX_MODE=false
TARGET_WORKSPACE=""
VIOLATIONS=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse args
for arg in "$@"; do
  case "$arg" in
    --fix)
      FIX_MODE=true
      ;;
    --workspace=*)
      TARGET_WORKSPACE="${arg#*=}"
      ;;
    *)
      echo "Unknown arg: $arg"
      echo "Usage: bash scripts/architecture-linter.sh [--fix] [--workspace=<name>]"
      exit 1
      ;;
  esac
done

echo "=== 昆仑镜 V4 Architecture Linter ==="
echo "Root: $ROOT_DIR"
[ "$FIX_MODE" = true ] && echo "Mode: --fix (auto-fix enabled)"
[ -n "$TARGET_WORKSPACE" ] && echo "Target workspace: $TARGET_WORKSPACE"
[ -z "$TARGET_WORKSPACE" ] && echo "Target: all workspaces"
echo ""

# Helper: determine workspace paths to scan
get_workspace_dirs() {
  if [ -n "$TARGET_WORKSPACE" ]; then
    echo "$WORKSPACE_DIR/$TARGET_WORKSPACE"
  else
    find "$WORKSPACE_DIR" -maxdepth 1 -mindepth 1 -type d 2>/dev/null || true
  fi
}

# Helper: increment violations
violation() {
  local rule="$1"
  local message="$2"
  VIOLATIONS=$((VIOLATIONS + 1))
  echo -e "${RED}  ❌ [${rule}] $message${NC}"
}

warn() {
  local rule="$1"
  local message="$2"
  WARNINGS=$((WARNINGS + 1))
  echo -e "${YELLOW}  ⚠️  [${rule}] $message${NC}"
}

pass() {
  local rule="$1"
  local message="$2"
  echo -e "${GREEN}  ✅ [${rule}] $message${NC}"
}

info() {
  echo "  ℹ️  $1"
}

# ====================================================================
# Rule 1: No workspace-owned Runtime
# Scans workspace directories for runtime.ts files
# Reference: MANIFESTO.md Rule 1, RUNTIME-SPEC.md, ADR-001
# ====================================================================
echo "[Rule 1] Workspace Runtime Check..."
rule1_violations=0
for ws in $(get_workspace_dirs); do
  ws_name=$(basename "$ws")
  # Check for *.runtime.ts files
  while IFS= read -r -d '' runtime_file; do
    violation "R1" "$ws_name: Found independent Runtime file: $(realpath --relative-to="$ROOT_DIR" "$runtime_file")"
    rule1_violations=$((rule1_violations + 1))
  done < <(find "$ws" -name "*.runtime.ts" -type f -print0 2>/dev/null)

  # Check for use*Runtime* composables
  while IFS= read -r -d '' runtime_composable; do
    violation "R1" "$ws_name: Found Runtime composable: $(realpath --relative-to="$ROOT_DIR" "$runtime_composable")"
    rule1_violations=$((rule1_violations + 1))
  done < <(find "$ws" -name "use*Runtime*" -type f -print0 2>/dev/null)

  # Check for class *Runtime definitions
  if find "$ws" -name "*.ts" -type f -exec grep -l "class.*Runtime" {} \; 2>/dev/null | grep -q .; then
    violation "R1" "$ws_name: Contains class *Runtime definition"
    rule1_violations=$((rule1_violations + 1))
  fi
done
if [ "$rule1_violations" -eq 0 ]; then
  pass "R1" "No workspace-owned Runtime found"
fi

# ====================================================================
# Rule 2: No direct fetch/axios in workspace code
# Except in platform SDK / api client
# Reference: MANIFESTO.md Rule 4, PLATFORM-SDK.md §4
# ====================================================================
echo "[Rule 2] Direct HTTP Calls Check..."
rule2_violations=0
for ws in $(get_workspace_dirs); do
  ws_name=$(basename "$ws")

  # Check for axios import
  while IFS= read -r -d '' file; do
    if grep -q "from.*axios" "$file" 2>/dev/null; then
      violation "R2" "$ws_name: Direct axios import in $(realpath --relative-to="$ROOT_DIR" "$file")"
      rule2_violations=$((rule2_violations + 1))
    fi
  done < <(find "$ws" -name "*.ts" -o -name "*.vue" -o -name "*.tsx" -type f -print0 2>/dev/null)

  # Check for direct fetch() calls (excluding comment context)
  while IFS= read -r -d '' file; do
    if grep -n '[^a-zA-Z]fetch(' "$file" 2>/dev/null | grep -v "//.*fetch(" | grep -v "[\"\`].*fetch(" | grep -q .; then
      violation "R2" "$ws_name: Direct fetch() in $(realpath --relative-to="$ROOT_DIR" "$file")"
      rule2_violations=$((rule2_violations + 1))
    fi
  done < <(find "$ws" -name "*.ts" -o -name "*.vue" -o -name "*.tsx" -type f -print0 2>/dev/null)
done
if [ "$rule2_violations" -eq 0 ]; then
  pass "R2" "No direct HTTP calls in workspace code"
fi

# ====================================================================
# Rule 3: No direct prisma import in workspace code
# Only allowed in repository layer (packages/studio-platform)
# Reference: MANIFESTO.md Rule 3, DATA-SPEC.md, ADR-004
# ====================================================================
echo "[Rule 3] Direct Prisma Import Check..."
rule3_violations=0
for ws in $(get_workspace_dirs); do
  ws_name=$(basename "$ws")

  while IFS= read -r -d '' file; do
    if grep -q "from.*prisma\|from.*@prisma/client\|import.*prisma" "$file" 2>/dev/null; then
      violation "R3" "$ws_name: Direct prisma import in $(realpath --relative-to="$ROOT_DIR" "$file")"
      rule3_violations=$((rule3_violations + 1))
    fi
  done < <(find "$ws" -name "*.ts" -o -name "*.vue" -type f -print0 2>/dev/null)
done
if [ "$rule3_violations" -eq 0 ]; then
  pass "R3" "No direct prisma imports in workspace code"
fi

# ====================================================================
# Rule 4: No brand-* geo-runtime video-runtime directory patterns
# Legacy naming patterns that must be migrated
# Reference: MANIFESTO.md §6 (Naming Convention), WORKSPACE-SPEC.md §6
# ====================================================================
echo "[Rule 4] Legacy Naming Patterns Check..."
rule4_violations=0

check_and_fix_dir() {
  local pattern="$1"
  local fix_name="$2"
  local desc="$3"

  while IFS= read -r -d '' dir; do
    dirname="$(basename "$dir")"
    parent="$(dirname "$dir")"
    violation "R4" "Legacy directory: $dirname (expected: $fix_name)"
    rule4_violations=$((rule4_violations + 1))

    if [ "$FIX_MODE" = true ] && [ "$dirname" != "$fix_name" ]; then
      info "  --fix: Moving $dirname → $fix_name"
      mv "$dir" "$parent/$fix_name" 2>/dev/null || warn "R4" "Cannot move $dir (may already exist)"
    fi
  done < <(find "$WORKSPACE_DIR" -maxdepth 1 -type d -name "$pattern" -print0 2>/dev/null)
}

# Legacy directory patterns
check_and_fix_dir "brand-*" "" "brand-* → unified workspace"
check_and_fix_dir "geo-runtime" "geo" "geo-runtime → geo"
check_and_fix_dir "video-runtime" "video" "video-runtime → video"

# Check for brand/ prefix in API routes
for ws in $(get_workspace_dirs); do
  ws_name=$(basename "$ws")
  while IFS= read -r -d '' file; do
    if grep -n "'/api/brand" "$file" 2>/dev/null | grep -q .; then
      violation "R4" "$ws_name: Contains '/api/brand' prefix in $(realpath --relative-to="$ROOT_DIR" "$file")"
      rule4_violations=$((rule4_violations + 1))
    fi
  done < <(find "$ws" -name "*.ts" -o -name "*.vue" -type f -print0 2>/dev/null)
done

# Check for Geo* data model naming (should be Knowledge*)
for ws in $(get_workspace_dirs); do
  ws_name=$(basename "$ws")
  while IFS= read -r -d '' file; do
    if grep -n "interface Geo\(Claim\|Evidence\|Citation\|FAQ\|Schema\|QualityScore\|Entity\|Relation\|Freshness\)" "$file" 2>/dev/null | grep -q .; then
      violation "R4" "$ws_name: Legacy Geo* data model naming in $(realpath --relative-to="$ROOT_DIR" "$file")"
      rule4_violations=$((rule4_violations + 1))
    fi
  done < <(find "$ws" -name "*.ts" -type f -print0 2>/dev/null)
done

if [ "$rule4_violations" -eq 0 ]; then
  pass "R4" "No legacy naming patterns found"
fi

# ====================================================================
# Rule 5: All workspace directories must have adapter.ts
# Every workspace/ must contain an adapter file
# Reference: WORKSPACE-SPEC.md §3, RUNTIME-SPEC.md §5, ADR-002
# ====================================================================
echo "[Rule 5] Workspace Adapter Check..."
rule5_violations=0
for ws in $(get_workspace_dirs); do
  ws_name=$(basename "$ws")
  adapter_count=$(find "$ws" -name "*Adapter.ts" -type f 2>/dev/null | wc -l)

  if [ "$adapter_count" -eq 0 ]; then
    violation "R5" "$ws_name: Missing WorkspaceAdapter (no *Adapter.ts file found)"
    rule5_violations=$((rule5_violations + 1))
  elif [ "$adapter_count" -gt 1 ]; then
    violation "R5" "$ws_name: Multiple Adapter files ($adapter_count found, expected 1)"
    rule5_violations=$((rule5_violations + 1))
  else
    adapter_file=$(find "$ws" -name "*Adapter.ts" -type f 2>/dev/null | head -1)
    # Verify adapter implements WorkspaceAdapter (basic check)
    if grep -q "implements WorkspaceAdapter" "$adapter_file" 2>/dev/null; then
      pass "R5" "$ws_name: Adapter found and implements WorkspaceAdapter"
    else
      warn "R5" "$ws_name: Adapter found but may not implement WorkspaceAdapter: $adapter_file"
    fi
  fi
done

# Also check for adapter/ directory pattern
for ws in $(get_workspace_dirs); do
  ws_name=$(basename "$ws")
  if [ ! -d "$ws/adapter" ]; then
    warn "R5" "$ws_name: Missing adapter/ directory (expected in workspace/<name>/adapter/)"
  fi
done

# ====================================================================
# Rule 6: Only one Runtime
# grep for "Runtime" classes, count distinct runtime implementations
# Reference: ADR-001, RUNTIME-SPEC.md
# ====================================================================
echo "[Rule 6] Runtime Implementation Count..."
rule6_violations=0

# Count Runtime classes in platform (expected: multiple allowed)
# Count Runtime classes in workspace (expected: 0)
ws_runtime_classes=0
for ws in $(get_workspace_dirs); do
  while IFS= read -r -d '' file; do
    classes=$(grep -c "class.*Runtime" "$file" 2>/dev/null || true)
    ws_runtime_classes=$((ws_runtime_classes + classes))
  done < <(find "$ws" -name "*.ts" -type f -print0 2>/dev/null)
done

if [ "$ws_runtime_classes" -gt 0 ]; then
  violation "R6" "Found $ws_runtime_classes Runtime class(es) in workspace code (expected: 0)"
  rule6_violations=$((rule6_violations + ws_runtime_classes))
fi

if [ "$rule6_violations" -eq 0 ]; then
  pass "R6" "No workspace Runtime classes found (ADR-001: Single Runtime in Platform)"
fi

# ====================================================================
# Rule 7: Import check — workspace imports must come from @studio/platform
# Scan workspace files for relative imports that cross workspace boundaries
# Reference: PLATFORM-SDK.md §1, §4
# ====================================================================
echo "[Rule 7] SDK Import Check..."
rule7_violations=0
for ws in $(get_workspace_dirs); do
  ws_name=$(basename "$ws")

  while IFS= read -r -d '' file; do
    # Check for cross-workspace relative imports (e.g., ../../workspace/video/...)
    if grep -n "from.*\.\./workspace/" "$file" 2>/dev/null | grep -q .; then
      violation "R7" "$ws_name: Cross-workspace relative import in $(realpath --relative-to="$ROOT_DIR" "$file")"
      rule7_violations=$((rule7_violations + 1))
    fi

    # Check for platform internal imports (should use @studio/platform)
    if grep -n "from.*\.\./\.\./platform\|from.*\.\./platform" "$file" 2>/dev/null | grep -v "node_modules" | grep -q .; then
      violation "R7" "$ws_name: Platform internal relative import in $(realpath --relative-to="$ROOT_DIR" "$file")"
      rule7_violations=$((rule7_violations + 1))
    fi

    # Check for direct Provider client instantiation
    if grep -n "new OpenAI\b\|new Doubao\b\|new Qwen\b\|new DeepSeek\b\|new Gemini\b" "$file" 2>/dev/null | grep -q .; then
      violation "R7" "$ws_name: Direct Provider client instantiation in $(realpath --relative-to="$ROOT_DIR" "$file")"
      rule7_violations=$((rule7_violations + 1))
    fi
  done < <(find "$ws" -name "*.ts" -o -name "*.vue" -type f -print0 2>/dev/null)
done
if [ "$rule7_violations" -eq 0 ]; then
  pass "R7" "All workspace imports via @studio/platform"
fi

# ====================================================================
# Rule 8: API response format check
# Verify all route files return unified ApiResponse format
# Reference: API-SPEC.md §1
# ====================================================================
echo "[Rule 8] API Response Format Check..."
rule8_violations=0
for ws in $(get_workspace_dirs); do
  ws_name=$(basename "$ws")
  while IFS= read -r -d '' file; do
    # Check if the file has route/endpoint definitions
    if grep -q "Route\|router\.\(get\|post\|put\|patch\|delete\)\|@\(Get\|Post\|Put\|Patch\|Delete\)" "$file" 2>/dev/null; then
      # Check for ApiResponse usage
      if ! grep -q "ApiResponse\|success.*data.*traceId\|success.*error" "$file" 2>/dev/null; then
        violation "R8" "$ws_name: Route file without ApiResponse format: $(realpath --relative-to="$ROOT_DIR" "$file")"
        rule8_violations=$((rule8_violations + 1))
      fi
    fi
  done < <(find "$ws" -name "*.ts" -type f -print0 2>/dev/null)
done
if [ "$rule8_violations" -eq 0 ]; then
  pass "R8" "API response format appears compliant"
fi

# ====================================================================
# ADR Validation Section
# ====================================================================
echo ""
echo "=== ADR Validation ==="

# --- ADR-001: Count Runtime implementations (must be <= 1 in Platform, 0 in Workspace) ---
echo "[ADR-001] Single Runtime Validation..."
adr1_violations=0

# Count distinct Runtime class implementations across the whole project
# Workspace Runtimes are already checked in Rule 1 / Rule 6

# Check for multiple Runtime instances in Platform
platform_runtime_files=$(find "$PLATFORM_DIR" -name "*.runtime.ts" -type f 2>/dev/null | wc -l)
info "Platform runtime files: $platform_runtime_files"

if [ "$ws_runtime_classes" -gt 0 ]; then
  violation "ADR-001" "Workspace contains $ws_runtime_classes Runtime class(es) — violates Single Runtime"
  adr1_violations=$((adr1_violations + 1))
fi

if [ "$adr1_violations" -eq 0 ]; then
  pass "ADR-001" "Single Runtime constraint satisfied"
fi

# --- ADR-002: All workspace/ dirs must have adapter.ts ---
# Already checked in Rule 5, just report
echo "[ADR-002] Workspace Adapter Validation..."
adr2_violations="$rule5_violations"
if [ "$adr2_violations" -eq 0 ]; then
  pass "ADR-002" "All workspaces have adapter.ts"
else
  violation "ADR-002" "$adr2_violations workspace(s) missing adapter — violates Workspace Adapter pattern"
fi

# --- ADR-003: All agents must go through capability registry ---
# Scan for direct LLM calls that bypass capability registry
echo "[ADR-003] Capability Layer Validation..."
adr3_violations=0
for ws in $(get_workspace_dirs); do
  ws_name=$(basename "$ws")
  while IFS= read -r -d '' file; do
    # Check for patterns that directly call LLM/Provider without going through capability
    # Patterns: llm.generate, client.chat.completions, openai. etc.
    direct_calls=$(grep -c "\.chat\.completions\|openai\.\|doubao\.\|deepseek\.\|qwen\.\|gemini\.\|\"llm\"\.generate\|new.*OpenAI\|new.*Doubao\|new.*DeepSeek" "$file" 2>/dev/null || true)
    if [ "$direct_calls" -gt 0 ]; then
      # Check if these are within capability registry or provider definition
      if ! grep -q "capability\.invoke\|CapabilityRuntime\|registerProvider\|ProviderRegistration" "$file" 2>/dev/null; then
        violation "ADR-003" "$ws_name: Direct LLM/Provider call in $(realpath --relative-to="$ROOT_DIR" "$file") (bypass Capability Runtime)"
        adr3_violations=$((adr3_violations + direct_calls))
      fi
    fi
  done < <(find "$ws" -name "*.ts" -type f -print0 2>/dev/null)
done

# Check for scoped agent registry files (not in platform)
while IFS= read -r -d '' file; do
  if grep -q "registerAgent\|AgentRegistration" "$file" 2>/dev/null; then
    # If this file is NOT in the platform agents directory, it's a scoped registry
    if ! echo "$file" | grep -q "packages/studio-platform.*agent"; then
      violation "ADR-003" "Scoped agent registry: $(realpath --relative-to="$ROOT_DIR" "$file") (must register in Platform)"
      adr3_violations=$((adr3_violations + 1))
    fi
  fi
done < <(find "$WORKSPACE_DIR" -name "*.ts" -type f -print0 2>/dev/null)

if [ "$adr3_violations" -eq 0 ]; then
  pass "ADR-003" "No direct LLM bypass detected — capability layer architecture respected"
fi

# --- ADR-004: All repository files must extend BaseRepository ---
echo "[ADR-004] Repository Pattern Validation..."
adr4_violations=0

# Find all *repository*.ts files and check they extend BaseRepository
repo_files=$(find "$ROOT_DIR" -name "*repository*" -name "*.ts" -type f 2>/dev/null || true)
if [ -z "$repo_files" ]; then
  info "No repository files found to validate"
else
  while IFS= read -r -d '' file; do
    if grep -q "class.*Repository" "$file" 2>/dev/null; then
      if ! grep -q "extends.*BaseRepository\|extends.*Repository" "$file" 2>/dev/null; then
        rel_path=$(realpath --relative-to="$ROOT_DIR" "$file")
        # Check if it imports BaseRepository
        if grep -q "BaseRepository" "$file" 2>/dev/null; then
          violation "ADR-004" "Repository class may not extend BaseRepository: $rel_path"
          adr4_violations=$((adr4_violations + 1))
        fi
      fi
    fi
  done < <(find "$ROOT_DIR" -name "*.ts" -type f -print0 2>/dev/null | xargs -0 grep -l "class.*Repository" 2>/dev/null || true)
fi

if [ "$adr4_violations" -eq 0 ] && [ -n "$repo_files" ]; then
  pass "ADR-004" "All Repository classes extend BaseRepository"
elif [ "$adr4_violations" -eq 0 ]; then
  info "ADR-004: No repository files to check"
fi

# ====================================================================
# Summary
# ====================================================================
echo ""
echo "=== Results ==="
echo "Violations: $VIOLATIONS"
echo "Warnings: $WARNINGS"

if [ $VIOLATIONS -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ Architecture Compliance: PASS${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}❌ Architecture Compliance: FAIL ($VIOLATIONS violations, $WARNINGS warnings)${NC}"
  echo "Run with --fix to auto-fix certain issues (e.g., directory renames)"
  exit 1
fi
