# GEO Sprint 1B — Knowledge Quality Layer

> **Project**: KMKI-GEO  
> **Sprint**: 1B  
> **Status**: ✅ Approved (with revisions) — Awaiting Execution Start  
> **Review**: XiongDa, 2026-07-02  
> **Revisions applied**:  
> 1. Data relationship constraint: all knowledge objects anchor to Entity, NOT Project  
> 2. Agent output contract: uniform envelope across all 5 agents (confidence, provenance, lineage, diagnostics)  
> 3. B4 split: B4A (Route + Workflow) → B4B (Dual Score, dependent on all 5 objects existing)  
> 4. DoD expanded: 12 criteria + 3 data relationship checks + 3 runtime compliance checks  
> 5. Sprint 1C models reserved: GEOBenchmarkRecord, GEOScoreSnapshot, GEOOptimizationHistory  
> **Date**: 2026-07-02  
> **Prerequisite**: KMKI-DOC-001 complete, GEO Sprint 1A frozen (`geo-v1-sprint1a`)

---

## 1. Objective

Build the **Knowledge Quality Layer** on top of Sprint 1A's Knowledge Skeleton (Entity + Relation + Graph).

Sprint 1A established the structural layer: entities, relations, and graph topology.  
Sprint 1B adds the **semantic quality layer**: claims, evidence, citations, FAQ, schema markup, freshness management, and review workflow.

### Sprint 1A Recap (Frozen)

```
Research → Entity Discovery → Graph Build
                ↓
         Knowledge Skeleton
           (Entity + Relation)
```

### Sprint 1B Target

```
Knowledge Skeleton (1A)
       ↓
Claim Generation ──→ Evidence Collection ──→ Citation Formatting
       ↓                     ↓
  FAQ Builder ──────→ Schema Markup ──────→ Knowledge Quality Score
       ↓
  Review Queue ─────→ Freshness Management
```

---

## 2. Scope

### 2.1 New Data Models (Prisma)

All five knowledge objects need new database models, following the same naming convention as Sprint 1A (`kmki_geo_*`):

| Model | Description | Key Fields |
|-------|-------------|------------|
| `GEOClaim` | Authoritative claim derived from an Entity | entityId (REQUIRED), text, confidence, sourceType, status, provenance |
| `GEOEvidence` | Supporting evidence for a claim | claimId (REQUIRED), source, content, credibilityScore, collectedAt |
| `GEOCitation` | Formatted citation | evidenceId (REQUIRED), format (APA/MLA/custom), citationText, sourceUrl |
| `GEOFAQ` | Question-answer pair linked to Entity | entityId (REQUIRED), question, answer, schemaType, confidence |
| `GEOSchemaMarkup` | Schema.org compliant structured data | entityId (REQUIRED), schemaType, markup JSON, validationStatus |

### Data Relationship Constraint

```
Entity ───→ Claim ───→ Evidence ───→ Citation
  │
  ├──→ FAQ
  └──→ SchemaMarkup
```

**Critical rule**: All knowledge objects MUST anchor to `Entity` (via `entityId`), NOT directly to `Project`. The `GEOProject` owns the workspace; `Entity` owns the knowledge. This ensures the Knowledge Graph stays graph-structured rather than degrading into a document tree.

Foreign key references:
- `GEOClaim.entityId` → `GEOEntity.id`
- `GEOEvidence.claimId` → `GEOClaim.id`
- `GEOCitation.evidenceId` → `GEOEvidence.id`
- `GEOFAQ.entityId` → `GEOEntity.id`
- `GEOSchemaMarkup.entityId` → `GEOEntity.id`

And supporting models:

| Model | Description |
|-------|-------------|
| `GEOReviewQueue` | Review checkpoint items (claims awaiting approval) |
| `GEOQualityScore` | Knowledge quality snapshot (Composite + 4 dimensions) |
| `GEOFreshnessRecord` | Freshness tracking per knowledge object |

### Sprint 1C Reservations (Schema-only, no usage in Sprint 1B)

These models are added to `schema.prisma` in B1 but left **unused** until Sprint 1C:

| Model | Purpose in Sprint 1C | Why Reserve Now |
|-------|----------------------|-----------------|
| `GEOBenchmarkRecord` | Stores per-model benchmark results (Knowledge Score + LLM Visibility Score for each LLM provider) | Avoid schema migration in Sprint 1C; seed table in 1B |
| `GEOScoreSnapshot` | Point-in-time snapshot of all quality scores for trend analysis | Base for Benchmark Center and optimization history |
| `GEOOptimizationHistory` | Tracks optimization actions taken per Entity/Claim (gap detected → action → re-score) | Required for Multi-LLM Optimization agent in Sprint 1C |

