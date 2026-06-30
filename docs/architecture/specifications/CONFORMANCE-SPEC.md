# KMKI Platform — Conformance Specification v1.1

> **Version**: 1.1  
> **Status**: Draft  
> **Date**: 2026-07-20  
> **Purpose**: 定义平台合规性判定标准。确保所有 Center、Registry、Event、API 符合 Architecture Baseline v1.0.0 的公共契约。作为自动化架构审计（CI/Gate）的依据。  
> **Target Audience**: Center 开发者、架构评审委员会、CI 流水线  
> **Governing Docs**: Constitution v1.1, Blueprint v2.0, ADR v1.0, Center SDK v1.0, Center Template v1.0

---

## 1. Rule ID 体系

本规范所有规则使用统一的 Rule ID 体系。Rule ID 是 Conformance Check 中唯一的规则标识符，在所有 Review、CI 输出、例外申请中必须通过 Rule ID 引用。

### 1.1 ID 格式

```
{category}-{number}
│           │
│           └── 三位流水号（001-999）
│
└── 分类前缀
```

### 1.2 Severity 等级

| Severity | 颜色 | 含义 | 判定影响 | 需修复 |
|----------|:----:|------|:--------:|:------:|
| **CRI** (Critical) | 🔴 | 违反 Platform Constitution 或 ADR 的核心约束 | 直接 Block | 必须修复 |
| **MAJ** (Major) | 🟠 | 违反 Center Spec 或 SDK 规范 | 影响评分 | 必须修复 |
| **MIN** (Minor) | 🟡 | 违反最佳实践或优雅性规范 | 记录 Warning | 建议修复 |
| **INF** (Info) | 🔵 | 提示信息，非违规 | 不扣分 | 可选 |

### 1.3 Rule ID 完整列表

#### API 类 (API-)

| ID | Severity | 标题 | 检查方式 | 通过条件 |
|----|:--------:|------|---------|----------|
| API-001 | MAJ | API 路径前缀 | 模式匹配 | `/api/{center}` 开头 |
| API-002 | MAJ | 请求格式 | Schema 校验 | `{ params, context }` |
| API-003 | CRI | 响应格式 | Schema 校验 | `{ success, data, error, traceId, meta }` |
| API-004 | MAJ | 错误响应格式 | Schema 校验 | `{ code, message, detail }` |
| API-005 | MIN | 分页格式 | Schema 校验 | `{ page, pageSize, total }` |
| API-006 | MAJ | Gateway 注册 | Route 表检查 | Route 存在 |
| API-007 | MAJ | 无重复路径 | 扫描 | 无冲突 |
| API-008 | MIN | 标准 HTTP 方法 | 检查 | 仅 POST/GET |
| API-009 | MIN | Lifecycle 非 removed | 扫描 | >= experimental |
| API-010 | MIN | 废弃 API 有日期 | 检查 | deprecateAt 存在 |
| API-011 | MIN | 废弃通知期 | 日期计算 | ≥ 90 天 |
| API-012 | MAJ | 标准状态码 | 扫描 | 仅 200/400/401/403/404/409/429/500/503 |
| API-013 | MAJ | 状态码匹配 | 匹配 | 200 GET / 201 POST |

#### Registry 类 (REG-)

| ID | Severity | 标题 | 检查方式 | 通过条件 |
|----|:--------:|------|---------|----------|
| REG-001 | CRI | Registry 目录位置 | 文件系统 | `src/registry/` |
| REG-002 | MIN | Registry 命名 | 文件名 | `{module}.registry.ts` |
| REG-003 | MAJ | Registry 注册索引 | 导入检查 | `index.ts` 导出 |
| REG-004 | CRI | 继承 BaseRegistry | 类型检查 | `extends BaseRegistry` |
| REG-005 | MAJ | 有对应 Repository | 文件系统 | `repository/{module}.repository.ts` |
| REG-006 | INF | 方法返回 Promise | 类型检查 | `Promise<T>` |
| REG-007 | CRI | 不直接访问数据库 | 代码扫描 | 无 SQL |
| REG-008 | CRI | 不直接调用 HTTP | 导入检查 | 无 axios/fetch |
| REG-009 | CRI | 只通过 Repository 访问数据 | 导入检查 | 仅引用 Repository |

