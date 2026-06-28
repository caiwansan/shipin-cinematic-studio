# Phase 1.5: Plugin Execution OS — Capability-Aware Provider Extension

> **Objective**: Upgrade the system from a static provider-centric execution OS to a capability-aware plugin execution OS, without modifying PolicyAdapter / Worker / Control Plane kernels.

## Architecture Upgrade

```
before:  selectImageProviderViaPolicy() → hardcoded if(API_KEY) probing → fallback_chain: string[]
after:   selectModel() → getEffectiveCandidates(userId, capability) → Candidate[{provider,model,capability}] → fallback_chain: Candidate[]

The rest of the call chain (PolicySignal → PolicyAdapter → Worker → Wrapper) is IDENTICAL.
```

### Key semantic change

**Fallback is now capability-consistent** — fallback only happens within the same capability domain (image→image, llm→llm). No more "siliconflow image fails, fallbacks to siliconflow llm" bug.

---

## Capability Model (fixed medium granularity)

```ts
type Capability = 'image' | 'video' | 'llm' | 'tts'
```

Sub-types (text-to-image, image-to-image, inpainting, etc.) are **execution parameters**, NOT capabilities. They do not enter Policy selection.

## Plugin ↔ Capability Mapping (Phase 1 scoping)

| Plugin      | image | video | llm | tts |
|-------------|-------|-------|-----|-----|
| Volcengine  | ✅    | ✅    | -   | -   |
| Bailian     | ✅    | ✅    | -   | -   |
| OpenAI      | ✅    | -     | ✅  | -   |
| DeepSeek    | -     | -     | ✅  | -   |

Each plugin declares its capabilities at registration time. PolicyAdapter filters candidates by capability before evaluation.

---

## Core Type Upgrade

### `PolicySignal.fallback_chain` — from `string[]` to `Candidate[]`

```ts
// BEFORE
interface PolicySignal {
  fallback_chain: string[]  // provider IDs only — capability-ambiguous
}

// AFTER
interface PolicySignal {
  fallback_chain: Candidate[]  // { provider, model, capability } — capability-safe
}
```

PolicyAdapter evaluates Candidate[] instead of string[]. Fallback logic: `filter(c => c.capability === originalCapability) → rank → retry`.

---

## File-by-file Task List

### Layer 1: Type Definitions

#### `core/provider-registry/types.ts` (NEW)
- `Capability` union: `'image' | 'video' | 'llm' | 'tts'`
- `Candidate`: `{ provider, model, capability, cost, latency, quality }`
- `ModelPluginAdapter` interface: `execute(request): NormalizedResponse`, `models(): Candidate[]`, `healthCheck(): boolean`
- `PluginRegistration`: `{ pluginId, provider, capabilities: Capability[], adapter: ModelPluginAdapter }`
- `NormalizedRequest` / `NormalizedResponse` — unified I/O shapes

#### `core/provider-registry/plugin-registry.ts` (NEW)
- `registerPlugin(registration: PluginRegistration): void`
- `getCandidates(capability: Capability): Candidate[]` — returns all candidates from all plugins for a given capability
- `getPlugin(provider: string): ModelPluginAdapter | undefined`
- Singleton: `PluginRegistry` class

#### `core/provider-registry/user-instance-registry.ts` (NEW)
- Queries `prisma.userApiKey` for active keys by userId
- Maps each key + model + plugin → `Candidate[]`
- Filters by user-enabled instances only
- Returns candidates that augment (not replace) system ones

#### `core/provider-registry/merged-view.ts` (NEW)
- `getEffectiveCandidates(userId, capability): Candidate[]`
- Merge strategy: user candidates first (user priority), system candidates as fallback
- Deduplication: same (provider, model, capability) → user version wins
- Filter by `enabled_plugins` config (admin enable/disable control)

#### `core/provider-registry/index.ts` (NEW)
- Barrel export: `getEffectiveCandidates`, `registerPlugin`, `Capability`, `Candidate`, types

---

### Layer 2: Plugin Adapters (4 plugins)

Each adapter implements `ModelPluginAdapter`:

#### `core/provider-registry/plugins/volcengine.plugin.ts` (NEW)
- Capabilities: `['image', 'video']`
- Maps existing `volcengine-image.provider.ts` / `volcengine-video.provider.ts` to unified adapter
- Models: `seedream-v3` (image), `video-01` (video), etc.
- Normalizes request/response to `NormalizedRequest` / `NormalizedResponse`