### 2.2 New Agents

| Agent | PLAT Runtime | Input | Output |
|-------|-------------|-------|--------|
| **Claim Agent** | PLAT-010 | Knowledge Graph (Entity + Relation) | GEOClaim[] |
| **Evidence Agent** | PLAT-010 | GEOClaim[] | GEOEvidence[] per claim |
| **Citation Agent** | PLAT-010 | GEOEvidence[] | GEOCitation[] |
| **FAQ Agent** | PLAT-010 | Knowledge Graph + Claims | GEOFAQ[] |
| **Schema Agent** | PLAT-010 | All knowledge objects | GEOSchemaMarkup[] |

### Agent Output Contract (Uniform)

All 5 agents MUST produce output following this schema:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `objectType` | `string` | ✅ | One of: `claim`, `evidence`, `citation`, `faq`, `schema` |
| `data` | `object[]` | ✅ | The actual knowledge objects |
| `confidence` | `number` (0–1) | ✅ | Agent confidence in output quality |
| `provenance` | `ProvenanceRecord` | ✅ | Who/what generated this output |
| `lineage` | `LineageRecord[]` | ✅ | Trace path from input to output |
| `diagnostics` | `{ tokensUsed, model, latencyMs, warnings }` | ✅ | Execution diagnostics for benchmarking |

**Why uniform**: Every agent's output uses the same envelope. Benchmarking, gap analysis, and optimization become trivial — just iterate over `confidence` and `diagnostics` on a known structure. Without this, Sprint 1C Benchmark would require N different parsers for N agents.

### 2.3 New Services

| Service | Purpose |
|---------|---------|
| `geo-claim.service.ts` | CRUD + quality filter for claims |
| `geo-evidence.service.ts` | Evidence aggregation + credibility scoring |
| `geo-citation.service.ts` | Citation formatting engine |
| `geo-faq.service.ts` | FAQ management |
| `geo-schema.service.ts` | Schema validation + generation |
| `geo-review.service.ts` | Review queue management |
| `geo-quality.service.ts` | Composite quality scoring |
| `geo-freshness.service.ts` | Freshness tracking + staleness detection |

### 2.4 Workflow DAG (PLAT-011)

A single GEO Knowledge Quality workflow:

```
GEO_KNOWLEDGE_QUALITY_WORKFLOW
        │
        ▼
  ┌─────────────┐
  │ SkeletonReady│ ← Trigger: Sprint 1A complete
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐     ┌──────────────────┐
  │ ClaimBuild   │────→│ ClaimReview      │ ← Human checkpoint (optional)
  └─────────────┘     └────────┬─────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  ┌───────────┐       ┌──────────────┐      ┌───────────┐
  │EvidenceGather│      │  FAQBuild     │      │ SchemaBuild│
  └──────┬─────┘       └──────────────┘      └──────┬────┘
         │                                          │
         ▼                                          │
  ┌──────────────┐                                  │
  │ CitationBuild │                                  │
  └──────┬───────┘                                  │
         │                                          │
         └──────────────────┬───────────────────────┘
                            ▼
                  ┌─────────────────┐
                  │ QualityScore     │
                  └──────┬──────────┘
                         ▼
                  ┌─────────────────┐
                  │ FreshnessTrack   │ ← Periodic refresh
                  └─────────────────┘
```

### 2.5 Dual Score Integration

Sprint 1A's Entity graph had no scoring. Sprint 1B adds the Dual Score System (spec'd in GEO-V1-SPEC.md):

| Score | Dimensions | Enabled By |
|-------|-----------|------------|
| **Knowledge Score** | Authority + Coverage + Evidence + Schema | Claims + Evidence + Schema agents |
| **LLM Visibility Score** | Retrieval + Entity + Semantic + Response | Schema markup + structured data |

---

## 3. Architecture Constraints

| Rule | Description |
|------|-------------|
| **No direct Prisma** | All DB access through Repository layer |
| **No direct Runtime calls** | Route → (SDK) → Service → Repository |
| **Use PLAT-010 Agent** | All agents register via Agent Runtime |
| **Use PLAT-011 Workflow** | Orchestration via Workflow Runtime DAG |
| **PlatformContext first param** | All service methods accept `ctx: PlatformContext` |
| **All throws use PlatformError** | No bare `new Error()` |
| **Freshness via timestamps + config** | Not real-time; configurable TTL per object type |
| **Review states use GEO ReviewState** | `draft → review → approved/rejected` (from existing enum) |

