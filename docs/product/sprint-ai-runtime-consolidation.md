# Sprint: AI Runtime Consolidation (P0)

> **Workspace 不拥有 Runtime，Workspace 只消费 Runtime。**

## 目标

消除双架构。整个 SaaS 平台只有一套 AI Runtime。

## 架构原则

```
Workspace（短剧/小说/GEO/未来）
    │ 仅通过 UnifiedAIGateway 调用
    ▼
AI Runtime Engine（平台基础设施）
    ├── UnifiedAIGateway        — 唯一 AI 调用入口
    ├── ProviderStateService     — 统一状态管理
    ├── UserModelResolver        — 用户配置解析（仅 Runtime 可访问）
    ├── Credential Lifecycle     — 凭据生命周期
    ├── Encryption Guard         — 加密密钥一致性检测
    ├── Health Check             — Provider 健康检测
    ├── Runtime Diagnostics      — 运行时诊断
    ├── Provider Routing         —（预留）Provider 路由
    └── Failover / Rate Limit    —（预留）故障转移 / 限流
```

**不允许：**
- 任何 Workspace 直接读 Provider
- 任何 Workspace 直接读 Credential
- 任何 Workspace 直接读 UserModelConfigV2 Repository
- 任何 Workspace 直接调 Provider SDK

---

## 任务清单

### R-001 — GEO Agent 全部走 UnifiedAIGateway（P0）

GEO Agent 的 LLM 调用不再经过 `StructuredExecutor` / `resolveLLMConfig()`，全部改为：
```
Agent → UnifiedAIGateway.invokeAI() → UserModelResolver → Provider
```

**范围：**
- `StructuredExecutor.ts` — 改为委托 UnifiedAIGateway
- `provider-resolver.ts` — 删除或精简为 UnifiedAIGateway 封装
- KQ Workflow 的 `createRealLLM()` — 改为统一调用
- 所有 12 个 GEO AI Agent 的 LLM 调用

**DoD：** GEO 不再存在第二条 AI 调用路径。所有 AI 请求最终都进入 UnifiedAIGateway。所有 Workspace 共用同一 Runtime。

---

### R-002 — GEO 不允许直接访问 UserModelConfigV2 Repository（P0）

GEO 不应持有 Repository 引用。改为：
```
GEO → AI Runtime → UserModelResolver → UserModelConfigV2
```

**范围：**
- 删除 `user-model-config.repository.ts`
- 所有读取 `UserModelConfigV2` 的地方改为调用 `UserModelResolver`
- Repository 属于 Runtime，不属于 GEO

**DoD：** GEO 代码中不存在直接 import `UserModelConfigV2` 的语句。Repository 归 Runtime 所有。

---

### R-003 — 统一 Provider 状态管理（P0）

所有状态统一通过 `ProviderStateService`。

**范围：**
- 删除 GEO 中的 `getProviderStatus()`, `checkProvider()`, `resolveProvider()` 等方法
- 所有 Provider 状态查询改为 `ProviderStateService` 调用

**DoD：** GEO 零 Provider 状态管理代码。

---

### R-004 — 删除 GEO Runtime Layer（P0）

GEO 中存在一套独立 Runtime 实现，包括：
- Provider 判断 / 路由
- Retry / Timeout 逻辑
- Health 检测
- Credential 解析

全部删除。GEO 只保留 Business Logic。

**范围：**
- `backend/src/services/geo/runtime/` 目录评估并迁移
- `backend/src/services/geo/presence/geo-credential-provider.ts` — 改为委托
- `StructuredExecutor` — 内联为 UnifiedAIGateway 薄封装或删除

**DoD：** GEO 不包含任何 AI 调用基础设施。所有基础设施归 Runtime 所有。

---

### R-005 — Workspace Consistency Test（P0）

三端验证：短剧、小说、GEO。

**验证项：**
- 同一用户 → 同一 Provider → 同一 Model
- Runtime 返回一致
- Health 一致
- Credential 一致

**后续：** 加入 CI。

**DoD：** 三个 Workspace 在相同用户配置下，AI 调用结果一致。

---

### R-006 — Credential Provider 统一委托（P0）

所有 Credential Provider 统一委托给 AI Runtime。

**范围：**
- `geo-credential-provider.ts` — 改为 Runtime 委托封装
- `credential-audit.ts` — 统一审计路径

