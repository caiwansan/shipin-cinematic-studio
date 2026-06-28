# Step Taxonomy — Execution Step Classification Directory
## KMKI-KERNEL-001-B: Step Abstraction Audit

| Field | Status | Audit Date |
|---|---|---|
| ✅ | PASS | 2025-06-28 |

---

## Step Category System

All execution steps are classified by **action type** (NOT by provider name).

### Category Hierarchy

```
ExecutionStep
├── Acquire      — Fetch data from external sources
├── Transform    — Transform or enrich data
├── Reason       — AI/LLM reasoning (provider-agnostic)
├── Execute      — Execute business logic
├── Persist      — Store data
├── Notify       — Emit events, notifications
├── Wait         — Wait for event, human approval, condition
└── Control      — Flow control (condition, validation, routing)
```

---

## Step Type Registry

### Acquire (Fetch/Access external data)

| StepType | ExecutorType | Description | Plugin Status |
|---|---|---|---|
| `LOAD_ASSET` | default | Load assets from storage | ✅ Implemented |
| `LOAD_SEMANTIC` | default | Load semantic context | ✅ Implemented |
| `LOAD_GRAPH` | default | Load graph data | 🔲 Future |
| `VECTOR_SEARCH` | tool | Vector similarity search | 🔲 Future |

### Transform (Transform/Enrich data)

| StepType | ExecutorType | Description | Plugin Status |
|---|---|---|---|
| `BUILD_CONTEXT` | default | Build execution context | ✅ Implemented |
| `TRANSFORM` | script | Generic data transformation | 🔲 Future |

### Reason (AI/LLM Reasoning)

| StepType | ExecutorType | Description | Plugin Status |
|---|---|---|---|
| `REASON` | provider | AI/LLM reasoning (provider-agnostic) | 🔲 Provider Runtime |

### Execute (Business Logic)

| StepType | ExecutorType | Description | Plugin Status |
|---|---|---|---|
| `CALL_TOOL` | tool | Call system/business tool | 🔲 Stub created |
| `CALL_MCP` | mcp | Call MCP server | 🔲 Stub created |
| `RUN_SCRIPT` | script | Execute a script | 🔲 Stub created |

### Persist (Store data)

| StepType | ExecutorType | Description | Plugin Status |
|---|---|---|---|
| `STORE_ASSET` | default | Store asset to storage | ✅ Implemented |
| `UPDATE_GRAPH` | default | Update graph data | 🔲 Future |
| `CACHE` | cache | Cache lookup/store | 🔲 Future |

### Notify (Emit Events)

| StepType | ExecutorType | Description | Plugin Status |
|---|---|---|---|
| `EMIT_EVENT` | default | Emit completion/notification event | ✅ Implemented |

### Wait (Blocking Operations)

| StepType | ExecutorType | Description | Plugin Status |
|---|---|---|---|
| `CALL_HUMAN` | human | Human-in-the-loop approval | 🔲 Stub created |
| `WAIT_EVENT` | wait | Wait for external event | 🔲 Stub created |

### Control (Flow Control)

| StepType | ExecutorType | Description | Plugin Status |
|---|---|---|---|
| `VALIDATE_OUTPUT` | default | Validate step output | ✅ Implemented |
| `CONDITION` | default | Conditional branching | 🔲 Future |
| `TRANSFORM_CONTROL` | default | Transform-based flow control | 🔲 Future |

---

## Plugin Status Legend

| Icon | Meaning |
|---|---|
| ✅ Implemented | Plugin exists and is registered |
| 🔲 Stub created | Interface-only stub created (throws "not implemented") |
| 🔲 Future | Not yet created; interface defined |

---

## Migration: Old → New Step Types

| Old StepType | New StepType | New Category |
|---|---|---|
| `LOAD_ASSET` | `LOAD_ASSET` | Acquire |
| `LOAD_SEMANTIC` | `LOAD_SEMANTIC` | Acquire |
| `LOAD_GRAPH` | `LOAD_GRAPH` | Acquire |
| `BUILD_CONTEXT` | `BUILD_CONTEXT` | Transform |
| `BUILD_PROMPT` | (removed) → `TRANSFORM` | Transform |
| `CALL_PROVIDER` | (removed) → `REASON` | Reason |
| `VALIDATE_OUTPUT` | `VALIDATE_OUTPUT` | Control |
| `STORE_ASSET` | `STORE_ASSET` | Persist |
| `UPDATE_GRAPH` | `UPDATE_GRAPH` | Persist |
| `EMIT_EVENT` | `EMIT_EVENT` | Notify |

---

## File Reference

- Types: `backend/src/services/platform/execution/types.ts`
- Registry: `backend/src/services/platform/execution/registry/step-plugin-registry.ts`
- Step plugins: `backend/src/services/platform/execution/registry/steps/`