#### Event 类 (EVT-)

| ID | Severity | 标题 | 检查方式 | 通过条件 |
|----|:--------:|------|---------|----------|
| EVT-001 | CRI | 事件命名格式 | 正则匹配 | `{source}.{action}.v{version}` |
| EVT-002 | MAJ | source 为已注册 Center | 跨文档检查 | 存在于 Known Centers |
| EVT-003 | INF | version 从 1 递增 | 扫描 | 无 v0 或跳号 |
| EVT-004 | CRI | 不发布其他 Center 的事件 | 前缀检查 | 前缀 == 自身 Center |
| EVT-005 | CRI | 不删除已有 Event | diff | 旧事件仍在 |
| EVT-006 | CRI | 不修改 Payload 字段名 | diff | 字段名不变 |
| EVT-007 | CRI | 不修改 Payload 类型 | diff | 类型不变 |
| EVT-008 | MAJ | 新增字段可选 | diff | required 无新增 |

#### Health 类 (HLT-)

| ID | Severity | 标题 | 检查方式 | 通过条件 |
|----|:--------:|------|---------|----------|
| HLT-001 | CRI | 暴露 /health | HTTP 请求 | 200 OK |
| HLT-002 | MAJ | 包含 status | Schema 校验 | 存在 |
| HLT-003 | MAJ | 包含 checks | Schema 校验 | 存在 |
| HLT-004 | MAJ | 有 database 检查 | Schema 校验 | 存在（如有 DB）|
| HLT-005 | MAJ | 有 event_bus 检查 | Schema 校验 | 存在 |
| HLT-006 | MAJ | 有 cache 检查 | Schema 校验 | 存在（如有 Cache）|
| HLT-007 | MAJ | 有 dependencies | Schema 校验 | 存在 |
| HLT-008 | MAJ | 依赖声明完整 | 交叉引用 | 所有依赖存在 |
| HLT-009 | MAJ | status 真实 | 逻辑检查 | 无虚假 healthy |
| HLT-010 | MAJ | 暴露 /metrics | HTTP 请求 | 200 OK |
| HLT-011 | MAJ | 有 requests_total | 文本扫描 | Prometheus 格式 |
| HLT-012 | MAJ | 有 request_latency_ms | 文本扫描 | 存在 |
| HLT-013 | MAJ | 有 request_errors_total | 文本扫描 | 存在 |
| HLT-014 | MAJ | 有 health_status | 文本扫描 | 存在 |
| HLT-015 | MAJ | 有 event_published_total | 文本扫描 | 存在 |
| HLT-016 | MAJ | 有 db_query_latency_ms | 文本扫描 | 存在（如有 DB）|
| HLT-017 | MIN | 指标含 center label | 格式检查 | label: center={name} |

#### Architecture 类 (ARC-)

| ID | Severity | 标题 | 检查方式 | 通过条件 |
|----|:--------:|------|---------|----------|
| ARC-001 | CRI | Controller 不直接访问 Repository | 导入扫描 | 无直接引用 |
| ARC-002 | CRI | Controller 不直接访问 DAO | 导入扫描 | 无直接引用 |
| ARC-003 | CRI | Service 不直接访问 DAO | 导入扫描 | 无直接引用 |
| ARC-004 | CRI | Service 不直接调用外部 HTTP | 导入扫描 | 无 axios/fetch |
| ARC-005 | CRI | Service 只调用 Registry/Service | 导入扫描 | 无违规导入 |
| ARC-006 | CRI | Registry 只调用 Repository | 导入扫描 | 无违规导入 |
| ARC-007 | CRI | Repository 只调用 DAO | 导入扫描 | 无违规导入 |
| ARC-008 | MAJ | DAO 不包含业务逻辑 | 代码扫描 | 无业务 if/for |
| ARC-009 | CRI | 无循环依赖 | 导入图分析 | 无环 |
| ARC-010 | CRI | 无违禁依赖方向 | 导入图分析 | 无 Gateway→DAO 等 |
| ARC-011 | MIN | 目录符合 Template | 文件树比较 | 无缺失目录 |
| ARC-012 | INF | 无 utils/ 目录 | 文件系统 | 无 |
| ARC-013 | INF | 无 lib/ 目录 | 文件系统 | 无 |
| ARC-014 | INF | 无 common/ 目录 | 文件系统 | 无 |