---

### R-007 — Runtime Dependency Audit（P0）

扫描 GEO 中所有 Runtime 相关引用。

**扫描范围：**
| 模块 | 动作 |
|------|------|
| `resolveLLM` / `resolveLLMConfig` | 迁出 |
| `resolveProvider` | 迁出 |
| `ProviderRegistry` | 迁出 |
| `UserModelRepository` | 迁出 |
| `CredentialProvider` | 迁出 |
| `ProviderResolver` | 迁出 |
| `StructuredExecutor` | 迁出或删除 |
| `retryWithBackoff` | 迁出 |
| `timeout` | 迁出 |
| `healthCheck` | 迁出 |

**验收指标：**
```
GEO Runtime Dependencies Before: 24
GEO Runtime Dependencies After: 0
```

**DoD：** 输出扫描报告，确认 GEO 零 Runtime 基础设施。

---

### R-008 — Architecture Guard（建议）

执行后增加 Architecture Rule（CI 可检查）：

**规则：**
- 禁止 `import` 任何 `PrismaModel.Provider` / `ApiKey` 以外的 Provider 表
- 禁止 `import` 任何 `UserModelConfigV2`
- 所有 AI 调用必须经过 `UnifiedAIGateway`
- 所有状态查询必须经过 `ProviderStateService`

---

## 强制约束（Gates）

### Gate 1：禁止业务中断（P0）
采用 **Strangler Pattern（绞杀者模式）**，严禁"全部改完再修"。
```
Old Runtime
  ├── 已迁移 → Unified Runtime
  └── 未迁移 → Legacy Runtime（临时）
```
当所有调用都迁移完成并验证通过后，再一次性删除 Legacy Runtime。

### Gate 2：AI Runtime 不允许反向依赖 Workspace（P0）
```
Workspace ↓ AI Runtime（正确）
AI Runtime ↓ Workspace（禁止）
```
Runtime 必须保持平台层独立，不引用任何 Workspace 模块。

### Gate 3：统一契约（Contract）
Workspace 不允许自己拼参数。统一请求/响应：

```ts
RuntimeRequest {
  userId, workspace, agent, capability,
  modelPreference, prompt, context, metadata
}
RuntimeResponse {
  success, provider, model, latency,
  tokenUsage, finishReason, content, diagnostics
}
```

## 执行顺序

```
① R-003（统一 ProviderStateService）
② R-006（Credential 统一委托）
③ R-001 + R-002（Agent 调用迁移 + Repository 收敛）
④ R-007（Dependency Audit — 扫描确认后再删除）
⑤ R-004（删除 GEO Runtime Layer）
⑥ R-005（Workspace Consistency Test）
⑦ R-008（Architecture Guard + CI 规则）
```

## 验收指标（Runtime Consolidation Score）

| 指标 | DoD |
|------|----:|
| Workspace Runtime 实现数 | **1** |
| Provider Registry 实现数 | **1** |
| Credential Manager 实现数 | **1** |
| UserModel Repository 直接访问点 | **0** |
| UnifiedAIGateway 覆盖率 | **100%** |
| ProviderStateService 覆盖率 | **100%** |
| Runtime 重复代码 | **0** |

---

## 验收总标准（Sprint DoD）

- [ ] GEO 不再保存任何 API Key
- [ ] GEO 不再维护独立 Provider 配置
- [ ] GEO 不再存在第二条 AI 调用路径
- [ ] GEO 不直接访问 UserModelConfigV2 Repository
- [ ] GEO 不包含 Provider 状态管理代码
- [ ] GEO Runtime Dependencies Before: 24, After: 0
- [ ] 短剧、小说、GEO 三端 Workspace Consistency Test 通过
- [ ] 无重复代码、无重复配置、无双写数据
- [ ] Build、部署、PM2 全部通过
- [ ] Architecture Guard 规则已定义

---

## 交付物

1. 架构变更说明（此文）
2. Runtime 接入清单（R-007 扫描报告）
3. 删除的重复模块列表
4. 前后端影响范围
5. 数据兼容性说明（现有用户无需迁移）
6. Workspace 联调验证结果（R-005）

---

## 后续

完成后正式更新 GEO 北极星架构文档，将 AI Runtime Engine 写入平台基础设施层。
