# RUNTIME_GOVERNANCE_V1_PLAN.md — P4-2 Runtime Governance 规划

**创建时间:** 2026-06-27  
**最后更新:** 2026-06-27  
**状态:** ✅ P0 已完成, P1-P5 已规划 (待 FRE v1 GA 后启动)  
**工程约束:** 下方 Governance Principles 是所有后续治理工作的统一准则。

---

## 0. Runtime Governance Principles

这些原则作为所有 Runtime 治理工作的统一准则，任何 P1-P5 的设计和实现必须遵守。

1. **Validation before Persistence** — 写入 canonical data 前必须经过 schema 验证。
2. **Observable before Optimized** — 先采集数据再优化，不依靠猜测调优。
3. **Fail Fast** — 非法输入应在最早阶段拒绝，不传递给下游。
4. **No Silent Failure** — 任何失败必须记录结构化错误码，不静默降级。
5. **Immutable Contract** — Schema Contract 一旦冻结，版本升级必须提供迁移路径。
6. **Runtime never trusts Agent output** — Agent 输出必须经过校验才能进入执行链路。
7. **Frontend never repairs backend corruption** — 前端应有防御性编程但不承担数据修复职责。后端数据异常应通过治理层处理。
8. **Idempotent Retry** — 所有自动重试操作必须保证幂等性，防止重复扣费或重复创建资源。

---

## 1. 概述

Runtime Governance 是 P4-2 阶段的核心工作，目标是在 Credential Pipeline 已收敛（P4-1）的基础上，建立 AI 任务调用的**完整治理链路**。

### 1.1 Governance Scope

| 层 | 是否属于 Runtime Governance | 备注 |
|----|---------------------------|------|
| Agent Prompt | ❌ | 归属 Prompt Governance |
| NarrativeGateway | ❌ | LLM 路由层，已冻结 |
| Credential Pipeline | ❌ | P4-1 已完成，已冻结 |
| Worker Runtime | ✅ | 治理核心对象 |
| ModelAdapter | ✅ | 治理核心对象 |
| Provider Lifecycle | ✅ | Provider 注册/健康/路由 |
| Queue | ✅ | 限流与排队策略 |
| Metrics | ✅ | 全景观测底座 |
| Schema Validation | ✅ | P0 已完成 |
| Studio Store | ❌ | 前端消费层 |

### 1.2 当前完成状态

| 阶段 | 状态 | 交付物 |
|------|------|--------|
| P0 Schema Validation | ✅ 已冻结 | 33/33 测试通过, 已注入 script-submit.ts |
| P0.1 Validation Report | ✅ 已冻结 | 结构化错误返回, 含 code/schemaVersion/errors |
| P0.2 Quarantine | ✅ 已冻结 | In-memory 隔离区, source + payload 溯源 |
| P1-P5 | 🟡 已规划 | 设计文档就绪, 等待启动 |

---

## 2. 治理路线图

### ✅ P0 — Schema Validation（已完成）

**目标:** `AigcSpecOutput` 写入 `Project.executionResults` 前必须经过 schema 校验，拒绝非法 Agent 输出。

**为什么是 P0:** 因为 `executionResults` 已成为整个 Studio 的 canonical data，没有写入校验是最脆弱的环节。非法数据一旦入库，前端 400 行 parser 也难以兜底。

**交付物:**
- `src/runtime/schema-validator/schema-validator.ts` — AigcSchemaValidator + Migration Interface
- `src/runtime/schema-validator/execution-results-guard.ts` — schemaGuard() 守卫层
- `src/runtime/schema-validator/schema-validator.test.ts` — 23 项测试全部通过
- `src/runtime/schema-validator/schema-validator-extended.test.ts` — 10 项 Report + Quarantine 测试全部通过

**验证通过的标准:**
- ✅ 非法 Agent 输出被拒绝（返回 422）
- ✅ 合法输出正常持久化
- ✅ 返回结构化 ValidationReport（code/errors/warnings/stats）
- ✅ 非法 payload 进入 Quarantine（可溯源）
- ✅ Schema version 已定义
- ✅ 全部 33/33 测试通过

### ✅ P0.1 — Validation Report（已完成）

