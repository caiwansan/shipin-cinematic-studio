# ADR-011: Plugin Registry — 统一 register/resolve/discover 插件机制

- Status: Accepted
- Date: 2025-06-28
- Deciders: Platform Architecture Team
- Tags: plugins, dispatch, registry

## Context
ARCH-001 audit revealed redundant registry implementations. Goal Runtime had `actionRegistry` with register/get/execute. Capability Platform had `capabilityRegistry` with register/getByName/list/discover. Strategy engine had hardcoded template iteration. Capability resolver had strategy selection logic. Each registry followed a similar pattern but without a shared interface.

## Decision
Create `Plugin<T>` and `PluginRegistry<T>` in `platform/plugins/plugin-registry.ts`:

1. **Plugin<T>** — base plugin interface with name, type, execute
2. **PluginRegistry<T>** — generic registry with register, resolve, discover, unregister, clear
3. All domain registries (action-registry, capability-registry) continue to work as-is but follow the same register/resolve/discover pattern
4. New dispatch logic must use PluginRegistry instead of switch/case

## Alternatives Considered
- **Require all registries to extend PluginRegistry**: Breaking change for existing code
- **Keep existing registries as-is**: No convergence
- **Strategy pattern with factory**: Over-engineered for current needs

## Consequences
- Uniform plugin registration/discovery across all domains
- New dispatch logic uses PluginRegistry by default
- Existing registries retain their API for backward compatibility
- PluginRegistry is a platform primitive, available to all Runtimes
- Eliminates switch/case hardcoding in core dispatch paths

## Compliance
- Core Runtime code should have no switch/case for dispatch
- New plugin-like features must use PluginRegistry
- PluginRegistry supports both named resolution and type-based discovery
