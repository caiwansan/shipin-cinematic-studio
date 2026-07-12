# Engine Matrix — GEO Workspace

**Sprint:** P2-01
**Type:** Audit Only
**Last Updated:** 2026-07-27

---

## 1. Knowledge Intelligence Engine (KIE)

**Location:** `backend/src/engines/knowledge-intelligence/`
**Status:** ✅ Production (rule-based)

| Field | Value |
|---|---|
| Input | KnowledgeObject[] |
| Processing | 5 Rules: Coverage / Freshness / Citation / Authority / Consistency |
| Output | Assessment[] / Insight[] |
| Consumer | GET /api/geo/knowledge-quality → KnowledgePage |
| Workflow Position | After KO CRUD, before Optimization |
| Completion | 85% |
| Missing | AI upgrade, knowledge graph, real citation data |

---

## 2. Mission Generator

**Location:** `backend/src/services/geo/mission-engine/mission-generator.ts`
**Status:** ❌ Blocked

| Field | Value |
|---|---|
| Input | Action[] |
| Processing | Scores and prioritizes actions into missions |
| Output | Mission[] |
| Current Consumer | GET /api/geo/missions → ❌ Returns empty |
| Workflow Position | After KnowledgeActionAdapter, before Mission API |
| Completion | Engine: 80% / Pipeline: 0% |
| Missing | **KnowledgeActionAdapter not wired** → NO INPUT |

---

## 3. Mission Prioritizer

**Location:** `backend/src/services/geo/mission-engine/`
**Status:** ❌ Blocked (same root cause)

| Field | Value |
|---|---|
| Input | Mission[] (from MissionGenerator) |
| Processing | Sorts by priority score |
| Output | Prioritized Mission[] |
| Consumer | ∅ (no missions to prioritize) |
| Completion | 80% (logic complete, no data) |
| Missing | Same as MissionGenerator — no input |

---

## 4. Verification Engine

**Location:** `backend/src/services/geo/verification/engine.ts`
**Status:** ✅ Production

| Field | Value |
|---|---|
| Input | projectId |
| Processing | Runs verification checks, generates evidence timeline |
| Output | VerificationResult |
| Consumer | POST /api/geo/verification/run → ✅ VerificationPage |
| Workflow Position | After Mission Execute / Recommendation Execute |
| Completion | 70% |
| Missing | DB-persisted job runner (currently in-memory) |

---

## 5. Health Engine

**Location:** `backend/src/services/geo/monitor/` (service-level, no dedicated engine directory)
**Status:** 🔶 Partial (service-level, not a standalone engine)

| Field | Value |
|---|---|
| Input | projectId |
| Processing | Calculates health score from multiple dimensions |
| Output | HealthScore + Dimensions |
| Consumer | GET /api/geo/health/:projectId → ✅ HealthPage |
| Workflow Position | After Verification |
| Completion | 60% |
| Missing | No formal Engine class; check-published / check-indexed have no UI |

---

## 6. Growth Engine

**Location:** `backend/src/services/geo/growth/`
**Status:** 🔶 Partial (service-level)

| Field | Value |
|---|---|
| Input | projectId, events |
| Processing | Tracks growth metrics over time |
| Output | GrowthReport |
| Consumer | GET /api/geo/growth/:projectId → ✅ GrowthPage |
| Workflow Position | After Health |
| Completion | 55% |
| Missing | No cross-module data integration (verification/knowledge/health all feed into growth) |

---

## 7. Discovery Engine

**Location:** ❌ Does not exist as product engine
**Current:** `benchmark/discovery/mock-scanner` (test only)
**Status:** ❌ Not in IA — requires full rebuild

| Field | Value |
|---|---|
| Input | — |
| Processing | — |
| Output | — |
| Consumer | ❌ Removed from IA |
| Completion | 0% (product-level) |

---

## 8. Presence Engine

**Location:** `backend/src/services/geo/presence/engine.ts`
**Status:** 🔶 Simulated

