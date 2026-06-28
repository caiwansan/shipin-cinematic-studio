# ADR-004: Event Model

## Decision
All Runtime events must use the **Platform Event Bus** (`platform/events/event-bus.ts`). No Runtime may define its own in-memory event bus or EventEmitter. Events must follow the canonical naming convention:
```
{domain}:{EventCategory}
```
Where `EventCategory` is one of: `Created`, `Loaded`, `Updated`, `Deleted`, `Started`, `Completed`, `Failed`, `Cancelled`, `Published`, `Archived`.

## Context
The audit found 4 separate in-memory event bus implementations:
1. **Asset Runtime**: `asset.service.ts` — `eventListeners: Map<AssetEventType, Array<(event: AssetEvent) => void>>`
2. **Semantic Runtime**: `semantic.service.ts` — `eventListeners: Map<SemanticEventType, Array<(event: SemanticEvent) => void>>`
3. **Goal Runtime**: `goal.runtime.ts` — `eventListeners: Map<GoalEventType, Array<(event: GoalEvent) => void>>`
4. **Capability Platform**: `events/capability-events.ts` — `CapabilityEventBus` class (the most mature)

Each has slightly different API, different event types, and different error handling (silent try/catch in most).

## Alternatives
1. **EventEmitter** (Node.js built-in) — simplest but lacks typed event types
2. **Redis pub/sub** — over-engineered for in-process events
3. **Message queue** — deferred to V4 for cross-process events

## Consequences
- **Positive**: Single event infrastructure; cross-Runtime event subscriptions; uniform observability
- **Negative**: Migration needed for existing event subscribers
- **Note**: The Capability EventBus (`capability-events.ts`) is closest to the target and can serve as reference