#### SDK 类 (SDK-)

| ID | Severity | 标题 | 检查方式 | 通过条件 |
|----|:--------:|------|---------|----------|
| SDK-001 | CRI | 使用 createCenter() | 入口扫描 | 存在 |
| SDK-002 | MAJ | 使用 CenterLogger | 导入检查 | 无 console.log |
| SDK-003 | MAJ | 使用 CenterMetrics | 导入检查 | SDK 注册 |
| SDK-004 | MAJ | 使用 CenterEventBus | 导入检查 | SDK 注册 |
| SDK-005 | MAJ | 使用 CenterHealth | 导入检查 | SDK 注册 |
| SDK-006 | MAJ | 使用 CenterError | 导入检查 | 无原生 Error throw |
| SDK-007 | MAJ | 不使用原生 ORM | 导入检查 | 无 TypeORM/Prisma |
| SDK-008 | INF | 含 .kmki-template 标志 | 文件系统 | 存在 |
| SDK-009 | MAJ | 含 @kmki/center-sdk | 包扫描 | package.json 存在 |
| SDK-010 | MAJ | name 以 @kmki/ 开头 | 包名检查 | 前缀正确 |
| SDK-011 | INF | OpenAPI 有生成标记 | 注释检查 | 存在 |

---

## 2. Conformance Scope

所有 Center 必须通过 Conformance Check 方可进入生产环境。Conformance Check 覆盖以下维度：

| 维度 | Rule 范围 | 占比 | 最低要求 |
|------|:---------:|:----:|:--------:|
| Public Contract | API-001 ~ API-013 | 25% | 100% |
| Registry Contract | REG-001 ~ REG-009 | 20% | 100% |
| Event Contract | EVT-001 ~ EVT-008 | 15% | 100% |
| Health & Metrics | HLT-001 ~ HLT-017 | 15% | ≥ 80% |
| Architecture Layer | ARC-001 ~ ARC-014 | 15% | 100% |
| SDK & Template | SDK-001 ~ SDK-011 | 10% | ≥ 70% |
| **Total** | **72 条规则** | **100%** | **≥ 95%** |

**Critical 违规直接 Block，无论总分。**

### 2.1 Conformance Level（等级）

| Level | Score | 颜色 | 含义 | 条件 |
|:-----:|:----:|:----:|------|------|
| 🏆 **Platinum** | 100% | 金色 | Reference Center — 完美的架构合规示例 | 无 Critical, 无 Major, 无 Minor |
| ⭐ **Gold** | ≥ 98% | 绿色 | Production Ready — 可接受进入生产 | 无 Critical, ≤ 5 Minor |
| 🥈 **Silver** | ≥ 95% | 蓝色 | Qualified — 符合最低要求 | 无 Critical, ≤ 10 条未通过 |
| 🥉 **Bronze** | ≥ 85% | 黄色 | Legacy Compatible — 兼容模式 | 需 Tech Debt 记录 + 修复计划 |
| ❌ **Failed** | < 85% | 红色 | Block | 不允许注册到 Gateway |

Conformance Level 会显示在 Developer Center 的 Center Registry Dashboard 中：

```
AI Center     🏆 Platinum  🟢 100%
Gateway       🏆 Platinum  🟢 100%
Runtime       ⭐ Gold      🟢 98%  (1 Minor)
Capability    🥈 Silver    🟢 97%  (3 Minor)
Platform Avg  ⭐ Gold      🟢 98.7%
Arch Drift    🟢 +0.5  Stable
```

---

## 3. Architecture Drift Index

### 3.1 定义

**Architecture Drift Index (ADI)** 衡量一段时间内 Center 架构的退化或改进程度。

```
ADI = 当前评分 − 上次评分

ADI > 0  → 改进（架构变好）
ADI = 0  → 稳定
ADI < 0  → 漂移（架构退化）
```

### 3.2 漂移等级

