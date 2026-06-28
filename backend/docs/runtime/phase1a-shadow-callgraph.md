# Phase 1A — Shadow Callgraph Scan

> **Purpose:** Verify every volcengine call site resolves through the Phase 1A wrapper.
> **Rule:** If any site bypasses the wrapper, Phase 1A is NOT established.
> **Generated:** 2026-05-16 12:31

---

## Scan Methodology

For each of the 11 call sites (from `volcengine-call-sites-phase1a.md`):
1. Read the actual `import` statement (current code)
2. Trace the runtime resolution path
3. Check if it goes through `core/provider-wrapper/volcengine/*`
4. Flag any bypass

---

## 1. volcengineTTS — 4 call sites (all in `routes/tts.ts`)

| # | Line | Actual Import | Runtime Resolution | Wrapped? | Bypass? |
|---|------|---------------|--------------------|----------|---------|
| 1 | 70 | `const volcengineTTS = { synthesize: bindVolcengineTTSMethods.synthesize }` | `bindVolcengineTTSMethods` → `volcengineTTSWrapped` → `createVolcengineProxy(original)` | ✅ | ❌ No |
| 2 | 88 | Same `volcengineTTS.synthesize` | Same resolution | ✅ | ❌ No |
| 3 | 172 | Same `volcengineTTS.synthesize` | Same resolution | ✅ | ❌ No |
| 4 | 248 | Same `volcengineTTS.synthesize` | Same resolution | ✅ | ❌ No |

**Note:** TTS uses local `const volcengineTTS = { synthesize: ... }` pattern, NOT the import itself.
All 4 call sites use the same local variable. Lambda capture: N/A (no `gen: (p) =>` pattern).

---

## 2. volcengineImage — 4 call sites (routes/images.ts × 3, worker-runtime.ts × 1)

### 2a. `routes/images.ts` — 3 call sites

| # | Line | Actual Import | Runtime Resolution | Wrapped? | Bypass? |
|---|------|---------------|--------------------|----------|---------|
| 1 | 73 | `const volcengineImage = bindVolcengineImageMethods` | `bindVolcengineImageMethods` → `volcengineImage` wrapper → `createVolcengineProxy(original)` | ✅ | ❌ No |
| 2 | 98 | Same `volcengineImage.generate` | Same resolution (lambda) | ✅ Lambda captured from local const | ❌ No |
| 3 | 106 | Same `volcengineImage.generate` | Same resolution (lambda) | ✅ Lambda captured from local const | ❌ No |

**Lambda analysis:** `gen: (p) => volcengineImage.generate(p)`
- `volcengineImage` is the local `const` (not the original import)
- `.generate` is from `bindVolcengineImageMethods` which wraps the proxy
- **Result:** Lambda injects proxy function identity, not original.

### 2b. `queue/worker-runtime.ts` — 1 call site (⚠️ NOT YET WRAPPED)

| # | Line | Actual Import | Runtime Resolution | Wrapped? | Bypass? |
|---|------|---------------|--------------------|----------|---------|
| 4 | 31 | `import { volcengineImage } from '../services/volcengine-image.provider.js'` | Direct import from original source file | ❌ **BYPASS** | ✅ Bypass detected |

**Risk:** HIGH. This call site still goes directly to the original provider file.
**Consequence:** Phase 1A is NOT fully established until this is wrapped.

---

## 3. volcengineVideo — 2 call sites (routes/images.ts × 1, mock-worker.ts × 2)

### 3a. `routes/images.ts` — 1 call site (line 344)

| # | Line | Actual Import | Runtime Resolution | Wrapped? | Bypass? |
|---|------|---------------|--------------------|----------|---------|
| 1 | 344 | `import { volcengineVideo } from '../services/volcengine-video.provider.js'` | Direct import from original | ❌ **BYPASS** | ✅ Bypass detected |

**Risk:** MEDIUM. Used as `videoService = volcengineVideo` for dynamic dispatch.
Part of `use-request` pipeline — submit + waitForCompletion chain.

### 3b. `services/mock-worker.ts` — 2 call sites (lines 172, 188)

| # | Line | Actual Import | Runtime Resolution | Wrapped? | Bypass? |
|---|------|---------------|--------------------|----------|---------|
| 2 | 172 | `import { volcengineVideo } from './volcengine-video.provider.js'` | Direct import from original (relative path) | ❌ **BYPASS** | ✅ Bypass detected |
| 3 | 188 | Same import, `volcengineVideo.poll(taskId)` | Same resolution | ❌ **BYPASS** | ✅ Bypass detected |

**Risk:** HIGH. mock-worker is part of the job pipeline. submit + poll pattern.
Internal service, not a route handler.

---

## 4. volcengineImage Stateless (production-loop) — 1 call site

| # | Line | Actual Import | Runtime Resolution | Wrapped? | Bypass? |
|---|------|---------------|--------------------|----------|---------|
| 1 | 14 (import) + 371 (call) | `import { volcengineImage } from './video/volcengine.image.js'` | Direct import from production-loop's own class provider | ❌ **BYPASS** | ✅ Bypass detected |

**Risk:** MEDIUM. Different call signature than services version.
Used only by production-loop/api.ts.

---

## Summary: Bypass Report

| Site | File | Line | Risk | Status |
|------|------|------|------|--------|
| volcengineImage | queue/worker-runtime.ts | 31 | 🔴 HIGH | UNWRAPPED |
| volcengineImage | production-loop/api.ts | 371 | 🟡 MEDIUM | UNWRAPPED |
| volcengineVideo | routes/images.ts | 344 | 🟡 MEDIUM | UNWRAPPED |
| volcengineVideo | services/mock-worker.ts | 172 | 🔴 HIGH | UNWRAPPED |
| volcengineVideo | services/mock-worker.ts | 188 | 🔴 HIGH | UNWRAPPED |
| volcengineTTS | routes/tts.ts | 4 sites | 🟢 WRAPPED | ✅ |
| volcengineImage | routes/images.ts | 3 sites | 🟢 WRAPPED | ✅ |

**Coverage: 5/11 sites wrapped (45%).** ❌ NOT sufficient.

---

## Next Step Decision

Shadow Verification reveals:
- Wrapped paths are verified clean (no bypass)
- **6 remaining unwrapped sites** must be wrapped before Phase 1A can be considered established
- worker-runtime.ts (volcengineImage) and mock-worker.ts (volcengineVideo) are HIGH risk — job model with async lifecycle
- production-loop/api.ts is MEDIUM risk — stateless model, different API shape

**Recommended order for wrapping remaining sites:**
1. 🔴 queue/worker-runtime.ts (volcengineImage — job model, HIGH risk)
2. 🟡 production-loop/api.ts (volcengineImage — stateless model, MEDIUM risk)
3. 🔴 services/mock-worker.ts (volcengineVideo — job model, HIGH risk)
4. 🟡 routes/images.ts volcengineVideo (MEDIUM risk, but bundling with mock-worker makes sense)
