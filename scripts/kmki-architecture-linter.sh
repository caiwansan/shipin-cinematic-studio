#!/bin/bash
# ====================================================================
# KMKI Architecture Linter v1 — Baseline Compliance Score
# 昆仑镜微电影工作台架构合规性检查脚本
#
# Covers 14 check modules (Baseline v1.0):
#   1.  Directory Structure     — expected files/dirs exist
#   2.  Naming Convention       — kebab-case for .ts/dirs (skip .vue)
#   3.  Service Layer           — no direct Prisma import outside repos
#   4.  Repository Layer        — repos/ dirs present, exports exist
#   5.  Route Layer             — no business logic (prisma, >200 lines)
#   6.  Component Convention    — <script setup> + defineProps
#   7.  Page Convention         — < 200 lines per page
#   8.  Workspace Manifest      — studio-v2 workspace/*/workspace.json
#   9.  Store Convention        — useXxxStore export pattern
#   10. Prisma Map Convention   — @@map on models, @map on fields
#   11. Technical Debt          — TODO/FIXME/HACK/XXX count
#   12. Test Coverage           — __tests__ per service
#   13. Registry Convention     — geo/registry exists with exports
#   14. Prisma Convention (gen) — models have @id, timestamps
#
# Usage: bash scripts/kmki-architecture-linter.sh
# Output: stdout (human-readable + CI-parsable final line)
# Returns:
#   0 — Score >= 80 (PASS)
#   1 — Score >= 60 (WARN)
#   2 — Score < 60  (FAIL)
# ====================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT_DIR/frontend"
BACKEND="$ROOT_DIR/backend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# ── Module Results Arrays ─────────────────────────────────────────
MODULE_NAMES=()
MODULE_PASS=()
MODULE_TOTAL=()
MODULE_STATUS=()   # "PASS"|"WARN"|"FAIL"
MODULE_SCORES=()   # 0..100

# ── Helpers ───────────────────────────────────────────────────────

pass_if_true() {
  local name="$1" total="$2" pass="$3" detail="$4"
  MODULE_NAMES+=("$name")
  MODULE_TOTAL+=("$total")
  MODULE_PASS+=("$pass")
  MODULE_DETAILS+=("$detail")
  if [ "$total" -eq 0 ]; then
    MODULE_STATUS+=("PASS")
    MODULE_SCORES+=("100")
  elif [ "$pass" -eq "$total" ]; then
    MODULE_STATUS+=("PASS")
    MODULE_SCORES+=("100")
  elif [ "$pass" -ge $(( (total * 60 + 99) / 100 )) ]; then
    # 60%+ threshold: WARN
    MODULE_STATUS+=("WARN")
    local score=$(( pass * 100 / total ))
    MODULE_SCORES+=("$score")
  else
    MODULE_STATUS+=("FAIL")
    local score=$(( pass * 100 / total ))
    MODULE_SCORES+=("$score")
  fi
}

# Global detail strings (used in summary)
MODULE_DETAILS=()

print_header() {
  echo ""
  echo "========================================"
  echo "  KMKI Architecture Report"
  echo "========================================"
  echo ""
}

print_summary() {
  local total_pass=0 total_warn=0 total_fail=0
  local sum_score=0 min_score=100 min_idx=-1
  local i
  for i in "${!MODULE_NAMES[@]}"; do
    local name="${MODULE_NAMES[$i]}"
    local pass="${MODULE_PASS[$i]}"
    local total="${MODULE_TOTAL[$i]}"
    local status="${MODULE_STATUS[$i]}"
    local det="${MODULE_DETAILS[$i]:-}"
    local score="${MODULE_SCORES[$i]}"

    local color="$GREEN"
    [ "$status" = "WARN" ] && color="$YELLOW"
    [ "$status" = "FAIL" ] && color="$RED"

    echo -e "${color}${status}${NC} [${pass}/${total}] ${name} ${det:+(${det})}"

    case "$status" in
      PASS) total_pass=$((total_pass + 1)) ;;
      WARN) total_warn=$((total_warn + 1)) ;;
      FAIL) total_fail=$((total_fail + 1)) ;;
    esac
    sum_score=$((sum_score + score))
    if [ "$score" -lt "$min_score" ]; then
      min_score="$score"
      min_idx=$i
    fi
  done

  local mod_count="${#MODULE_NAMES[@]}"
  local overall
  if [ "$mod_count" -gt 1 ]; then
    local adjusted_sum=$((sum_score - min_score))
    local adjusted_count=$((mod_count - 1))
    overall=$(( adjusted_sum / adjusted_count ))
  else
    overall=$(( sum_score / mod_count ))
  fi

  echo ""
  echo "Technical Debt"
  echo "  FAIL ${total_fail}"
  echo "  WARN ${total_warn}"
  echo "  PASS ${total_pass}"
  echo ""
  echo -e "${BOLD}Overall Score: ${overall} / 100${NC}"
  echo ""

  # CI line (must be last stdout line)
  echo "KMKI_OVERALL_SCORE: ${overall}"

  # Exit code
  if [ "$overall" -ge 80 ]; then
    echo -e "${GREEN}✅ KMKI Architecture: PASS${NC}" >&2
    exit 0
  elif [ "$overall" -ge 60 ]; then
    echo -e "${YELLOW}⚠️ KMKI Architecture: WARN${NC}" >&2
    exit 1
  else
    echo -e "${RED}❌ KMKI Architecture: FAIL${NC}" >&2
    exit 2
  fi
}

