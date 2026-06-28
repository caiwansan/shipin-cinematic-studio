# Phase 1A — Job Model Execution Path Reconstruction

> **Purpose:** Deep trace of worker-runtime and mock-worker to determine if wrapper bypass is structural.
> **Generated:** 2026-05-16 12:32

---

## Path 1: queue/worker-runtime.ts (volcengineImage — Job Model)

### Call Chain

```
queue-manager (external) → processImage()
  → callProvider('image', userId, projectId, payload)
    → apiRouter.selectProvider(...) → returns providerConfig
    → handler = providerHandlers[providerConfig.provider]
    → providerHandlers.volcengine(taskType, providerName, input, _config)
      → volcengineImage.generate({ prompt, size, ... })
        → services/volcengine-image.provider.ts (DIRECT import)
```

### Bypass Analysis

| Layer | Detail | Wrapped? |
|-------|--------|----------|
| Import | `import { volcengineImage } from '../services/volcengine-image.provider.js'` | ❌ Direct import, no wrapper |
| Call | `volcengineImage.generate({...})` at line 31 | ❌ Direct call to original |
| Lambda? | No lambda pattern, direct await call | N/A |
| Retry path | Line 301: `retryHandler(taskType, ...)` → same `providerHandlers` → same bypass | ❌ Duplicate bypass |

**Bypass type:** B. Cached reference bypass (the `providerHandlers` object captures the reference at module load time).

**Risk:** 🔴 HIGH
- Caller: internal worker (not a route handler)
- Pattern: module-level object reference, survives import rewrite
- If we change the import, we must ensure `providerHandlers` captures the new reference

---

## Path 2: services/mock-worker.ts (volcengineVideo — Job Model)

### Call Chain

```
External trigger → generateVideo(prompt, duration, ratio)
  → volcengineVideo.submit({ prompt, duration, ratio })
    → services/volcengine-video.provider.ts (DIRECT import)
  → IIFE poll():
    → volcengineVideo.poll(taskId)
    → sleep(5000) loop
    → until status === 'succeeded' | 'failed'
```

### Bypass Analysis

| Layer | Detail | Wrapped? |
|-------|--------|----------|
| Import | `import { volcengineVideo } from './volcengine-video.provider.js'` | ❌ Direct import |
| `submit` call (L172) | `volcengineVideo.submit({ ... })` | ❌ Direct call |
| `poll` call (L188) | `volcengineVideo.poll(taskId)` inside IIFE poll loop | ❌ Multiple calls in loop |

**Bypass type:** A. Direct import bypass (top-level import, then used in block scope).

**Risk:** 🔴 HIGH
- Full lifecycle (submit → poll loop → completion)
- Async lifecycle: each poll iteration goes directly to original provider
- 5s interval poll means wrapper could be bypassed hundreds of times per request

---

## Path 3: routes/images.ts (volcengineVideo — Dispatch)

### Call Chain (lines 344–367)

```
POST /api/images/generate-video handler
  → videoService = videoProviderName === 'aliyun' ? aliyunVideo : volcengineVideo
  → videoService.submit({ ... })  // with or without withUserKey wrapper
  → videoService.waitForCompletion(taskId!, 5000)
```

### Bypass Analysis

| Layer | Detail | Wrapped? |
|-------|--------|----------|
| Import | `import { volcengineVideo } from '../services/volcengine-video.provider.js'` | ❌ Direct import |
| Assignment | `videoService = ... volcengineVideo` | ❌ Alias assignment |
| `submit` call | `videoService.submit(...)` | ❌ Via alias |
| `waitForCompletion` call | `videoService.waitForCompletion(...)` | ❌ Via alias |

**Bypass type:** A. Direct import bypass (then aliased to `videoService`).

**Risk:** 🟡 MEDIUM
- External route handler (easier to test)
- No poll loop (submit + waitForCompletion delegated)
- Two possible submit paths: `withUserKey` wrapper or direct

---

## Path 4: production-loop/api.ts (volcengineImage — Stateless)

### Call Chain (line 371)

```
POST /production/images handler
  → volcengineImage.generate(prompt, { size, n, model })
  → production-loop/video/volcengine.image.ts (DIRECT import)
```

### Bypass Analysis

| Layer | Detail | Wrapped? |
|-------|--------|----------|
| Import | `import { volcengineImage } from './video/volcengine.image.js'` | ❌ Direct import (different source) |
| Call | `volcengineImage.generate(prompt, { size, n, model })` | ❌ Different signature than services version |

**Bypass type:** A. Direct import bypass.

**Risk:** 🟡 MEDIUM
- Stateless model (single call, no lifecycle)
- Different call signature: `(prompt: string, options?: {...})` vs services version `(params: {...})`
- Wrapper must account for this different signature

---

## Root Cause Analysis

The bypass is structural, not accidental. Four distinct bypass mechanisms exist:

### Mechanism 1: Module Reference Capture (worker-runtime.ts)
```ts
const providerHandlers = {
  async volcengine(...) { volcengineImage.generate(...) }
  //                     ^^^^^ captured at module load
}
```
Even if import path is rewritten, the `providerHandlers` object holds the original reference.
**Fix needed:** Replace the function body reference, or rebuild `providerHandlers` after wrapper injection.

### Mechanism 2: Relative Import (mock-worker.ts)
```ts
import { volcengineVideo } from './volcengine-video.provider.js'
```
Relative path from within `services/` directory. Import path rewrite needed.

### Mechanism 3: Alias Dispatch (routes/images.ts)
```ts
const videoService = videoProviderName === 'aliyun' ? aliyunVideo : volcengineVideo
```
`videoService` becomes a runtime alias. Wrapping the import source fixes this.

### Mechanism 4: Different Source File (production-loop/api.ts)
```ts
import { volcengineImage } from './video/volcengine.image.js'
```
This file imports from production-loop's own provider class, NOT from services/.
Wrapping requires a second wrapper (stateless model) with different API shape.

---

## Fix Strategy for Each Path

| Path | Mechanism | Fix | Risk |
|------|-----------|-----|------|
| worker-runtime.ts | M1 (module capture) | Rewrite import + rebuild `providerHandlers` ref or use `bindVolcengineImageMethods` | Medium |
| mock-worker.ts | M2 (relative import) | Rewrite import to `core/provider-wrapper/volcengine` | Low |
| routes/images.ts (video) | M3 (alias dispatch) | Rewrite volcengineVideo import to wrapper | Low |
| production-loop/api.ts | M4 (different source) | Rewrite import to `volcengineImageStateless` wrapper | Medium |

**Phase 1A completeness estimate:** After fixing all 4 paths, coverage goes from 45% → 100%.

---

## Key Conclusion

**Phase 1A is NOT structurally established yet**, but the remaining bypasses are all fixable and well-understood.
The fix order should prioritize the structural fix (M1 — worker-runtime) because its reference capture pattern affects correctness even if we change the import.
