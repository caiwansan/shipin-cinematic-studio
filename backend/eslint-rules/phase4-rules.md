# Phase 4.1 — ESLint Rules (for CI Gate)
# Place these in .eslintrc or as a plugin when CI is set up.
# Currently: reference-only. Not wired.

# Rule 1: no-missing-runtime-owner
# Every module in src/runtime/, src/services/, src/routes/, src/agents/,
# src/jobs/, src/scheduler/, src/api/, src/plugins/, src/utils/ must export __RUNTIME_OWNER__
#
# ESLint custom rule skeleton:
# module.exports = {
#   meta: { type: 'suggestion' },
#   create(context) {
#     return {
#       Program(node) {
#         const sourceCode = context.getSourceCode()
#         if (!sourceCode.text.includes('__RUNTIME_OWNER__')) {
#           context.report({
#             node,
#             message: 'Missing __RUNTIME_OWNER__ export. All runtime modules must declare ownership.',
#           })
#         }
#       },
#     }
#   },
# }

# Rule 2: single-entry-domain-enforcement
# No module with OBSERVE mode may contain SYNC/ASYNC/WORKER execution routing.
# No SHADOW module may be imported by a SYNC module (except known exceptions).
#
# Regex-based check:
#   If file has __RUNTIME_OWNER__.mode === "OBSERVE"
#     then forbid: "registerRoute|app\.(post|get|put|delete)|narrativeGateway\.execute"
#
#   If file has __RUNTIME_OWNER__.mode === "SHADOW"
#     then forbid being imported by files with mode !== "SHADOW" and mode !== "LEGACY"
#     exception: graph-runtime is allowed to be imported by pipeline-executor (known debt)

# Rule 3: shadow-module-import-block
# Forbid NEW imports INTO shadow modules (queue/, graph-runtime/, production-loop/).
#
# Check:
#   diff the import graph against a baseline.
#   If a shadow module gains a new import → CI fail.

# Rule 4: invalid-domain-routing
# OBSERVE modules must NOT:
#   - call narrativeGateway.execute()
#   - call provider.registry
#   - register as route handler (except /api/v2/director/*)
