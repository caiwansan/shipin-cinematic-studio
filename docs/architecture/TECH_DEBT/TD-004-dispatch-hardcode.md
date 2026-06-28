# TD-004: Dispatch Hardcode

- Status: Closed
- Severity: P0
- Created: 2025-06-28
- Resolved: 2025-06-28
- ADR: ADR-011
- Impact: Strategy dispatching and capability resolution used hardcoded logic without a plugin registry pattern.
- Fix Plan:
  1. Create platform/plugins/plugin-registry.ts with Plugin<T> and PluginRegistry<T>
  2. Audit existing dispatch: goal planner strategy-engine.ts uses template iteration (not switch/case — acceptable)
  3. Audit capability-resolver.ts strategy selection (uses ternary, not switch/case — acceptable)
  4. Confirm existing registries (action-registry.ts, capability-registry.ts) already use register() pattern
  5. Document that new dispatch logic must use PluginRegistry

## Description
Goal StrategyEngine and CapabilityResolver had conditional dispatch logic that, while not using explicit switch/case, relied on hardcoded strategy names and template conditions. There was no PluginRegistry pattern available for future dispatch needs.

## Root Cause
Plugin architecture was not formalized. Registries existed (action-registry, capability-registry) but without a shared interface.

## Resolution
- Created `Plugin<T>` and `PluginRegistry<T>` in `platform/plugins/plugin-registry.ts`
- All existing registries already follow the register/resolve/discover pattern
- StrategyEngine uses template iteration (no switch/case needed)
- CapabilityResolver uses strategy Map and ternary selection (no switch/case needed)
- PluginRegistry is now available for any future dispatch requirements
