# Event Sequence Diagram — GEO Workspace

**Status**: Canonical
**Scope**: S1.2C flow events + extension points
**Format**: Mermaid sequence diagram

## S1.2C Flow (Discovery → Recommendation → Mission → Verification)

```mermaid
sequenceDiagram
    participant User
    participant DiscoveryPage
    participant RecPage
    participant MissionPage
    participant VerifyPage
    participant EventBus
    participant Timeline

    User->>DiscoveryPage: Start scan
    DiscoveryPage->>EventBus: DISCOVERY:COMPLETED
    EventBus-->>RecPage: auto-refresh
    RecPage->>EventBus: RECOMMENDATION:GENERATED
    EventBus-->>MissionPage: show ready state
    User->>MissionPage: Create Mission
    MissionPage->>EventBus: MISSION:CREATED
    User->>MissionPage: Complete Mission
    MissionPage->>EventBus: MISSION:COMPLETED
    EventBus-->>VerifyPage: auto-enable
    VerifyPage->>EventBus: VERIFICATION:READY
    EventBus-->>Timeline: append all events
```

## Event Catalog

| Event | Producer Domain | Emitted By | Payload | Consumers |
|-------|----------------|------------|---------|-----------|
| `PROJECT:CREATED` | Project | ProjectRepository | `{ projectId, name }` | Dashboard |
| `DISCOVERY:COMPLETED` | Discovery | DiscoveryRepository | `{ projectId, reportId, summary }` | RecommendationRepository, Timeline |
| `RECOMMENDATION:GENERATED` | Recommendation | RecommendationRepository | `{ projectId, recommendationCount }` | MissionRepository, Timeline |
| `MISSION:CREATED` | Mission | MissionRepository | `{ missionId, title }` | Timeline |
| `MISSION:COMPLETED` | Mission | MissionRepository | `{ missionId, completedAt }` | VerificationRepository, Timeline |
| `VERIFICATION:READY` | Verification | VerificationRepository | `{ missionId, verificationId }` | Timeline |

## Extension Points (Future Sprints)

```mermaid
sequenceDiagram
    participant KnowledgePage
    participant PubPage
    participant EventBus

    Note over KnowledgePage,EventBus: S1.2D / S1.3
    KnowledgePage->>EventBus: KNOWLEDGE:EXTRACTED
    KnowledgePage->>EventBus: KNOWLEDGE:PUBLISHED
    PubPage->>EventBus: PUBLISH:SUBMITTED
    PubPage->>EventBus: PUBLISH:LIVE
```

When adding new events:

1. Add to this catalog
2. Register in Producer Registry
3. Add consumer listener in target Repository
4. Verify no naming collision with existing events
5. Verify exactly one producer per event

## Event Naming Convention

```
{SOURCE_DOMAIN}:{ACTION_PERFORMED}
```

- UPPER_SNAKE_CASE
- Domain prefix mandatory
- Past tense for completed actions
- No verbs like "get", "fetch", "load" (those are not events, they are data access)

✅ `DISCOVERY:COMPLETED`
✅ `MISSION:CREATED`
❌ `getDiscoveryResults` (RPC call, not an event)
❌ `Mission_created` (wrong casing)
❌ `RECOMMENDATION:GENERATED:COMPLETED` (over-nested)

## Version History

| Date | Version | Change |
|------|---------|--------|
| 2026-07-04 | 1.0 | Initial — S1.2C scope + extension points |