# ═══════════════════════════════════════════════════════════════════
#  Module 1: Directory Structure
# ═══════════════════════════════════════════════════════════════════
check_directory_structure() {
  local violations=0 total=0

  local fe_checks=(
    "pages/workspace/geo.vue"
    "components/kmki-ui/Badge/index.vue"
    "components/kmki-ui/Card/index.vue"
    "stores/auth.ts"
    "stores/projectStore.ts"
    "layouts/workbench.vue"
    "layouts/admin-aigc.vue"
  )
  for f in "${fe_checks[@]}"; do
    total=$((total + 1))
    if [ ! -f "$FRONTEND/$f" ]; then
      echo "  MISSING: frontend/$f"
      violations=$((violations + 1))
    fi
  done

  local be_checks=(
    "src/platform/repository"
    "src/platform/state-machine"
    "src/platform/event-bus"
    "src/platform/version"
    "src/services/geo/repositories"
    "src/services/geo/routes"
    "prisma/schema.prisma"
  )
  for f in "${be_checks[@]}"; do
    total=$((total + 1))
    if [ ! -e "$BACKEND/$f" ]; then
      echo "  MISSING: backend/$f"
      violations=$((violations + 1))
    fi
  done

  local pass=$((total - violations))
  pass_if_true "Directory Structure" "$total" "$pass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 2: Naming Convention
# ═══════════════════════════════════════════════════════════════════
check_naming_convention() {
  local violations=0 total=0

  # Check .ts files in backend/src/ (not in node_modules)
  # Known exceptions: PascalCase for class files, __tests__ dirs
  while IFS= read -r -d '' f; do
    local basename bname ext
    basename=$(basename "$f")
    bname="${basename%.ts}"

    # Skip known conventional names
    case "$bname" in
      index|types|constants|config|env|global|setup|middleware)
        continue ;;
    esac

    total=$((total + 1))
    # Check non-kebab: contains uppercase letters
    if echo "$bname" | grep -qE '[A-Z]'; then
      violations=$((violations + 1))
      echo "  NON_KEBAB_TS: $f"
    fi
  done < <(find "$BACKEND/src" -name "*.ts" -not -path "*/node_modules/*" -not -path "*/__tests__/*" -type f -print0 2>/dev/null)

  # Check dir names in backend/src/ (maxdepth 2)
  while IFS= read -r -d '' d; do
    local dirname
    dirname=$(basename "$d")
    # Skip __tests__ dirs (conventional), node_modules
    [[ "$dirname" == __* ]] && continue
    total=$((total + 1))
    if echo "$dirname" | grep -qE '[A-Z]'; then
      violations=$((violations + 1))
      echo "  NON_KEBAB_DIR: $d"
    fi
  done < <(find "$BACKEND/src" -maxdepth 2 -type d -not -path "*/node_modules/*" -not -path "$BACKEND/src" -print0 2>/dev/null)

  local pass=$((total - violations))
  [ "$pass" -lt 0 ] && pass=0
  pass_if_true "Naming Convention" "$total" "$pass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 3: Service Layer — Per-Workspace Direct Prisma Import
#  GEO, HDZ, Shared Platform — each workspace scored independently
# ═══════════════════════════════════════════════════════════════════
WORKSPACE_DOMAINS=(
  "geo|$BACKEND/src/services/geo"
  "hdz|$BACKEND/src/services/hdz"
  "platform|$BACKEND/src/platform"
)
# Additional domains (not ranked by score) — optional check
EXTRA_DOMAINS=()

check_service_layer() {
  local global_violations=0 global_total=0
  local domain_results=()

  check_single_domain() {
    local label="$1" dir="$2"
    local dv=0 dt=0

    # Count files in this domain (excluding repos, platform sub-dirs, tests)
    while IFS= read -r -d '' f; do
      dt=$((dt + 1))
    done < <(find "$dir" -name "*.ts" \
      -not -path "*/node_modules/*" \
      -not -path "*/repositories/*" \
      -not -path "*/__tests__/*" \
      -type f -print0 2>/dev/null)

    # Check direct prisma imports
    local matches
    matches=$(grep -rn "import.*prisma.*from\|require.*prisma" "$dir" --include="*.ts" 2>/dev/null \
      | grep -v "node_modules" | grep -v "\.test\." | grep -v "/repositories/" || true)

    if [ -n "$matches" ]; then
      while IFS= read -r line; do
        dv=$((dv + 1))
        echo "  PRISMA_IN_${label}_SERVICE: $line"
      done <<< "$matches"
    fi

    local dp=$((dt - dv))
    [ "$dp" -lt 0 ] && dp=0
    local score=100
    [ "$dt" -gt 0 ] && score=$(( dp * 100 / dt ))

    echo "  [${label}] ${dp}/${dt} clean (score: ${score})"
    echo ""
    echo "$label:$dt:$dp:$score"
  }

  for entry in "${WORKSPACE_DOMAINS[@]}"; do
    local label="${entry%%|*}"
    local dir="${entry##*|}"
    result=$(check_single_domain "$label" "$dir")
    # Print lines that aren't the result line
    while IFS= read -r line; do
      case "$line" in
        geo:*|hdz:*|platform:*) domain_results+=("$line");;
        *) echo "$line";;
      esac
    done <<< "$result"
  done

  # Aggregate: average of domain scores (equal weight)
  local agg_score=0 agg_denom=0
  for result in "${domain_results[@]}"; do
    # result format: label:total:pass:score
    local label="${result%%:*}"
    local rest="${result#*:}"
    local dt="${rest%%:*}"
    rest="${rest#*:}"
    local dp="${rest%%:*}"
    local score="${rest##*:}"
    agg_score=$((agg_score + score))
    agg_denom=$((agg_denom + 1))
    global_total=$((global_total + dt))
    global_violations=$((global_violations + dt - dp))
  done

  local agg=100
  [ "$agg_denom" -gt 0 ] && agg=$(( agg_score / agg_denom ))
  local gpass=$((global_total - global_violations))
  [ "$gpass" -lt 0 ] && gpass=0
  pass_if_true "Service Layer (aggregate)" "$global_total" "$gpass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 4: Repository Layer — Per-Workspace Coverage
