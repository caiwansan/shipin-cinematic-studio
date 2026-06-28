# Render-Intelligence Feature Decomposition Map

> **Phase 1B input:** Current render-intelligence feature space (as-is)
> **Goal:** Identify which features are implicit heuristics → to become explicit PolicySignal
> **Generated:** 2026-05-16 12:39

---

## 1. Current Architecture

```
RenderIntelligence Class (309 lines)
├── Inputs: VideoPrompt, RoutingConstraints
├── Dependencies: CostProfiles, CostLearner, SLAController, VideoProviders, EventBus
├── Core method: decide()
│   ├── Filter candidates by SLA constraints
│   ├── Score candidates: qScore×0.4 + speedScore×0.3 + costScore×0.3
│   └── Return RouteDecision (provider, model, confidence, cost, latency)
├── execute()
│   ├── Call decide()
│   ├── Emit decision as event
│   └── executeWithFallback() — retry up to 2 fallbacks
└── getIntelligenceStatus() — observability endpoint
```

## 2. Current Output (RouteDecision)

```typescript
interface RouteDecision {
  chosenProvider: string      // decision result
  chosenModel: string
  reason: string              // human-readable string (not machine-parseable)
  confidence: number          // 0.0–1.0
  estimatedCost: number       // computed cost
  estimatedLatencyMs: number  // from profile
  slaTier: SLATier
  alternatives: Array<{ provider: string; model: string; reason: string }>
}
```

## 3. Feature Signal Extraction

Every decision render-intelligence makes is currently embedded in business logic.
Here is the decomposition of each signal:

### 3a. Explicit Signals (already present, needs schema)

| Signal | Source | Current Form | Target Form |
|--------|--------|-------------|-------------|
| Quality score | `CostProfile.qualityScore` | 1-10, embedded | `qualityScore: number` in PolicySignal |
| Latency | `CostLearner.getEffectiveProfile().avgLatencyMs` | milliseconds | `latency_ms: number` |
| Cost | `CostProfile.costPerSecond × duration` | USD | `cost_score: number` (normalized 0-1) |
| Confidence | Computed in `buildDecision()` | 0.4-1.0, computed | `confidence: number` |

### 3b. Implicit Heuristics (need explicit extraction)

| Heuristic | Current Location | What It Does | Must Become |
|-----------|-----------------|--------------|-------------|
| `quality_weight = 0.4` | Line 79 | Hardcoded weight in score formula | Configurable weight in policy layer |
| `speed_weight = 0.3` | Line 79 | Hardcoded weight | Configurable weight |
| `cost_weight = 0.3` | Line 79 | Hardcoded weight | Configurable weight |
| `maxLatencyMs = 120_000` | Line 76 | Normalization ceiling | Explicit SLA parameter |
| `maxCost = $1` | Line 77 | Normalization ceiling | Explicit SLA parameter |
| `confidence boost` | Line 110 | +0.1 if clear winner | Explicit confidence formula |
| `fallbackDecision` | Lines 176-195 | Picks first available | Explicit fallback chain signal |
| `forceProvider override` | Lines 103-108 | Bypasses scoring | Must remain as override, not signal |

**Total implicit heuristics found: 8**

### 3c. Missing Signals (need to add)

| Signal | Why Needed | Available? |
|--------|-----------|-------------|
| `computational_model` | Job vs stateless | Implicit (video always job) |
| `reliability_score` | Provider uptime history | Not tracked yet — Phase 1C |
| `failure_rate` | Recent failure trend | CostLearner has success/fail, but not extracted as signal |
| `provider_version` | API version tracking | Not available |

## 4. Input Schema (what render-intelligence already receives)

```typescript
interface VideoPrompt {
  id: string; sceneId: string; projectId: string;
  prompt: string; duration: number;
  width: number; height: number;
  cameraMotion?: string; seed?: number;
  // extended by execute pipeline
  model?: string;  // set after decision
}

interface RoutingConstraints {
  maxBudgetUsd?: number
  maxLatencyMs?: number
  minQualityScore?: number
  slaTier?: SLATier            // 'fast' | 'balanced' | 'production'
  preferredProvider?: string
  forceProvider?: string
}
```

## 5. Output Schema (target) — PolicySignal

```typescript
interface PolicySignal {
  providerId: string
  capability: string            // 'video' (current; extends to 'image'|'tts'|'llm')
  confidence: number            // 0.0 – 1.0
  quality_score: number         // 0.0 – 1.0 (normalized from 1-10)
  latency_ms: number            // predicted or observed
  cost_score: number            // 0.0 – 1.0 (lower = cheaper)
  computational_model: 'job' | 'stateless'
  feature_weights: {
    quality: number             // 0.4 in current
    speed: number               // 0.3 in current
    cost: number                // 0.3 in current
  }
  meta: {
    source: 'render-intelligence'
    model: string
    is_fallback: boolean
    fallback_chain: string[]    // ordered list of attempted providers
    sla_tier: SLATier
    timestamp: number
  }
}
```

## 6. Adapter Surface

The adapter will sit at `renderIntelligence.decide()` output. It's a pure transformation:

```
RouteDecision (from decide())
    │
    ▼
PolicySignalAdapter.convert(routeDecision, originalPrompt, constraints)
    │
    ▼
PolicySignal (standardized)
```

**Adapter file:** `src/core/policy-signal/render-intelligence-adapter.ts`

## 7. Call Sites to Inject Adapter

| File | Line | Current Call | Adapter After |
|------|------|-------------|---------------|
| `production-loop/api.ts` | 239 | `renderIntelligence.decide(...)` → RouteDecision | Return both RouteDecision + PolicySignal |
| `production-loop/api.ts` | 269 | `renderIntelligence.execute(...)` → { decision, job } | Append PolicySignal to result |
| `production-loop/production-runner.ts` | 80 | `renderIntelligence.execute(...)` → { decision, job } | Append PolicySignal to result |

## 8. Health Check Before Phase 1B Coding

- [x] Execution layer unified (Phase 1A)
- [x] Wrapper layer stable
- [ ] Render-intelligence feature map documented ← HERE
- [ ] PolicySignal schema defined
- [ ] Adapter pattern decided
- [ ] Call sites identified
