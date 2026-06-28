# ADR-008: Platform Event Model — 统一事件类型 + Payload Envelope + Event Bus

- Status: Accepted
- Date: 2025-06-28
- Deciders: Platform Architecture Team
- Tags: events, bus, convergence

## Context
ARCH-001 audit revealed fragmented event models. Goal Runtime used a private `eventListeners` Map with `GoalEvent` type. Capability Runtime used `capabilityEventBus` with `CapabilityEvent` type. Neither produced typed, domain-scoped events that could be consumed cross-domain.

## Decision
Standardize on a single `PlatformEvent` interface and `IEventBus` interface in `platform/events/`:

1. **PlatformEvent** — unified payload with type, source, timestamp, context, entityId, projectId, payload, error
2. **PlatformEventType** — typed union of all domain events (asset:*, semantic:*, goal:*, capability:*)
3. **IEventBus** — interface with on(), onAny(), off(), emit(), getHistory(), clear()
4. **InMemoryEventBus** — default in-memory implementation with history
5. **platformEventBus** — singleton instance

All Runtimes inject `IEventBus` instead of creating private event infrastructure. Event types use canonical domain prefixes.

## Alternatives Considered
- **Per-Runtime EventEmitter**: Defeats observability goals
- **Redis/Kafka EventBus from start**: Premature; use InMemoryEventBus now, swap later
- **No typed events**: Would lose compile-time safety for event consumers

## Consequences
- Cross-domain event observation is now possible
- event bus can be swapped for distributed implementation later
- Event history enables observability/debugging
- All events carry context for end-to-end tracing
- Backward compat maintained via optional fields on PlatformEvent

## Compliance
- `grep -rn "new EventEmitter" backend/src/services/` should return no hits
- All Runtime event emissions use `this.eventBus.emit(platformEvent)`
