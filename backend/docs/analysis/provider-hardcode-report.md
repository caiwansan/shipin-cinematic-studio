# Provider Hardcode Report — Phase 0 Runtime Topology

> Generated: 2026-05-16 11:30
> Source: `/root/shipin-cinematic-studio/backend/src/` (418 .ts files)

---

## Provider Call Map

### 1. Provider Density (by reference count)

| Provider | Reference Count | Risk Level |
|----------|:-:|:-:|
| volcengine | 84 | 🔴 HIGH |
| deepseek | 80 | 🔴 HIGH |
| aliyun | 55 | 🟡 MEDIUM |
| siliconflow | 52 | 🟡 MEDIUM |
| openai | 30 | 🟢 LOW |
| kling | 23 | 🟢 LOW |
| bailian | 21 | 🟢 LOW |

### 2. Direct Instantiation Points

**Existing Provider Registry (`runtime/providers/provider.registry.ts`)**
Already has centralized `registerProvider()` + `getProvider()` pattern for LLMs. But:
- Only covers: DeepSeek, OpenAI (incl. Kimi/SiliconFlow/Bailian via OpenAI-compatible adapter)
- Does NOT cover: volcengine (image/video/TTS), aliyun (image/TTS/video), kling, suno, mureka, mock

**Standalone singletons (HIGH risk)**
| File | Pattern |
|------|---------|
| `production-loop/video/volcengine.image.ts:61` | `export const volcengineImage = new VolcengineImageProvider()` |
| `production-loop/video/init.ts:15` | `const volc = new VolcengineVideoProvider()` |

---

## Routing Logic Map

### Layer 1: Service-layer switch/if-else

**`routes/images.ts:83-94`**
```ts
switch (id) {
  case 'siliconflow': { ... }
  case 'aliyun': { ... }
  case 'volcengine': { ... }
}
```

**`routes/tts.ts:146-167`**
```ts
if (provider === 'aliyun') { ... }
if (provider === 'volcengine') { ... }
```

**`scheduler/resource-router.ts:135-138`**
```ts
switch (provider) {
  case 'doubao': return { name: 'doubao', type: 'volcengine' }
  case 'deepseek': return { name: 'deepseek', type: 'deepseek' }
  case 'gpt-4o-mini': return { name: 'gpt-4o-mini', type: 'openai' }
}
```

### Layer 2: Production-loop provider scoring (render-intelligence.ts)

Already has a policy-like `decide()` method with weighted scoring:
```ts
score = qScore * 0.4 + speedScore * 0.3 + costScore * 0.3
```
Uses `COST_PROFILES` from `cost-profiles.ts` — hardcoded array, not DB.

### Layer 3: AI Router service (ai-router.service.ts)

Has structured fallback chain logic:
```ts
executeWithFallback(taskType, currentModel)
  → getFallbackChain(taskType, modelId)
  → try next → on fail → next fallback
  → all exhausted → error
```

### Layer 4: Circuit breaker (DB-backed)

`routes/stability.ts` — PostgreSQL `circuitBreaker` table with per-service failure tracking.
Already has DB-persisted breaker state (not Redis).

---

## Instantiation Map

| Lifecycle | Provider | Files | Risk |
|-----------|----------|-------|:-:|
| Registry-managed | DeepSeek, OpenAI-compatible | `runtime/providers/provider.registry.ts` | ✅ LOW |
| Singleton export | volcengine (image/video) | `volcengine.image.ts:61`, `init.ts:15` | 🔴 HIGH |
| Service-layer HTTP | aliyun, siliconflow, kling | `services/*.provider.ts` | 🟡 MEDIUM |
| Route-level HTTP | volcengine TTS, aliyun TTS | `routes/tts.ts` | 🟡 MEDIUM |

---

## Hidden Fallback / Hidden Policy

| Pattern | Location | Impact |
|---------|----------|--------|
| try/catch → different provider | `ai-router.service.ts` | Actual fallback, but routing logic embedded in service |
| quality fallback (emotion secondary) | `director-engine.ts:358` | Domain-specific fallback, should be policy |
| revenue-based provider selection | `routes/admin-global-config.ts` | Business logic driving routing |
| mock provider | `queue/mock-provider.ts`, `worker-runtime.ts:243` | Testing path mixed with production |

---

## Existing Policy/Scoring Infrastructure (interesting)

**`observability/provider-score.ts`** — Already has in-memory scoring:
```ts
const WEIGHTS = { latency: 0.40, success: 0.30, cost: 0.20, circuit: 0.10 }
```
But: in-memory only, no Redis, no persistence.

**`production-loop/cost-profiles.ts`** — Static cost metadata array.
But: hardcoded in code, not DB-driven.

**`scheduler/resource-router.ts`** — Provider cost + latency estimates in constructor.
But: hardcoded enum values, not data-driven.

---

## Migration Priority Recommendation

### Phase 1 — Immediate (highest risk, lowest complexity)

| Priority | Target | Rationale |
|:--------:|--------|-----------|
| P0 | `services/volcengine-image.provider.ts` | Singleton + 84 refs + no registry |
| P0 | `services/volcengine-video.provider.ts` | Singleton + video is expensive to retry |
| P0 | `services/volcengine-tts.provider.ts` | 2 route fallback paths |
| P1 | `routes/images.ts` switch | Clean service-layer switch |
| P1 | `routes/tts.ts` if/else | Clean service-layer if/else |
| P1 | `services/aliyun-*.provider.ts` | 55 refs, duplicate pattern |

### Phase 1.5 — Medium (needs registry first)

| Priority | Target | Rationale |
|:--------:|--------|-----------|
| P2 | `scheduler/resource-router.ts` | Switch-based, should read from DB |
| P2 | `production-loop/render-intelligence.ts` | Policy-like but code-embedded |
| P2 | `services/ai-router.service.ts` | Fallback logic should be policy-driven |

### Phase 2 — Lower (depends on telemetry)

| Priority | Target | Rationale |
|:--------:|--------|-----------|
| P3 | `production-loop/cost-profiles.ts` | Move to DB |
| P3 | `observability/provider-score.ts` | Move to Redis |
| P3 | Agent layer (`agent-pool.ts`) | Deepest nesting, complex fallback |

---

## Topology Observation

The system already has THREE incomplete governance layers:
1. **Provider Registry** — LLM-only, incomplete
2. **Cost Profiles** — Video-only, hardcoded
3. **Provider Score** — In-memory, no persistence
4. **Circuit Breaker** — DB-backed but separate from routing

The Phase 1 migration should NOT try to unify all four. Instead:
- Merge Registry + Cost Profiles first (two tables)
- Then bridge to Circuit Breaker
- Then build Telemetry

This avoids the "Universal AI Schema" trap — each layer evolves independently.