| ADI 范围 | 等级 | 含义 | 操作 |
|:--------:|:----:|------|------|
| ≥ +2.0 | 🟢 Improving | 架构在改进 | 继续 |
| ± 2.0 | 🟢 Stable | 架构稳定 | 正常观察 |
| −2.0 ~ −5.0 | 🟡 Drifting | 轻微漂移 | 记录 Tech Debt |
| −5.0 ~ −10.0 | 🟠 Degrading | 明显退化 | 架构评审 |
| < −10.0 | 🔴 Critical Drift | 严重漂移 | 冻结 Center 变更 |

### 3.3 Drift Dashboard 示例

```
Architecture Health Dashboard — 2026 Q3
┌──────────────────┬──────┬──────┬──────┬─────────┐
│ Center           │ Score│ Prev│ ADI  │ Status  │
├──────────────────┼──────┼──────┼──────┼─────────┤
│ AI Center        │ 100  │ 100  │ +0.0 │ 🟢 Stable│
│ Gateway           │ 100  │ 100  │ +0.0 │ 🟢 Stable│
│ Runtime           │ 98   │ 100  │ −2.0 │ 🟡 Drift │
│ Asset             │ 100  │ 100  │ +0.0 │ 🟢 Stable│
│ Capability        │ 97   │ 99   │ −2.0 │ 🟡 Drift │
│ Observability     │ 99   │ 98   │ +1.0 │ 🟢 Stable│
│ Developer Center  │ 100  │ —    │ —    │ 🟢 New   │
├──────────────────┼──────┼──────┼──────┼─────────┤
│ Platform Average  │ 98.1 │ 99.2 │ −1.1 │ 🟢 Stable│
└──────────────────┴──────┴──────┴──────┴─────────┘
```

### 3.4 ADI 记录存储

每次 Conformance Check 的结果（包括评分和 ADI）必须存储在 Observability Center：

```typescript
interface ConformanceRecord {
  centerName: string
  version: string
  checkedAt: Date
  score: number
  level: 'platinum' | 'gold' | 'silver' | 'bronze' | 'failed'
  adi: number                       // Architecture Drift Index
  previousScore: number
  dimensionScores: Record<string, number>
  failingRules: { id: string, severity: string, detail: string }[]
  passed: boolean
}
```

---

## 4. Public Contract Conformance

### 4.1 API 签名合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| API-001 | MAJ | 模式匹配 | 路径前缀正确 |
| API-002 | MAJ | Schema 校验 | 结构一致 |
| API-003 | CRI | Schema 校验 | 字段完整 |
| API-004 | MAJ | Schema 校验 | 字段完整 |
| API-005 | MIN | Schema 校验 | 模式一致 |
| API-006 | MAJ | Route 表 | Route 存在 |
| API-007 | MAJ | 扫描 | 无冲突 |
| API-008 | MIN | 检查 | 无自定义方法 |

### 4.2 API 版本合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| API-009 | MIN | 扫描 | 非 removed |
| API-010 | MIN | 检查 | 字段存在 |
| API-011 | MIN | 日期计算 | ≥ 90 天 |

### 4.3 HTTP 状态码合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| API-012 | MAJ | 扫描 | 无自定义状态码 |
| API-013 | MAJ | 匹配 | 状态码正确 |

---

## 5. Registry Contract Conformance

### 5.1 结构合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| REG-001 | CRI | 文件系统 | 路径正确 |
| REG-002 | MIN | 文件名匹配 | `{module}.registry.ts` |
| REG-003 | MAJ | 导入检查 | 已导入导出 |
| REG-004 | CRI | 类型检查 | `extends BaseRegistry` |
| REG-005 | MAJ | 文件系统 | 存在 |
| REG-006 | INF | 类型检查 | `Promise<T>` |

### 5.2 数据访问合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| REG-007 | CRI | 代码扫描 | 无 SQL |
| REG-008 | CRI | 导入检查 | 无 axios/fetch |
| REG-009 | CRI | 导入检查 | 仅引用 Repository |

---

## 6. Event Contract Conformance

### 6.1 命名合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| EVT-001 | CRI | 正则匹配 | 符合模式 |
| EVT-002 | MAJ | 跨文档检查 | Key 存在于 Known Centers |
| EVT-003 | INF | 扫描 | 无 v0 或跳号 |
| EVT-004 | CRI | 前缀检查 | 事件前缀 == Center name |

