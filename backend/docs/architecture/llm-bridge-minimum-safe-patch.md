# LLMExecutionAdapter — Minimum Safe Bridge

**Status: Patch Design (zero-behavior-change)**
**Date: 2026-05-16**
**Objective: Unify LLM execution graph under Stream Plane without changing runtime behavior**

---

## 1. Objective

### 1.1 What This Achieves

Before:
```
dispatchByCapability('llm')
    → CapabilityAdapterMissingError (no adapter registered)
    → LLM still runs through legacy narrative-gateway → provider.call()
```

After:
```
dispatchByCapability('llm')
    → StreamPlane.execute()
        → LLMExecutionAdapter (bridge)
            → legacy LLMProvider.call()
    → LLM still runs through legacy provider runtime
    → zero behavior change
```

### 1.2 What This Does NOT Do

| Not Done | Reason |
|----------|--------|
| Change provider registration | Legacy `provider.registry.ts` remains authoritative |
| Change fallback logic | `narrative-gateway.ts` fallback chain unchanged |
| Change streaming | Legacy streaming SSE untouched |
| Change narrative-gateway entry point | Route layer still calls narrative-gateway directly |
| Add new models | Only wraps existing providers |
| Remove old code | No `runtime/providers/` files touched |

---

## 2. Execution Graph Change

### Before (current production dist)

```
POST /narrative-llm
    → narrative-gateway.ts
        → router.getProviderList()
        → provider.call(request, signal)
        → return LLMResponse
```

### After (with bridge, but legacy runtime still called)

```
POST /narrative-llm
    → narrative-gateway.ts  ← unchanged
        → dispatchByCapability('llm', request)
            → StreamPlane.execute(plan, request)
                → pluginRegistry.getAdapter('deepseek')
                → DeepSeekLLMAdapter.complete(request)
                    → DeepSeekProvider.call(request, signal)  ← legacy runtime
                → return StreamResult { content, meta, latencyMs }
        → convert StreamResult → LLMResponse
        → return LLMResponse
```

**Key:** The conversion between `StreamResult → LLMResponse` happens in the route layer.
For the caller (narrative-gateway), the response shape is identical. Zero external change.

---

## 3. Files to Create

### 3.1 Bridge Adapter — `src/core/provider-adapters/deepseek-stream.bridge.ts`

```ts
import { getProvider } from '../../runtime/providers/provider.registry.js'
import type { LLMProvider } from '../../runtime/providers/base.provider.js'
import type { LLMExecutionAdapter, StreamRequest, StreamResult, StreamSession, StreamChunk } from '../provider-registry/types.js'

export class DeepSeekLLMAdapter implements LLMExecutionAdapter {
  readonly provider = 'deepseek'
  readonly models: string[]
  private delegate: LLMProvider

  constructor() {
    this.delegate = getProvider('deepseek')
    this.models = this.delegate.models
  }

  async complete(request: StreamRequest): Promise<StreamResult> {
    const t0 = Date.now()

    // Translate StreamRequest → legacy LLMRequest
    const legacyRequest = {
      model: request.model,
      messages: request.messages,
      maxTokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
      stream: false,
    }

    // Call legacy provider (the only execution path)
    const response = await this.delegate.call(legacyRequest, request.signal)

    return {
      content: response.content,
      meta: {
        model: response.model,
        provider: this.provider,
        usage: response.usage,
      },
      chunkCount: 1,
      latencyMs: Date.now() - t0,
    }
  }

  async stream(request: StreamRequest): Promise<StreamSession> {
    // Deferred — narrative-gateway currently uses non-streaming
    // The bridge will implement this when stream=true is needed
    throw new Error('Stream mode not yet bridged — use complete()')
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'down'; latencyMs: number; modelsAvailable: string[]; rateLimitRemaining: number }> {
    const t0 = Date.now()
    try {
      await this.delegate.call({
        model: this.models[0],
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 1,
      })
      return {
        status: 'healthy',
        latencyMs: Date.now() - t0,
        modelsAvailable: this.models,
        rateLimitRemaining: -1, // legacy runtime doesn't expose this
      }
    } catch {
      return {
        status: 'down',
        latencyMs: Date.now() - t0,
        modelsAvailable: this.models,
        rateLimitRemaining: 0,
      }
    }
  }
}
```

### 3.2 Barrel Export — `src/core/provider-adapters/index.ts`

Add:

```ts
export { DeepSeekLLMAdapter } from './deepseek-stream.bridge.js'
```

### 3.3 Registration — `src/index.ts`

Add next to existing TTS adapters:

```ts
pluginRegistry.register(new DeepSeekLLMAdapter())
```

---

## 4. Types to Add

### `src/core/provider-registry/types.ts`

```ts
// ─── Stream Plane Types ───────────────────────────

export type StreamStatus = 'streaming' | 'done' | 'error' | 'cancelled'

export interface StreamChunk<T = string> {
  index: number
  delta: T
  cumulative?: T
  status: StreamStatus
  meta?: {
    model: string
    provider: string
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  }
  error?: { code: string; message: string; retryable: boolean }
}

export interface StreamResult<T = string> {
  content: T
  meta: { model: string; provider: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }
  chunkCount: number
  latencyMs: number
}

export interface StreamSession {
  sessionId: string
  status: StreamStatus
  [Symbol.asyncIterator](): AsyncIterator<StreamChunk>
  cancel(reason?: string): Promise<void>
}

export interface StreamRequest {
  model: string
  provider: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
  tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>
  signal?: AbortSignal
}

// ─── LLMExecutionAdapter Interface ────────────────

export interface LLMExecutionAdapter {
  readonly provider: string
  readonly models: string[]
  complete(request: StreamRequest): Promise<StreamResult>
  stream(request: StreamRequest): Promise<StreamSession>
  healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'down'
    latencyMs: number
    modelsAvailable: string[]
    rateLimitRemaining: number
  }>
}
```

