# Phase 1B — Render-Intelligence → Unified Policy Signal Extraction

> **Phase 1A established:** Execution graph unified through wrapper layer ✅
> **Phase 1B goal:** Convert render-intelligence from business logic into a standardized policy signal generator.
> **Draft:** 2026-05-16

---

## 1. Problem Statement

Currently, `renderIntelligence` in `production-loop/` is a business module with baked-in routing decisions. It evaluates provider capability and returns scoring — but its output cannot be consumed by a unified policy layer because:

1. **No standard output schema** — scoring is embedded in business logic
2. **No decoupling from execution** — intelligence and dispatch are mixed
3. **No compatibility with Registry** — render-intelligence output cannot feed into `PolicyAdapter.decide()`

The split-brain between render-intelligence scoring and route-level switches means the system still has three competing policy systems (see ADR-002).

---

## 2. Target Architecture

```
Policy Adapter Layer (Phase 1C goal)
    ↑ standardized signal
Render-Intelligence (Phase 1B)
    ↓ extracts signal from business logic
Wrapper Layer (Phase 1A — established)
    ↓ intercepts execution
Provider Layer (volcengine / aliyun / openai / …)
```

Phase 1B extracts render-intelligence's decision output into a clean signal that the Policy Adapter Layer can consume in Phase 1C.

---

## 3. Scope

### In Scope (Phase 1B)
- Define `PolicySignal` schema (standardized output from render-intelligence)
- Extract signal generation from render-intelligence business logic
- Create signal adapter that converts render-intelligence output → `PolicySignal`
- Validate signal consistency across provider types

### Out of Scope (Phase 1C)
- Policy Adapter Layer implementation
- Registry integration
- Decision consolidation (L1 heuristic vs LLM Registry)
- Telemetry pipeline consumption

---

## 4. PolicySignal Schema (Proposed)

```typescript
interface PolicySignal {
  providerId: string
  capability: string          // 'image' | 'video' | 'tts' | 'llm'
  confidence: number          // 0.0 – 1.0
  latency_ms?: number         // observed or predicted
  cost_score?: number         // 0.0 – 1.0 (lower = cheaper)
  reliability_score?: number  // 0.0 – 1.0
  meta: {
    source: 'render-intelligence' | 'heuristic' | 'registry'
    model: string
    computational_model: 'job' | 'stateless'
    timestamp: number
  }
}
```

---

## 5. Migration Strategy

### Step 1: Audit render-intelligence output
- Identify every decision point where render-intelligence scores a provider
- Document current output shape

### Step 2: Define `PolicySignal` adapter
- Create adapter function in `core/policy-signal/`
- Convert render-intelligence output → `PolicySignal` without modifying render-intelligence internals

### Step 3: Inject adapter at render-intelligence call sites
- Replace direct consumption of render-intelligence output with adapter-consumed signal
- Validate signal fidelity (input → adapter → output matches original decision)

### Step 4: Validate signal consistency
- Compare render-intelligence signals with heuristic signals (latency, cost)
- Identify discrepancies → document for Phase 1C resolution

---

## 6. Constraints

- ✅ **Do NOT modify render-intelligence internals** — adapter pattern only
- ✅ **Do NOT introduce registry or policy layer** — pure signal extraction
- ✅ **Do NOT change execution behavior** — decision output only
- ✅ **Do NOT add telemetry consumption** — leave for Phase 1C

---

## 7. Success Criteria

- [ ] `PolicySignal` schema defined and implemented
- [ ] render-intelligence output successfully converted to `PolicySignal`
- [ ] Signal fidelity validated (adapter output matches original decision)
- [ ] No regression in render-intelligence behavior
- [ ] Adapter ready for Phase 1C Policy Adapter Layer consumption

---

## 8. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| render-intelligence has implicit decisions not surfaced | Signal incomplete | Step 1 audit must be thorough |
| adapter introduces latency overhead | Decision delay | Lightweight transformation, no IO |
| Phase 1C changes schema | Rework | Keep schema minimal, extensible via `meta` |
