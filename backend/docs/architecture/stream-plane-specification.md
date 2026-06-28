# Stream Plane Specification

**Status: Architecture Constitution (pre-implementation)**
**Date: 2026-05-16**
**Part of: Phase F — Execution Model Separation**

---

## 0. Context: Why Stream Plane Is a New OS Layer

The system currently has:

| Layer | Status |
|-------|--------|
| Sync Plane (image/tts) | ✅ Live — `capability-dispatcher` → `SyncExecutionAdapter` |
| Async Plane (video) | ⚠️ Partial — adapter stub exists, plane undefined |
| Stream Plane (llm) | ❌ **Missing** — LLM runs as a standalone subsystem |

The legacy LLM runtime (`runtime/providers/`) is a **complete, independent execution OS**:
- 5 providers: DeepSeek, OpenAI, Kimi, SiliconFlow, Bailian
- Own routing, fallback, retry, timeout, circuit breaker
- Own trace/monitoring system
- Native streaming support

**The goal is NOT to rewrite this system.**
The goal is to **bridge** it into the Capability Runtime Kernel so that:

```
dispatchByCapability('llm', request)
    → Stream Plane
        → LLMExecutionAdapter (bridge)
            → legacy provider.call()
```

This document defines the Stream Plane contract — the missing layer.

---

## 1. Stream Plane Identity

### 1.1 What Stream Plane Is

Stream Plane is the **execution orchestrator for stateful, token-streaming capabilities**.
It does NOT contain providers. It does NOT implement models.
It coordinates: adapter resolution → execution → chunk emission → state boundary enforcement.

### 1.2 Relationship to Other Planes

| Aspect | Sync Plane | Stream Plane | Async Plane |
|--------|-----------|-------------|-------------|
| Result type | Complete artifact | Token stream | Job handle |
| State ownership | Caller (ephemeral) | External conv context | Runtime job store |
| Adapter method | `execute()` | `complete()` / `stream()` | `submit()` / `poll()` / `cancel()` |
| Latency bound | Seconds | Milliseconds-to-first-token | Minutes-to-hours |
| Backpressure | Not needed | Required | Not needed |

### 1.3 Design Principles

1. **Stream Plane bridges, never owns.** It does not store conversation state, manage API keys, or route providers. The legacy LLM runtime retains all execution ownership.
2. **Stream Plane enforces boundaries.** State stays outside. Chunks are normalized. Errors are typed.
3. **Stream Plane is capability-agnostic.** The same plane handles LLM today, and any future streaming capability (real-time audio, live subtitles, streaming image generation).
4. **Adapter is a protocol translator.** `LLMExecutionAdapter` translates Stream Plane contract → legacy runtime protocol. Zero rewriting of existing providers.

---

## 2. Core Types

```ts
// ─── Stream Plane Types ───────────────────────────

type StreamStatus = 'streaming' | 'done' | 'error' | 'cancelled'

interface StreamChunk<T = string> {
  /** Position in the stream (0-indexed) */
  index: number
  /** The delta content since the last chunk */
  delta: T
  /** Cumulative state — caller may use this instead of aggregating deltas */
  cumulative?: T
  /** Current stream status */
  status: StreamStatus
  /** Provider metadata emitted once (on first chunk or at end) */
  meta?: {
    model: string
    provider: string
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }
  /** Structured error — only present when status === 'error' */
  error?: {
    code: string          // e.g. 'RATE_LIMITED', 'CONTENT_FILTERED', 'PROVIDER_DOWN'
    message: string       // Human-readable
    retryable: boolean    // Can the caller retry with backoff?
  }
}

interface StreamResult<T = string> {
  /** Full assembled content (for convenience — caller can also aggregate chunks) */
  content: T
  /** Final metadata */
  meta: NonNullable<StreamChunk['meta']>
  /** Total chunks emitted */
  chunkCount: number
  /** Total wall-clock time in ms */
  latencyMs: number
}

// ─── Stream Execution Contract ────────────────────

interface StreamSession {
  /** Unique session ID for this stream (traceable) */
  sessionId: string
  /** Async iterator the caller consumes */
  [Symbol.asyncIterator](): AsyncIterator<StreamChunk>
  /** Cancel the stream mid-flight */
  cancel(reason?: string): Promise<void>
  /** Current state of the session */
  status: StreamStatus
}

interface StreamRequest {
  /** Provider model name (resolved by policy) */
  model: string
  /** Provider identity (resolved by policy, injected into adapter) */
  provider: string
  /** The conversation messages */
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  /** Optional tools/function definitions for tool-calling models */
  tools?: ToolDefinition[]
  /** Generation parameters */
  temperature?: number
  maxTokens?: number
  /** Client-side abort signal */
  signal?: AbortSignal
}
```

