# ERTG v0.1: Execution Runtime Truth Graph

**Generated: 2026-05-16 17:20 CST**
**Source: src/ code analysis, NOT design docs**
**Scope: All execution entry points → dispatch decisions → provider sinks → data mutations**

---

## Layer 1: Entry Points

```
HTTP ROUTES:
  POST /api/images/generate   → images.ts (line 226)     image generation
  POST /api/images/video      → images.ts (line 340+)    video generation
  POST /api/tts/generate      → tts.ts (line 33)         TTS generation
  GET/POST /api/storyboards/*  → storyboards.ts          LLM (narrative)
  POST /api/customer-service/* → customer-service.ts     LLM (chat)
  ...metadata routes (config/keys/models)                 non-execution

QUEUE WORKERS:
  processImage   → dispatchByCapability('image')          worker-runtime.ts
  processVideo   → dispatchByCapability('video')          worker-runtime.ts
  processTTS     → dispatchByCapability('tts')            worker-runtime.ts
  processLLM     → dispatchByCapability('llm')            worker-runtime.ts
  processFrame   → dispatchByCapability('image') + DB     worker-runtime.ts
  processExport  → exportRuntime()                        worker-runtime.ts
```

## Layer 2: Dispatch Decision

```
dispatchByCapability (capability-dispatcher.ts)
  → getEffectiveCandidates(userId, capability)   [UserInstanceRegistry + system fallback]
  → policyAdapter.evaluate(signal)                [policy engine]
  → pluginRegistry.getAdapter(selected.provider)  [adapter resolution]
  → adapter.execute(request, candidate)           [execution]
  → DispatchResult                                 [normalized output]

selectAndExecuteImage (images.ts:45, route-only)
  → getEffectiveCandidates(userId, 'image')
  → policyAdapter.evaluate(signal)
  → pluginRegistry.getAdapter(selected.provider)
  → adapter.execute(request, candidate)
  → ImageExecutionResult
  NOTE: This is a standalone copy of the same logic, NOT dispatchByCapability call.
  Same function body, separate invocation path.
```

## Layer 3: Execution Paths (Per Capability)

### IMAGE (SYNC) — ✅ SINGLE TRUTH

```
Path A (route, images.ts:226):
  HTTP POST /api/images/generate
  → selectAndExecuteImage()
  → getEffectiveCandidates('image') → 3 candidates (siliconflow, aliyun, volcengine)
  → policyAdapter.evaluate() → selected provider
  → pluginRegistry.getAdapter(provider) → SiliconflowImageAdapter | AliyunImageAdapter | VolcengineImageAdapter
  → adapter.execute(prompt, model)
  → SDK call → image URL
  → IMAGE RESULT ✓

Path B (worker, worker-runtime.ts):
  queue job → processImage()
  → dispatchByCapability('image')
  → [identical flow via capability-dispatcher.ts]
  → IMAGE RESULT ✓

BOTH PATHS CONVERGE TO SAME ADAPTER SET. Single truth.
```

### TTS (SYNC) — ✅ SINGLE TRUTH

```
Path A (route, tts.ts:33):
  HTTP POST /api/tts/generate
  → dispatchByCapability('tts')
  → getEffectiveCandidates('tts') → 3 candidates
  → policyAdapter.evaluate() → selected provider
  → pluginRegistry.getAdapter(provider) → SiliconflowTTSAdapter | AliyunTTSAdapter | VolcengineTTSAdapter
  → adapter.execute(text, voice, model)
  → SDK call → audio URL
  → TTS RESULT ✓

Path B (worker):
  queue job → processTTS()
  → dispatchByCapability('tts')
  → [identical flow]
  → TTS RESULT ✓

SINGLE TRUTH. Both paths converge to same 3 adapters.
```

### LLM (STREAM) — ◉ FALSE UNIFICATION (DISPATCHER = DEAD CODE)

