# ADR-001: Runtime Layering

## Decision
All Runtimes (Asset, Semantic, Goal, Capability, Scanner) must follow a strict three-layer dependency architecture:

```
Route → Runtime → Service → Repository → Prisma
```

Each layer may only depend on the layer directly below it:
- **Routes** may call **Runtime** (via Platform SDK in the future)
- **Runtime** may call **Service** (orchestration/business logic)
- **Service** may call **Repository** (data access)
- **Repository** may call **Prisma Client** (only)
- No layer may skip a level (e.g., Runtime calling Prisma directly)

## Context
The original codebase had inconsistent layering:
- Some Runtime files (`goal.runtime.ts`) correctly used Repository pattern
- Other files (`asset.service.ts`) had inline `import { prisma }` with dynamic imports for ad-hoc queries
- Event systems were duplicated across each Runtime (4 in-memory event bus implementations)
- There was no unified PlatformContext, causing opaque method signatures
- Workspace code sometimes imported Runtime internals directly

## Alternatives
1. **No layering** — keep flat imports; rejected due to growing complexity
2. **Single mega-service** — rejected; violates separation of concerns
3. **Dependency injection container** — considered over-engineering for current scale; deferred to V4

## Consequences
- **Positive**: Clear dependency direction; easy to reason about data flow; testable layers
- **Negative**: More files per feature; requires discipline in code review
- **Migration**: Existing violations (see ARCH-001-A report) must be fixed incrementally
