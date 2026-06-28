# PHASE 1A — Video Adapter Coverage & Contract Alignment

**Status: Aligned Execution Patch (system convergence, not new architecture)**
**Rules:**
- R1: Use existing `NormalizedRequest` / `NormalizedResponse` — no new type system
- R2: Place adapters in `src/core/provider-adapters/` — no parallel registry path
- R3: Fix execution correctness, not introduce new architecture

---

## File 1: `src/core/provider-adapters/aliyun-video.adapter.ts` [NEW]

```ts
import type { ModelPluginAdapter, NormalizedRequest, NormalizedResponse, Candidate } from '../provider-registry/types.js'
import { aliyunVideo } from '../../services/aliyun-video.provider.js'

export class AliyunVideoAdapter implements ModelPluginAdapter {
  readonly provider = 'aliyun'

  models(): Candidate[] {
    return [
      {
        provider: 'aliyun',
        model: 'wan2.7-t2v',
        capability: 'video',
        cost: 0.4,
        latency: 0.5,
        quality: 0.8,
        reliability: 0.8,
      },
    ]
  }

  async execute(request: NormalizedRequest, candidate: Candidate, _signal?: AbortSignal): Promise<NormalizedResponse> {
    const params: any = request.params ?? {}
    const prompt = request.prompt ?? params.prompt ?? ''
    const duration = params.duration ?? 5
    const ratio = params.ratio ?? '16:9'

    const taskId = await aliyunVideo.submit({
      prompt,
      duration,
      ratio,
      imageUrl: params.imageUrl,
      model: candidate.model,
    })

    const result = await aliyunVideo.waitForCompletion(taskId!, 5000)

    return {
      content: result.videoUrl || '',
      model: candidate.model,
      latencyMs: 0,
      raw: { taskId, status: result.status },
    }
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  label(): string {
    return 'Aliyun Video'
  }
}
```

---

## File 2: `src/core/provider-adapters/volcengine-video.adapter.ts` [FIXED]

**Bug fixed:** `volcengineVideoWrapped.generate()` was a fake API — the wrapped object only has `submit/poll/waitForCompletion`. Adapter now uses the correct method chain.

```diff
-    const result = await volcengineVideoWrapped.generate(params)
+    const taskId = await volcengineVideoWrapped.submit({
+      prompt,
+      duration,
+      ratio,
+      imageUrl: params.imageUrl,
+      model: candidate.model,
+    })
+    const result = await volcengineVideoWrapped.waitForCompletion(taskId!, 5000)
```

Full corrected file:

```ts
import type { ModelPluginAdapter, NormalizedRequest, NormalizedResponse, Candidate } from '../provider-registry/types.js'
import { volcengineVideoWrapped } from '../provider-wrapper/volcengine/volcengine-video.wrapper.js'

export class VolcengineVideoAdapter implements ModelPluginAdapter {
  readonly provider = 'volcengine'

  models(): Candidate[] {
    return [
      {
        provider: 'volcengine',
        model: 'doubao-seedance-1-5-pro-251215',
        capability: 'video',
        cost: 0.3,
        latency: 0.4,
        quality: 0.85,
        reliability: 0.85,
      },
    ]
  }

  async execute(request: NormalizedRequest, candidate: Candidate, _signal?: AbortSignal): Promise<NormalizedResponse> {
    const params: any = request.params ?? {}
    const prompt = request.prompt ?? params.prompt ?? ''

    const taskId = await volcengineVideoWrapped.submit({
      prompt,
      duration: params.duration ?? 5,
      ratio: params.ratio ?? '16:9',
      imageUrl: params.imageUrl,
      model: candidate.model,
      ...params,
    })

    const result = await volcengineVideoWrapped.waitForCompletion(taskId, 5000)

    return {
      content: result.videoUrl || '',
      model: candidate.model,
      latencyMs: 0,
      raw: { taskId, status: result.status },
    }
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  label(): string {
    return 'Volcengine Video'
  }
}
```

---

## File 3: `src/core/provider-adapters/index.ts` [MODIFIED]

Add the export:

```diff
 export { SiliconflowImageAdapter } from './siliconflow-image.adapter.js'
 export { AliyunImageAdapter } from './aliyun-image.adapter.js'
 export { VolcengineImageAdapter } from './volcengine-image.adapter.js'
 export { VolcengineVideoAdapter } from './volcengine-video.adapter.js'
+export { AliyunVideoAdapter } from './aliyun-video.adapter.js'
 export { SiliconflowTTSAdapter } from './siliconflow-tts.adapter.js'
 export { AliyunTTSAdapter } from './aliyun-tts.adapter.js'
 export { VolcengineTTSAdapter } from './volcengine-tts.adapter.js'
```

---

## File 4: `src/index.ts` [MODIFIED]

Register the new adapter:

```diff
-  pluginRegistry.register(new VolcengineVideoAdapter())
+  pluginRegistry.register(new AliyunVideoAdapter())
+  pluginRegistry.register(new VolcengineVideoAdapter())
   console.log('[startup] Registered 7 provider adapters (4 image/video + 3 tts)')
+  console.log('[startup] Registered AliyunVideoAdapter — video coverage complete (2 providers)')
```

**Note:** The startup log message should also be updated to reflect 8 adapters:

```diff
-  console.log('[startup] Registered 7 provider adapters (4 image/video + 3 tts)')
+  console.log('[startup] Registered 8 provider adapters (5 image/video + 3 tts)')
```

---

## No Changes To

| File | Reason |
|------|--------|
| `src/core/provider-registry/types.ts` | `NormalizedRequest` / `NormalizedResponse` already sufficient |
| `src/queue/capability-dispatcher.ts` | Already handles video via `executeWithAdapter()` — no change needed |
| `src/routes/images.ts` | Route SDK removal is Phase 1D |

---

## Verification

```bash
# 1. Compile
npx tsc --noEmit

# 2. No fake APIs in adapters
grep -rn "\.generate(" src/core/provider-adapters/

# 3. No direct SDK calls in routes (Phase 1D target, check anyway)
grep -rn "aliyunVideo\|volcengineVideo" src/routes/
```

## Post-Phase 1A State

```
VIDEO_ADAPTER_COVERAGE = TRUE (aliyun + volcengine)
VIDEO_CONTRACT = UNIFIED (submit + waitForCompletion)
DISPATCHER = VALID SINGLE TRUTH (for video)
GENERATE_BUG = FIXED
ROUTE SDK = NOT YET REMOVED (Phase 1D)
```