```
Path A (worker → dispatcher — THIS ALWAYS FAILS):
  queue job → processLLM()
  → dispatchByCapability('llm')
  → getEffectiveCandidates('llm') → candidates returned (from registry config)
  → policyAdapter.evaluate() → selects provider
  → pluginRegistry.getAdapter(provider) → NO LLM ADAPTERS REGISTERED
  → ❌ CapabilityAdapterMissingError THROWN
  → Worker does NOT catch this error
  → JOB FAILS

Path B (legacy — WHAT ACTUALLY RUNS):
  HTTP POST (narrative-gateway, agent routes, director routes)
  → runtime/providers/provider.registry.ts
  → getProvider('openai') | getProvider('deepseek')
  → openai.provider.call() | deepseek.provider.call()
  → LLM API → text response
  → LLM RESULT ✓

  OR via worker-runtime legacy fallback:
  → queue job → worker picks task type
  → calls legacy runtime/providers/* directly
  → (same result)

CRITICAL:
  - dispatcher path is DEAD CODE (always throws)
  - legacy path is the REAL SYSTEM
  - NO LLM adapter is registered (0 / 7)
  - stream-plane.ts: NOT IMPLEMENTED
  - LLMExecutionAdapter: NOT IMPLEMENTED
  - The worker-runtime.ts line "llm: processLLM" is a functional lie
```

### VIDEO (ASYNC) — ❌ NON-DETERMINISTIC DUAL TRUTH

```
Path A (route — DIRECT SDK, BYPASSES DISPATCHER):
  POST /api/images/generate (images.ts:340+)
  → userHasVideoKey ? withUserKey(..., aliyunVideo.submit()) : direct call
  → aliyunVideo.submit(prompt, duration, ratio) | volcengineVideo.submit(prompt, duration, ratio)
  → SDK call → { taskId }
  → poll loop (every N seconds) → check status
  → complete → save result to DB
  → VIDEO RESULT ✓

Path B (worker — VIA DISPATCHER, STUB ADAPTER):
  queue job → processVideo()
  → dispatchByCapability('video')
  → getEffectiveCandidates('video') → candidates
  → policyAdapter.evaluate() → selected provider
  → pluginRegistry.getAdapter(provider) → VolcengineVideoAdapter (STUB)
  → adapter.execute() → ??? (may not actually submit to provider)
  → ??? RESULT (undefined behavior)

CRITICAL — DOUBLE EXECUTION RISK:
  Same user request can trigger BOTH paths:
  1. Route handler submits video job (Path A) → gets taskId
  2. Route handler also enqueues a queue job → worker processes (Path B)
  3. Video job submitted TWICE to provider
  4. No idempotency key between the two paths

Submissions per request: 0, 1, or 2 (non-deterministic)
```

### FRAME (IMAGE + DB) — ✅ SINGLE TRUTH

```
Path:
  queue job → processFrame()
  → dispatchByCapability('image')
  → [image adapter path] → image URL
  → prisma.frameImage.deleteMany() + create()
  → FRAME RESULT ✓

Safe. Converges to same image adapter path.
```

## Layer 4: Data Mutation Points

```
image:  route → projectImage, assetDna, rights tables
tts:    route → audio record table
llm:    legacy → script, storyboard, analysis tables (multiple mutation sites)
video:  route → { taskId returned, poll loop writes videoResult }
        worker → ??? (undefined, may also write videoResult)
        SAME DB RECORD POTENTIALLY WRITTEN TWICE

queue state: job_queue table (SKIP LOCKED), read by queue-manager + workers
```

## Summary: Execution Graph Ontology Reality Check

```
Design claims: 3 planes (SYNC / STREAM / ASYNC)

Runtime truth:
  SYNC  = image + tts → ✅ SINGLE TRUTH (6 working adapters)
  STREAM= llm → ◉ FALSE UNIFICATION (dispatcher path is dead code)
  ASYNC = video → ❌ DUAL TRUTH (non-deterministic execution count)

Adapter count: 7 registered
  working:   6 (3x image + 3x tts)
  stub:      1 (volcengine-video — registered but incomplete)
  missing:   2 (LLMExecutionAdapter, AsyncPlaneAdapter)

Legacy bypass paths: 2
  - video route → aliyunVideo SDK direct call
  - video route → volcengineVideo SDK direct call
  - LLM → runtime/providers/ provider registry (complete parallel runtime)

Deploy readiness: ❌ BLOCKED
SYSTEM_STATUS = FALSE_UNIFICATION
Root cause: dispatchByCapability is NOT the single truth source
```

## Anomalies Detected

| ID | Severity | Description | Location |
|----|----------|-------------|----------|
| A1 | CRITICAL | LLM dispatcher path always throws (0 adapters) | capability-dispatcher.ts |
| A2 | CRITICAL | Video route bypass dispatcher with direct SDK | images.ts:340-420 |
| A3 | HIGH | Video double-execution risk (route + worker) | images.ts + worker-runtime.ts |
| A4 | MEDIUM | selectAndExecuteImage is standalone dispatch copy | images.ts:45 |
| A5 | LOW | Frame capability duplicates image dispatch path | worker-runtime.ts processFrame |