---

## 3. LLMExecutionAdapter Interface

This is the bridge contract. Every LLM provider implements this.
Under the hood, it calls the existing `LLMProvider.call()` from `runtime/providers/`.

```ts
interface LLMExecutionAdapter {
  /** Adapter identity */
  readonly provider: string
  readonly models: string[]

  /** Non-streaming completion (wraps a stream internally for convenience) */
  complete(request: StreamRequest): Promise<StreamResult>

  /** True streaming — returns a controllable StreamSession */
  stream(request: StreamRequest): Promise<StreamSession>

  /** Health check with model-level diagnostics */
  healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'down'
    latencyMs: number
    modelsAvailable: string[]
    rateLimitRemaining: number
  }>
}
```

### 3.1 `complete()` Contract

```ts
async function complete(request: StreamRequest): Promise<StreamResult>
```

- Must collect all chunks internally and return the assembled result
- Must handle errors gracefully — surface via `StreamResult` not throw (unless unrecoverable)
- Must report usage metadata

### 3.2 `stream()` Contract

```ts
async function stream(request: StreamRequest): Promise<StreamSession>
```

- Returns immediately with a `StreamSession` (non-blocking)
- Chunks flow through `AsyncIterator<StreamChunk>`
- Caller consumes chunks at its own pace (backpressure is the caller's responsibility)
- `cancel()` must propagate cancellation to the underlying provider call

### 3.3 Chunk Normalization Rules

Every provider emits chunks. This adapter normalizes them:

| Provider | Native Format | Normalized To |
|----------|--------------|--------------|
| DeepSeek | SSE `data: {...}` | `StreamChunk<string>` (delta.content) |
| OpenAI | SSE `data: {...}` | `StreamChunk<string>` (delta.content) |
| Kimi | SSE (OpenAI-compat) | `StreamChunk<string>` (delta.content) |
| SiliconFlow | SSE (OpenAI-compat) | `StreamChunk<string>` (delta.content) |
| Bailian | SSE (OpenAI-compat) | `StreamChunk<string>` (delta.content) |

All bridge adapters share a single `StreamChunkNormalizer` utility.

---

## 4. Stream Plane Execution Flow

```
Caller (e.g. narrative-gateway)
    │
    ├── dispatchByCapability('llm', { messages, temperature, ... })
    │       │
    │       ├── policy.evaluate(candidates)
    │       │       → returns ExecutionPlan
    │       │         { provider: 'deepseek', model: 'deepseek-chat', executionModel: 'STREAM' }
    │       │
    │       ├── StreamPlane.execute(plan, input)
    │       │       │
    │       │       ├── adapter = pluginRegistry.getAdapter('deepseek')  ← returns LLMExecutionAdapter
    │       │       │
    │       │       ├── if (input.stream === true)
    │       │       │     → return adapter.stream(request)
    │       │       │
    │       │       ├── else
    │       │       │     → return adapter.complete(request)
    │       │       │
    │       │       └── (adapter internally calls legacy runtime)
    │       │
    │       └── returns StreamResult or StreamSession
    │
    └── response sent to client
```

### 4.1 StreamPlane.execute() — Pseudocode

```ts
class StreamPlane {
  async execute(plan: ExecutionPlan, input: StreamRequest) {
    const adapter = this.resolveAdapter(plan.provider)

    const request: StreamRequest = {
      model: plan.model,
      provider: plan.provider,
      messages: input.messages,
      temperature: input.temperature ?? 0.7,
      maxTokens: input.maxTokens ?? 2048,
      tools: input.tools,
      signal: input.signal,
    }

    if (input.stream === true) {
      return adapter.stream(request)
    }

    return adapter.complete(request)
  }

  private resolveAdapter(provider: string): LLMExecutionAdapter {
    const adapter = pluginRegistry.getAdapter(provider)
    // Must be an LLMExecutionAdapter — not SyncExecutionAdapter
    if (!('stream' in adapter)) {
      throw new CapabilityAdapterMissingError('llm', provider, pluginRegistry.listProviders())
    }
    return adapter as LLMExecutionAdapter
  }
}
```

---

## 5. The Bridge: Wrapping Legacy LLM Runtime

The legacy `runtime/providers/` system exposes:

```ts
interface LLMProvider {
  name: string
  models: string[]
  apiKey: string
  call(req: LLMRequest, signal?: AbortSignal): Promise<LLMResponse>
}
```

### 5.1 Bridge Adapter — Structural

```ts
class DeepSeekStreamAdapter implements LLMExecutionAdapter {
  readonly provider = 'deepseek'
  readonly models: string[]

  constructor() {
    const provider = getProvider('deepseek')  // from legacy registry
    this.models = provider.models
  }

  async complete(request: StreamRequest): Promise<StreamResult> {
    // 1. Convert StreamRequest → legacy LLMRequest
    // 2. Call provider.call()
    // 3. Wrap result into StreamResult
  }

  async stream(request: StreamRequest): Promise<StreamSession> {
    // 1. Convert StreamRequest → legacy LLMRequest
    // 2. Call provider.call() with stream:true
    // 3. Wrap SSE chunks into AsyncIterator<StreamChunk>
  }

  async healthCheck(): Promise<...> {
    // Ping legacy provider
  }
}
```

**Key design rule:** The bridge adapter imports `getProvider` from the legacy registry.
It does NOT duplicate provider logic. It does NOT create new HTTP fetch calls.
It is a **protocol format converter**, nothing more.

### 5.2 Bridge Does Not Touch

| Legacy Feature | Bridge Action |
|---------------|--------------|
| Provider registration | Unchanged — still in `provider.registry.ts` |
| API key management | Unchanged — still in `narrative-gateway.ts` |
| Circuit breaker | Unchanged — still in `core/circuit-breaker.ts` |
| Fallback chain | Unchanged — still in `narrative-gateway.ts` |
| Trace system | Unchanged — still in `observability/distributed-trace.ts` |
| Retry/timeout policy | **Migrate** — policy moves into `ExecutionPlan` |

---

## 6. State Ownership Layer

### 6.1 Conversation State Lives Outside

```ts
// NOT inside adapter:
class DeepSeekStreamAdapter {
  private history: Message[]  // ❌ ADAPTER NEVER OWNS STATE
}

// Inside external layer:
class ConversationContext {
  private messages: Message[]
  private sessionId: string

  async append(userMessage: string): Promise<StreamSession> {
    this.messages.push({ role: 'user', content: userMessage })
    const session = await streamPlane.execute(plan, {
      messages: this.messages,
      stream: true,
    })
    // Consume stream, append assistant response
    for await (const chunk of session) {
      // append to this.messages
    }
    return session
  }
}
```

### 6.2 State Ownership Boundaries

| Who | Owns | Example |
|-----|------|---------|
| Caller | Conversation history | `narrative-gateway.ts` or agent layer |
| Stream Plane | Execution lifecycle | Session creation, chunk emission, cancellation |
| LLMExecutionAdapter | Protocol translation only | Chunk normalization, error mapping |
| Legacy Provider Runtime | Provider execution | HTTP calls, API key, rate limiting |

---

## 7. Backpressure & Cancellation

### 7.1 Backpressure Model

Stream Plane does NOT implement backpressure natively.
Backpressure is the **caller's responsibility**:

```ts
// Caller controls consumption rate
const session = await streamPlane.execute(plan, request)
for await (const chunk of session) {
  await processChunk(chunk)  // if this is slow, chunks queue up
  // The adapter's internal buffer grows, but no data is lost
}
```

Rationale: In HTTP-based SSE streaming, backpressure is soft. The provider sends
chunks at its own rate. The bridge adapter buffers unread chunks.
If buffer exceeds threshold, adapter may pause SSE consumption.

### 7.2 Cancellation

Cancellation is explicit:

```ts
const session = await adapter.stream(request)
setTimeout(() => session.cancel('user interrupted'), 5000)
for await (const chunk of session) {
  if (chunk.status === 'cancelled') break
  render(chunk)
}
```

Internally, `cancel()`:
1. Sets `status = 'cancelled'`
2. Aborts the underlying `AbortSignal`
3. Closes the SSE connection
4. Pushes a final `{ status: 'cancelled' }` chunk to unblock the iterator

---

## 8. Error Model

### 8.1 Error Types

| Error Code | Meaning | Retryable | Plane Action |
|-----------|---------|-----------|-------------|
| `RATE_LIMITED` | Provider rate limit hit | ✅ Yes (with backoff) | Signal policy to downgrade model |
| `PROVIDER_DOWN` | Provider unavailable | ✅ Yes | Fallback to next candidate |
| `CONTENT_FILTERED` | Response blocked by safety | ❌ No | Return error to caller |
| `TIMEOUT` | Generation exceeded timeout | ✅ Yes (with retry) | Increase timeout or downgrade |
| `INVALID_REQUEST` | Bad request format | ❌ No | Return error to caller |
| `CANCELLED` | User/client cancelled | N/A | Clean exit |

### 8.2 Error Flow

```ts
// Errors flow through chunks, not throws
{ status: 'error', error: { code: 'RATE_LIMITED', retryable: true } }

// Stream Plane catches this and may re-route
for await (const chunk of session) {
  if (chunk.status === 'error' && chunk.error.retryable) {
    // Plane could: signal policy → fallback → retry
    session = await this.retryWithFallback(plan, request)
    continue
  }
  // Non-retryable: propagate to caller
  throw new StreamExecutionError(chunk.error)
}
```

---

## 9. Integration Points

### 9.1 What Changes

| File | Change |
|------|--------|
| `core/provider-registry/types.ts` | Add `LLMExecutionAdapter` + `StreamChunk` + `StreamSession` types |
| `core/provider-registry/plugin-registry.ts` | Support registering LLMExecutionAdapter alongside SyncExecutionAdapter |
| `core/provider-adapters/` | Add `deepseek-stream.bridge.ts`, `openai-stream.bridge.ts` (bridge adapters) |
| `queue/capability-dispatcher.ts` | Add `case 'STREAM'` to the execution model switch |
| `runtime/narrative-gateway.ts` | Optionally migrate entry point to `dispatchByCapability('llm')` |

### 9.2 What Does NOT Change

| File | Reason |
|------|--------|
| `runtime/providers/*` | Legacy LLM OS — remains the real execution engine |
| `runtime/providers/provider.registry.ts` | Provider registration still happens here |
| `runtime/providers/base.provider.ts` | `LLMProvider` interface unchanged |
| `core/circuit-breaker.ts` | Circuit breaker still works on legacy provider calls |
| `observability/*` | Trace system unchanged — bridge adapter adds span metadata |

---

## 10. Capability Registration Example

```ts
// src/index.ts — bootstrap
import { DeepSeekStreamAdapter } from './core/provider-adapters/deepseek-stream.bridge.js'

const deepseek = new DeepSeekStreamAdapter()
pluginRegistry.register(deepseek)    // same method, different interface

// The registry must detect:
// - if adapter has 'execute' → SyncExecutionAdapter
// - if adapter has 'stream'  → LLMExecutionAdapter
```

```ts
// pluginRegistry.register() — polymorphic detection
register(adapter: SyncExecutionAdapter | LLMExecutionAdapter) {
  if ('execute' in adapter) {
    this.syncAdapters.set(adapter.provider, adapter)
  }
  if ('stream' in adapter) {
    this.streamAdapters.set(adapter.provider, adapter)
  }
}

getAdapter(provider: string): SyncExecutionAdapter | LLMExecutionAdapter {
  return this.syncAdapters.get(provider) ?? this.streamAdapters.get(provider)
}
```

---

## 11. Decision Record

- **Legacy LLM runtime is treated as an immutable subsystem.** Zero rewrites. All translation happens in the bridge adapter.
- **Stream Plane is a new OS layer**, not an adapter folder. It has its own execution coordinator, error model, and lifecycle management.
- **Bridge adapters are protocol translators**, not provider re-implementations. They import `getProvider()` from the legacy registry.
- **State lives outside the adapter.** Conversation context is managed by the caller (narrative-gateway, agent layer, or future ConversationContext class).
- **Errors flow through chunks, not throws.** Stream Plane can intercept retryable errors mid-stream and trigger policy-driven fallback.
- **Backpressure is the caller's responsibility.** Stream Plane provides the channel; the caller controls consumption rate.
- **Cancellation is explicit.** `session.cancel(reason)` propagates through to the provider's SSE connection.