**返回结构:**
```json
{
  "code": "SCHEMA_INVALID",
  "schemaVersion": "1.0",
  "valid": false,
  "errors": [
    {
      "field": "videoSegments[3].description",
      "reason": "FIELD_MISSING",
      "expected": "string",
      "actual": "—"
    }
  ],
  "warnings": [],
  "stats": {
    "fieldsChecked": 14,
    "arraysChecked": 4,
    "nestedObjectsChecked": 1,
    "durationMs": 2
  }
}
```

### ✅ P0.2 — Quarantine（已完成）

非法 payload 不直接丢弃，而是进入隔离区，保留：
- 完整 validation report
- payload snippet（前 2000 字符）
- source 标记（script-submit / workbench-project）
- projectId（如果有）

可通过 `getQuarantineRecords()` 回放，用于 Prompt Governance 分析。

### 完整 Canonical Data Pipeline（已冻结）

```
Agent
  ↓
AigcSpecOutput
  ↓
Schema Validator
  ↓
Execution Guard
  ↓
  ├── passed ──→ ExecutionResults (可信数据) ──→ Frontend Store
  └── failed ──→ Quarantine (隔离区) ──→ Validation Report → 422
```

### P1 — Timeout

**目标:** 所有 Runtime 层有明确的 timeout 策略，防止单个慢操作拖死 Worker。

**Timeout 层级（平台级设计，不仅针对短剧工作台）:**

```
Request Timeout      ← HTTP 层，适用于 API 调用
  ↓
Provider Timeout     ← ModelAdapter 层，等待 Provider 响应
  ↓
Task Timeout         ← Queue 层，单个 Task 的完整生命周期
  ↓
Workflow Timeout     ← 编排层，跨多个 Task 的工作流（视频合成、批量处理）
```

各层职责：
- **Request Timeout:** API 网关层，用于 HTTP 请求超时。短任务 30s，长任务 300s。
- **Provider Timeout:** ModelAdapter.execute() 内等待 Provider API 响应的时间。按 Provider 预设（见第 4 节）。
- **Task Timeout:** 从 enqueue 到 complete 的完整时间（含排队）。超出后任务标记为 FAILED。
- **Workflow Timeout:** 预留。视频合成或 PPT 生成等涉及多个 Task 的工作流应有独立超时策略。

**超时行为:** 触发 timeout 后，记录 `PROVIDER_TIMEOUT` 错误，释放 Worker 资源。不自动重试（retry 由 P2 决定）。

**哪些任务允许覆盖默认值:** Provider Timeout 由 Provider 类型决定；Task/Workflow Timeout 后续可通过任务类型维度配置。

### P2 — Retry (按错误类型)

**目标:** 统一 retry 策略，区分可重试/不可重试错误，基于 ErrorClassifier。

**约束:** 所有自动 Retry 必须保证幂等性。对于非幂等操作（如视频生成、扣费型 API），Retry 前需先检查 Task 是否已成功完成。

**基于 ErrorClassifier（已完成 28/28 PASS）:**

| 错误码 | 可重试 | 最大重试 | 间隔 | 幂等安全 |
|--------|--------|---------|------|---------|
| RATE_LIMITED | ✅ 是 | 3 | 线性退避 | ✅ |
| NETWORK_TIMEOUT | ✅ 是 | 2 | 指数退避 | ✅ |
| NETWORK_ERROR | ✅ 是 | 2 | 指数退避 | ✅ |
| DNS_ERROR | ✅ 是 | 1 | 指数退避 | ✅ |
| PROVIDER_ERROR | ✅ 是 | 1 | 线性退避 | ❌ 需前置检查 |
| INVALID_API_KEY | ❌ 否 | 0 | — | N/A |
| EXPIRED_API_KEY | ❌ 否 | 0 | — | N/A |
| PERMISSION_DENIED | ❌ 否 | 0 | — | N/A |
| QUOTA_EXCEEDED | ❌ 否 | 0 | — | N/A |
| UNKNOWN_ERROR | ❌ 否 | 0 | — | N/A |

### P3: Circuit Breaker

**状态机:**
```
CLOSED → (失败超过阈值) → OPEN → (timeout) → HALF_OPEN → (成功) → CLOSED
                                                       → (失败) → OPEN
```

**配置:**
| 参数 | 默认值 |
|------|--------|
| 失败阈值 (OPEN) | 连续 5 次 |
| 超时时间 (OPEN→HALF_OPEN) | 30s |
| 成功阈值 (HALF_OPEN→CLOSED) | 连续 3 次 |

### P4: Provider Health

