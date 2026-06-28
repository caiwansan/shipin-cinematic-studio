# Volcengine Call Site Inventory — Phase 1A

> Generated: 2026-05-16 12:21
> Status: Pre-migration baseline

---

## 1. volcengineImage — 3 Source Exports, 5 Call Sites

### Export A: `services/volcengine-image.provider.ts` — Job Model
**Shape:** `export const volcengineImage = { generate(params), pollAndWait(taskId) }`

**Used by (3 call sites):**

| # | File | Line | Usage | Pattern |
|---|------|------|-------|---------|
| 1 | `routes/images.ts` | 71 | `gen: (p) => volcengineImage.generate(p)` | Fallback-to lambda |
| 2 | `routes/images.ts` | 96 | `gen: (p) => volcengineImage.generate(p)` | Switch case lambda |
| 3 | `routes/images.ts` | 104 | `gen: (p) => volcengineImage.generate(p)` | Default fallback lambda |
| 4 | `queue/worker-runtime.ts` | 31 | `volcengineImage.generate({ prompt, size, ... })` | Direct call with object params |

### Export B: `production-loop/video/volcengine.image.ts` — Stateless Model
**Shape:** `class VolcengineImageProvider` → `export const volcengineImage = new VolcengineImageProvider()`

**Used by (1 call site):**

| # | File | Line | Usage | Pattern |
|---|------|------|-------|---------|
| 5 | `production-loop/api.ts` | 371 | `volcengineImage.generate(prompt, { size, n, model })` | Direct call with (string, options) signature |

---

## 2. volcengineVideo — 1 Source Export, 2 Call Sites

### Export: `services/volcengine-video.provider.ts`
**Shape:** `export const volcengineVideo = { submit(params), poll(taskId), waitForCompletion(taskId) }`

**Used by (2 call sites):**

| # | File | Line | Usage | Pattern |
|---|------|------|-------|---------|
| 1 | `routes/images.ts` | 342 | `videoService = volcengineVideo` | Dynamic dispatch (aliyun vs volcengine) |
| 2 | `services/mock-worker.ts` | 172 | `volcengineVideo.submit({ ... })` | Direct submit |
| 3 | `services/mock-worker.ts` | 188 | `volcengineVideo.poll(taskId)` | Direct poll in loop |

**Note:** `routes/images.ts:342` uses `volcengineVideo` as default when `videoProviderName !== 'aliyun'`. Submit + waitForCompletion chain at lines 347-363.

---

## 3. volcengineTTS — 1 Source Export, 4 Call Sites

### Export: `services/volcengine-tts.provider.ts`
**Shape:** `export const volcengineTTS = { synthesize(params) }`

**Used by (4 call sites, all in same file):**

| # | File | Line | Usage | Pattern |
|---|------|------|-------|---------|
| 1 | `routes/tts.ts` | 67 | `volcengineTTS.synthesize({ text, voiceId, speed })` | Active provider direct call |
| 2 | `routes/tts.ts` | 85 | `volcengineTTS.synthesize({ text, voiceId, speed })` | DB key fallback |
| 3 | `routes/tts.ts` | 169 | `volcengineTTS.synthesize({ text, voiceId, speed })` | User key context |
| 4 | `routes/tts.ts` | 245 | `volcengineTTS.synthesize({ text, voiceId, speed })` | Additional synthesize path |

---

## 4. Summary Stats

| Symbol | Source Files | Call Sites | Lines of Code Touched |
|--------|:-----------:|:----------:|:--------------------:|
| volcengineImage | 2 (services + production-loop) | 5 | 4 files |
| volcengineVideo | 1 (services) | 2 (3 actual calls) | 2 files |
| volcengineTTS | 1 (services) | 4 | 1 file |
| **Total** | **4** | **11** | **5 files** |

---

## 5. Import Paths to Rewire

| Current Import Path | Files |
|---------------------|-------|
| `../services/volcengine-image.provider.js` | routes/images.ts, queue/worker-runtime.ts |
| `./video/volcengine.image.js` | production-loop/api.ts |
| `../services/volcengine-video.provider.js` | routes/images.ts, services/mock-worker.ts |
| `../services/volcengine-tts.provider.js` | routes/tts.ts |

---

## 6. Wrapper Strategy

| Symbol | Wrapper Type | Notes |
|--------|-------------|-------|
| volcengineImage (services) | Proxy on plain object | 4 call sites, job model |
| volcengineImage (production-loop) | Proxy on class instance | 1 call site, stateless model |
| volcengineVideo | Proxy on plain object | 2 call sites |
| volcengineTTS | Proxy on plain object | 4 call sites (same file) |

No merging. Each export gets its own wrapper.