### Prisma Generation Requirements

After adding new models to `schema.prisma`:
1. `npx prisma generate` — regenerate client
2. Type-check via `npx tsc --noEmit` — verify service code compiles
3. New files should be idempotent: safe to run multiple times

### File Naming Convention

```
backend/src/services/geo/
├── agents/
│   ├── claim.agent.ts        ← new
│   ├── evidence.agent.ts     ← new
│   ├── citation.agent.ts     ← new
│   ├── faq.agent.ts          ← new
│   └── schema.agent.ts       ← new
├── services/
│   ├── geo-claim.service.ts      ← new
│   ├── geo-evidence.service.ts   ← new
│   ├── geo-citation.service.ts   ← new
│   ├── geo-faq.service.ts        ← new
│   ├── geo-schema.service.ts     ← new
│   ├── geo-review.service.ts     ← new
│   ├── geo-quality.service.ts    ← new
│   └── geo-freshness.service.ts  ← new
├── routes/
│   ├── geo-entity.route.ts    ← Sprint 1A
│   ├── geo-graph.route.ts     ← Sprint 1A
│   ├── geo-project.route.ts   ← Sprint 1A
│   ├── geo-claim.route.ts     ← new
│   ├── geo-evidence.route.ts  ← new
│   ├── geo-faq.route.ts       ← new
│   └── geo-review.route.ts    ← new
├── repositories/
│   ├── geo-claim.repository.ts      ← new
│   ├── geo-evidence.repository.ts   ← new
│   ├── geo-citation.repository.ts   ← new
│   ├── geo-faq.repository.ts        ← new
│   ├── geo-schema.repository.ts     ← new
│   ├── geo-review.repository.ts     ← new
│   ├── geo-quality.repository.ts    ← new
│   └── geo-freshness.repository.ts  ← new
├── types.ts                   ← Sprint 1A (extend with new types)
├── registry/geo-registry.ts   ← Sprint 1A
└── index.ts                   ← Sprint 1A (extend exports)
```

---

## 4. Implementation Phases

### Phase B1: Data Model & Repository (Foundation)

**Files**: `schema.prisma` (add 8 new models) + 8 new repository files

**Deliverables**:
- Prisma schema: GEOClaim, GEOEvidence, GEOCitation, GEOFAQ, GEOSchemaMarkup, GEOReviewQueue, GEOQualityScore, GEOFreshnessRecord
- `prisma generate` runs clean
- 8 repository files with CRUD
- Repository compliance: each extends `BaseRepository<T>` pattern

**No code written beyond data layer in this phase.**

### Phase B2: Service Layer

**Files**: 8 new service files

**Deliverables**:
- Claim service: create/update/query/filter by quality
- Evidence service: aggregate + credibility score
- Citation service: format (APA/MLA/custom)
- FAQ service: manage Q&A pairs
- Schema service: validate + generate schema.org JSON-LD
- Review service: queue management + state transitions
- Quality service: composite score calculation
- Freshness service: TTL-based staleness detection

### Phase B3: Agent Layer

**Files**: 5 new agent files

**Deliverables**:
- Claim Agent: LLM prompt → extract claims from entity graph
- Evidence Agent: web/corpus search → find evidence for each claim
- Citation Agent: format evidence into citation strings
- FAQ Agent: generate Q&A from graph + claims
- Schema Agent: generate schema.org JSON-LD

Each agent registers via `register*Agent()` (Sprint 1A pattern).

### Phase B4A: Route Layer + Workflow Integration

**Files**: 4 new route files + extend `index.ts` + update `registry/geo-registry.ts`

**Deliverables**:
- REST endpoints for Claim, Evidence, FAQ, Review
- End-to-end test: route → service → repository → DB
- Workflow DAG registration via PLAT-011

**Dual Score NOT yet wired — all 5 knowledge objects must exist in DB first.**

### Phase B4B: Dual Score Integration

**Prerequisite**: B4A complete (Claim + Evidence + Citation + FAQ + Schema all exist and queryable)

**Deliverables**:
- Knowledge Score endpoint (Authority + Coverage + Evidence + Schema)
- LLM Visibility Score endpoint (Retrieval + Entity + Semantic + Response)
- Dual score response includes dimension breakdown + diagnostics
- Score snapshot stored in GEOQualityScore model

