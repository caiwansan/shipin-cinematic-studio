# Capability Contract Evolution

**Phase: E2.4 — Architecture Documentation**
**Date: 2026-05-16**
**Author: Runtime Architecture Audit**

---

## 1. The Problem

`ModelPluginAdapter` currently defines a single execution contract:

```ts
interface ModelPluginAdapter {
  execute(request: NormalizedRequest, candidate: Candidate, signal?: AbortSignal): Promise<NormalizedResponse>
}
```

This works for **Artifact Capabilities** (image, tts) — request → single result.
It does **not** work for:

| Capability | Why `execute()` fails |
|-----------|---------------------|
| **llm** | Stateful — needs conversation history, streaming, retry with memory, token budgeting |
| **video** | Async lifecycle — submit → poll → cancel, not a single HTTP roundtrip |

---

## 2. Capability Classification

All capabilities divide into three **execution classes**:

### Class A: Artifact Generation (sync)

Existing semantics: `request → artifact URL`

| Capability | Current State |
|-----------|--------------|
| image | ✅ Fully migrated (3 adapters, capability dispatch) |
| tts | ✅ Fully migrated (3 adapters, Phase E2.1) |

Contract:
```ts
interface ArtifactAdapter extends BaseAdapter {
  execute(request: ArtifactRequest, candidate: Candidate): Promise<ArtifactResponse>
}
// ArtifactRequest = NormalizedRequest (unchanged)
// ArtifactResponse = NormalizedResponse (unchanged)
```

### Class B: Stateful Cognitive Execution (stream/conversation)

Required for: **llm**

The fundamental difference from Class A:
- **State**: Each call exists in a conversation context
- **Stream**: Tokens arrive asynchronously
- **Memory**: Previous turns affect next output
- **Tools**: May invoke external functions mid-generation

```ts
interface LLMAdapter extends BaseAdapter {
  /** Synchronous completion (for simple use cases) */
  complete(request: LLMRequest, candidate: Candidate): Promise<LLMResponse>

  /** Streaming completion (for real-time UX) */
  stream(request: LLMRequest, candidate: Candidate): AsyncIterable<LLMChunk>

  /** Health check with model-specific diagnostics */
  healthCheck(): Promise<LLMHealthStatus>
}

interface LLMRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
  stream?: boolean
  tools?: ToolDefinition[]
  signal?: AbortSignal
}

interface LLMChunk {
  content: string
  done: boolean
  delta: {
    tokens: number
    finishReason?: 'stop' | 'length' | 'tool_calls'
  }
}
```

### Class C: Async Job Lifecycle

Required for: **video**

The fundamental difference from A and B:
- **Submit** initiates an async process (seconds/minutes)
- **Poll** checks progress
- **Cancel** aborts mid-execution
- **Webhook** may deliver result asynchronously

```ts
interface AsyncJobAdapter extends BaseAdapter {
  /** Submit a job and return a tracking ID */
  submit(request: AsyncJobRequest, candidate: Candidate): Promise<JobHandle>

  /** Poll for current status */
  poll(jobId: string): Promise<JobStatus>

  /** Cancel a running job */
  cancel(jobId: string): Promise<void>

  /** Convenience: submit + poll until done */
  executeAndWait(request: AsyncJobRequest, candidate: Candidate, timeoutMs?: number): Promise<AsyncJobResult>
}

interface JobHandle {
  jobId: string
  estimatedDurationMs: number
}

interface JobStatus {
  jobId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: number  // 0–100
  result?: AsyncJobResult
  error?: string
}
```

---

## 3. Adapter Hierarchy

```ts
interface BaseAdapter {
  provider: string
  /** Primary capability the adapter is registered for */
  capability: Capability
  label(): string
}

// ─── Class A ─────────────────────────────────────

interface SyncExecutionAdapter extends BaseAdapter {
  execute(request: NormalizedRequest, candidate: Candidate, signal?: AbortSignal): Promise<NormalizedResponse>
}

// ─── Class B ─────────────────────────────────────

interface LLMExecutionAdapter extends BaseAdapter {
  complete(request: LLMRequest, candidate: Candidate): Promise<LLMResponse>
  stream(request: LLMRequest, candidate: Candidate): AsyncIterable<LLMChunk>
  healthCheck(): Promise<LLMHealthStatus>
}

// ─── Class C ─────────────────────────────────────

interface AsyncJobExecutionAdapter extends BaseAdapter {
  submit(request: AsyncJobRequest, candidate: Candidate): Promise<JobHandle>
  poll(jobId: string): Promise<JobStatus>
  cancel(jobId: string): Promise<void>
  executeAndWait(request: AsyncJobRequest, candidate: Candidate, timeoutMs?: number): Promise<AsyncJobResult>
}
```

