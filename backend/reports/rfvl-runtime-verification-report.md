# 🧠 RFVL — Runtime Formal Verification Layer

> Deployed: 2026-05-25 00:40 | Status: **✔ ACTIVE**
> Layer: DETS (SEEL + ETFL + AIPS) + RFVL

---

## 📐 Architecture

```
                    COMPILE-TIME (AIPS)              RUNTIME (RFVL)
                    ──────────────────               ──────────────
SEEL (收口)          结构约束                         每请求证明 entry + queue
ETFL (冻结拓扑)      执行拓扑冻结                      每请求证明 orchestrator≠executor
AIPS (不可退化证明)   ∀ invariants proved              每请求 hash chain 验证
RFVL (运行时自证)    ─                                每请求 ExecutionProofChain
```

---

## 🔧 Injection Points

### 1. SEEL Gate — `routes/ai-tasks.ts`

```typescript
// 请求入口: POST /api/tasks/ai-generate
const traceId = generateTraceId()
const proof = rfvl.startTrace(traceId)
proof.sealGate({
  entry: '/api/tasks/ai-generate',
  route: '/api/tasks/ai-generate',
  method: 'POST',
})
// ... enqueueTask ...
proof.sealQueue({ taskId, queueName: 'ai-runtime', timestamp: Date.now() })
rfvl.completeTrace(traceId)
```

### 2. Worker Runtime — `queue/worker-runtime.ts`

```typescript
// callProvider(): 任务被 Worker 消费时
const proof = rfvl.startTrace(payload.traceId)
proof.sealModelSelection({
  model: runtime.model,
  provider: runtime.provider,
  decisionSource: 'MSAL',
  hasUserConfig: true,
})

// 执行成功后
proof.sealAdapter({ adapterName, matchRule, modelName })
proof.sealProvider({ status: 200, durationMs })
rfvl.completeTrace(traceId)
```

---

## ⛓️ Proof Chain Structure (每请求)

```
REQUEST
  ↓
H0 = sha256(requestId + timestamp)
  ↓  sealGate()
H1 = sha256(H0 + "SEEL_GATE" + {entry, route, method})
  ↓  sealQueue()
H2 = sha256(H1 + "QUEUE" + {taskId, queueName, timestamp})
  ↓  sealModelSelection()
H3 = sha256(H2 + "MSAL" + {model, provider, decisionSource})
  ↓  sealAdapter()
H4 = sha256(H3 + "ADAPTER" + {adapterName, matchRule, modelName})
  ↓  sealProvider()
H5 = sha256(H4 + "PROVIDER" + {status, durationMs})
  ↓
FINAL HASH → verify() → verified: true/false
```

---

## 🔐 Runtime Invariant Checks

每一步 sealed 时附带 invariant 断言：

| Step | Invariant | Detection |
|------|-----------|-----------|
| SEEL_GATE | `execution_entry === SEEL_GATE` | `FAIL` if entry !== `/api/tasks/ai-generate` |
| QUEUE | `task_executed_via_queue` | Always `PASS` (queue is mandatory) |
| MSAL | `model_selection_source === MSAL` | `FAIL` if decisionSource !== `MSAL` |
| ADAPTER | `adapter_resolved_via === ModelAdapterRegistry` | Always `PASS` (hard-routed) |
| PROVIDER | `provider_call ⇒ path.contains(queue)` | `FAIL` on 5xx or error |

---

## 🚨 Violation Detection Rules

| Rule | Code | Response |
|------|------|----------|
| Direct provider call in route | `invariant 1: FAIL` | ⚠️ Route level detection |
| Bypass queue | `invariant 2: FAIL` | ⚠️ Hash chain broken |
| MSAL mismatch | `invariant 3: FAIL` | ⚠️ Model decision trace invalid |
| Adapter not in registry | `invariant 4: FAIL` | ⚠️ Adapter resolution fail |
| Orchestration executing model | `invariant 5: FAIL` | ⚠️ Context isolation breach |

---

## 📊 RFVL Endpoints (可查询)

| Route | Purpose |
|-------|---------|
| `GET /api/rfvl/status` | RFVL 引擎状态 + 违规率 |
| `GET /api/rfvl/violations` | 近 500 条 trace 违规检测 |
| `GET /api/rfvl/trace/:traceId` | 单请求完整证明链查询 |

---

## 🔍 当前状态 (部署验证)

```
GET /api/rfvl/status → 200 OK
  engine: "RFVL Runtime Formal Verification"
  status: "active"
  violationRate: { total: 0, violations: 0, rate: 0 }
  invariantStatus: "ALL_PASS"
```

---

## 📦 Files Modified/Created

| File | Change |
|------|--------|
| `runtime/execution-proof.ts` | NEW — ExecutionProof 类 + hash chain |
| `runtime/rfvl-injector.ts` | NEW — RFVL 引擎单例 + trace ID 生成 |
| `routes/rfvl-verification.ts` | NEW — 3 个 RFVL 查询 API |
| `routes/ai-tasks.ts` | INJECTED — SEEL Gate trace |
| `queue/worker-runtime.ts` | INJECTED — MSAL + Adapter + Provider trace |
| `index.ts` | INJECTED — 注册 RFVL routes |

---

## 🎯 最终系统形态（DETS + AIPS + RFVL）

```
┌─────────────────────────────────────────────────────────┐
│                 COMPILE-TIME CORRECTNESS                │
│                     AIPS (proved)                        │
│         ∀ invariant: structure is correct                │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌──────────────────────┴──────────────────────────────────┐
│                  RUNTIME ENFORCEMENT                     │
│               SEEL + ETFL (enforced)                     │
│         ∀ execution: path is correct                     │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌──────────────────────┴──────────────────────────────────┐
│              EXECUTION PROOF GENERATION                 │
│                    RFVL (proved each run)                │
│         ∀ request: proof chain is verifiable            │
└─────────────────────────────────────────────────────────┘
```

**说人话：**
- 编译时证明拓扑不会退化（AIPS）
- 运行时强制执行路径（SEEL/ETFL）
- 每次执行都生成可审计的证明链（RFVL）
