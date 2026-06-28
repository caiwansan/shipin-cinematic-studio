#!/bin/bash
# System Validation Test Runner
# Run: bash tests/run.sh
#
# Tests the core Kernel, Async, Persistence, and Mutation Engine modules.

set -e

cd "$(dirname "$0")/.."
echo "============================================================"
echo "  EGOS Kernel — System Validation Suite"
echo "============================================================"
echo ""
echo "Working directory: $(pwd)"
echo ""

# Track results
total=0
passed=0
failed=0

run_test() {
  local name="$1"
  local file="$2"
  total=$((total + 1))

  printf "  [%02d/%05d] %-45s" "$total" "5" "$name"

  if npx tsx "$file" > /dev/null 2>&1; then
    echo "✅ PASS"
    passed=$((passed + 1))
  else
    echo "❌ FAIL"
    failed=$((failed + 1))
    # Show failure details
    echo ""
    echo "  ┌─ Failure details ──────────────────────"
    npx tsx "$file" 2>&1 | grep -E "❌|Error:" | sed 's/^/  │ /'
    echo "  └─────────────────────────────────────────"
    echo ""
  fi
}

echo "--- Core Modules ---"
run_test "Execution Mode Resolution"             "tests/kernel/01-execution-mode.test.ts"
run_test "Async State Machine"                  "tests/kernel/02-async-state-machine.test.ts"
run_test "Execution Memory + Feedback Loop"     "tests/kernel/03-execution-memory.test.ts"
run_test "Execution Store + Recovery Engine"    "tests/kernel/04-execution-store-recovery.test.ts"
run_test "Mutation Engine (Phase 7A-2)"         "tests/kernel/05-mutation-engine.test.ts"
run_test "Formal Guard (Phase 7A-3)"          "tests/kernel/06-formal-guard.test.ts"
run_test "Optimization Planner (Phase 7A-4A)" "tests/kernel/07-optimization-planner.test.ts"
run_test "Optimization Executor (Phase 7A-4B)"    "tests/kernel/08-optimization-executor.test.ts"
run_test "Optimization Feedback (Phase 7A-4C)" "tests/kernel/09-optimization-feedback.test.ts"
run_test "Optimization Policy (Phase 7A-4D)" "tests/kernel/10-optimization-policy.test.ts"
run_test "Stress Validation (Phase 7A-5)" "tests/kernel/11-stress-validation.test.ts"
run_test "Benchmark Validation (Phase 7A-6)" "tests/kernel/12-benchmark-validation.test.ts"

echo ""
echo "============================================================"
echo "  RESULTS: $passed/$total passed, $failed failed"
echo "============================================================"

if [ "$failed" -gt 0 ]; then
  exit 1
fi