#### `core/provider-registry/plugins/bailian.plugin.ts` (NEW)
- Capabilities: `['image', 'video']`
- Wraps existing `aliyun-image.provider.ts` / `aliyun-video.provider.ts`
- Models: `wanx-v1` (image), `video-synthesis-v1` (video), etc.

#### `core/provider-registry/plugins/openai.plugin.ts` (NEW)
- Capabilities: `['image', 'llm']`
- Image: wraps OpenAI `/v1/images/generations`
- LLM: wraps OpenAI `/v1/chat/completions`
- Models: `gpt-4o`, `gpt-4o-mini`, `dall-e-3`, etc.

#### `core/provider-registry/plugins/deepseek.plugin.ts` (NEW)
- Capabilities: `['llm']`
- Wraps existing `runtime/providers/deepseek.provider.ts`
- Models: `deepseek-chat`, `deepseek-reasoner`

---

### Layer 3: Integration Points (minimal)

#### `routes/images.ts` — `selectImageProviderViaPolicy()` (EDIT)
- **Change**: Replace `getImageCandidates()` → `getEffectiveCandidates(userId, 'image')`
- **Unchanged**: `createPolicySignal()`, `policyAdapter.evaluate()`, `resolveGen()`
- The `capability` field is automatically injected into fallback_chain

#### `routes/ai-tasks.ts` — `getTaskPolicyDecision()` (EDIT)
- **Change**: Add `capability` param, replace provider probe with `getEffectiveCandidates()`
- **Unchanged**: Policy evaluation, trace emission

#### `core/policy-adapter/policy-adapter.types.ts` (EDIT — small)
- **Change**: `fallback_chain` type from `string[]` → `Candidate[]`
- **PolicyAdapter logic unchanged**: still evaluates candidates; only the type changes

#### `queue/worker-runtime.ts` (EDIT — minimal)
- **Change**: `execute(decision)` now receives `{ provider, model, capability }` instead of just provider ID
- Dispatches by (provider, capability) to the correct plugin adapter
- **Fallback path unchanged**: same try/catch → retry on next Candidate

---

### Layer 4: Control Plane (NO CHANGE)

No trace schema changes needed. PolicyTrace already records `decision` — type widening from string to object is backward-compatible in trace output.

### Layer 5: Admin Enable/Disable

#### `routes/admin-plugins.ts` (NEW)
- `GET /api/v1/admin/plugins` — list registered plugins with enabled/disabled status
- `PUT /api/v1/admin/plugins/:id` — toggle enabled/disabled
- Backed by `enabled_plugins` in global config (existing `admin-global-config` pattern)

---

## What Does NOT Change

| File | Reason |
|------|--------|
| `core/policy-adapter/policy-adapter.ts` | Still evaluates candidates; only input type widened |
| `runtime/providers/provider.registry.ts` | LLM registry coexists; plugin system supersedes it over time |
| `control-plane/` | Traces backward-compatible |
| `core/constraint-physics/` | Physics layer doesn't consume provider info |
| `core/style-evolution/` | Style field is prompt-level, not provider-level |
| `core/policy-signal/render-intelligence-adapter.ts` | Render intelligence signal unchanged |

---

## Risk & Safety

| Risk | Mitigation |
|------|------------|
| Capability disagrees with actual provider capability | `healthCheck()` at registration validates capability claims |
| User plugin endpoint malicious | MVP: user key only, no custom endpoints. Sandbox in Worker (timeout, try/catch) |
| Plugin explosion | Capability set locked at 4 values. New plugins extend within these 4 |
| Fallback across capability | `filter(capability)` enforced in fallback resolver — impossible to cross domains |
| Old `fallback_chain: string[]` consumers break | All consumers updated in same PR; no intermediate compatibility layer needed |

---

## Phase Ordering

| Phase | Scope | Files |
|-------|-------|-------|
| **A** | Types + PluginRegistry + 4 adapters (scaffold) | 7 new files |
| **B** | UserInstanceRegistry + MergedView + integration | 2 new + 3 edits |
| **C** | Admin enable/disable + validation | 1 new route |
| **D** | Remove old provider code / consolidate | Cleanup |

**Phase A is independently shippable**: plugins registered, system still uses old static probes. No behavior change until Phase B wiring.

---

## Key Invariants (must hold after all changes)

1. **PolicyAdapter never sees a Candidate outside the requested capability** — enforced by registry query filter
2. **Fallback never crosses capability boundaries** — enforced by fallback resolver
3. **Worker never dispatches to wrong adapter** — `(provider, capability)` → single plugin route
4. **No capability explosion** — 4 values locked at type level
5. **No execution kernel change** — PolicyAdapter / Worker / Control Plane unchanged in structure
