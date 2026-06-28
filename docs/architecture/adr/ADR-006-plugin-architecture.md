# ADR-006: Plugin Architecture

## Decision
Hardcoded dispatch logic (switch/case, if-else chains) should be replaced with **Plugin Registries**. Each domain that supports dispatch must:
1. Define a **Plugin Interface** (contract for the plugin)
2. Provide a **Plugin Registry** (registration + lookup)
3. Allow **runtime registration** of new plugins
4. Avoid hardcoded type-to-implementation mapping

## Context
The audit found hardcoded dispatch in:
- `balance/index.ts` — switch/case over provider names (`deepseek`)
- `image/pipeline/validators/core/quality-anchor.ts` — switch/case over quality tiers
- `image/pipeline/decision/` — multiple switch/case blocks for action types
- `visual-constraint/constraint-scoring.ts` — switch/case over check kinds

The **Capability Resolver** already demonstrates the correct pattern:
- Routing strategies implement `RoutingStrategy` interface
- `capabilityResolver.registerStrategy()` adds strategies at runtime
- No switch/case — resolved by strategy name lookup

Similarly, the **Semantic Extractor Registry** and **Goal Action Registry** follow the plugin pattern.

## Alternatives
1. **Hardcoded dispatch** — simple for small projects but doesn't scale
2. **Strategy pattern (ad-hoc)** — already partially used; this ADR codifies it
3. **Dependency injection container** — too heavy for current scale

## Consequences
- **Positive**: Extensible by design; no code changes needed to add new dispatch targets
- **Negative**: More boilerplate for simple dispatch; indirection can reduce readability
- **Migration path**: Convert identified switch/case blocks to registries incrementally