**Migration path:**
- Class A adapters: `ModelPluginAdapter` → `SyncExecutionAdapter` (rename only, interface identical)
- Class B adapters: NEW — no migration from existing
- Class C adapters: NEW — no migration from existing

---

## 4. Decision: How Does Adapter Resolution Change?

**Current:**
```ts
const adapter = pluginRegistry.getAdapter(selected.provider)
const result = await adapter.execute(request, candidate)
```

**Future (Class B/C):**
The dispatcher must know **which contract** to call. Options:

### Option 1: Capability-type dispatch (recommended)

```ts
function executeWithAdapter(candidate, request) {
  const adapter = pluginRegistry.getAdapter(candidate.provider)

  if (isSyncAdapter(adapter)) {
    return adapter.execute(request, candidate)
  }
  if (isLLMAdapter(adapter)) {
    return candidate.capability === 'llm'
      ? adapter.complete(castToLLMRequest(request), candidate)
      : fallback()
  }
  // etc
}
```

Dispatch becomes capability-aware at the contract level, not the provider level.

### Option 2: Separate registry per class

```ts
syncRegistry.getAdapter(provider)     // → SyncExecutionAdapter
llmRegistry.getAdapter(provider)      // → LLMExecutionAdapter
asyncRegistry.getAdapter(provider)    // → AsyncJobExecutionAdapter
```

Cleaner but fragments the plugin registry. Current singleton + capability filter is simpler.

**Recommendation: Option 1**, implemented as a capability-type check in `capability-dispatcher.ts`.

---

## 5. Backward Compatibility

The current `ModelPluginAdapter` type should be **renamed to `SyncExecutionAdapter`** (not removed).
Existing image/tts adapters change only the `implements` clause.

```ts
// Before
class SiliconflowTTSAdapter implements ModelPluginAdapter {
// After
class SiliconflowTTSAdapter implements SyncExecutionAdapter {
```

The rename communicates intent without changing behavior.

All three TTS adapters written in Phase E2.1 are immediately compatible —
they already implement `execute()`, `healthCheck()`, `label()`.

---

## 6. Timeline

| Step | What | Blocked By |
|------|------|-----------|
| 1 | Rename `ModelPluginAdapter` → `SyncExecutionAdapter` | None (mechanical) |
| 2 | Define `LLMExecutionAdapter` in types.ts | Step 1 |
| 3 | Define `AsyncJobExecutionAdapter` in types.ts | Step 1 |
| 4 | Extend dispatcher for Class B/C dispatch | Steps 2+3 |
| 5 | Implement `DeepseekLLMAdapter` | Step 4 |
| 6 | Implement `AliyunVideoAdapter` | Step 4 |
| 7 | Normalize images.ts video route (remove legacy volcengineVideo/aliyunVideo imports) | Step 6 |

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| LLM streaming causes adapter contract churn | Medium | High | Keep `stream()` separate from `complete()` — one doesn't imply the other |
| Video async lifecycle breaks dispatcher's "single execute" assumption | High | Medium | AsyncJobAdapter's `executeAndWait()` provides backward-compatible surface |
| Capability-type dispatch adds branching in dispatcher | Low | Low | Branching is on capability (stable enum), not provider (growing set) |
| LLM conversation state leaks into adapter | Medium | Medium | State lives in caller (narrative-gateway, director), adapter is stateless per `complete()` |

---

## 8. Decision Record

- **TTS is Class A, not Class B.** Even though some TTS providers support streaming, the capability semantics are "generate audio artifact" not "converse." Streaming is a transport optimization, not a semantic difference.
- **Video is Class C, not Class A.** Even if a provider returns instantly, the system must support providers that take 60+ seconds. The contract must be async-first.
- **LLM is Class B, not Class A.** Even if a simple completion is synchronous, the capability includes conversation state, tool use, and streaming. A synchronous-only contract would be a permanent ceiling.
- **No breaking change to existing adapters.** All 7 registered adapters are Class A. The rename is backward-compatible.
