# Phase 1C Step 2 — Decision Entrypoint Enforcement Map

> **Goal:** Ensure ALL decision paths go through PolicyAdapter.evaluate().
> **Phase 1C Step 1** established the authority. Step 2 enforces the entrypoint.

---

## Bypass Entry Categories

### Category 1: render-intelligence direct calls (3 sites)

| Location | Call | Bypass Risk | Action |
|----------|------|-------------|--------|
| `api.ts:241` — `/intelligence/decide` | `renderIntelligence.decide()` | 🔴 Uses raw decision without PolicyAdapter | Wrap with PolicyAdapter.evaluate() |
| `api.ts:272` — `/intelligence/execute` | `renderIntelligence.execute()` | 🟡 execute already produces decision; inject adapter after | Keep adapter injection |
| `production-runner.ts:82` | `renderIntelligence.execute()` | 🟡 Same as above | Already has adapter injection |

### Category 2: apiRouter.selectProvider direct calls (2 sites)

| Location | Call | Bypass Risk | Action |
|----------|------|-------------|--------|
| `worker-runtime.ts:238` | `apiRouter.selectProvider(userId, taskType, true)` | 🔴 Worker makes its own routing decision | Inject policy decision via job payload |
| `worker-runtime.ts:300` | `apiRouter.selectProvider(...)` (retry) | 🔴 Same | Remove decision from worker |

### Category 3: providerHandlers decision map (1 site)

| Location | Call | Bypass Risk | Action |
|----------|------|-------------|--------|
| `worker-runtime.ts:30` | `const providerHandlers` | 🔴 Inline provider → handler mapping is a decision | Keep as execution map, remove routing role |

### Category 4: Production-loop hidden decision (1 site)

| Location | Call | Bypass Risk | Action |
|----------|------|-------------|--------|
| `api.ts:377` | `volcengineImage.generate()` (in `/api/production/pipeline/status`) | 🟡 Stateless, but bypasses decision layer | Inject policy check |

---

## Step 2 Execution

### 2a. Inject PolicyAdapter into API layer (api.ts)

**Target:** `src/production-loop/api.ts`

Transform:
```
request → renderIntelligence.decide() → decision → signal
```
Into:
```
request → renderIntelligence.decide() → decision
       → PolicyAdapter.evaluate(signal, context) → governed_decision
```

### 2b. Remove provider decision from worker-runtime.ts

**Target:** `src/queue/worker-runtime.ts`

- `apiRouter.selectProvider()` is being called inside the worker → this is a **decision**, not execution
- Phase 1C rule: worker only **executes** what policy has decided

**But critical constraint:** worker-runtime still needs provider routing for non-policy-governed calls (e.g., legacy routes). Phase 1C should NOT break these.

**Strategy:** Dual mode:
- If `payload.policyDecision` exists → use it (pure execute)
- Otherwise → fall back to existing apiRouter.selectProvider (backward compat)

### 2c. TTS/Image routes (routes/images.ts, routes/tts.ts)

These are Phase 1A-wrapped direct provider calls. They are **not** decision points — they execute what the route handler decides. Phase 1C does not need to touch them.

**Verdict:** 🟢 Already consistent with Phase 1C (execution only, no routing decision).

---

### 2d. mock-worker.ts (worker is execution)

**Target:** `src/services/mock-worker.ts`

Uses `volcengineVideo.submit()` and `.poll()` directly. This is execution (the decision of *which provider* was already made by the caller). No change needed.

**Verdict:** 🟢 Consistent.

---

## Summary: What Changes

| File | Change | Risk |
|------|--------|------|
| `production-loop/api.ts` | Inject PolicyAdapter.evaluate() after renderIntelligence.decide() | 🟢 Low |
| `production-loop/production-runner.ts` | Already has adapter injection | 🟢 No change |
| `queue/worker-runtime.ts` | Add policyDecision check; keep fallback for compat | 🟡 Medium |
| `services/api-router.service.ts` | No change (Phase 1C post) | 🟢 No change |
| `services/mock-worker.ts` | No change (pure execution) | 🟢 No change |
| `routes/images.ts` | No change (execution only) | 🟢 No change |
| `routes/tts.ts` | No change (execution only) | 🟢 No change |

**Result:** 5 unaffected files, 2 modified files (api.ts, worker-runtime.ts).

---

## Verification Points

1. ✅ All production-loop endpoints produce policy-governed decision
2. ✅ worker-runtime can receive policy decisions
3. ✅ render-intelligence not modified
4. ✅ All decision bypasses accounted for (0 unaccounted)
5. ✅ Phase 1B signal + Phase 1C policy coexist