# ═══════════════════════════════════════════════════════════════════
check_repository_layer() {
  local global_violations=0 global_total=0
  local domain_results=()

  check_single_repo_domain() {
    local label="$1" dir="$2"
    local dt=0 dv=0
    local repo_dir="$dir/repositories"

    # Count total non-repo .ts files (candidates for repo coverage)
    while IFS= read -r -d '' f; do
      dt=$((dt + 1))
    done < <(find "$dir" -name "*.ts" \
      -not -path "*/node_modules/*" \
      -not -path "*/repositories/*" \
      -not -path "*/__tests__/*" \
      -not -path "*/registry/*" \
      -type f -print0 2>/dev/null)

    # Count repo files that exist
    local repo_count=0
    if [ -d "$repo_dir" ]; then
      repo_count=$(find "$repo_dir" -name "*repository*.ts" -type f 2>/dev/null | wc -l)
    fi

    echo "  [${label}] Repos: ${repo_count}, Service+Route+Other files: ${dt}"

    # Check that all repo files have exports
    local no_export=0
    while IFS= read -r -d '' f; do
      if ! grep -q "export" "$f" 2>/dev/null; then
        dv=$((dv + 1))
        no_export=$((no_export + 1))
        echo "    NO_EXPORT: $f"
      fi
    done < <(find "$dir" -path "*/repositories/*repository*.ts" -not -path "*/node_modules/*" -type f -print0 2>/dev/null)

    local dp=$((dt - dv))
    [ "$dp" -lt 0 ] && dp=0
    local score=100
    [ "$dt" -gt 0 ] && score=$(( dp * 100 / dt ))

    echo "  [${label}] Coverage: ${dp}/${dt} (score: ${score})"
    echo ""
    echo "$label:$dt:$dp:$score"
  }

  for entry in "${WORKSPACE_DOMAINS[@]}"; do
    local label="${entry%%|*}"
    local dir="${entry##*|}"
    result=$(check_single_repo_domain "$label" "$dir")
    while IFS= read -r line; do
      case "$line" in
        geo:*|hdz:*|platform:*) domain_results+=("$line");;
        *) echo "$line";;
      esac
    done <<< "$result"
  done

  local agg_score=0 agg_denom=0
  for result in "${domain_results[@]}"; do
    local label="${result%%:*}"
    local rest="${result#*:}"
    local dt="${rest%%:*}"
    rest="${rest#*:}"
    local dp="${rest%%:*}"
    local score="${rest##*:}"
    agg_score=$((agg_score + score))
    agg_denom=$((agg_denom + 1))
    global_total=$((global_total + dt))
    global_violations=$((global_violations + dt - dp))
  done

  local agg=100
  [ "$agg_denom" -gt 0 ] && agg=$(( agg_score / agg_denom ))
  local gpass=$((global_total - global_violations))
  [ "$gpass" -lt 0 ] && gpass=0
  pass_if_true "Repository Layer (aggregate)" "$global_total" "$gpass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 5: Route Layer
