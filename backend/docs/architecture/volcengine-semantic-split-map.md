# Volcengine Semantic Split Map — Phase 1A

> Defines the two runtime models coexisting under `volcengineImage`.
> This is NOT a refactoring plan — it is a **semantic boundary document**.

---

## 1. Two Computational Models

### Model A: Job Model (stateful)

**Source:** `services/volcengine-image.provider.ts`
**Export:** `export const volcengineImage = { generate, pollAndWait }` (plain object)
**Used by:** `routes/images.ts`, `queue/worker-runtime.ts`

**Lifecycle:**
```
submit generate request
  → may return async task (id / task_id)
  → if async: pollAndWait() with retries (600×500ms = 300s max)
  → return single ImageGenResult { imageUrl, seed? }
```

**Characteristics:**
- Eventual consistency (task may still be processing after HTTP 200)
- Multi-step latency: T = submit + queue + poll × N
- Internal reference image download + base64 conversion (side effect)
- "图生图" fallback pipeline (download → convert → retry → degrade to text-only)

---

### Model B: Stateless Model (functional)

**Source:** `production-loop/video/volcengine.image.ts`
**Export:** `class VolcengineImageProvider` => `export const volcengineImage = new VolcengineImageProvider()`
**Used by:** `production-loop/api.ts`

**Lifecycle:**
```
generate(prompt, options?, signal?)
  → single POST to images/generations
  → return ImageGenResult[] (array, multiple images if n > 1)
```

**Characteristics:**
- Immediate consistency (HTTP response = final result)
- Determnistic latency: T ≈ single HTTP round-trip
- Accepts AbortSignal for cancellation
- Pure text-to-image (no reference image logic)
- Returns array (caller iterates)

---

## 2. API Surface Comparison

| Aspect | Job Model | Stateless Model |
|--------|-----------|-----------------|
| Input shape | `{ prompt, negativePrompt?, size?, imageUrl?, model?, n? }` | `(prompt, { size?, n?, seed?, model? }, signal?)` |
| Return shape | `{ imageUrl: string, seed?: number }` | `ImageGenResult[]` |
| Async pattern | Promise → may poll internally | Single Promise |
| Side effects | Downloads + converts reference images | None |
| Error mode | Timeout during poll (up to 300s) | HTTP error |
| Caller assumption | Single result | Multiple results |

---

## 3. Latency Semantics (Critical for Policy Scoring)

| Phase | Job Model | Stateless Model |
|-------|-----------|-----------------|
| Submit | T1: HTTP POST | — |
| Queue wait | T2: variable (server-side) | — |
| Poll | T3: N × pollInterval (500ms) | — |
| Total (typical) | 5–60s (depends on server load) | 2–10s |
| Failure detection | Timeout after 300s | HTTP error immediate |

**Policy implication:** Job model latency = multi-phase cost. Stateless model latency = single HTTP call.
These must be scored with different profiles.

---

## 4. Failure Mode Comparison

| Scenario | Job Model | Stateless Model |
|----------|-----------|-----------------|
| HTTP 4xx | Throws immediately | Throws immediately |
| HTTP 5xx | Throws immediately | Throws immediately |
| Async task fails | Poll detects `status: 'failed'` | N/A |
| Timeout | 300s wall-clock timeout | N/A |
| Reference image fail | Degrade gracefully (text-only) | N/A |
| Partial result | N/A (single result only) | Returns partial array |

---

## 5. Phase 1A Wrapper Constraints

### What Proxy Does:
- Maintains existing import paths and call signatures (no caller changes)
- Intercepts every provider call
- Tags result with `meta: { mode: 'job' | 'stateless' }`
- Passes through to original implementation (behavior zero change)

### What Proxy Does NOT Do:
- ❌ Trigger poll from wrapper
- ❌ Add retry / fallback / default parameters
- ❌ Normalize return shapes (no array wrapping, no field renaming)
- ❌ Merge or deduplicate implementations
- ❌ Change error behavior

### Proxy Contract (Phase 1A only):
```
caller → [same signature] → volcengineImage.generate(...)
                              ↓ (proxy intercept)
                            raw implementation (unchanged)
                              ↓
                            { raw: RawResult, meta: { mode: 'job' | 'stateless' } }
                              ↓
                            returned to caller
```

---

## 6. Migration Path to Unified Registry (Phase 1C Reference)

When Registry takes over execution in Phase 1C:
- Registry reads `meta.mode` to determine execution path
- Job model: Registry uses submit + poll + wait (no built-in timeout assumption)
- Stateless model: Registry invokes single HTTP call with timeout
- Policy scoring uses separate latency models per mode
- Result normalization happens at Registry output, NOT at wrapper level

---

## 7. Key Guardrails

```
❌ Phase 1A Proxy: no behavior injection (poll/retry/fallback)
❌ Phase 1A Normalization: add meta only, do NOT reshape results
❌ Phase 1A: do NOT unify return type across models
✔ Wait until Phase 1C Registry for unified execution path
```
