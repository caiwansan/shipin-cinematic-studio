# GEO v4 Platform Infrastructure

This directory contains shared platform infrastructure for the GEO v4 Verification Engine.

## Structure

```
platform/
├── contracts/          # Domain Contract (Freeze⑪) — all DTOs shared across layers
├── state-machine/      # State Machine Registry (Freeze④) — unified status transitions
├── repository/         # Repository Interfaces (Freeze⑤) — abstract data access
├── event-bus/          # Domain Event Bus (Freeze⑥) — event-driven communication
└── version/            # Version Registry (Freeze⑦+⑬) — version tracking with metadata
```

## Freeze Compliance

| Freeze | Status | Module |
|--------|--------|--------|
| ④ State Machine | Not started | `state-machine/` |
| ⑤ Repository Interface | Not started | `repository/` |
| ⑥ Event Bus | Not started | `event-bus/` |
| ⑪ Domain Contract | Not started | `contracts/` |
| ⑬ Version Registry | Not started | `version/` |