### 6.2 Schema 兼容性合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| EVT-005 | CRI | diff | 旧事件仍在 |
| EVT-006 | CRI | diff | 字段名未变 |
| EVT-007 | CRI | diff | 类型未变 |
| EVT-008 | MAJ | diff | required 字段无新增 |

---

## 7. Health & Metrics Conformance

### 7.1 Health Endpoint 合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| HLT-001 | CRI | HTTP 请求 | 200 OK |
| HLT-002 | MAJ | Schema 校验 | 存在 |
| HLT-003 | MAJ | Schema 校验 | 存在 |
| HLT-004 | MAJ | Schema 校验 | 存在（如有数据库）|
| HLT-005 | MAJ | Schema 校验 | 存在 |
| HLT-006 | MAJ | Schema 校验 | 存在（如有缓存）|
| HLT-007 | MAJ | Schema 校验 | 存在 |
| HLT-008 | MAJ | 交叉引用 | 完整 |
| HLT-009 | MAJ | 逻辑检查 | 无虚假 healthy |

### 7.2 Metrics 合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| HLT-010 | MAJ | HTTP 请求 | 200 OK |
| HLT-011 | MAJ | 文本扫描 | Prometheus 格式 |
| HLT-012 | MAJ | 文本扫描 | 存在 |
| HLT-013 | MAJ | 文本扫描 | 存在 |
| HLT-014 | MAJ | 文本扫描 | 存在 |
| HLT-015 | MAJ | 文本扫描 | 存在 |
| HLT-016 | MAJ | 文本扫描 | 存在（如有数据库）|
| HLT-017 | MIN | 格式检查 | label: center={name} |

---

## 8. Architecture Layer Conformance

### 8.1 分层调用合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| ARC-001 | CRI | 导入扫描 | 无直接引用 |
| ARC-002 | CRI | 导入扫描 | 无直接引用 |
| ARC-003 | CRI | 导入扫描 | 无直接引用 |
| ARC-004 | CRI | 导入扫描 | 无 axios/fetch |
| ARC-005 | CRI | 导入扫描 | 无违规导入 |
| ARC-006 | CRI | 导入扫描 | 无违规导入 |
| ARC-007 | CRI | 导入扫描 | 无违规导入 |
| ARC-008 | MAJ | 代码扫描 | 无业务 if/for |

### 8.2 依赖方向合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| ARC-009 | CRI | 导入图分析 | 无环 |
| ARC-010 | CRI | 导入图分析 | 无违规 |

### 8.3 目录结构合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| ARC-011 | MIN | 文件树比较 | 无缺失目录 |
| ARC-012 | INF | 文件系统 | 无 |
| ARC-013 | INF | 文件系统 | 无 |
| ARC-014 | INF | 文件系统 | 无 |

---

## 9. SDK & Template Conformance

### 9.1 SDK 使用合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| SDK-001 | CRI | 入口文件扫描 | 存在 |
| SDK-002 | MAJ | 导入检查 | 无 console.log |
| SDK-003 | MAJ | 导入检查 | SDK 注册 |
| SDK-004 | MAJ | 导入检查 | SDK 注册 |
| SDK-005 | MAJ | 导入检查 | SDK 注册 |
| SDK-006 | MAJ | 导入检查 | 无原生 Error throw |
| SDK-007 | MAJ | 导入检查 | 无 TypeORM/Prisma |

### 9.2 Template 生成合规

| Rule ID | Severity | 检查方式 | 通过条件 |
|---------|:--------:|---------|----------|
| SDK-008 | INF | 文件系统 | 存在 |
| SDK-009 | MAJ | 包扫描 | 存在 |
| SDK-010 | MAJ | 包名检查 | 前缀正确 |
| SDK-011 | INF | 注释检查 | 存在生成标记 |

---

## 10. Conformance Report

### 10.1 报告格式

当 CI 执行 Conformance Check 后，生成以下格式的报告：

