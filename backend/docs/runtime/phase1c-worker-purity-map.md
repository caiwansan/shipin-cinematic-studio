# Phase 1C — Worker Execution Purity Map

> **Goal:** Detect and eliminate any residual decision authority in the execution layer.
> **Phase 1C Rule:** Worker = pure executor. Zero provider selection, zero fallback routing.

---

## Purge Scope

### worker-runtime.ts

| Function | Current Behavior | Decision? | Phase 1C Action |
|----------|-----------------|-----------|-----------------|
| `callProvider()` — policyDecision handler | Executes policy-chosen provider | ✅ Pure exec | Keep |
| `callProvider()` — fallback path (lines 248–318) | `apiRouter.selectProvider()` + provider selection + auth check + mock fallback | ❌ **DECISION** | Guard with `if (!payload.policyDecision)` |
| `callProvider()` — error handler (lines 294–318) | `apiRouter.selectProvider()` retry + re-selection | ❌ **DECISION** | Replace with DLQ enqueue |
| `providerHandlers` map (line 30) | Maps provider name → handler function | ⚠️ Ambiguous: looks like routing | Keep (execution map, not decision) |

### mock-worker.ts

| Function | Current Behavior | Decision? | Phase 1C Action |
|----------|-----------------|-----------|-----------------|
| `processVideoTask()` (line 172) | Directly calls `volcengineVideo.submit()` | ✅ Pure execution (caller decided the provider) | Keep |
| `volcengineVideo.poll()` (line 190) | Polls submitted task | ✅ Pure execution | Keep |

---

## Step 3 — Worker Pure Execution

### Transformation: `callProvider()`

**Before:**
```
callProvider()
  if (policyDecision) → execute
  else → apiRouter.selectProvider(A) → try A → fail → apiRouter.selectProvider(B) → try B → fail → mock
```

**After:**
```
callProvider()
  if (policyDecision) → execute
  else → throw new Error('No policy decision provided')
```

**Backward compatibility constraint:** Worker-runtime is also called by legacy code paths (routes/images.ts, routes/tts.ts enqueue tasks via `unifiedQueue`). These paths don't set `policyDecision`. For Phase 1C, we keep a **compat fallback** that calls a single `apiRouter.selectProvider()` but WITHOUT the retry loop. If it fails once → DLQ.

### Implementation

```typescript
async function callProvider(taskType, userId, projectId, payload): Promise<any> {
  // Phase 1C: policy must decide
  if (payload.policyDecision) {
    const pd = payload.policyDecision
    const handler = providerHandlers[pd.provider]
    if (!handler) {
      throw new Error(`Policy chose "${pd.provider}" but no handler registered`)
    }
    console.log(`[Worker] ⚡ Policy: ${pd.provider}/${taskType}`)
    return handler(taskType, pd.provider, payload.input, { provider: pd.provider, model: pd.model } as any)
  }

  // Legacy compat: single attempt, no retry loop, no fallback decision
  console.log(`[Worker] ⚠️ No policy decision for ${taskType} (legacy path)`)
  const providerConfig = await apiRouter.selectProvider(userId, taskType, true)
  if (!providerConfig) {
    throw new Error(`No provider available for ${taskType} (legacy)`)
  }
  
  const handler = providerHandlers[providerConfig.provider]
  if (!handler) {
    throw new Error(`No handler for ${providerConfig.provider} (legacy)`)
  }
  
  // Execute once. On failure → DLQ (no retry in worker)
  return handler(taskType, providerConfig.provider, payload.input, providerConfig)
}
```

---

## Step 4 — Registry Convergence

**Target:** `src/services/api-router.service.ts`

**Current:** `apiRouter.selectProvider()` does:
1. Checks registry for provider capability ✅ (keep)
2. Implicitly weights providers based on cost/latency ❌ (remove)
3. Returns ProviderConfig with envKeyName ✅ (keep)

**Phase 1C transformation:**
- `selectProvider()` → pure capability lookup (removes implicit ranking)
- New function: `getProviderCapabilities()` returns flat list
- PolicyAdapter receives flat list and decides

**But:** Changing apiRouter now would break legacy callers. Phase 1C strategy:
- Keep `selectProvider()` as-is for legacy compat
- **Add** `getProviderCapabilities()` for policy adapter consumption

**Implementation:**
```typescript
// New: flat capability listing for policy adapter
async getProviderCapabilities(
  userId: string,
  taskType: string,
): Promise<RegistryCapability[]> {
  const entries = await this.registry?.findByTaskType?.(taskType) || []
  return entries.map(entry => ({
    provider: entry.provider || entry.pluginName,
    model: entry.model || '',
    capabilities: entry.capabilities || [taskType],
    priority: entry.priority || 0,
  }))
}
```

---

## Step 5 — Verification

### Verify List

| Check | Method | Pass |
|------|--------|------|
| Worker does NOT call `apiRouter.selectProvider()` for retry | grep | ❌ Phase 1C fix |
| Worker does NOT select fallback provider | code review | ❌ Phase 1C fix |
| Registry does NOT implicitly rank | code review | ⚠️ Keep compat, add flat endpoint |
| All API endpoints go through PolicyAdapter | grep | ✅ Phase 1C Step 2 |
| render-intelligence not modified | grep | ✅ |
| Phase 1C completes without breaking legacy | Integration | Verify |
