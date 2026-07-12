# ADR-001 — Explainability 作为 GEO 横向平台能力

**状态:** Accepted
**日期:** 2026-07-05
**作者:** GEO Explainability 架构团队

---

## 背景

经过 v1.1 Sprint 1 架构复审，发现当前 Explain 设计存在 4 个 P0 问题：

1. **Explain 被设计成 Mission 的附属功能** — 但实际上 Explain 应该是 GEO 的横向平台能力
2. **双模型（ExplainResult + MissionDecision）** — 未来会膨胀为 KnowledgeDecision/VerificationDecision
3. **API 按资源拆分** — `missions/{id}/explain`、`verification/{id}/explain` → 每个 type 一个 endpoint
4. **Builder 在做预测** — MissionDecisionBuilder 内部计算 confidence/expectedScore/delta，这些属于 Decision Engine

审计总分 0/5，所有设计文档标记为 `[REQUIRES_REVISION]`。

## 架构决策

### 1. 统一为 ExplainDocument 格式

所有 Explain 输出（Mission/Verification/Knowledge/Discovery/Execution）统一为 `ExplainDocument` 接口：
- `ExplainDocument` 包含：id, title, summary, sections[], confidence, metadata
- `sections[]` 由数据驱动的 Section 构成，类型包括：evidence, threshold, impact, rule, reasoning, recommendation, metric, timeline
- `ExplainItem` 包含 label/value/detail/source/confidence/status
- `ExplainMetadata` 包含 type/sourceId/sourceType/generatedAt/provider/version

### 2. 单一 Explain API

`GET /api/geo/explain?type=xxx&id=xxx` — 不按资源拆分。

### 3. 插件化 Provider

`ExplainEngine` 只做路由，`ExplainProvider` 通过 Registry 注册，新 type 只需新增 Provider。

### 4. ExplainDocumentBuilder 纯组装

Builder 不计算 confidence/delta/expectedScore，所有派生值来自 Decision Engine 或数据源。

---

## 架构冻结规则（v1.0 Freeze）

以下规则在 Explainability Platform v1.0 生命周期内不可违反：

| # | 规则 | 说明 |
|---|------|------|
| 1 | ExplainDocument 是唯一 Explain SSOT | 禁止引入第二个 Explain 模型（如 ExplainResultV2） |
| 2 | Explain Engine 只负责 Provider 路由 | 禁止在 Engine 中包含业务逻辑或 type 判断 |
| 3 | Explain Builder 不允许业务计算 | 禁止在 Builder 中计算 confidence/delta/expectedScore 等派生值 |
| 4 | Explain Renderer 永远数据驱动 | 禁止按业务 type 复制组件树；只按 section.type 渲染 |
| 5 | Runtime/Planner/Mission/Discovery 不得绕过 Explain Provider | 所有 Explain 必须通过 Provider 输出 ExplainDocument |
| 6 | Explain 永远只读 Repository | Explain Provider 不应直接访问 Runtime 或 Service |

---

## 后果

### 正面
- 新增 Explain type（execution, observation, adaptive）只需新增 Provider，不修改 Engine/Renderer/API/Builder
- 前端渲染器不需要知道业务 type
- Explain 成为 GEO 的平台基础设施，不是任何子系统的附属功能
- Trace → ExplainDocument 天然打通，不需要第二套 UI

### 负面
- 现有 4 个 Provider（Discovery/Recommendation/Verification/Presence）需要迁移到 ExplainDocumentBuilder
- 前端 `ExplainResult`（@deprecated）需要在下个版本移除
- 已有页面的 Explain 入口需要切换到统一 Drawer

---

## 实现状态

| 组件 | 状态 | 文件 |
|------|------|------|
| ExplainDocument | 🟢 已冻结 | `explain/explain-document.ts` |
| ExplainDocumentBuilder | 🟢 已冻结 | `explain/builder.ts` |
| Explain Engine | 🟢 已冻结 | `explain/engine.ts` |
| Explain Registry | 🟢 已冻结 | `explain/registry.ts` |
| Explain API | 🟢 已冻结 | `routes/geo-explain.route.ts` |
| Explain Renderer (frontend) | 🟢 已冻结 | `GeoExplainSection/` |
| MissionExplainProvider | 🟢 已冻结 | `explain/providers/mission-explain-provider.ts` |
| Discovery Provider | 🟢 已冻结 | `explain/providers/discovery.provider.ts` |
| Recommendation Provider | 🟢 已冻结 | `explain/providers/recommendation.provider.ts` |
| Verification Provider | 🟢 已冻结 | `explain/providers/verification.provider.ts` |
| Presence Provider | 🟢 已冻结 | `explain/providers/presence.provider.ts` |
| ExplainResult (backend) | ✅ 已删除 | 无引用 |
| ExplainResult (frontend) | ⚠️ @deprecated | `types/explain.ts` |

---

## 相关 ADR

| ADR | 关联 |
|-----|------|
| ADR-002 (未来) | Execution Runtime 架构 |
| ADR-003 (未来) | Provider Router + Capability |