```json
{
  "centerName": "capability",
  "centerVersion": "1.0.0",
  "checkedAt": "2026-07-20T12:00:00Z",
  "overallScore": 97.5,
  "overallLevel": "silver",
  "passed": true,
  "adi": -2.0,
  "previousScore": 99.5,
  "dimensions": [
    {
      "dimension": "Public Contract",
      "score": 25,
      "maxScore": 25,
      "passed": true,
      "checks": [
        { "ruleId": "API-001", "passed": true, "detail": "/api/capability/resolve" },
        { "ruleId": "API-002", "passed": true, "detail": "params+context" },
        { "ruleId": "API-003", "passed": true, "detail": "success+data+error+meta" }
      ]
    },
    {
      "dimension": "Event Contract",
      "score": 15,
      "maxScore": 15,
      "passed": true,
      "checks": [
        { "ruleId": "EVT-001", "passed": true },
        { "ruleId": "EVT-005", "passed": true }
      ]
    }
  ],
  "failures": [
    {
      "ruleId": "HLT-012",
      "severity": "MAJ",
      "detail": "{center}_request_latency_ms not found in /metrics"
    }
  ],
  "criticalCount": 0,
  "majorCount": 1,
  "minorCount": 2,
  "infoCount": 0
}
```

### 10.2 判定规则

| Level | 判定 | 操作 |
|:-----:|------|------|
| Platinum | ✅ Pass | 不允许注册到 Gateway |
| Gold | ✅ Pass | 允许注册 |
| Silver | ⚠️ Pass | 允许注册 + 记录 Warning |
| Bronze | ❌ Conditional | 需要架构评审 + 修复计划 |
| Failed | ❌ Block | 不允许注册 + 必须重做 |

### 10.3 Severity 加权评分

```
Score = (所有通过规则的权重总和 / 72) × 100

权重（按 Severity 加权）:
  CRI: 3 分（若违规）
  MAJ: 2 分（若违规）
  MIN: 1 分（若违规）
  INF: 0 分（不扣分）

满分: CRI × 3 + MAJ × 2 + MIN × 1 均通过
扣分: CRI × 3, MAJ × 2, MIN × 1
```

---

## 11. CI 集成

Conformance Check 集成到 CI 流水线的标准步骤：

```yaml
# .github/workflows/conformance.yml (每个 Center 的 CI)
name: KMKI Conformance Check

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Check Directory Structure
        run: npx kmki conformance check-dir

      - name: Check SDK Usage
        run: npx kmki conformance check-sdk

      - name: Check Architecture Layer
        run: npx kmki conformance check-layers

      - name: Check API Format
        run: npx kmki conformance check-api

      - name: Check Events
        run: npx kmki conformance check-events

      - name: Check Health
        run: npx kmki conformance check-health

      - name: Generate Report
        run: npx kmki conformance report --output conformance.json

      - name: Verify Level (min Silver)
        run: npx kmki conformance verify --min-level silver
```

---

## 12. 年度 Conformance 审计

### 12.1 审计频率

| Scope | 频率 | 执行者 |
|-------|------|--------|
| 新增 Center | 每次 PR | CI 自动 |
| 已有 Center 修改 | 每次 PR | CI 自动 |
| 全平台年度审计 | 每年一次 | 架构评审团队 |

### 12.2 年度审计内容

每年对所有 Center 进行一次全量 Conformance 审计：

1. 所有 Center 重新执行所有 7 个维度的检查
2. 检测是否有架构漂移（Architecture Drift）
3. 检测是否有废弃的 API/Event/Endpoint
4. 输出年度 Conformance Audit Report

### 12.3 架构漂移处理

| 漂移程度 | 处理方式 |
|:--------:|---------|
| 轻微（< 5 个 rules failed）| 记录 Tech Debt，修复计划 ≤ 1 个月 |
| 中等（5-15 个）| 架构评审，修复计划 ≤ 1 个 Sprint |
| 严重（> 15 个）| 冻结 Center 变更，必须全量修复 |

---

## 13. 例外处理

### 13.1 允许例外

以下情况允许 Conformance Exception：

1. **新 Center 首次提交**：在首次 PR 时可豁免部分检查，但必须在 1 个月内补齐
2. **Legacy Center 迁移**：迁移期间允许渐进达标，但需有迁移计划

### 13.2 例外申请流程

```
开发者提交 Exception Request（需注明 Rule ID）
  │
  ▼
架构评审团队评估（≤ 3 个工作日）
  │
  ├── Approved → 记录例外 + 截止日期
  │
  └── Rejected → 必须修复后提交
```

---

> **没有 Conformance Check 的 Center 不是 KMKI Center。合规性是架构契约的可执行形式。不遵守就是未实现。**