---

## 5. Dispatcher Integration

### `src/queue/capability-dispatcher.ts`

Add case for STREAM:

```ts
switch (executionModel) {
  case 'SYNC':
    return SyncPlane.execute(plan, request)
  case 'STREAM':
    return StreamPlane.execute(plan, request)
  case 'ASYNC':
    return AsyncPlane.submit(plan, request)
}
```

### `src/queue/stream-plane.ts` (new file)

```ts
import { pluginRegistry } from '../core/provider-registry/plugin-registry.js'
import type { LLMExecutionAdapter, StreamRequest } from '../core/provider-registry/types.js'

export class StreamPlane {
  async execute(plan: { provider: string; model: string }, input: StreamRequest) {
    const adapter = this.getAdapter(plan.provider)

    const request: StreamRequest = {
      model: plan.model,
      provider: plan.provider,
      messages: input.messages,
      temperature: input.temperature ?? 0.7,
      maxTokens: input.maxTokens ?? 2048,
      signal: input.signal,
    }

    if (input.stream === true) {
      return adapter.stream(request)
    }
    return adapter.complete(request)
  }

  private getAdapter(provider: string): LLMExecutionAdapter {
    const adapter = pluginRegistry.getAdapter(provider)
    if (!adapter || !('stream' in adapter)) {
      throw new Error(`No LLM execution adapter for provider: ${provider}`)
    }
    return adapter as LLMExecutionAdapter
  }
}
```

---

## 6. Narrative Gateway Integration

The narrative-gateway must decide:

**Option A (safe — recommended):** Keep the current `narrative-gateway.ts` entry point. Only use `dispatchByCapability('llm')` inside a new private method. No route changes.

```ts
// Inside narrative-gateway.ts — new private method
private async executeViaCapabilityRuntime(request: LLMRequest): Promise<LLMResponse> {
  const result = await dispatchByCapability({
    capability: 'llm',
    projectId: this.projectId,
    traceId: this.traceId,
    userId: this.userId,
    payload: {
      messages: request.messages,
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    },
  })
  // Convert StreamResult back to LLMResponse
  return {
    content: result.content,
    model: result.meta.model,
    usage: result.meta.usage!,
    latencyMs: result.latencyMs,
  }
}
```

**Option B (aggressive — NOT for this patch):** Replace narrative-gateway's entry point entirely.
Blocked on: stream mode, fallback chain migration, trace system unification.

**Decision: Option A.**

---

## 7. Security: No Behavioral Change Verification

Checklist to verify zero behavior change:

| Aspect | Verification | Status |
|--------|-------------|--------|
| Route response shape | `LLMResponse` unchanged | ✅ Identical |
| Error handling | All errors propagate same as before | ✅ Adapter throws, narrative-gateway catches |
| Streaming disabled | `stream()` throws | ✅ Exactly matches current behavior |
| Provider routing | Still uses `provider.registry.ts` | ✅ Bridge calls `getProvider()` |
| API key injection | Still in narrative-gateway before call | ✅ Gateway manages keys, not bridge |
| Fallback chain | Still in narrative-gateway | ✅ Bridge doesn't implement fallback |
| Circuit breaker | Still in narrative-gateway | ✅ Bridge doesn't bypass circuit breaker |
| Trace system | Still in narrative-gateway | ✅ Bridge doesn't add trace spans |

---

## 8. Merge Strategy

```
Step 1: Add types (types.ts)           → safe, no usage yet
Step 2: Create StreamPlane class       → safe, no callers yet
Step 3: Add dispatcher switch case     → safe, no 'STREAM' plans emitted yet
Step 4: Create DeepSeekLLMAdapter      → safe, no registration yet
Step 5: Register adapter in index.ts   → safe, narrative-gateway still uses old path
Step 6: narrative-gateway Option A     → switch point — zero external change
```

Steps 1–5 do not change any runtime behavior. Step 6 is the activation point — and it preserves response shape.

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Bridge adapter throws | Low | Medium | Catches and falls back to existing pathway |
| Type mismatch between StreamResult and LLMResponse | Low | Low | Both use same content/usage shapes |
| Legacy provider dependency | Low | Low | Bridge imports `getProvider` statically |
| Backward compat with future Stream Plane changes | Low | Low | Bridge is thin — swap adapter when Stream Plane is native |

---

## 10. Decision Record

- **Bridge adapter is a protocol shim, not a runtime replacement.** Zero behavioral change.
- **Narrative-gateway remains the entry point.** The route layer does not change.
- **Stream mode is explicitly not bridged.** Current system doesn't use streaming; `stream()` throws.
- **Only DeepSeek is bridged in this patch.** One provider proves the contract. Others follow in Phase F proper.
- **deploy is blocked until all three conditions are met.** This patch brings LLM to condition 1 (adapter exists) but conditions 2 (dispatchByCapability routing) and 3 (legacy runtime only via bridge) require narrative-gateway integration.
