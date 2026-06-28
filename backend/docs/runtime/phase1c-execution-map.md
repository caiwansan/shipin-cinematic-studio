# Phase 1C — Policy Adapter Layer + Registry Convergence Execution Map

> **Phase 1C 目标：** 将决策权从 render-intelligence/service 层收敛到统一 Policy Adapter。
> **Phase 1B 结束时状态：** decision → observable + decomposed
> **Phase 1C 完成后状态：** decision → governable + unified

---

## 1. 当前架构 vs 目标架构

### 当前（Phase 1B 结束）

```
input
  ↓
render-intelligence.decide()   ← 隐式决策 + 硬编码权重
  ↓
RouteDecision
  ↓
PolicySignal (observable but not governable)
  ↓
routes / services               ← 直接消费 RouteDecision
```

### 目标（Phase 1C 完成）

```
input
  ↓
render-intelligence             ← 降级为 feature extractor（不再 decide）
  ↓
RouteDecision (raw estimate)
  ↓
Policy Adapter                  ← 唯一决策入口（NEW）
  ├── SLA enforcement
  ├── weight application
  ├── fallback policy
  ├── registry integration
  └── confidence normalization
  ↓
PolicySignal (governable)
  ↓
Registry Layer                  ← capability routing (改造成 policy-aware)
  ↓
Worker / Service Layer          ← 纯执行，零决策
```

---

## 2. 构建顺序

### Step 1 — Policy Adapter Core (独立层，不修改外部代码)

**文件：** `src/core/policy-adapter/policy-adapter.types.ts`
**文件：** `src/core/policy-adapter/policy-adapter.ts`

新类型：
```typescript
interface PolicyRule {
  condition: (signal: PolicySignal, context: PolicyContext) => boolean
  action: 'allow' | 'reroute' | 'fallback' | 'reject'
  weight: number
  priority: number
}
```

不破坏外部：
- policy-adapter 不修改 render-intelligence 内部
- reference → import policy-adapter.something

### Step 2 — Policy Adapter Integration Point (API 层)

**修改文件：** `src/production-loop/api.ts`（`/intelligence/execute` 端点）

```
- return { decision, signal }
+ // Phase 1C: inject policy adapter
+ const policySignal = await policyAdapter.evaluate(decision, { constraints, history })
+ return { decision, signal: policySignal, policy: policySignal.policyResult }
```

外部行为变化：零（PolicySignal 字段新增，语义不变）

### Step 3 — Policy-Governed Fallback (替换现有 fallback 路径)

**修改文件：** `src/core/policy-adapter/fallback-policy.ts`

现有 fallback 行为 `available[0]` → 替换为 policy rules：
- rule: "若 fallback chain 剩余 provider ≥ 1 → 重试"
- rule: "若 fallback chain 剩余 provider = 0 → mock"

行为变化：fallback provider 选择从字母序 变为 policy 驱动

### Step 4 — Registry Convergence (registry 不再做隐式决策)

**修改文件：** `src/services/api-router.service.ts`

现在 apiRouter 同时 perform：
- capability selection
- weight application (implicit)

Phase 1C 后：
- apiRouter → pure capability router
- weights → only in policy adapter

### Step 5 — Worker Layer 纯执行化

**目标文件：** `src/queue/worker-runtime.ts`、`src/services/mock-worker.ts`

当前：
```
worker → callProvider → providerHandlers → decide provider
```

Phase 1C 后：
```
worker → execute only
policy → already decided (injected via job payload)
```

---

## 3. 改变 vs 不改变

| 维度 | 改变 | 不改变 |
|------|------|--------|
| API 端点返回结构 | ✅ + `policy` 字段 | ❌ 保持兼容 |
| render-intelligence.decide() | ❌ 保留，降级为 feature extractor | ✅ 不修改内部逻辑 |
| PolicySignal 结构 | ✅ + `policy_result`、`applied_rules` | ✅ 向后兼容 |
| Weight 定义 | ✅ 移到 policy-adapter | ❌ render-intelligence weights 仍保留作为 source of truth |
| Fallback 选择逻辑 | ✅ 从字母序改为 policy rules | ❌ |
| apiRouter.selectProvider | ❌ 不修改签名 | ✅ 改为只做 routing，不带决策 |
| worker 执行路径 | ❌ 不修改 | ✅ 通过 job payload 接收已决策结果 |

---

## 4. 风险点

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| render-intelligence 降级后现有 API 使用者可能依赖其决策行为 | 🟡 低 | API 返回兼容字段，policy 作为附加层 |
| fallback policy rule 误判 | 🔴 高 | Phase 1C 初期保留 dual path (policy + legacy) |
| apiRouter.selectProvider 调用者期望它做决策 | 🟡 中 | 渐进迁移：先加 policy，再改 apiRouter |
| worker 接收 job payload 后与现有 providerHandlers 冲突 | 🟡 中 | worker-runtime 读取 payload.policyDecision，若不存在则回退现有逻辑 |

---

## 5. 验证点

| 验证 | 方法 | 预期 |
|------|------|------|
| Phase 1C modify render-intelligence: NO | grep | 0 修改 |
| PolicySignal 向后兼容: OK | 旧 consumer 字段全部保留 | 无 break |
| Fallback policy 覆盖所有场景 | 测试：fallback chain 长度 0/1/2+ | 不抛异常 |
| apiRouter 不返回 weights | 调用后检查 | weights 字段不存在 |
| worker 执行不改变 | 现有 pipeline 测试 | 结果一致 |

---

## 6. 文件变更清单

```
NEW  src/core/policy-adapter/policy-adapter.types.ts    — PolicyRule, PolicyResult 类型
NEW  src/core/policy-adapter/policy-adapter.ts           — PolicyAdapter.evaluate()
NEW  src/core/policy-adapter/fallback-policy.ts          — 基于 policy rules 的 fallback
NEW  src/core/policy-adapter/index.ts                     — barrel

MOD  src/production-loop/api.ts                          — inject policy adapter to execute endpoint
MOD  src/services/api-router.service.ts                  — remove implicit decision from selectProvider
MOD  src/queue/worker-runtime.ts                         — read job policy payload, remove providerHandlers decision
MOD  src/services/mock-worker.ts                         — read policy payload, remove hidden decision

DOC  docs/runtime/phase1c-execution-map.md               — this file
DOC  docs/runtime/phase1c-status.md                      — constructed at Phase 1C end
```

---

## 7. Phase 1C 分步执行

| Step | 名称 | 估计文件数 | 依赖 |
|------|------|-----------|------|
| 1 | Policy Adapter Core (types + evaluate) | 4 | 无 |
| 2 | Policy Adapter Integration (API injection) | 1 | Step 1 |
| 3 | Policy-Governed Fallback | 1 | Step 1 |
| 4 | Registry Convergence (apiRouter) | 1 | Step 1 |
| 5 | Worker Layer 纯执行化 | 2 | Steps 1-4 |
| 6 | Phase 1C Verification Report | 1 | Steps 1-5 |
