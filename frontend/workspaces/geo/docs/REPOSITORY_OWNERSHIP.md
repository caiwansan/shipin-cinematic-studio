# Repository Ownership — GEO Workspace

**Status**: Canonical
**Scope**: S1.2C domain boundaries
**Principle**: One Repository per Domain. No overlap. No ambiguity.

## Ownership Table

| Repository | Owner Domain | Producer Domain | Consumer(s) | Source of Truth |
|------------|-------------|-----------------|-------------|-----------------|
| `ProjectRepository` | Project | Project | Dashboard, All Pages | `API /project` |
| `DiscoveryRepository` | Discovery | Discovery | DiscoveryLabPage | `API /discovery` |
| `RecommendationRepository` | Recommendation | Recommendation | RecommendationsPage | `API /recommendation` |
| `MissionRepository` | Mission | Mission | MissionCenterShell | `API /mission` |
| `VerificationRepository` | Verification | Verification | VerificationPage | `API /verification` |
| `TimelineRepository` | Timeline | All Domains (read-only) | MissionCenter (ActivityHub Tab) | Aggregated from all repositories |
| `KnowledgeRepository` | Knowledge | Knowledge (future) | KnowledgePage (future) | `API /knowledge` |
| `PublishingRepository` | Publishing | Publishing (future) | PublishingPage (future) | `API /publishing` |

## Rules

### 1. No Shared Ownership
A Domain maps to exactly one Repository. If two repositories touch the same API endpoint, that is a defect.

### 2. Consumer ≠ Owner
Just because a Page reads from a Repository does not mean it owns it. The Page is a Consumer. The Repository's Domain owns the data.

### 3. Timeline is Read-Only
TimelineRepository reads from all other repositories. It never writes. It never conflicts. It is the only shared consumer.

### 4. Cross-Domain Events
When Domain A completes an action that Domain B needs:
- Domain A's Repository emits the event
- Domain B's Repository listens and refreshes
- No direct method call between repositories
- No Repository calls another Repository's methods

## Event ↔ Repository Mapping

```
DISCOVERY:COMPLETED          → DiscoveryRepository emits
RECOMMENDATION:GENERATED     → RecommendationRepository emits
MISSION:CREATED              → MissionRepository emits
MISSION:COMPLETED            → MissionRepository emits
VERIFICATION:READY           → VerificationRepository emits
```

Each event has exactly one producer. TimelineRepository listens to all.

## Anti-Patterns

❌ `DiscoveryRepository` calls `RecommendationRepository.refresh()` directly
→ Should emit `DISCOVERY:COMPLETED`, RecommendationRepository listens via EventBus

❌ `MissionCenterShell` directly fetches data from both `MissionRepository` and `RecommendationRepository` in one component
→ MissionCenterShell uses only `MissionRepository` for its own data. If it needs recommendation context, that comes via EventBus payload or shared state

❌ Two repositories both claim `GET /api/geo/discovery`
→ Only DiscoveryRepository owns discovery data

## Future Expansion

When Knowledge or Publishing domains are added:
1. Create a new Repository file in `lib/`
2. Register it in Producer Registry
3. Add events to the event catalog
4. Verify no existing Repository claims the same API prefix
5. Append to this document

## Version History

| Date | Version | Change |
|------|---------|--------|
| 2026-07-04 | 1.0 | Initial — S1.2C scope |