| Field | Value |
|---|---|
| Input | projectId, brandName |
| Processing | Checks AI platform mentions |
| Output | PresenceResult[] |
| Consumer | GET /api/geo/presence/:projectId → ✅ BrandOverview |
| Workflow Position | Brand detail |
| Completion | 60% |
| Missing | Most adapters (chatgpt, deepseek, claude, xinghuo, doubao) exist but data quality unknown |

---

## 9. Explain Engine

**Location:** `backend/src/services/geo/explain/providers/`
**Status:** ✅ Production

| Field | Value |
|---|---|
| Input | domain + entityId |
| Processing | Multiple ExplainProviders (discovery, recommendation, mission, execution, presence) |
| Output | ExplainResult |
| Consumer | POST /api/geo/explain → ✅ BrandOverview explain drawer |
| Completion | 75% |

---

## 10. KnowledgeActionAdapter

**Location:** `backend/src/services/geo/mission-engine/` (as part of mission-engine)
**Status:** ❌ BROKEN

| Field | Value |
|---|---|
| Input | KIE Insight |
| Processing | Transforms KIE Insight into Action recommendations |
| Output | Action[] |
| Consumer | ❌ Not wired to any production data flow |
| Completion | 50% (code exists, no product integration) |
| Missing | **This is the #1 blocker for the entire Mission pipeline** |

---

## 11. Timeline Engine

**Location:** `backend/src/services/geo/workspace/timeline.ts` (service, not engine)
**Status:** ❌ Not production

| Field | Value |
|---|---|
| Input | events |
| Storage | In-memory only |
| Output | TimelineEvent[] |
| Consumer | ❌ No UI, no persistence |
| Completion | 20% |
| Missing | DB persistence, UI component, cross-module event integration |

---

## 12. Distribution Engine (Platform-level)

**Location:** `backend/src/platform/knowledge-hub/distribution/distribution-engine.ts`
**Status:** ❌ Not integrated into GEO

| Field | Value |
|---|---|
| Input | KnowledgePackage |
| Processing | Distributes to channels |
| Output | DistributionResult |
| Consumer | ❌ Not wired to GEO Publishing |
| Completion | 60% (platform) / 0% (GEO integration) |

---

## 13. Observable Engine (Platform-level)

**Location:** `backend/src/platform/knowledge-hub/monitoring/observability-engine.ts`
**Status:** ❌ Not integrated into GEO

---

## Summary

| Engine | Status | Consumer | Input Source | Output Destination | Completion |
|---|---|---|---|---|---|
| KIE | ✅ Production | KnowledgePage | KnowledgeObject | Insight[] | 85% |
| MissionGenerator | ❌ Blocked | MissionPage (empty) | Action[] (missing) | Mission[] | 80% / pipeline 0% |
| MissionPrioritizer | ❌ Blocked | ∅ | Mission[] (missing) | Mission[] | 80% / pipeline 0% |
| VerificationEngine | ✅ Production | VerificationPage | projectId | VerificationResult | 70% |
| HealthEngine | 🔶 Partial | HealthPage | projectId | HealthScore | 60% |
| GrowthEngine | 🔶 Partial | GrowthPage | projectId + events | GrowthReport | 55% |
| PresenceEngine | 🔶 Simulated | BrandOverview | brandName | PresenceResult | 60% |
| ExplainEngine | ✅ Production | BrandOverview | domain + id | ExplainResult | 75% |
| KnowledgeActionAdapter | ❌ Broken | ∅ | KIE Insight | Action[] | 50% |
| TimelineEngine | ❌ Not prod | ∅ | events | TimelineEvent[] | 20% |
| DiscoveryEngine | ❌ Missing | ∅ | — | — | 0% |
| DistributionEngine | ❌ Not integrated | ∅ | KnowledgePackage | DistributionResult | 0% GEO |

**Live Engines:** 3 (KIE, Verification, Explain)
**Partial Engines:** 3 (Health, Growth, Presence)
**Broken/Blocked/NotProd:** 6 (Mission Generator, Mission Prioritizer, KnowledgeActionAdapter, Timeline, Discovery, Distribution)
