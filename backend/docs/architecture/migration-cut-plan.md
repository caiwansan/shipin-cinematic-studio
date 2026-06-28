# Migration Cut Plan v1 — Provider Architecture Upgrade

> Phase: 0.5 (post-scan, pre-migration)
> Date: 2026-05-16
> Based on: `docs/analysis/provider-hardcode-report.md`

---

## 1. Policy Hierarchy

### L0 — Legacy Routing (Migration-Only Layer)

**Contains:**
- `routes/images.ts` — switch-based image provider selection
- `routes/tts.ts` — if/else-based TTS provider selection
- `services/volcengine-image.provider.ts` — standalone singleton
- `services/volcengine-video.provider.ts` — standalone singleton
- `services/volcengine-tts.provider.ts` — standalone
- `services/aliyun-image.provider.ts`, `aliyun-video.provider.ts`, `aliyun-tts.provider.ts`
- `services/siliconflow-tts.provider.ts`

**Rules:**
- ❌ No new logic
- ❌ No decision logic changes
- ✔ Migration only (rewire call entry, preserve behavior)

---

### L1 — Heuristic Policy Layer (Decision Generator)

**Contains:**
- `production-loop/render-intelligence.ts` — weighted scoring (quality/speed/cost)
- `observability/provider-score.ts` — in-memory score map
- `services/ai-router.service.ts` — fallback chain

**Role:** Generate ranked candidates, NOT finalize decisions.

**Rules:**
- Output must conform to standardized decision schema (see Policy Adapter)
- Existing weights (quality*0.4, speed*0.3, cost*0.3) are seed values, not final

---

### L2 — Registry Execution Layer (Dumb Executor)

**Target:**
- Execute provider calls based on Policy Adapter decision
- Capability match + health check filter + dispatch

**Rules:**
- ❌ No scoring, no business logic, no fallback chain decision
- ✔ Only: `(decision) → (http call) → (normalized result)`

---

## 2. Architecture (Post-Migration)

```
Request / TaskIntent
       ↓
L1 Heuristic Policy (render-intelligence)
  → score + rank candidates
       ↓
Policy Adapter Layer (NEW)
  → normalize all policy outputs into single decision
  → { providerId, confidence, fallbackChain }
       ↓
L2 Registry Execution
  → capability match
  → health check filter (read-only snapshot)
  → HTTP execution
  → recordTelemetry()
       ↓
Provider Layer (volcengine / openai / aliyun / ...)
```

**Key rule:** Only ONE decision path. L1 generates candidates. Policy Adapter reduces to one decision. Registry executes blindly.

---

## 3. Migration Phases

### Phase 1A — Volcengine Isolation (Risk: LOWEST)

**Goal:** Stop direct calls, not rewrite provider logic.

**Steps:**
1. Wrap `volcengine-image.provider.ts`, `volcengine-video.provider.ts`, `volcengine-tts.provider.ts` in adapter wrapper
2. Rewire `routes/images.ts` switch case 'volcengine' → delegate to wrapper
3. Rewire `routes/tts.ts` if-provider === 'volcengine' → delegate to wrapper

**Success criteria:**
- No service layer calls volcengine directly
- All volcengine calls pass through wrapper entry point
- Behavior unchanged (wrapper is transparent)

**Rollback:** Remove wrapper, reconnect direct call. 0-risk.

---

### Phase 1B — Render-intelligence Extraction (Risk: MEDIUM)

**Goal:** Turn render-intelligence from business module into policy service.

**Steps:**
1. Standardize input schema for `decide()` (taskType, constraints, preferences)
2. Standardize output schema → conform to Policy Adapter `Decision` type
3. Extract scoring weights to config (not code)
4. Add `observability/provider-score.ts` as scoring signal input (already available)

**Success criteria:**
- `decide()` is a pure policy function: `(input) → Decision`
- No side effects (no HTTP calls, no DB writes inside decide)
- Scores read from `COST_PROFILES` but prepared for DB migration

---

### Phase 1C — Registry Convergence (Risk: HIGHEST)

**Goal:** Registry becomes sole execution entry point.

**Steps:**
1. Extend existing `provider.registry.ts` to cover image/video/TTS providers (currently LLM-only)
2. Registry reads `PolicyAdapter.decide()` output
3. Registry executes: resolve capability → filter health → dispatch → recordTelemetry
4. Deprecate: `routes/images.ts`, `routes/tts.ts` switch/if-else paths replaced by registry call

**Success criteria:**
- All provider calls go through registry
- No hardcoded routing logic in any route/service
- Registry is stateless executor (no policy logic)

---

## 4. Isolation Rules

### Legcy Layer (L0)
```
❌ Do NOT add new providers to legacy route switches
❌ Do NOT fix decision logic bugs in L0 code
✔ Only migrate call sites to wrapper/registry
```

### Heuristic Policy (L1)
```
✔ Can evolve scoring model
✔ Can add new signals (telemetry, cost, latency)
❌ Do NOT bypass Policy Adapter to write decisions directly to registry
```

### Registry (L2)
```
✔ Add new providers via registry.register()
✔ Add health check filters
❌ Do NOT embed scoring/business logic
❌ Do NOT embed fallback strategy
```

---

## 5. Forbidden Path Rules (Hard Guards)

These rules are not "best practices" — they are **system invariants**. Violation is a bug, not a shortcut.

### Global Forbidden Paths

```
❌ Any direct provider call outside wrapper layer
   Exception: test mocks (must be explicitly tagged)

❌ Any selection/business logic inside Registry
   Registry is an executor, not a decision-maker

❌ Any scoring logic inside execution (HTTP) layer
   Scoring belongs to L1 Heuristic Policy only

❌ Any bypass of Policy Adapter to write decisions directly to Registry
   Policy Adapter is the ONLY decision → execution bridge
```

### Migration-Phase Forbidden Paths

```
❌ Phase 1A: Adding new endpoints/products to legacy route switch (images.ts, tts.ts)
❌ Phase 1B: Modifying decision logic inside L0 code — only migrate call sites
❌ Phase 1C: Registry embedding scoring rules as "temporary optimization"
```

### Critical Rule

> If a provider is called directly — not through registry — it is a bug, not a shortcut.
> This applies even if: "it's just a test" / "it's just one call" / "I'll fix it later."

### Enforcement

- Code review must check for direct provider calls
- CI lint rule (future): grep for `new.*Provider\(\)` outside test files
- Registry imports the only HTTP client; any service importing HTTP lib directly is a violation

---

## 6. Rollback Strategy per Phase

| Phase | Rollback Action | Risk |
|-------|----------------|------|
| 1A | Remove wrapper, restore direct call | None (transparent wrapper) |
| 1B | Revert to inline render-intelligence call | Low (pure function extraction) |
| 1C | Revert routes to old if/else logic | Medium (multiple files touched) |

Each phase should be independently deployable and independently revertible. No cross-phase dependencies.