**数据模型:**
```typescript
interface ProviderHealth {
  providerId: string
  status: 'healthy' | 'degraded' | 'down'
  lastCheck: number
  successRate: number       // 最近 100 次
  p95Latency: number        // ms, P95 延迟
  retryRate: number         // 重试率
  circuitOpenRate: number   // CB 打开比例
  errorDistribution: Record<string, number>  // 错误码 → 次数
  circuitBreakerState: 'closed' | 'open' | 'half_open'
}
```

### P5: Runtime Metrics

**目标:** 以上所有治理项的数据底座。

**Runtime KPI（平台级，后续 Dashboard 指标）:**

| 指标 | 类型 | 说明 |
|------|------|------|
| Provider Success Rate | Gauge | 每个 Provider 的成功率（窗口期） |
| Provider P95 Latency | Gauge | P95 延迟，反映尾部延迟 |
| Retry Rate | Gauge | 重试请求占总请求的比例 |
| Circuit Open Rate | Gauge | CB 处于 OPEN 状态的 Provider 数 |
| Schema Reject Rate | Gauge | Schema Validation 拒绝率 |
| Quarantine Rate | Gauge | 进入隔离区的 payload 比例 |
| Average Queue Time | Gauge | Task 从 enqueue 到 start 的平均时间 |
| Average Execution Time | Gauge | Task 从 start 到 complete 的平均时间 |

**事件埋点:**

| 事件 | 字段 |
|------|------|
| task.enqueue | taskId, taskType, provider, model |
| task.start | taskId, timestamp |
| task.complete | taskId, latencyMs, tokens |
| task.error | taskId, errorCode, retryable |
| provider.timeout | provider, timeoutMs |
| provider.retry | provider, attempt, errorCode |
| circuit.breaker.open | provider, consecutiveFailures |
| circuit.breaker.close | provider, recoveryLatency |
| schema.reject | schemaVersion, errors, source |
| quarantine.store | quarantineId, errorCount, source |

---

## 3. Runtime Pipeline（实际执行顺序）

```
Agent Output
  ↓
Schema Validator           ← P0: 输入校验
  ↓
Execution Guard            ← P0: 拒绝/隔离
  ↓
Worker Runtime              ← 调度层
  │
  ├── Timeout               ← P1: 层级超时
  ├── Retry (按错误类型)     ← P2: 幂等重试
  ├── Circuit Breaker       ← P3: 保护 Provider
  ├── Provider Health       ← P4: 健康状态
  │
  └── Provider API           ← 外部调用
        ↓
  ExecutionResults           ← 持久化
  ↓
Runtime Metrics             ← P5: 底座
  ↓
Studio Store                ← 前端消费
```

**注意:** 此图是**运行时执行顺序**，不是安装/治理顺序。Timeout/Retry/CB 在 Worker 内部，数据的最终持久化在调用完成后。

---

## 4. 各优先级详情

### P0: Schema Validation

**位置:** `aigcOrchestrator.generate()` 输出 → `script-submit.ts` 写入 executionResults 之前

**核心逻辑:**
```
AigcSpecOutput → SchemaValidator.validate() → 通过则写入 / 拒绝则返回错误
```

**Schema 定义源:** `AIGC_SPEC_OUTPUT_V1.md`

**约束:**
- 不修改 RuntimeCredential、Credential Pipeline、ModelAdapterRegistry
- 不修改 Worker Runtime、Provider Registry
- FRE v1 Architecture Convergence v1 保持冻结

### P1: Timeout

**位置:** `ModelAdapterRegistry.execute()` 调用 Provider 时（Provider Timeout）

**策略（按 Provider 类型）:**

| Provider | Default Timeout | Max Timeout |
|----------|----------------|-------------|
| Volcengine | 30s | 60s |
| Wenxin | 30s | 60s |
| Bailian | 60s | 120s |
| 通用 | 30s | 60s |

**Timeout Hierarchy（平台级设计）:**

```
Request Timeout (HTTP)     → 默认 60s, 长任务 300s
  └── Provider Timeout     → 按 Provider 预设 (上表)
        └── Task Timeout   → 短任务 120s, 视频/PPT 等长任务可覆盖
              └── Workflow Timeout → 预留, 跨 Task 编排
```

**超时行为:** 触发 timeout 后，记录 `PROVIDER_TIMEOUT` 错误，释放 Worker 资源，不自动重试。

