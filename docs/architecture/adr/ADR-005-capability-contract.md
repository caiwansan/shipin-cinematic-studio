# ADR-005: Capability Contract

## Decision
All capability interactions must be governed by a **Capability Contract** — a formal definition of:
- Input/Output schema (JSON Schema)
- Constraints (rate limits, budgets)
- Quality profiles (expected score, latency)
- Permission profiles (required roles)

Capabilities are registered in a **Registry**, resolved via a **Resolver** (with pluggable routing strategies), and validated before execution.

## Context
The Capability Platform (`services/platform/capability/`) was already the most mature Runtime:
- Full contract lifecycle (create, validate, resolve, deprecate, remove)
- Pluggable routing strategies (QualityFirst, CostFirst, LatencyFirst, Balanced)
- Registry with in-memory + database persistence
- Event bus with typed events and listener management

However, some patterns drifted:
- `Validator` chain uses `inputValidator → outputValidator → constraintValidator → permissionValidator` but error aggregation is manual
- `Resolver` strategies are registered from `index.ts` rather than self-registering
- No unified PlatformContext in contract methods

## Alternatives
1. **No contracts** — ad-hoc capability calls; rejected for governance requirements
2. **OpenAPI-based** — too heavy; JSON Schema is sufficient for current needs
3. **gRPC service definitions** — deferred; HTTP/REST is fine for V3

## Consequences
- **Positive**: Formal governance; automatic validation; observable capability usage
- **Negative**: Schema maintenance overhead; migration cost for existing ad-hoc calls
- **This is the reference implementation** for future Runtime designs
