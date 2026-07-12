# Sprint I-002: Legacy Dependency Inventory

**Project:** Kunlun Mirror (昆仑镜) — Legacy Execution Convergence  
**Legacy entry point:** `backend/src/routes/ai-tasks.ts` (DEPRECATED)  
**Target entry point:** `backend/src/routes/platform/execution/execution.route.ts` (POST /api/platform/execution/execute)  
**Date:** 2026-07-03  
**Policy:** DO NOT MODIFY any code. Inventory only.

---

## Legacy API Surface Summary

### Legacy endpoints (in `ai-tasks.ts`):

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/tasks/ai-generate` | Create AI task (image/tts/video/frame) |
| GET | `/api/tasks/:id/status` | Poll task status |
| GET | `/api/tasks/:id/result` | Get completed task result URL |
| POST | `/api/tasks/batch-create` | Batch-create tasks |
| POST | `/api/provider-cache/cleanup` | Clean provider cache |

### Legacy Request Shape (POST /api/tasks/ai-generate):
```json
{
  "projectId": "string",
  "taskType": "image|tts|video|frame",
  "input": { /* type-specific payload */ },
  "priority": 1
}
```

### Legacy Response Shape (success):
```json
{
  "success": true,
  "task": {
    "id": "uuid",
    "projectId": "string",
    "taskType": "string",
    "status": "queued",
    "priority": 1
  }
}
```

### Legacy Status/Result Response:
```json
{
  "success": true,
  "task": {
    "id": "uuid", "status": "completed|failed|...",
    "result": { "url": "...", "imageUrl": "..." }
  }
}
```

### Target API Shape (POST /api/platform/execution/execute):
```json
{
  "capabilityId": "string",
  "contract": {
    "id": "string", "name": "string", "displayName": "string",
    "description": "string|null", "category": "string",
    "version": "string", "status": "string",
    "metadata": { ... }
  },
  "input": { "projectId": "...", ... },
  "strategy": "string"
}
```
**Response:** `{ "success": true, "data": { "status": "completed", ... } }`

---

## Caller #1: VideoGenerationWorkspace.vue

**File:** `/root/shipin-cinematic-studio/frontend/studio-v2/workspace/video-generation/VideoGenerationWorkspace.vue` (3661 lines)

### API Usage

**Direct fetch calls to legacy endpoints:**
1. **`POST /api/tasks/ai-generate`** — Frame image generation (`taskType: 'image'`) — line 1867
   - Request body: `{ projectId, taskType: 'image', input: { prompt, negativePrompt, mode, imageUrl, referenceImages, source, name, aspectRatio, size, videoStyle } }`
   - Response: `{ success, task: { id, ... } }`
   - Polls: `GET /api/tasks/${taskId}/status` (30× 2s = 60s timeout) — line 1906

2. **`POST /api/tasks/ai-generate`** — Three-frame batch generation (`taskType: 'image'`) — lines 1985, 1997, 2009
   - 3 parallel fetches for first/mid/last frame
   - Request: `{ projectId, taskType: 'image', input: { prompt, referenceImages, negativePrompt, size, n, temperature } }`
   - Polls each: `GET /api/tasks/${taskId}/status` (30× 2s = 60s timeout) — line 2034

3. **`POST /api/tasks/ai-generate`** — Video generation (`taskType: 'video'`) — line 2159
   - Request: `{ projectId, taskType: 'video', input: { narrative, dialogue, effects, optimizedShots, negativePrompt, segmentIndex, segmentId, duration, ratio, firstFrameUrl, midFrameUrl, lastFrameUrl, characterReferenceUrls, voiceMap, model, videoStyle } }`
   - Polls: `GET /api/tasks/${taskId}/status` (240× 1s = 240s timeout) — line 2208

4. **`POST /api/provider-cache/cleanup?type=video`** — line 2118

**Other API calls (NOT legacy):**
- `POST /api/ai/optimize-video-prompt` — line 672
- `POST /api/ai/optimize-shot-script` — line 1393
- `POST /api/ai/optimize-frame-prompt` — line 1633
- `GET /api/projects/segments/:pid` — line 738
- `POST /api/projects/segments/save` — line 795
- `GET /api/execution-images/characters/:pid` — line 1057
- `GET /api/execution-images/scenes/:pid` — line 1067
- `GET /api/voice/records` — line 1095
- `POST /api/evaluation/record-action` — line 2068
- `GET/POST /api/executions/:pid` — line 2327
- `GET /api/video/merge/check/:pid` — line 2395
- `POST /api/video/merge/:pid` — line 2439
- `GET /api/video/merge/status/:pid` — line 2462

### Dependency Analysis
- **Can keep using Legacy proxy?** YES — All calls are direct `fetch()` to `/api/tasks/ai-generate`. As long as the legacy route remains operational, this will work. The route has the deprecation `onRequest` hook but no removal schedule.
- **Migratable to platform/execution?** YES — Functionally equivalent (the new system handles image/video generation via capabilities). However, the response shape is different (the new API uses `capabilityId` + `contract` instead of `taskType` + `input`), and polling would need to be adapted.
- **Migration effort:** HIGH — This is the most heavily dependent caller (3 distinct use patterns: frames, three-frame-batch, video) with polling loops reading specific response fields (`task.id`, `task.status`, `task.result.url`, `task.error`). Response shape compatibility is tight.
- **Recommended priority:** 8 (9 = hardest, defer to later sprint)

### Notes
- Uses raw `fetch()` calls, NOT the `api.ts` wrapper
- Reads `task.id`, `task.status`, `task.result.url`, `task.result.imageUrl`, `task.error` from responses
- Has 30s/60s/240s polling timeouts — any new API must support equivalent async status checking
- Calls `/api/provider-cache/cleanup` separately before video generation (side-effect dependency)

---

## Caller #2: StoryboardWorkspace.vue

**File:** `/root/shipin-cinematic-studio/frontend/studio-v2/workspace/storyboard/StoryboardWorkspace.vue` (1705 lines)

### API Usage

**Direct fetch calls to legacy endpoints:**
1. **`POST /api/tasks/ai-generate`** — Storyboard image generation (`taskType: 'image'`) — line 857
   - Request body: `{ projectId, taskType: 'image', priority, input: { prompt, negativePrompt, source, segmentId, referenceImages, videoStyle, imageUrl, mode } }`
   - Response: `{ success, task: { id, ... } }`
   
2. **`GET /api/tasks/${taskId}/status`** — Polls 30× 2s (60s) — line 876

3. **`GET /api/tasks/${taskId}/result`** — Gets final image URL — line 882
   - Expects: `{ success, data: { url } }`

**Other API calls (NOT legacy):**
- `GET /api/execution-images/storyboards/all` — line 627
- `GET /api/aigc-spec/:projectId/load` — line 646
- `GET /api/execution-images/storyboards/:projectId` — lines 738, 792
- `PUT /api/execution-images/storyboards` — line 908
- `POST /api/script/regenerate` — line 1065

### Dependency Analysis
- **Can keep using Legacy proxy?** YES — All calls are standard legacy route calls that will continue to work.
- **Migratable to platform/execution?** YES — Image generation is a core capability. The new API can handle it.
- **Migration effort:** MEDIUM — Uses 3 legacy endpoints (generate, status, result). Polling logic and response field reads (`task.id`, `task.status`, `task.result.url`, `data.url`) need updating. Only one generation pattern (single image per segment).
- **Recommended priority:** 5

### Notes
- Uses raw `fetch()` calls
- Relies on both `/status` AND `/result` endpoints (distinct polling paths)
- Fallback logic: tries `/result` first for URL, falls back to `taskData.result.url`
- Saves result to `/api/execution-images/storyboards` after generation

---

## Caller #3: AdvertisementWorkspace.vue

**File:** `/root/shipin-cinematic-studio/frontend/studio-v2/workspace/advertisement/AdvertisementWorkspace.vue` (1049 lines)

### API Usage

**Direct fetch calls to legacy endpoints:**
1. **`POST /api/tasks/ai-generate`** — Advertisement image generation (`taskType: 'image'`) — line 731
   - Request: `{ projectId: '00000000-...', taskType: 'image', input: { prompt, negativePrompt, mode, model, referenceImage, n } }`
   - Polls: `GET /api/tasks/${taskId}/status` (30× 2s) — line 758

2. **`GET /api/tasks/${taskId}/status`** — Ad video polling (600× 1s = 10min timeout) — lines 579, 612
   - Polls for video tasks submitted through a DIFFERENT endpoint (`/api/ai/generate-ad-video`)

**Other API calls (NOT legacy):**
- `POST /api/ai/generate-ad-video` — Ad video generation (line 543) — **SEPARATE ROUTE, not ai-tasks**
- `POST /api/ai/optimize-ad-script` — line 483
- `POST /api/ai/optimize-image-prompt` — line 690
- `GET /api/user/llm-config` — line 436
- `POST /api/upload/video` — line 420

### Dependency Analysis
- **Can keep using Legacy proxy?** YES — Image generation via `/api/tasks/ai-generate` works. Video generation goes through `/api/ai/generate-ad-video` (NOT the legacy route), but its status polling still uses `/api/tasks/${taskId}/status`.
- **Migratable to platform/execution?** YES/NO — Image generation is migratable. The `/api/ai/generate-ad-video` endpoint is a separate backend route that would need its own migration plan (not directly in scope of ai-tasks.ts migration).
- **Migration effort:** MEDIUM — Image generation portion is straightforward (1 pattern). Status polling for ad video would break if status endpoint changes.
- **Recommended priority:** 6

### Notes
- The ad video generation goes through `/api/ai/generate-ad-video` which is NOT in ai-tasks.ts — this route's downstream behavior needs separate investigation
- Status polling for BOTH image and video tasks uses the legacy `/api/tasks/${taskId}/status` endpoint
- Image polling timeout is 30× 2s (60s); video polling timeout is 600× 1s (10min)
- Reads `task.id`, `task.status`, `task.result.videoUrl`, `task.result.url`, `task.error` from status response

---

## Caller #4: FirstRunWizard.vue

**File:** `/root/shipin-cinematic-studio/frontend/components/wizard/FirstRunWizard.vue` (964 lines)

### API Usage

**Direct fetch calls to legacy endpoints:**
1. **`POST /api/tasks/ai-generate`** — First-run AI verification — line 409
   - Request body:
     ```json
     {
       "taskType": "llm",
       "prompt": "用一句话介绍杭州，不超过20个字",
       "model": "defaultModel",
       "config": { "temperature": 0.7, "maxTokens": 50 }
     }
     ```
   - **NOTICE:** Uses `taskType: 'llm'` which is **NOT** in the legacy route's valid types list (`['image', 'tts', 'video', 'frame']` — line 92 of ai-tasks.ts)
   - Expects response fields: `data.content || data.result || data.text`
   - **Does NOT poll for status** — expects a synchronous/completion response

**Other API calls (NOT legacy):**
- Uses `provider-api` utility module (`listProviders`, `verifyProvider`, `connectProvider`)

### Dependency Analysis
- **Can keep using Legacy proxy?** YES/NO — The route still exists and will accept the request. HOWEVER, the `taskType: 'llm'` is NOT in the valid types array of `ai-tasks.ts` (line 92: `['image', 'tts', 'video', 'frame']`). This means requests with `taskType: 'llm'` will be **rejected with 400**: `不支持的 taskType: llm，支持: image, tts, video, frame`.
  
  **IMPORTANT FINDING:** This caller may already be broken or was working through a different version of the route that accepted 'llm' as a type.
  
- **Migratable to platform/execution?** PARTIALLY — The LLM capability is conceptually available in the new platform, but the contract-based API is very different from this simple request/response pattern.
- **Migration effort:** MEDIUM — Simple call pattern (no polling), but the `taskType: 'llm'` incompatibility needs attention first. The response shape expectations (`data.content || data.result || data.text`) don't match either legacy or target API.
- **Recommended priority:** 1 (simplest standalone dependency; also potentially already broken)

### Notes
- **CRITICAL FINDING:** Uses `taskType: 'llm'` which ai-tasks.ts explicitly rejects (line 92-95). This may have been intended for a different routing layer or previous code version.
- No polling — expects immediate response with LLM text content
- Response shape expected: `data.content || data.result || data.text` — not matching the legacy route's `{ success, task: { id, status: 'queued', ... } }` shape
- This caller may need a **separate non-queued LLM endpoint** rather than the task queue system

---

## Caller #5: api.ts (frontend/studio-v2/api.ts)

**File:** `/root/shipin-cinematic-studio/frontend/studio-v2/api.ts` (80 lines)

### API Usage

**API wrapper methods:**
1. **`api.tasks.generate(data)`** → `POST /api/tasks/ai-generate` — line 55
   - Generic data passthrough, no specific shape enforced in wrapper
   - Returns: `res.json()` (generic)

2. **`api.tasks.status(taskId)`** → `GET /api/tasks/${taskId}/status` — line 56
   - Returns: `res.json()` (generic)

**Other methods (NOT legacy):**
- `api.script.*` → `/api/script/regenerate`, `/api/ai/optimize-*`, `/api/script-breakdown`
- `api.executionImages.*` → `/api/execution-images/*`
- `api.ad.*` → `/api/ai/generate-ad-video`, `/api/ai/optimize-ad-script`

### Dependency Analysis
- **Can keep using Legacy proxy?** YES — Thin passthrough wrapper. No logic dependency on response shape.
- **Migratable to platform/execution?** YES — Wrapper is easy to update; the callers that use `api.tasks.generate()` would need the new URL and request shape.
- **Migration effort:** LOW — Single file, 2 methods to update. The methods are thin wrappers with no response processing logic.
- **Recommended priority:** 2 (easy win; update wrapper first, then individual callers)

### Notes
- This is the **central API client** that other components COULD use, but the Vue workspaces (callers #1-#3) use raw `fetch()` instead
- Any workspace using `api.tasks.generate()` would automatically be redirected after updating this wrapper
- Currently no polling/status logic lives in this wrapper — callers implement their own polling

---

## Caller #6: TTS Route (tts.ts)

**File:** `/root/shipin-cinematic-studio/backend/src/routes/tts.ts` (107 lines)

### API Usage

**Proxies to legacy:**
1. **`POST /api/tts/generate`** → proxies to `POST /api/tasks/ai-generate` — line 79
2. **`POST /api/tts/synthesize`** → proxies to `POST /api/tasks/ai-generate` — line 76

**Proxy mechanism:**
- Uses `server.inject()` (internal Fastify redirect) — primary path (line 46)
- Fallback: external `fetch()` to `http://localhost:${PORT}/api/tasks/ai-generate` (line 60)

**Proxied request body:**
```json
{
  "projectId": "projectId || null",
  "taskType": "tts",
  "input": {
    "text": "... (trimmed to 500 chars)",
    "voiceId": "zh_male_deep",
    "speed": 1.0,
    "source": "voice"
  }
}
```

**Response:** Direct passthrough of ai-tasks response (no transformation).

### Dependency Analysis
- **Can keep using Legacy proxy?** YES — This IS the proxy. Will continue to work as long as the legacy route exists.
- **Migratable to platform/execution?** YES — TTS capability maps directly to the new platform execution system.
- **Migration effort:** LOW — The proxy function (`proxyToQueue`) just needs its internal redirect URL changed from `/api/tasks/ai-generate` to `/api/platform/execution/execute`, with appropriate request body transformation.
- **Recommended priority:** 3

### Notes
- Has dual-path architecture (inject → internal, fallback → external fetch)
- Response passthrough — no transformation needed
- `GET /api/tts/voices` is NOT affected (information-only query, not AI execution)

---

## Caller #7: Images Route (images.ts)

**File:** `/root/shipin-cinematic-studio/backend/src/routes/images.ts` (272 lines)

### API Usage

**Proxies to legacy:**
1. **`POST /images/generate`** → proxies to `POST /api/tasks/ai-generate` (taskType: 'image') — line 87
2. **`POST /images/generate-json`** → same proxy — line 90
3. **`POST /images/generate-and-download`** → same proxy — line 93
4. **`POST /videos/generate`** → proxies to `POST /api/tasks/ai-generate` (taskType: 'video') — line 97
5. **`GET /videos/status/:taskId`** → proxies to `GET /api/tasks/ai-generate/status/${taskId}` — line 211

**Proxy mechanism:**
- `server.inject()` internal redirect — primary (lines 31, 101)
- Fallback: external `fetch()` — lines 58, 127

**Proxied image request:**
```json
{
  "projectId": "body.projectId || '__image_proxy__'",
  "taskType": "image",
  "input": { "prompt", "negativePrompt", "width", "height", "mode", "referenceImage",
             "referenceImages", "aspectRatio", "model", "size", "n": 1, "source": "image" }
}
```

**Proxied video request:**
```json
{
  "projectId": "body.projectId || '__video_proxy__'",
  "taskType": "video",
  "input": { "prompt", "negativePrompt", "width", "height", "mode", "referenceImage",
             "duration": 5, "model", "audioUrl", "segmentId", "source": "video" }
}
```

**Other routes (NOT legacy):**
- `POST /images/save` — database-only operation
- `GET /props/:projectId` — query
- `GET /videos/download-all/:projectId` — file download
- `GET /projects/:id/character-makeup-images` — query

### Dependency Analysis
- **Can keep using Legacy proxy?** YES — This IS the proxy layer. Will continue working as long as legacy route exists.
- **Migratable to platform/execution?** YES — Image and video generation are core capabilities in the platform system.
- **Migration effort:** MEDIUM — Multiple proxied endpoints (5 routes × 2 code paths each = inject + fallback). Each endpoint constructs different request bodies. Response passthrough simplifies things.
- **Recommended priority:** 4

### Notes
- Heaviest backend proxy — covers image AND video generation
- Has parity-breaking behavior: `POST /videos/generate` is in `images.ts` (legacy artifact)
- `/videos/status/:taskId` proxies to `/api/tasks/ai-generate/status/${taskId}` (note the malformed URL — uses `ai-generate/status/` instead of `tasks/${taskId}/status`)
- Internal `server.inject()` + external `fetch()` fallback in all proxy functions

---

## Caller #8: Voice Route (voice.ts)

**File:** `/root/shipin-cinematic-studio/backend/src/routes/voice.ts` (340 lines)

### API Usage

**Proxies to legacy:**
1. **`POST /api/voice/test`** → proxies to `POST /api/tasks/ai-generate` (taskType: 'tts') — line 193

**Proxy mechanism:**
- `server.inject()` internal redirect ONLY (lines 203-217) — NO external fetch fallback
  
**Proxied request body:**
```json
{
  "projectId": "__voice_test__",
  "taskType": "tts",
  "input": {
    "text": "...",
    "voiceId": "voiceId || voice || 'Aria'",
    "speed": 1.0,
    "source": "voice_test"
  }
}
```

**Response:** Direct passthrough.

**Other routes (NOT legacy):**
- `POST /api/voice/design` — non-execution voice design
- `POST /api/voice/clone` — non-execution voice clone
- `GET /api/voice/presets` — query
- `DELETE /api/voice/presets/:id` — delete
- `GET /api/voice/builtin-list` — file listing
- `PUT /api/hdz/character/:name/voice` — update
- `GET /api/voice/records` — query
- `POST /api/voice/records/save` — save
- `POST /api/voice/ai-design` — AI-powered design (calls provider directly)

### Dependency Analysis
- **Can keep using Legacy proxy?** YES — Single endpoint, clean proxy, no code changes needed for continued operation.
- **Migratable to platform/execution?** YES — TTS is a standard capability.
- **Migration effort:** LOW — Only one proxied endpoint, simple request body, no external fetch fallback. Straightforward to redirect.
- **Recommended priority:** 3

### Notes
- Cleanest proxy implementation — only `server.inject()`, no fallback
- Uses special projectId `__voice_test__` (not a real project)
- Response passthrough — no transformation

---

## Caller #9: Dual Render Orchestrator (dual-render-orchestrator.ts)

**File:** `/root/shipin-cinematic-studio/backend/src/services/p18/dual-render-orchestrator.ts` (173 lines)

### API Usage

**Direct function call (NOT over HTTP):**
1. **`enqueueTask()`** — lines 90, 102
   - Imported from `../../queue/queue-manager.js` — line 17
   - Called with:
     ```typescript
     enqueueTask({
       taskType: 'video',      // always 'video'
       projectId: string,
       userId: string,
       input: Record<string, any>,
       priority: number,
       runtime?: RuntimePayload,  // V3 pipeline only (line 116)
     })
     ```
   - Returns: `string` (traceId) — assigned to `v2TraceId`, `v3TraceId`

**V2 pipeline call (line 90-97):**
```typescript
await enqueueTask({
  taskType: 'video',
  projectId,
  userId,
  input: v2Input,  // from caller
  priority,         // from caller
  // NO runtime passed (V2 is pure baseline)
})
```

**V3 pipeline call (line 102-117):**
```typescript
await enqueueTask({
  taskType: 'video',
  projectId,
  userId,
  input: {
    _p18V3: true,
    _p18PairId: pairId,
    promptIR: v3PromptIR,
    enablePolish: enableV3Polish,
    _sourceTaskType: 'p18-dual-render',
  },
  priority: Math.max(1, priority - 1),
  runtime,  // Passes RuntimePayload directly
})
```

### Dependency Analysis
- **Can keep using Legacy proxy?** NO — This does NOT use the HTTP route at all. It calls `enqueueTask()` directly from the queue manager module. The legacy proxy route is irrelevant—this bypasses it entirely.
- **Migratable to platform/execution?** PARTIALLY — The queue manager (`queue-manager.ts`) is also DEPRECATED. The orchestrator would need to switch from direct `enqueueTask()` calls to the new `executionService.executeFromContract()` or the new control plane API. The `RuntimePayload`-based architecture in V3 may map to the new capabilities system.
- **Migration effort:** HIGH — This is a deeply integrated service-layer caller, not a simple HTTP proxy. Requires:
  1. Replacing `enqueueTask()` with equivalent new execution API
  2. Adapting `DualRenderInput` / `RuntimePayload` to the contract-based system
  3. Maintaining the dual V2/V3 pipeline semantics
  4. Updating the p18_pair record-keeping logic
- **Recommended priority:** 9 (hardest, keep for last)

### Notes
- **Only backend service** that bypasses HTTP and calls `enqueueTask()` directly
- V2 pipeline intentionally does NOT pass `runtime` — it relies on the queue-manager's internal resolution
- V3 pipeline passes `RuntimePayload` explicitly with experimental flags
- The `enqueueTask()` return value (`traceId`) is different from the HTTP route's response (`{ success, task: { id } }`)
- `/api/voice/ai-design` (line 280 in voice.ts) calls providers directly (convergenceController) — NOT through ai-tasks. Not a current dependency but worth noting for full migration.

---

## Ranked Migration Priority Table

| Rank | Caller | Effort | Reason |
|:----:|--------|:------:|--------|
| **1** | **FirstRunWizard.vue** | MEDIUM | Simplest standalone caller. **Potentially already broken** (uses invalid `taskType: 'llm'`). No polling. Needs separate LLM endpoint rather than task queue. |
| **2** | **api.ts** | LOW | Central API wrapper. Easy 2-method update. Updating this first gives downstream consumers a migration path. No workspace currently uses it for legacy tasks (they use raw `fetch()`), but fixing this creates the migration foundation. |
| **3** | **tts.ts** | LOW | Cleanest backend proxy. Single redirected URL change with request body mapping. No fallback complexity for voice test. |
| **3** | **voice.ts** | LOW | Single proxied endpoint (`/api/voice/test`). Clean `server.inject()` only. Straightforward redirect. |
| **5** | **images.ts** | MEDIUM | Multiple proxied endpoints (5 routes). Different request shapes for image vs video. Has `server.inject()` + external `fetch()` fallback. Includes a legacy /videos/generate route that's misplaced in this file. |
| **6** | **AdvertisementWorkspace.vue** | MEDIUM | Image generation portion is migratable, but ad video goes through separate `/api/ai/generate-ad-video` route. Status polling for both uses legacy `/api/tasks/:id/status`. |
| **7** | **StoryboardWorkspace.vue** | MEDIUM | Uses 3 legacy endpoints (generate, status, result). Single generation pattern. Has `/result` endpoint dependency. |
| **8** | **VideoGenerationWorkspace.vue** | HIGH | Most complex frontend caller. 3 distinct generation patterns (frame, three-frame batch, video). Multiple polling loops. Reads specific response fields. Calls `/api/provider-cache/cleanup` as side effect. |
| **9** | **dual-render-orchestrator.ts** | HIGH | Bypasses HTTP entirely — calls `enqueueTask()` directly. Deep service-layer integration. Dual V2/V3 pipeline semantics. Requires full architectural migration. Saved for last. |

---

## Summary Statistics

- **Total callers:** 9
- **Frontend callers:** 5 (VideoGenerationWorkspace, StoryboardWorkspace, AdvertisementWorkspace, FirstRunWizard, api.ts)
- **Backend proxy callers:** 3 (tts.ts, images.ts, voice.ts)
- **Direct queue caller:** 1 (dual-render-orchestrator.ts)
- **Can keep using legacy proxy:** 8 out of 9 (all except dual-render-orchestrator)
- **Already potentially broken:** 1 (FirstRunWizard.vue — invalid `taskType: 'llm'`)
- **Migration priority tiers:**
  - **Low effort (rank 1-3):** FirstRunWizard, api.ts, tts.ts, voice.ts → Sprint I-003
  - **Medium effort (rank 4-7):** images.ts, AdWorkspace, StoryboardWorkspace → Sprint I-004/I-005
  - **High effort (rank 8-9):** VideoGenerationWorkspace, dual-render-orchestrator → Sprint I-006+
