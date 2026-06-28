# GEO Studio V1 Product & Architecture Specification

> **WARNING**: This is an AI-generated draft. Every section needs human review before implementation. Covers all agreed directions including:

1. ✅ Product Positioning (KOS, not SEO tool)
2. ✅ 15-step Business Workflow with HITL points
3. ✅ Page Layout + Component Inventory
4. ✅ 12-Agent Architecture (Registry, Collaboration, Context)
5. ✅ Workflow DAG with conditional edges + checkpoints
6. ✅ Knowledge Model (Topic, Entity, Claim, Evidence, etc.)
7. ✅ **Knowledge Provenance & Content Lineage** (provenance records, lineage graph, freshness management, 9-state review system)
8. ✅ Data Model (full Prisma schema for GEOProject through GEOAsset)
9. ✅ **Dual Score System**: Knowledge Score + LLM Visibility Score + Benchmark Center
10. ✅ Multi-LLM Strategy (5 target models, per-model variants)
11. ✅ V1→V2 Roadmap (Sprint 1A/1B/1C)


**Document Status**: Draft v0.1  
**Date**: 2025-06-29  
**Version**: V1  
**Platform Baseline**: KMKI Platform V3.0 (Platform Freeze)

---

## Table of Contents

1. [Product Positioning](#1-product-positioning)
2. [Business Workflow](#2-business-workflow)
3. [Page & Interaction Design](#3-page--interaction-design)
4. [Agent Architecture](#4-agent-architecture)
5. [Workflow Orchestration](#5-workflow-orchestration)
6. [Knowledge Model](#6-knowledge-model)
7. [Knowledge Provenance & Content Lineage](#7-knowledge-provenance--content-lineage)
8. [Data Model & Asset Pipeline](#8-data-model--asset-pipeline)
9. [Scoring System](#9-scoring-system)
10. [Multi-LLM Strategy](#10-multi-llm-strategy)
11. [V1 → V2 Roadmap](#11-v1--v2-roadmap)

---

## 1. Product Positioning

GEO Studio is **not** an SEO tool.

It is a **Knowledge Operating System (KOS)** — a platform that transforms raw research into authoritative, citation-backed, multi-platform knowledge assets with measurable quality scores.

| Dimension | SEO Tool | KOS (GEO Studio) |
|---|---|---|
| Goal | Keyword ranking | Knowledge authority |
| Core Asset | Keywords | Knowledge Graph |
| Process | Optimize → Publish | Research → Build → Evidence → Optimize → Monitor |
| Quality | Traffic | GEO Score (Authority + Coverage + Evidence + Schema) |
| Output | Content | Knowledge Assets + Structured Data |
| Iteration | Manual | Continuous (Agent-driven gap analysis) |

---

## 2. Business Workflow

### 2.1 End-to-End Flow

```
┌─────────────────────────────────────────────────────────┐
│ ① Create GEO Project                                   │
│   - Select entity/topic                                │
│   - Configure target model(s)                          │
│   - Set quality thresholds                             │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ② Topic Research (Research Agent)                      │
│   - Discover subtopics, questions, trends               │
│   - Competitive analysis                                │
│   - Identify knowledge gaps                             │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ③ Entity Discovery (Entity Agent)                      │
│   - Extract entities from research                      │
│   - Entity relationship mapping                         │
│   - Entity disambiguation                               │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ④ Knowledge Graph (Knowledge Graph Agent)               │
│   - Build entity-relation graph                         │
│   - Layer: Core → Supporting → Peripheral               │
│   - Graph visualization                                 │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ⑤ Claim Builder (Claim Agent)                          │
│   - Generate authoritative claims                       │
│   - For each claim: claim text, confidence, source type │
│   - Human review checkpoint (optional)                  │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ⑥ Evidence & Citation (Evidence Agent)                 │
│   - Find supporting evidence per claim                  │
│   - Source credibility scoring                          │
│   - Citation formatting (APA, MLA, custom)              │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ⑦ FAQ Builder (FAQ Agent)                              │
│   - Generate Q&A pairs from knowledge graph             │
│   - Schema-compliant FAQ markup                         │
│   - Multi-level (overview → detailed)                   │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ⑧ Schema Builder (Schema Agent)                        │
│   - JSON-LD structured data                             │
│   - Article, FAQ, Product, VideoObject, etc.            │
│   - Schema validation                                   │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ⑨ Multi-LLM Optimization (Optimization Agent)          │
│   - Optimize for: Google AI Overview / Bing Copilot /   │
│                   ChatGPT / Perplexity / DeepSeek / etc. │
│   - Content structure, evidence density, citation depth │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ⑩ Knowledge Gap Analysis (Gap Agent)                   │
│   - Compare current graph vs competitor graphs          │
│   - Identify missing entities, claims, evidence         │
│   - Generate improvement recommendations                │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ⑪ GEO Score (Evaluation Agent)                         │
│   - Composite: Authority + Coverage + Evidence + Schema │
│   - Per-model optimization score                        │
│   - Threshold validation                                │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ⑫ Human Review (Workspace Checkpoint)                  │
│   - Review claims, evidence, citations                  │
│   - Edit/approve/reject per section                     │
│   - Optional: external reviewer role                    │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ⑬ Publish (Publisher Agent)                            │
│   - Multi-platform output generation                    │
│   - Web, API, CMS integration                           │
│   - Asset deposition                                    │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ⑭ Monitor & Iterate (Monitor Agent)                    │
│   - Track GEO Score over time                           │
│   - Competitor movement alerts                          │
│   - Re-optimization triggers                            │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Human-in-the-Loop Points

| Stage | Intervention | Required For |
|---|---|---|
| ⑤ Claim Builder | Claim approval | High-authority projects |
| ⑫ Human Review | Full review + approval | All published projects |
| ⑪ GEO Score | Score review if < threshold | Configurable threshold |

### 2.3 Batch vs Interactive

| Mode | Trigger | Use Case |
|---|---|---|
| Batch | Workflow trigger | Full pipeline (new project) |
| Interactive | Per-Agent invocation | Partial re-run (after edit) |
| Monitor | Scheduled | Weekly/monthly re-optimization |

---

## 3. Page & Interaction Design

### 3.1 Workspace Layout

```
┌──────────────┬──────────────────────────────────┬──────────────┐
│   LEFT       │          CENTER                  │   RIGHT      │
│   NAV        │          WORKSPACE               │   PANEL      │
├──────────────┼──────────────────────────────────┼──────────────┤
│              │                                  │              │
│ GEO Studio   │  Project Header                  │ Knowledge    │
│   ├─ Projects│  ┌──────────────────────────┐    │ Graph        │
│   ├─ Assets  │  │  Flow Pipeline            │    │ (Mini)       │
│   ├─ Monitor │  │  ○ → ○ → ○ → ○ → ● → ○  │    │              │
│   └─ Settings│  │  (Current step highlighted) │    │              │
│              │  └──────────────────────────┘    │ Claim List   │
│ My Projects  │                                  │ (Filtered)   │
│   ├─ Brand X │  ┌──────────────────────────┐    │              │
│   ├─ Topic Y │  │  Main Content Area       │    │ Source       │
│   └─ Niche Z │  │                          │    │ Credibility  │
│              │  │  - Research results       │    │              │
│              │  │  - Entity graph           │    │ Metrics      │
│              │  │  - Claim editor           │    │   GEO: 72    │
│              │  │  - Schema reviewer        │    │   Auth: 84   │
│              │  └──────────────────────────┘    │   Cov: 68    │
│              │                                  │   Evid: 79   │
│              │  ┌──────────────────────────┐    │              │
│              │  │  Activity Timeline        │    │ Quick        │
│              │  │  Step 1 ✅ Step 2 ✅ ... │    │ Actions      │
│              │  └──────────────────────────┘    │  [Re-run]    │
│              │                                  │  [Publish]   │
└──────────────┴──────────────────────────────────┴──────────────┘
```

### 3.2 Key Pages

| Page | Route | Content |
|---|---|---|
| Project List | `/geo/projects` | All GEO projects with status, score, last run |
| Project Workspace | `/geo/project/:id` | Full pipeline workspace (layout above) |
| Entity Graph | `/geo/project/:id/graph` | Full knowledge graph visualization |
| Claim Editor | `/geo/project/:id/claims` | Claim CRUD with evidence binding |
| Schema View | `/geo/project/:id/schema` | Generated structured data preview |
| Score Dashboard | `/geo/project/:id/score` | Detailed scoring breakdown |
| Monitor | `/geo/monitor` | All projects' health dashboard |
| Asset Center | `/geo/assets` | Cross-project knowledge assets |

### 3.3 Component Inventory

| Component | Page(s) | Description |
|---|---|---|
| `FlowPipeline.vue` | Workspace | Step-by-step pipeline visualization |
| `KnowledgeGraphViewer.vue` | Workspace, Entity Graph | Interactive graph with zoom/filter |
| `ClaimEditor.vue` | Workspace, Claim Editor | Rich text + evidence binding |
| `SourceCredibilityBadge.vue` | Workspace | Visual credibility indicator |
| `GEOProjectCard.vue` | Project List | Card with status, scores, actions |
| `ActivityTimeline.vue` | Workspace | Execution history with step status |
| `ScoreGauge.vue` | Workspace, Score Dashboard | Circular gauge for GEO Score |
| `SchemaPreview.vue` | Schema View | Formatted JSON-LD preview |
| `OptimizationComparison.vue` | Workspace | Per-model optimization diffs |
| `GapAnalysisChart.vue` | Workspace | Knowledge gap radar chart |

---

## 4. Agent Architecture

### 4.1 Agent Registry

Each GEO agent registers with Agent Runtime (PLAT-010):

| Agent | Code | Capability | Input | Output |
|---|---|---|---|---|
| Research Agent | `geo.research` | `geo.topic.research` | Topic, config | Research report, subtopics |
| Entity Agent | `geo.entity` | `geo.entity.discover` | Research report | Entity list + relations |
| Knowledge Graph Agent | `geo.knowledge-graph` | `geo.graph.build` | Entities | Knowledge graph (nodes + edges) |
| Claim Agent | `geo.claim` | `geo.claim.build` | Knowledge graph | Claims with confidence |
| Evidence Agent | `geo.evidence` | `geo.evidence.find` | Claims | Evidence + citation pairs |
| FAQ Agent | `geo.faq` | `geo.faq.generate` | Knowledge graph | FAQ pairs |
| Schema Agent | `geo.schema` | `geo.schema.generate` | Claims, FAQ, topic | JSON-LD structured data |
| Optimization Agent | `geo.optimizer` | `geo.optimize.multi-llm` | Claims, evidence, schema | Per-model optimized content |
| Gap Agent | `geo.gap` | `geo.gap.analyze` | Knowledge graph, competitor | Gap report + recommendations |
| Evaluation Agent | `geo.evaluator` | `geo.score.evaluate` | All assets | GEO Score + breakdown |
| Publisher Agent | `geo.publisher` | `geo.publish.output` | Optimized content | Platform-specific output |
| Monitor Agent | `geo.monitor` | `geo.monitor.track` | All projects | Health dashboard + alerts |

### 4.2 Agent Collaboration Flow

```
Research Agent ──► Entity Agent ──► Knowledge Graph Agent
                                            │
                        ┌───────────────────┼───────────────────┐
                        ▼                   ▼                   ▼
                  Claim Agent           FAQ Agent           Gap Agent
                        │                   │                   │
                        ▼                   ▼                   │
                 Evidence Agent        Schema Agent             │
                        │                   │                   │
                        └───────┬───────────┘                   │
                                ▼                               │
                      Optimization Agent ◄──────────────────────┘
                                │
                                ▼
                        Evaluation Agent
                                │
                                ▼
                        Publisher Agent
```

All collaboration via Agent Dispatcher (PLAT-010). No direct coupling.

### 4.3 Agent Context

Each GEO agent receives via AgentContext (PLAT-010):
- `workspace` — Current GEO project workspace
- `executionContext` — Execution plan context
- `capabilityResolver` — Resolve capability → Resource
- `resourceResolver` — Resolve strategy → AI Resource
- `conversation` — Per-project AI conversation history
- `memory` — Short-term + knowledge memory
- `variables` — Project variables (topic, depth, targets)
- `settings` — User/tenant settings

---

## 5. Workflow Orchestration

### 5.1 Workflow Definition

**Code**: `geo.full-pipeline`  
**Version**: v1  
**Category**: geo  

#### Nodes

| Node ID | Type | Config |
|---|---|---|
| start | start | — |
| research | agent | agentCode: geo.research |
| entity_discovery | agent | agentCode: geo.entity |
| knowledge_graph | agent | agentCode: geo.knowledge-graph |
| claim_review | humanApproval | label: "审核观点" (optional, based on config) |
| claim_build | agent | agentCode: geo.claim |
| evidence | agent | agentCode: geo.evidence |
| faq | agent | agentCode: geo.faq |
| schema | agent | agentCode: geo.schema |
| optimize | agent | agentCode: geo.optimizer |
| gap_analysis | agent | agentCode: geo.gap |
| evaluate | agent | agentCode: geo.evaluator |
| human_review | humanReview | label: "人工审核" |
| publish | agent | agentCode: geo.publisher |
| end | end | — |

#### Edges

```
start → research → entity_discovery → knowledge_graph
knowledge_graph → claim_review (condition: config.requireClaimApproval)
claim_review → claim_build (on: approved)
knowledge_graph → claim_build (condition: !config.requireClaimApproval)
claim_build → evidence → faq
knowledge_graph → faq (parallel)
claim_build → schema
faq → schema
knowledge_graph → gap_analysis
schema → optimize → evaluate → human_review
human_review (on: approved) → publish → end
human_review (on: rejected) → claim_build (loop)
gap_analysis → evaluate (side channel: gap report included in evaluation)
```

### 5.2 Templates

| Template Code | Name | Triggers | Human Points |
|---|---|---|---|
| geo.full-pipeline | 完整 GEO 流程 | Manual | Claim review + Full review |
| geo.quick-optimize | 快速优化 | Manual | None (auto-publish) |
| geo.monitor-weekly | 周度监测 | Scheduled | No, only alert generation |

### 5.3 Checkpoints

Every agent-based node automatically checkpoints via Workflow Checkpoint Runtime (PLAT-011). This allows:
- **Resume from failure** — pick up where an agent failed
- **Replay from node** — re-run a single agent with updated parameters
- **Branch replay** — re-run a subgraph without restarting

---

## 6. Knowledge Model

### 6.1 Core Objects

```typescript
interface Topic {
  id: string
  name: string
  description: string
  subtopics: Topic[]
  keywords: string[]
  questions: string[]     // People Also Ask, related queries
}

interface Entity {
  id: string
  name: string
  type: EntityType        // Person, Organization, Concept, Product, Location, Event
  description: string
  aliases: string[]
  relations: EntityRelation[]
  categories: string[]
  confidence: number
  metadata: Record<string, any>
}

interface EntityRelation {
  targetId: string
  type: RelationType       // isA, partOf, produces, locatedIn, foundedBy, etc.
  weight: number
  source: string           // Evidence reference
}

interface KnowledgeGraph {
  entities: Entity[]
  edges: GraphEdge[]
  metadata: {
    entityCount: number
    relationCount: number
    densityScore: number
    coverageScore: number
  }
}

interface Claim {
  id: string
  text: string
  entityId: string
  type: ClaimType          // factual, statistical, comparative, predictive, definitional
  confidence: number
  evidences: Evidence[]
  status: ClaimStatus      // draft, reviewed, approved, rejected
}

interface Evidence {
  id: string
  claimId: string
  source: string           // URL, DOI, ISBN
  sourceType: SourceType   // academic, news, official, encyclopedia, etc.
  credibilityScore: number
  extract: string          // Supporting text
  datePublished: Date
  citation: string         // Formatted citation
}

interface Citation {
  id: string
  format: CitationFormat   // APA, MLA, Chicago, Custom
  text: string
  metadata: Record<string, any>
}

interface FAQPair {
  id: string
  question: string
  answer: string
  entities: string[]
  keywords: string[]
  schemaType: string       // FAQPage, QAPage
}

interface SchemaOutput {
  type: string             // Article, FAQPage, Product, VideoObject, etc.
  jsonld: Record<string, any>
  validationErrors: SchemaError[]
}

interface GEOProject {
  id: string
  topic: Topic
  knowledgeGraph: KnowledgeGraph
  claims: Claim[]
  faqPairs: FAQPair[]
  schemas: SchemaOutput[]
  scores: GEOScores
  status: ProjectStatus
  version: number
}
```

### 6.2 Entity Types

| Type | Description | Examples |
|---|---|---|
| Person | Individual | Albert Einstein, Elon Musk |
| Organization | Company, institution | OpenAI, WHO |
| Concept | Abstract idea | Quantum computing, "Digital transformation" |
| Product | Commercial product | ChatGPT, iPhone 16 |
| Location | Geographic entity | Tokyo, Silicon Valley |
| Event | Historical/current event | COP28, COVID-19 pandemic |
| Technology | Technology | Blockchain, 5G |
| Field | Domain of study | Machine learning, Cardiology |
| Brand | Brand | Nike, Toyota |

### 6.3 Relation Types

| Type | Inverse | Description |
|---|---|---|
| isA | isA | Subclass / type-of |
| partOf | contains | Composition |
| foundedBy | founded | Organization founder |
| locatedIn | location | Geographic location |
| produces | producedBy | Product/output |
| uses | usedBy | Technology/method usage |
| influenced | influencedBy | Intellectual influence |
| competesWith | competesWith | Competitive relationship |
| precedes | follows | Temporal order |
| evidences | evidencedBy | Evidentiary relationship |

---

## 7. Knowledge Provenance & Content Lineage

### 7.1 Why This Matters

Most AI content tools produce opaque output — you can't trace *why* a statement exists, *where* it came from, or *who* modified it. For enterprise GEO, this is a deal-breaker.

By integrating with **Workspace Runtime (version history)**, **Workflow Runtime (checkpoint lineage)**, and **Audit Runtime (immutable audit trail)**, GEO Studio becomes the only knowledge tool where every atom of output is fully traceable.

### 7.2 Provenance Model

```typescript
interface ProvenanceRecord {
  id: string
  entityId: string           // The knowledge entity this applies to
  entityType: ProveanceEntityType  // claim | evidence | entity | faq | schema
  source: string             // Where it came from (API, Agent, Human, Import)
  sourceMetadata: {          // Detailed source info
    agentId?: string
    agentRunId?: string
    workflowNodeId?: string
    executionPlanId?: string
    humanUserId?: string
    importFile?: string
    modelName?: string       // If AI-generated, which model
  }
  action: string             // created | updated | verified | rejected | escalated
  timestamp: Date
  actor: string              // agent:geo.claim | user:123 | system
  reason: string             // Why this action was taken
  previousVersionId?: string // Link to previous version (chaining)
  metadata: Record<string, any>
}

interface ContentLineage {
  id: string                 // Maps to a published output segment
  outputType: string         // article | faq | schema | optimized-variant
  outputSegment: string      // Paragraph, sentence, or structured block
  tracePath: LineageNode[]   // Full backtrace
  createdAt: Date
}
```

### 7.3 Lineage Graph

```
Published Article Paragraph
        │
        ▼
Optimization Agent (model: GPT-4o)
        │
        ▼
FAQBuilder Agent
   ┌────┴────┐
   ▼         ▼
FAQ #12    FAQ #14
   │
   ▼
Claim #42 (置信度 0.87)
   │
   ├── Evidence #7 (source: academic | credibility: 0.92)
   │       │
   │       └── Citation: "Smith et al. (2024)"
   │
   └── Evidence #12 (source: official | credibility: 0.88)
           │
           └── Citation: "WHO Report 2024"
           │
           └── Last Verified: 2025-06-15 (14 days ago)
```

### 7.4 Freshness Management

| Object | Freshness Policy | Default Expiry |
|---|---|---|
| Entity | Per-type configurable | 180 days |
| Claim | Based on evidence freshness | 90 days |
| Evidence | Based on source type | Academic: 365d, News: 30d, Official: 180d |
| FAQ | Based on claim freshness | 90 days |
| Schema | Based on entity changes | 180 days |
| Optimized Content | Based on model updates | 30 days |

When an object's freshness expires:
1. Agent marks it `stale`
2. Automatically enters **Review Queue**
3. Review Agent re-verifies or escalates for human review

### 7.5 Review States (Enhanced)

Each knowledge object supports:

| State | Description | Next Actions |
|---|---|---|
| draft | AI-generated, not reviewed | submit_review |
| reviewed | Passed AI auto-review | approve, request_revision |
| approved | Human-approved | publish |
| rejected | Human-rejected | revise, escalate |
| request_revision | Human requested changes | revise |
| escalated | Needs senior reviewer | assign_reviewer, escalate |
| stale | Freshness expired | re_verify |
| archived | Manually archived | unarchive |

## 8. Data Model & Asset Pipeline

### 8.1 Prisma Schema (Backend)

model GEOProject {
  id             String   @id @default(uuid())
  tenantId       String
  workspaceId    String   // Workspace Runtime integration
  name           String
  topic          String   // JSON — Topic
  description    String?
  targetModels   String   // JSON — list of target LLM/SE models
  config         String?  // JSON — project configuration
  status         String   // draft, research, building, review, ready, published, monitoring
  geoScore       Float?
  authorityScore Float?
  coverageScore  Float?
  evidenceScore  Float?
  schemaScore    Float?
  version        Int      @default(1)
  publishedAt    DateTime?
  metadata       String?  // JSON
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  entities       GEOEntity[]
  claims         GEOClaim[]
  faqPairs       GEOFAQPairs[]
  schemas        GEOSchema[]
  gaps           GEOGapReport[]
  scoreHistory   GEOScoreHistory[]
  assets         GEOAsset[]
}

model GEOEntity {
  id             String   @id @default(uuid())
  projectId      String
  name           String
  type           String   // Person, Organization, Concept, Product, Location, Event
  description    String?
  aliases        String?  // JSON array
  confidence     Float?
  metadata       String?  // JSON
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  project        GEOProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  relations      GEOEntityRelation[]
  claims         GEOClaim[]
}

model GEOEntityRelation {
  id             String   @id @default(uuid())
  entityId       String
  targetEntityId String
  type           String   // isA, partOf, foundedBy, etc.
  weight         Float?
  source         String?  // evidence reference
  createdAt      DateTime @default(now())

  entity         GEOEntity @relation(fields: [entityId], references: [id], onDelete: Cascade)
}

model GEOClaim {
  id             String   @id @default(uuid())
  projectId      String
  entityId       String?
  text           String
  type           String   // factual, statistical, comparative, predictive, definitional
  confidence     Float?
  status         String   // draft, reviewed, approved, rejected
  metadata       String?  // JSON
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  project        GEOProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  entity         GEOEntity? @relation(fields: [entityId], references: [id])
  evidences      GEOEvidence[]
}

model GEOEvidence {
  id             String   @id @default(uuid())
  claimId        String
  source         String   // URL or DOI
  sourceType     String   // academic, news, official, encyclopedia
  credibilityScore Float?
  extract        String
  citation       String?
  datePublished  DateTime?
  metadata       String?  // JSON
  createdAt      DateTime @default(now())

  claim          GEOClaim @relation(fields: [claimId], references: [id], onDelete: Cascade)
}

model GEOFAQPairs {
  id             String   @id @default(uuid())
  projectId      String
  question       String
  answer         String
  entities       String?  // JSON array of entity IDs
  keywords       String?  // JSON array
  schemaType     String   @default("FAQPage")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  project        GEOProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model GEOSchema {
  id             String   @id @default(uuid())
  projectId      String
  schemaType     String   // Article, FAQPage, Product, VideoObject
  jsonld         String   // JSON-LD content
  valid          Boolean  @default(true)
  errors         String?  // JSON — validation errors
  version        Int      @default(1)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  project        GEOProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model GEOGapReport {
  id             String   @id @default(uuid())
  projectId      String
  reportType     String   // entity, claim, evidence, schema
  gaps           String   // JSON — gap analysis findings
  recommendations String  // JSON — improvement recommendations
  score          Float?
  createdAt      DateTime @default(now())

  project        GEOProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model GEOScoreHistory {
  id             String   @id @default(uuid())
  projectId      String
  geoScore       Float
  authorityScore Float
  coverageScore  Float
  evidenceScore  Float
  schemaScore    Float
  breakdown      String?  // JSON — per-dimension breakdown
  createdAt      DateTime @default(now())

  project        GEOProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
}

model GEOAsset {
  id             String   @id @default(uuid())
  projectId      String
  type           String   // knowledge_graph, claim_set, evidence_set, faq_set, schema_set, optimization
  content        String   // JSON
  hash           String?
  version        Int      @default(1)
  published      Boolean  @default(false)
  metadata       String?  // JSON
  createdAt      DateTime @default(now())

  project        GEOProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

### 8.2 Asset Center Integration

On publish, GEO assets automatically flow into Asset Center:

| GEO Asset Type | Asset Center Type | Cross-Workspace Reuse |
|---|---|---|
| Knowledge Graph | Knowledge | Yes — other projects can reference |
| Claim Set | Knowledge | Yes |
| Evidence Set | Knowledge | Yes |
| FAQ Set | Template | Yes |
| Schema Set | Template | Yes |
| Optimized Content | Output | No — project-specific |

---

## 9. Scoring System

### 9.1 GEO Score (Composite)

```
GEO Score = w1 × Authority + w2 × Coverage + w3 × Evidence + w4 × Schema

w1 = 0.30 (Authority)
w2 = 0.25 (Coverage)
w3 = 0.25 (Evidence)
w4 = 0.20 (Schema)
```

### 9.2 Authority Score

Evaluates the authority of entities and sources:

| Factor | Weight | Source |
|---|---|---|
| Entity authority (Wikipedia page rank, citation count) | 0.35 | Entity Agent |
| Source credibility distribution | 0.30 | Evidence Agent |
| Claim confidence distribution | 0.20 | Claim Agent |
| Entity disambiguation quality | 0.15 | Entity Agent |

### 9.3 Coverage Score

Evaluates how comprehensively a topic is covered:

| Factor | Weight | Source |
|---|---|---|
| Entity coverage vs known entities | 0.30 | Gap Agent |
| Sub-topic coverage | 0.25 | Research Agent |
| Question coverage (PAAs, related) | 0.25 | FAQ Agent |
| Keyword coverage | 0.20 | Research Agent |

### 9.4 Evidence Score

Evaluates the quality and credibility of evidence:

| Factor | Weight | Source |
|---|---|---|
| Evidence-per-claim ratio | 0.30 | Evidence Agent |
| Source credibility (academic vs news vs blog) | 0.25 | Evidence Agent |
| Evidence freshness (recent sources preferred) | 0.20 | Evidence Agent |
| Citation formatting quality | 0.15 | Evidence Agent |
| Claim-evidence relevance | 0.10 | Evidence Agent |

### 9.5 Schema Score

Evaluates structured data quality:

| Factor | Weight | Source |
|---|---|---|
| Schema type appropriateness | 0.30 | Schema Agent |
| JSON-LD validation status | 0.25 | Schema Agent |
| Schema completeness | 0.25 | Schema Agent |
| Schema depth (nested entities) | 0.20 | Schema Agent |

### 9.6 Dual Score System (V1 Enhancement)

In addition to the 4-dimension composite, GEO Score is split into two independent scores:

#### Knowledge Score (Internal Quality)

| Dimension | Weight | Description |
|---|---|---|
| Coverage | 0.30 | Entity + subtopic + question coverage |
| Evidence | 0.30 | Evidence-per-claim, credibility, freshness |
| Citation | 0.25 | Source credibility, citation formatting |
| Structure | 0.15 | Schema validity + completeness |

#### LLM Visibility Score (External Optimization)

Measures how well the content performs when consumed by target LLM models:

| Dimension | Weight | Description |
|---|---|---|
| Entity Density | 0.25 | Entities per token, entity richness |
| Prompt Friendliness | 0.25 | How well the content answers likely prompts |
| Retrieval Friendliness | 0.25 | Chunkability, section structure, heading density |
| Answerability | 0.25 | Direct answer clarity for common questions |

These two scores combined give the final **GEO Score**:

```
GEO Score = 0.55 × Knowledge Score + 0.45 × LLM Visibility Score
```

### 9.7 Per-Model Optimization Score

After optimization, each target model gets a score:

| Model | Factors |
|---|---|
| Google AI Overview | Authority + Evidence + Schema (structured data critical) |
| Bing Copilot | Coverage + Authority |
| ChatGPT (Browse) | Authority + Evidence + Coverage |
| Perplexity | Evidence + Authority |
| DeepSeek | Coverage + Schema |

### 9.8 Quality Thresholds

| Dimension | Minimum | Target | Excellent |
|---|---|---|---|
| GEO Score | 60 | 75 | 90+ |
| Knowledge Score | 65 | 80 | 92+ |
| LLM Visibility Score | 55 | 70 | 85+ |
| Authority Score | 65 | 80 | 92+ |
| Coverage Score | 60 | 75 | 88+ |
| Evidence Score | 55 | 70 | 85+ |
| Schema Score | 70 | 85 | 95+ |

If any score is below Minimum, the project cannot proceed to publish.

### 9.9 Benchmark Center

Built-in benchmark capability to compare multiple GEO project versions:

| Benchmark Type | Input | Output |
|---|---|---|
| Version A vs B | Two GEO project snapshots | Delta scores + improvement areas |
| Competitor comparison | Target topic | Competitive score comparison |
| Best practice template | Template project | Gap analysis against best practice |
| Time series | Project across versions | Score trend + regression detection |
| Model comparison | Same content, different LLM strategies | Per-model score comparison |

Each benchmark generates a report stored as a GEO asset, enabling:
- Track improvement over time
- Compare against competitors
- Validate optimization strategies
- Archive best-practice baselines

---

## 10. Multi-LLM Strategy

### 10.1 Model Roles

| Capability | Primary Model | Fallback Model | Strategy |
|---|---|---|---|
| geo.topic.research | DeepSeek | GPT-4o | Latency First |
| geo.entity.discover | DeepSeek | Claude 3.5 | Balanced |
| geo.graph.build | DeepSeek | GPT-4o | Latency First |
| geo.claim.build | Claude 3.5 | GPT-4o | Quality First |
| geo.evidence.find | GPT-4o | DeepSeek | Quality First |
| geo.faq.generate | DeepSeek | GPT-4o | Latency First |
| geo.schema.generate | GPT-4o | DeepSeek | Quality First |
| geo.optimize.multi-llm | Per-model: each target model | — | Balanced |
| geo.gap.analyze | DeepSeek | GPT-4o | Cost First |
| geo.score.evaluate | GPT-4o | Claude 3.5 | Quality First |

### 10.2 Optimization Strategy

For GEO optimization, we output **model-specific variants**:

```
Original Content
    │
    ├── Google AI Overview Variant
    │   • Structured data emphasis
    │   • Evidence-rich summaries
    │   • FAQ integration
    │
    ├── Bing Copilot Variant
    │   • Comprehensive coverage
    │   • Comparative analysis format
    │   • Source listing
    │
    ├── ChatGPT Browse Variant
    │   • Conversational depth
    │   • Multi-perspective
    │   • Authority signals
    │
    ├── Perplexity Variant
    │   • Citation-heavy
    │   • Source credibility explicit
    │   • Verifiable claims
    │
    └── DeepSeek Variant
        • Schema-rich
        • Structured output
        • Entity-dense
```

Each variant is independently scored by the Evaluation Agent.

### 10.3 Quality Thresholds

| Dimension | Minimum | Target | Excellent |
|---|---|---|---|
| GEO Score | 60 | 75 | 90+ |
| Authority Score | 65 | 80 | 92+ |
| Coverage Score | 60 | 75 | 88+ |
| Evidence Score | 55 | 70 | 85+ |
| Schema Score | 70 | 85 | 95+ |

If any score is below Minimum, the project cannot proceed to publish.

---

## 11. V1 → V2 Roadmap

### V1 (Current Sprint)

| Feature | Priority | Depends On |
|---|---|---|
| GEO Project CRUD + Workspace integration | P0 | Workspace Runtime |
| Research Agent + Topic discovery | P0 | Agent Runtime |
| Entity Discovery Agent + Entity model | P0 | Agent Runtime |
| Knowledge Graph Builder + visualization | P0 | Agent Runtime |
| Claim Builder Agent with evidence binding | P0 | Agent Runtime |
| Knowledge Provenance + Content Lineage | P0 | Provenance model + Audit Runtim |
| Freshness management + review queues | P0 | Freshness model + Workflow Runtime |
| FAQ Builder Agent | P0 | Agent Runtime |
| Schema Builder Agent (Article + FAQ) | P0 | Agent Runtime |
| Evidence Agent with source credibility | P0 | Agent Runtime |
| Evaluation Agent (GEO Score) | P0 | Agent Runtime |
| Human Review workflow (checkpoint) | P0 | Workflow Runtime |
| Dual Score System (Knowledge + LLM Visibility) | P0 | Scoring model |
| Benchmark Center (basic version comparison) | P1 | Scoring model |
| Flow Pipeline visualization (frontend) | P0 | Nuxt + Vue |
| Knowledge Graph Viewer (frontend) | P0 | D3.js or similar |
| Score Dashboard (frontend) | P0 | Nuxt + Vue |
| Prisma models for GEO business layer | P0 | Prisma + SQL |

### V2 (Future)

| Feature | Priority | Rationale |
|---|---|---|
| Multi-LLM Optimization Agent | P1 | Distinguishes GEO from SEO tools |
| Knowledge Gap Analyzer Agent | P1 | Continuous improvement engine |
| Publisher Agent (web/CMS/API) | P1 | End-to-end automation |
| Monitor Agent (scheduled tracking) | P1 | Ongoing value delivery |
| Optimized content variant comparison | P1 | User-facing differentiation |
| Competitor analysis integration | P2 | Advanced feature |
| Advanced Schema types (Product, Video, etc.) | P2 | Expand use cases |
| Enterprise knowledge governance workflow | P2 | Enterprise sales |
| Team collaboration on GEO projects | P2 | Enterprise |
| GEO Asset Center (cross-project reuse) | P2 | Ecosystem |

### Platform Dependency Summary

| Platform Module | Used By |
|---|---|
| Workspace Runtime | All GEO projects (state, snapshot, version) |
| Agent Runtime | All GEO agents (registry, dispatch, memory) |
| Workflow Runtime | GEO pipeline orchestration (DAG, checkpoint, replay, human points) |
| Execution Runtime | Capability → ExecutionPlan → AI Resource resolution |
| AI Resource Runtime | BYO model keys, resource routing, cost tracking |
| Capability Platform | GEO capabilities registered for authorization |
| Platform Governance | Subscription plans → Capability grants → GEO feature access |
| Asset Center | Cross-project knowledge asset sharing |

---