### P2: Retry

**基于 ErrorClassifier（已完成 28/28 PASS）:**

| 错误码 | 可重试 | 最大重试 | 间隔 | 幂等安全 |
|--------|--------|---------|------|---------|
| RATE_LIMITED | ✅ 是 | 3 | 线性退避 | ✅ |
| NETWORK_TIMEOUT | ✅ 是 | 2 | 指数退避 | ✅ |
| NETWORK_ERROR | ✅ 是 | 2 | 指数退避 | ✅ |
| DNS_ERROR | ✅ 是 | 1 | 指数退避 | ✅ |
| PROVIDER_ERROR | ✅ 是 | 1 | 线性退避 | ❌ 需前置检查 |
| INVALID_API_KEY | ❌ 否 | 0 | — | N/A |
| EXPIRED_API_KEY | ❌ 否 | 0 | — | N/A |
| PERMISSION_DENIED | ❌ 否 | 0 | — | N/A |
| QUOTA_EXCEEDED | ❌ 否 | 0 | — | N/A |
| UNKNOWN_ERROR | ❌ 否 | 0 | — | N/A |

**幂等性约束:** 对于非幂等操作（视频生成、扣费型 API），Retry 前必须通过 Task 状态检查确认尚未成功。

### P3: Circuit Breaker

**状态机:**
```
CLOSED → (失败超过阈值) → OPEN → (timeout) → HALF_OPEN → (成功) → CLOSED
                                                       → (失败) → OPEN
```

**配置:**
| 参数 | 默认值 |
|------|--------|
| 失败阈值 (OPEN) | 连续 5 次 |
| 超时时间 (OPEN→HALF_OPEN) | 30s |
| 成功阈值 (HALF_OPEN→CLOSED) | 连续 3 次 |

**影响范围:** 按 Provider 实例隔离，不互相影响。

### P4: Provider Health

**数据模型:**
```typescript
interface ProviderHealth {
  providerId: string
  status: 'healthy' | 'degraded' | 'down'
  lastCheck: number
  successRate: number       // 最近 100 次
  p95Latency: number        // ms
  retryRate: number
  circuitOpenRate: number
  errorDistribution: Record<string, number>
  circuitBreakerState: 'closed' | 'open' | 'half_open'
}
```

### P5: Runtime Metrics

**Runtime KPI（供 Dashboard 直接展示）:**

| 指标 | 类型 | 说明 |
|------|------|------|
| Provider Success Rate | Gauge | 窗口期成功率 |
| Provider P95 Latency | Gauge | 尾部延迟 |
| Retry Rate | Gauge | 重试比例 |
| Circuit Open Count | Gauge | 当前 OPEN 数 |
| Schema Reject Rate | Gauge | Validation 拒绝率 |
| Quarantine Rate | Gauge | 隔离率 |
| Avg Queue Time | Gauge | 排队时间 |
| Avg Execution Time | Gauge | 执行时间 |

**事件埋点:**

| 事件 | 字段 |
|------|------|
| task.enqueue | taskId, taskType, provider, model |
| task.start | taskId, timestamp |
| task.complete | taskId, latencyMs, tokens |
| task.error | taskId, errorCode, retryable |
| provider.timeout | provider, timeoutMs |
| provider.retry | provider, attempt, errorCode |
| circuit.breaker.open | provider, consecutiveFailures |
| circuit.breaker.close | provider, recoveryLatency |
| schema.reject | schemaVersion, errors, source |
| quarantine.store | quarantineId, errorCount, source |

---

## 5. 当前冻结范围（此阶段不修改）

- ✅ RuntimeCredential & Credential Pipeline
- ✅ ModelAdapterRegistry
- ✅ Worker Runtime
- ✅ Provider Registry
- ✅ FRE v1 Architecture Convergence v1 所有冻结文档
- ✅ Provider Wizard (P4-1 Workstream A/B)
- ✅ Schema Validation (P4-2 P0) — 只观测数据，不修改实现

---

## 6. 启动条件

以上所有内容在 **FRE v1 GA 之前不进入实现**。当前阶段只做规划。

**启动条件（FRE v1 GA 后）:**
1. ✅ Release Gate 全部通过
2. ✅ 无 P0/P1 缺陷
3. ✅ Funnel 数据稳定
4. ✅ 至少一轮真实用户验证
5. ✅ 冻结文档确认未修改