---

## 5. Acceptance Criteria

### Must Pass

| # | Criterion | Type |
|---|-----------|------|
| 1 | `prisma generate` runs without warnings | Build |
| 2 | `npx tsc --noEmit` passes with 0 errors | Build |
| 3 | All 5 knowledge objects stored + queryable in DB | Integration |
| 4 | Claim → Evidence → Citation chain completes end-to-end | Integration |
| 5 | FAQ generation produces valid schema-compliant output | Function |
| 6 | Schema markup validates against schema.org spec | Function |
| 7 | Review queue correctly cycles through ReviewState | Integration |
| 8 | Freshness detects stale objects after configurable TTL | Function |
| 9 | Dual score returns non-null values for all 8 dimensions | Integration |
| 10 | No direct `prisma` imports outside repository layer | Compliance |

### Definition of Done (All Must Pass)

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | TypeScript zero new errors | `npx tsc --noEmit` passes with 0 errors |
| 2 | Prisma Migration successful | `prisma migrate dev` runs clean |
| 3 | Frontend build successful | `npm run build` in frontend/ passes |
| 4 | PM2 restart successful | Both processes online (api-server-aigc + frontend) |
| 5 | All 5 agents registered in Agent Runtime | Registry check via agent dispatcher |
| 6 | Workflow DAG passes all Runtime lifecycle steps | Init → Load → Validate → Execute |
| 7 | Workspace Snapshot normal | Snapshot triggers after workflow completes |
| 8 | Version normal | Version increments on re-execution |
| 9 | Provenance complete | Every knowledge object has non-empty `provenance` |
| 10 | Lineage complete | Every claim/evidence/citation has non-empty `lineage` |
| 11 | Freshness tracking active | FreshnessRecord written and queryable |
| 12 | Review Queue functional | State transitions cycle through all ReviewState values |

### Data Relationship Acceptance Criteria

| # | Criterion | Check |
|---|-----------|-------|
| D1 | Entity → Claim correctly | Every GEOClaim has a valid entityId |
| D2 | Claim → Evidence correctly | Every GEOEvidence has a valid claimId |
| D3 | Evidence → Citation correctly | Every GEOCitation has a valid evidenceId |

### Runtime Compliance

| # | Criterion | Check |
|---|-----------|-------|
| R1 | All agents dispatched via Agent Runtime (PLAT-010) | No direct agent invocation |
| R2 | All workflows routed through Workflow Runtime (PLAT-011) | No bypass |
| R3 | No Prisma imports outside repository layer | Architecture Drift Detector = 0 violations |

---

## 6. Estimated Timeline

| Phase | Est. Effort | Dependencies | Gate |
|-------|-------------|--------------|------|
| B1: Data Model + Repository | 3-4h | Sprint 1A frozen | Schema Review before B2 |
| B2: Service Layer | 4-6h | B1 schema review complete | |
| B3: Agent Layer (5 agents, uniform contract) | 5-8h | B2 complete | |
| B4A: Routes + Workflow Integration | 2-3h | B3 complete | |
| B4B: Dual Score Integration | 2-3h | B4A + all 5 knowledge objects exist | |
| Sprint 1B Verification + Fixes | 3-5h | All code phases complete | ALL DoD pass |

### Execution Sequence

```
B1 → Schema Review → B2 → B3 → B4A → B4B → Verification → Freeze (geo-v1-sprint1b)
 ↑                                  ↑
 Create GEOBenchmarkRecord,         Dual Score depends on
 GEOScoreSnapshot,                   Claim + Evidence +
 GEOOptimizationHistory (reserved)    Citation + FAQ + Schema
                                       all queryable
```

---

## 7. Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| LLM hallucination in claim extraction | Medium | Review checkpoint before evidence gathering |
| Evidence source reliability varies | Medium | Credibility scoring + human review gate |
| Schema validation is complex | Low | Use existing `schema.org` validation libraries |
| Freshness violates B1 data model if designed late | Low | Design freshness model in B1 alongside other models |
| Workflow DAG integration with PLAT-011 untested | Medium | Test workflow registration in isolation first |

---

## 8. Out of Scope

- UI for GEO Knowledge Quality (frontend Sprint)
- Brand GEO Phase 2 models (`GeoProject`, `GeoBrandProfile`, etc.)
- Full-text search across knowledge objects
- Real-time freshness monitoring
- Cross-project knowledge merging

---

*End of GEO-SPRINT-1B-PLAN.md — Awaiting Review*
