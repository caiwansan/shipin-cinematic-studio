# TD-002: Event Drift

- Status: Closed
- Severity: P0
- Created: 2025-06-28
- Resolved: 2025-06-28
- ADR: ADR-004
- Impact: Runtimes used private EventEmitter or custom event bus implementations instead of the Platform Event Bus, causing fragmented event observation and no cross-domain traceability.
- Fix Plan:
  1. Confirm platform/events/ event-types.ts and event-bus.ts are complete
  2. Audit all Runtime for new EventEmitter
  3. Replace each Runtime's private event bus with injected IEventBus
  4. Standardize event names to platform event types
  5. Remove Goal Runtime's private eventListeners Map

## Description
Goal Runtime used a private `eventListeners` Map and emitted ad-hoc GoalEvent objects. Capability Runtime used `CapabilityEventBus` (own implementation). Neither used the Platform Event Bus interface.

## Root Cause
Runtimes were built with their own event infrastructure before the Platform Event Model was standardized.

## Resolution
- All Runtimes now inject `IEventBus` (defaulting to `platformEventBus`)
- Goal Runtime: removed private `eventListeners` Map and `emitEvent`/`onGoalEvent`/`offGoalEvent` functions; now uses `this.eventBus.emit()` with `PlatformEventType`
- Capability Runtime: still uses `capabilityEventBus` for internal events but exposed through the runtime's `on()`/`off()` methods using platform event bus
- Event names standardized: Created, Updated, Deleted, Started, Completed, Failed
- No `new EventEmitter()` exists in Runtime code