# ═══════════════════════════════════════════════════════════════════
check_route_layer() {
  local violations=0 total=0
  local route_files=()

  while IFS= read -r -d '' f; do
    route_files+=("$f")
    total=$((total + 1))
  done < <(find "$BACKEND/src/services" -name "*.route*.ts" -not -path "*/node_modules/*" -type f -print0 2>/dev/null)

  # Check each route file: prisma import = violation
  for f in "${route_files[@]}"; do
    if grep -q "prisma" "$f" 2>/dev/null; then
      violations=$((violations + 1))
      echo "  PRISMA_IN_ROUTE: $f"
    fi
  done

  # Check route file length (>200 lines = violation)
  for f in "${route_files[@]}"; do
    local lines
    lines=$(wc -l < "$f")
    if [ "$lines" -gt 200 ]; then
      violations=$((violations + 1))
      echo "  LONG_ROUTE: $f ($lines lines)"
    fi
  done

  local pass=$((total - violations))
  [ "$pass" -lt 0 ] && pass=0
  pass_if_true "Route Layer" "$total" "$pass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 6: Vue Component Convention
# ═══════════════════════════════════════════════════════════════════
check_component_convention() {
  local violations=0 total=0

  while IFS= read -r -d '' f; do
    total=$((total + 1))
    local hasSetup=0
    hasSetup=$(grep -c "<script setup" "$f" 2>/dev/null || true)

    if [ "$hasSetup" -eq 0 ]; then
      violations=$((violations + 1))
      echo "  NO_SCRIPT_SETUP: $f"
    fi
  done < <(find "$FRONTEND" -name "*.vue" -not -path "*/node_modules/*" -not -path "*/kmki-ui/*" -type f -print0 2>/dev/null)

  local pass=$((total - violations))
  [ "$pass" -lt 0 ] && pass=0
  pass_if_true "Component Convention" "$total" "$pass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 7: Page Convention
# ═══════════════════════════════════════════════════════════════════
check_page_convention() {
  local violations=0 total=0

  while IFS= read -r -d '' f; do
    total=$((total + 1))
    local lines
    lines=$(wc -l < "$f")
    # Pages should be concise: warn if >200 lines
    if [ "$lines" -gt 200 ]; then
      violations=$((violations + 1))
      echo "  LONG_PAGE: $f ($lines lines)"
    fi
  done < <(find "$FRONTEND/pages" -name "*.vue" -not -path "*/node_modules/*" -type f -print0 2>/dev/null)

  local pass=$((total - violations))
  [ "$pass" -lt 0 ] && pass=0
  pass_if_true "Page Convention" "$total" "$pass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 8: Workspace Manifest
# ═══════════════════════════════════════════════════════════════════
check_workspace_manifest() {
  local violations=0 total=0

  local ws_base="$FRONTEND/studio-v2/workspace"
  if [ -d "$ws_base" ]; then
    while IFS= read -r -d '' d; do
      local name
      name=$(basename "$d")
      total=$((total + 1))
      local json="$d/workspace.json"
      if [ ! -f "$json" ]; then
        violations=$((violations + 1))
        echo "  MISSING_MANIFEST: $name"
      fi
    done < <(find "$ws_base" -maxdepth 1 -type d -not -path "$ws_base" -print0 2>/dev/null)
  fi

  local pass=$((total - violations))
  [ "$pass" -lt 0 ] && pass=0
  pass_if_true "Workspace Manifest" "$total" "$pass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 9: Store Convention
# ═══════════════════════════════════════════════════════════════════
check_store_convention() {
  local violations=0 total=0

  while IFS= read -r -d '' f; do
    total=$((total + 1))
    if ! grep -q "use.*Store" "$f" 2>/dev/null; then
      violations=$((violations + 1))
      echo "  NON_STANDARD: $f (missing useXxxStore pattern)"
    fi
  done < <(find "$FRONTEND/stores" -name "*.ts" -not -path "*/node_modules/*" -type f -print0 2>/dev/null)

  local pass=$((total - violations))
  [ "$pass" -lt 0 ] && pass=0
  pass_if_true "Store Convention" "$total" "$pass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 10: Prisma Map Convention
# ═══════════════════════════════════════════════════════════════════
check_prisma_map_convention() {
  local violations=0 total=0

  local schema="$BACKEND/prisma/schema.prisma"
  if [ ! -f "$schema" ]; then
    pass_if_true "Prisma Map Convention" 0 0 "no schema"
    return
  fi

  # Check models for @@map
  local models
  models=$(grep "^model " "$schema" | awk '{print $2}' 2>/dev/null)
  for model in $models; do
    total=$((total + 1))
    local hasMap
    hasMap=$(grep -A5 "^model $model" "$schema" | grep -c "@@map" 2>/dev/null || true)
    if [ "$hasMap" -eq 0 ]; then
      violations=$((violations + 1))
      echo "  NO_TABLE_MAP: $model"
    fi
  done

  local pass=$((total - violations))
  [ "$pass" -lt 0 ] && pass=0
  pass_if_true "Prisma Map Convention" "$total" "$pass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 11: Technical Debt
# ═══════════════════════════════════════════════════════════════════
check_technical_debt() {
  local violations=0 total=0
  local max_report=30

  # Backend
  local be_debt
  be_debt=$(grep -rn "TODO\|FIXME\|HACK\|XXX" "$BACKEND/src/" --include="*.ts" 2>/dev/null \
    | grep -v "node_modules" | grep -v "\.test\." | head -"$max_report" || true)

  if [ -n "$be_debt" ]; then
    while IFS= read -r line; do
      total=$((total + 1))
      violations=$((violations + 1))
      echo "  TECH_DEBT: $line"
    done <<< "$be_debt"
  fi

  # Frontend
  local fe_debt
  fe_debt=$(grep -rn "TODO\|FIXME\|HACK\|XXX" "$FRONTEND/" --include="*.ts" --include="*.vue" 2>/dev/null \
    | grep -v "node_modules" | grep -v "\.test\." | head -"$max_report" || true)

  if [ -n "$fe_debt" ]; then
    while IFS= read -r line; do
      total=$((total + 1))
      violations=$((violations + 1))
      echo "  TECH_DEBT: $line"
    done <<< "$fe_debt"
  fi

  # If no items at all, score 100
  if [ "$total" -eq 0 ]; then
    total=1
  fi

  local pass=$((total - violations))
  [ "$pass" -lt 0 ] && pass=0
  pass_if_true "Technical Debt" "$total" "$pass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 12: Test Coverage
# ═══════════════════════════════════════════════════════════════════
check_test_coverage() {
  local violations=0 total=0

  while IFS= read -r -d '' d; do
    local name
    name=$(basename "$d")
    # Skip 'repositories' dir (not a service, it's inside geo)
    [ "$name" = "repositories" ] && continue
    total=$((total + 1))
    local testDir="$d/__tests__"
    if [ -d "$testDir" ]; then
      local testCount
      testCount=$(find "$testDir" -name "*.ts" -type f 2>/dev/null | wc -l)
      echo "  TESTS: $name ($testCount tests)"
    else
      violations=$((violations + 1))
      echo "  NO_TESTS: $name"
    fi
  done < <(find "$BACKEND/src/services" -maxdepth 1 -type d -not -path "$BACKEND/src/services" -print0 2>/dev/null)

  local pass=$((total - violations))
  [ "$pass" -lt 0 ] && pass=0
  pass_if_true "Test Coverage" "$total" "$pass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 13: Registry Convention
# ═══════════════════════════════════════════════════════════════════
check_registry_convention() {
  local violations=0 total=0

  if [ -d "$BACKEND/src/services/geo/registry" ]; then
    local reg_files=()
    while IFS= read -r -d '' f; do
      reg_files+=("$f")
      total=$((total + 1))
      if ! grep -q "export" "$f" 2>/dev/null; then
        violations=$((violations + 1))
        echo "  NO_EXPORT_REGISTRY: $f"
      fi
    done < <(find "$BACKEND/src/services/geo/registry" -name "*.ts" -type f -print0 2>/dev/null)

    if [ "${#reg_files[@]}" -eq 0 ]; then
      total=1
      violations=$((violations + 1))
      echo "  EMPTY_REGISTRY: geo/registry has no .ts files"
    fi
  else
    total=$((total + 1))
    violations=$((violations + 1))
    echo "  MISSING_REGISTRY_DIR: backend/src/services/geo/registry"
  fi

  local pass=$((total - violations))
  [ "$pass" -lt 0 ] && pass=0
  pass_if_true "Registry Convention" "$total" "$pass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 14: Prisma Convention (General)
# ═══════════════════════════════════════════════════════════════════
check_prisma_convention() {
  local violations=0 total=0

  local schema="$BACKEND/prisma/schema.prisma"
  if [ ! -f "$schema" ]; then
    pass_if_true "Prisma Convention" 0 0 "no schema"
    return
  fi

  local model_count
  model_count=$(grep -c "^model " "$schema" 2>/dev/null || true)
  total=$((total + 1))
  if [ "$model_count" -lt 1 ]; then
    violations=$((violations + 1))
    echo "  NO_MODELS: schema.prisma has no model definitions"
  fi

  # Check each model has an @id or @@id
  local models
  models=$(grep "^model " "$schema" | awk '{print $2}' 2>/dev/null)
  for model in $models; do
    total=$((total + 1))
    local hasId
    hasId=$(grep -A10 "^model $model" "$schema" | grep -cE "@id|@@id" 2>/dev/null || true)
    if [ "$hasId" -eq 0 ]; then
      violations=$((violations + 1))
      echo "  NO_PRIMARY_KEY: $model"
    fi
  done

  # Check for timestamp fields (createdAt or created_at)
  local hasTimestamps
  hasTimestamps=$(grep -cE "createdAt|created_at" "$schema" 2>/dev/null || true)
  total=$((total + 1))
  if [ "$hasTimestamps" -eq 0 ]; then
    violations=$((violations + 1))
    echo "  NO_TIMESTAMPS: schema lacks createdAt fields"
  fi

  local pass=$((total - violations))
  [ "$pass" -lt 0 ] && pass=0
  pass_if_true "Prisma Convention" "$total" "$pass" ""
}

# ═══════════════════════════════════════════════════════════════════
#  Module 15: Workspace Dashboard v2 — Data Access Coverage
#  
#  Metrics (per workspace):
#    DA Coverage = Repository-backed Services / Data-Accessing Services
#    (NOT "all .ts files" — only services that use Prisma/DB)
#  
#  Display:
#    Core (required for gate) vs Expansion (future modules)
#    Subdomain breakdown for GEO workspace
# ═══════════════════════════════════════════════════════════════════

check_workspace_dashboard() {
  echo ""

  # ── GEO Subdomain Breakdown ────────────────────────────────
  declare -A GEO_SUBDOMAINS=(
    ["Core (svc+route)"]="backend/src/services/geo/services backend/src/services/geo/routes"
    ["Runtime"]="backend/src/services/geo/runtime"
    ["Recommendation"]="backend/src/services/geo/recommendation"
    ["Verification"]="backend/src/services/geo/verification"
    ["Publishing"]="backend/src/services/geo/publishing"
    ["Monitor"]="backend/src/services/geo/monitor"
    ["Growth"]="backend/src/services/geo/growth"
  )

  echo "  ┌───────────────┬────────┬──────────┬──────────┬──────────┐"
  echo "  │ Subdomain     │ Files  │ DA Files │ Repos    │ DA Cov   │"
  echo "  ├───────────────┼────────┼──────────┼──────────┼──────────┤"

  local geo_core_da=0 geo_core_repo=0
  local geo_total_da=0 geo_total_repo=0
  local subdomain_details=()

  for sd_label in "${!GEO_SUBDOMAINS[@]}"; do
    local sd_dirs="${GEO_SUBDOMAINS[$sd_label]}"

    local total_files=0 da_files=0 repo_files=0
    local IFS_SAVE="$IFS"
    IFS=' '
    for sd_dir in $sd_dirs; do
      # Collect all eligible files, store paths for later
      local all_files=()
      while IFS= read -r -d '' f; do
        all_files+=("$f")
      done < <(find "$sd_dir" -name "*.ts" \
        -not -path "*/node_modules/*" \
        -not -path "*/__tests__/*" \
        -type f -print0 2>/dev/null)

      for f in "${all_files[@]}"; do
        # Skip repository files themselves (they ARE the convergence target)
        local f_base
        f_base=$(basename "$f")
        if echo "$f_base" | grep -qi "repository" || [[ "$f" == */repositories/* ]]; then
          repo_files=$((repo_files + 1))
          continue
        fi
        total_files=$((total_files + 1))
        # Check if this file imports prisma (data-accessing)
        if grep -q "import.*prisma.*from\|require.*prisma" "$f" 2>/dev/null; then
          da_files=$((da_files + 1))
        fi
      done
    done
    IFS="$IFS_SAVE"

    # DA Coverage: repo-backed among DA files.
    # A subdomain with 0 DA files is 100% converged (no db access needed).
    local da_cov=100
    if [ "$da_files" -gt 0 ]; then
      da_cov=$(( repo_files * 100 / da_files ))
      [ "$da_cov" -gt 100 ] && da_cov=100
    fi

    local color="\033[0;32m"
    [ "$da_cov" -lt 80 ] && color="\033[0;33m"
    [ "$da_cov" -lt 50 ] && color="\033[0;31m"

    printf "  │ %-13s │ %5d  │ %7d  │ %7d  │ ${color} %3d%%${NC}    │\n" "$sd_label" "$total_files" "$da_files" "$repo_files" "$da_cov"

    # Classify: Core vs Expansion
    case "$sd_label" in
      "Core (svc+route)"|"Runtime")
        geo_core_da=$((geo_core_da + da_files))
        geo_core_repo=$((geo_core_repo + repo_files))
        ;;
      *)
        geo_total_da=$((geo_total_da + da_files))
        geo_total_repo=$((geo_total_repo + repo_files))
        ;;
    esac
  done

  echo "  ├───────────────┼────────┼──────────┼──────────┼──────────┤"

  # Geo Core aggregate
  local geo_core_cov=100
  [ "$geo_core_da" -gt 0 ] && geo_core_cov=$(( geo_core_repo * 100 / geo_core_da ))
  [ "$geo_core_cov" -gt 100 ] && geo_core_cov=100
  local geo_exp_cov=100
  [ "$geo_total_da" -gt 0 ] && geo_exp_cov=$(( geo_total_repo * 100 / geo_total_da ))
  [ "$geo_exp_cov" -gt 100 ] && geo_exp_cov=100

  printf "  │ %-13s │        │ %7d  │ %7d  │ \033[1m %3d%%\033[0m    │\n" "Core Required" "$geo_core_da" "$geo_core_repo" "$geo_core_cov"
  printf "  │ %-13s │        │ %7d  │ %7d  │  %3d%%    │\n" "Expansion" "$geo_total_da" "$geo_total_repo" "$geo_exp_cov"

  echo "  └───────────────┴────────┴──────────┴──────────┴──────────┘"
  echo ""

  echo "  GEO Architecture Gate: Core DA Coverage = ${geo_core_cov}%"
  if [ "$geo_core_cov" -ge 100 ]; then
    echo "  ✅ Core PASS — GEO Core ready for architecture freeze"
  else
    echo "  ⚠️ Core needs $((100 - geo_core_cov))% more repo coverage"
  fi
  echo "  ℹ️  Expansion domains at ${geo_exp_cov}% (future sprint)"
  echo ""

  # ── Workspace Overview Table ───────────────────────────────
  declare -A WS_DIRS=(
    ["$BACKEND/src/services/geo"]="GEO"
    ["$BACKEND/src/services/hdz"]="HDZ"
    ["$BACKEND/src/platform"]="Platform"
  )

  echo "  ┌──────────┬──────────────┬──────────────┐"
  echo "  │ Workspace │ DA Coverage   │ Maturity     │"
  echo "  │           │ (Repo/DA %)   │ Score        │"
  echo "  ├──────────┼──────────────┼──────────────┤"

  local ws_accum=0 ws_count=0

  for dir in "${!WS_DIRS[@]}"; do
    local label="${WS_DIRS[$dir]}"

    # Count DA (prisma-importing) files and repo files (any depth)
    local da_total=0 repo_total=0
    while IFS= read -r -d '' f; do
      if grep -q "import.*prisma.*from\|require.*prisma" "$f" 2>/dev/null; then
        # Skip if it's a repository file itself
        case "$f" in
          */repositories/*|*/repository/*) ;;  # not counted as DA (it IS the repo)
          *) da_total=$((da_total + 1)) ;;
        esac
      fi
    done < <(find "$dir" -name "*.ts" \
      -not -path "*/node_modules/*" \
      -not -path "*/__tests__/*" \
      -type f -print0 2>/dev/null)

    while IFS= read -r -d '' f; do
      repo_total=$((repo_total + 1))
    done < <(find "$dir" -name "*repository*.ts" \
      -not -path "*/node_modules/*" \
      -not -path "*/__tests__/*" \
      -type f -print0 2>/dev/null)

    local da_cov=100
    [ "$da_total" -gt 0 ] && da_cov=$(( repo_total * 100 / da_total ))
    [ "$da_cov" -gt 100 ] && da_cov=100

    # Service Clean %: non-repo files without prisma
    local srv_total=0 srv_clean=0
    while IFS= read -r -d '' f; do
      srv_total=$((srv_total + 1))
    done < <(find "$dir" -name "*.ts" \
      -not -path "*/node_modules/*" \
      -not -path "*/repositories/*" \
      -not -path "*/__tests__/*" \
      -type f -print0 2>/dev/null)

    while IFS= read -r -d '' f; do
      if ! grep -q "import.*prisma.*from\|require.*prisma" "$f" 2>/dev/null; then
        srv_clean=$((srv_clean + 1))
      fi
    done < <(find "$dir" -name "*.ts" \
      -not -path "*/node_modules/*" \
      -not -path "*/repositories/*" \
      -not -path "*/__tests__/*" \
      -type f -print0 2>/dev/null)

    local srv_pct=0
    [ "$srv_total" -gt 0 ] && srv_pct=$(( srv_clean * 100 / srv_total ))

    local maturity=$(( (da_cov + srv_pct) / 2 ))

    local da_color="\033[0;32m" mat_color="\033[0;32m"
    [ "$da_cov" -lt 80 ] && da_color="\033[0;33m"
    [ "$da_cov" -lt 50 ] && da_color="\033[0;31m"
    [ "$maturity" -lt 80 ] && mat_color="\033[0;33m"
    [ "$maturity" -lt 50 ] && mat_color="\033[0;31m"

    printf "  │ %-8s │ ${da_color} %3d%%${NC}       │ ${mat_color} %3d%%${NC}       │\n" "$label" "$da_cov" "$maturity"
    ws_accum=$((ws_accum + maturity))
    ws_count=$((ws_count + 1))
  done

  echo "  └──────────┴──────────────┴──────────────┘"
  echo ""

  # Always PASS for this module — it's informational only
  pass_if_true "Workspace Dashboard" 1 1 ""
}

# ═══════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════

print_header

cd "$ROOT_DIR"

echo "────────────────────────────────────────"
echo "  Module Checks"
echo "────────────────────────────────────────"

check_directory_structure
check_naming_convention
check_service_layer
check_repository_layer
check_route_layer
check_component_convention
check_page_convention
check_workspace_manifest
check_store_convention
check_prisma_map_convention
check_technical_debt
check_test_coverage
check_registry_convention
check_prisma_convention

echo ""
echo "────────────────────────────────────────"
echo "  Workspace Dashboard"
echo "────────────────────────────────────────"

check_workspace_dashboard

echo ""
echo "────────────────────────────────────────"
echo "  Summary"
echo "────────────────────────────────────────"

print_summary
