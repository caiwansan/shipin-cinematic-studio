# Architecture Audit Report — GEO Explainability (v1.1 Sprint 1)

**审计日期:** 2026-01-16
**审计范围:** Mission Explainability Foundation
**审计员:** GEO Explainability 架构审计员

---

## 1. 审计结果摘要表

| # | 审计问题 | 结果 | 说明 |
|---|---------|------|------|
| 1 | **Decision Model** — MissionDecisionBuilder 是组装层还是新决策中心？ | ❌ **不通过** | `MissionDecisionBuilder` 被设计为从 `IssueGraph` / `Issue` / `Mission` 组装的工具类，符合组装层定义。但 `MissionDecision` 接口包含了 `confidence`(0-100)、`score`(0-100)、`scoreImpact`(包含 expectedScore 计算) 等字段，这些本质上是**决策输出**而非组装结果。如果 builder 开始计算 expectedScore/delta，则变成二次决策中心。当前设计存在歧义：`MissionDecision.confidence` 不是 `Mission` 的字段——这是新增值，说明 builder 在做决策。 |
| 2 | **Explain Engine** — 是否保持插件式？ | ❌ **不通过** | ExplainEngine 核心 (`engine.ts`) 保持了纯粹的 Provider Registry 模式，没有问题。但 API 层在 `mission-engine/routes.ts` 中新增了 **专用路由** `GET /api/geo/missions/{id}/explain`，这是绕过 ExplainEngine 统一入口的做法。新增的 `MissionExplainProvider` 注册方式本身没问题，但路由设计破坏了统一 API 的架构。 |
| 3 | **UI** — GeoExplainDrawer 是否通用？ | ❌ **不通过** | 当前设计使用 `mode: 'generic' | 'mission'` 在单组件中分支渲染，看似通用。但实际拆分为 `GeoExplainDrawerMission.vue`、`GeoExplainDrawerDecisionChain.vue` 等多套子组件，每个 mode 一套组件树。违反了"不能每个 mode 一套组件"的约束。未来 `verification`/`knowledge`/`discovery` 每个 mode 都需要新增整套子组件。 |
| 4 | **API** — Explain API 是否统一？ | ❌ **不通过** | 当前 API 设计为 `GET /api/geo/missions/{id}/explain?brandId=xxx`，这是按资源拆分的 API（`/missions/{id}/explain`）。如果未来需要 `GET /api/geo/verification/{id}/explain` 或 `GET /api/geo/knowledge/{id}/explain`，则需要每个资源独立路由。违反"单一 explain endpoint + type 参数"原则。 |
| 5 | **Evidence** — 所有 Explain 是否必须引用真实 Evidence？ | ❌ **不通过** | 现有 `DiscoveryExplainProvider`（`discovery.provider.ts`）包含大量**硬编码 Reason 文本**，如 `{ label: '未提取到品牌实体', severity: 'high' }` 和 `{ label: 'ADI 评分低于 30，品牌可见度极低', severity: 'high' }`。这些文本不指向任何真实 `GeoEvidence` 实体，是硬编码的判断逻辑。`MissionDecision` 设计中的 `DecisionEvidence.sourceId` 虽然指向真实 ID，但整体设计未强制要求所有 explain 内容必须从 `GeoEvidence` 构建。 |

---

## 2. 详细审计过程

### 审计问题 1: Decision Model

**审计依据:**
- `mission-decision.ts` 设计文档中的 `MissionDecision` 接口（第18-56行）
- `MissionDecision.confidence`（0-100）— Mission 中不存在此字段，是新增决策值
- `MissionDecision.score`（0-100）— 虽然与 Mission.score 对齐，但在 MissionDecision 层面重新暴露意味着 builder 可能在重算
- `ScoreImpactBreakdown` 中的 `currentScore`, `expectedScore`, `delta` — 这些需要**计算逻辑**，builder 必须知道如何预判执行后的评分
- `missions/types.ts` 第17行 `Mission` 接口的 `score: number` 已有评分

**判断依据:**
- `MissionDecision` 的 `confidence` 不是 `Mission` 的属性，说明 builder 需要单独计算
- `ScoreImpactBreakdown.expectedScore` 不是现有数据，属于预测/决策输出
- 设计文档第7节"数据流图"中显示 `MissionDecisionBuilder.build()` 调用 `IssueGraphBuilder` + `MissionGenerator`，但 builder 内部逻辑未明确说明是否仅组装还是也计算
- **结论: 设计模糊。** 虽然口头上说"组装层"，但接口字段包含了需要重新计算的值（confidence, expectedScore）。如果 builder 真正实现时会计算这些值，则必然成为新的决策中心。

**判定: ❌ 不通过**（存在变成新决策中心的风险，接口本身包含了需要重新计算的字段）

### 审计问题 2: Explain Engine

**审计依据:**
- `engine.ts` 第11-18行: 纯粹的 `provider.getExplain(type, id)` 调用，符合插件模式
- `registry.ts` 第13-16行: 标准的 provider 注册模式
- `types.ts` 第22-26行: `ExplainProvider` 接口，规范明确
- 设计文档第5节 `routes.ts` 新增路由: 新增了 `GET /api/geo/missions/:id/explain` 专用路由，直接调用 `engine.explain('mission', mission.id)`
- 设计文档第5节 `registry.ts` 变更: `this.register('mission', new MissionExplainProvider())`

**判断依据:**
- ExplainEngine 核心逻辑（engine.ts）无需修改，provider 注册方式正确
- 但路由层绕过了统一入口：`mission-engine/routes.ts` 新增专用路由，而不是统一在 Explain 路由中添加
- `MissionExplainProvider` 返回的是 `MissionDecision` 而非 `ExplainResult`，[虽然设计文档第2节 API 响应是 MissionDecision 结构]，这意味着 provider 的输出与现有 ExplainResult 接口不兼容
- **结论: Engine 层保持插件式（✅），但 API 路由层破坏了统一性（❌）**。整体判定不通过。

**判定: ❌ 不通过**（API 路由层按资源拆分，provider 输出不兼容现有 ExplainResult）

### 审计问题 3: UI

**审计依据:**
- `FRONTEND-DESIGN.md` 第1.1节架构图: 按 mode 分支渲染 `GeoExplainCard` (generic) 或 `GeoExplainDrawerMission` (mission)
- `FRONTEND-DESIGN.md` 第1.2节: 模板中使用 `v-if="mode === 'generic'"` 和 `v-if="mode === 'mission'"` 分支
- 子组件设计: 每个 mode 有专属子组件集合（Mission.vue, DecisionChain, EvidenceList, Rules）
- 现有 `GeoExplainDrawer/index.vue`: 只传 `explain: ExplainResult | null`

**判断依据:**
- 当前设计为每个 mode 创建一组专属子组件。`mode === 'generic'` 走 `GeoExplainCard`，`mode === 'mission'` 走 `GeoExplainDrawerMission` + `GeoExplainDrawerDecisionChain` + `GeoExplainDrawerEvidenceList` + `GeoExplainDrawerRules`
- 未来 `verification` mode 需要新增 `GeoExplainDrawerVerification.vue` + 配套子组件
- 未来 `knowledge` mode 需要新增 `GeoExplainDrawerKnowledge.vue` + 配套子组件
- 未来 `discovery` mode 需要新增 `GeoExplainDrawerDiscovery.vue` + 配套子组件
- 违反"不能每个 mode 一套组件"的约束
- 虽然 `mode` prop 是单一入口，但组件树是按 mode 倍增的
- **结论: 看似通用（单组件 + mode），实则每个 mode 有独立组件树。**

**判定: ❌ 不通过**（按 mode 拆组件树，不能支持未来的 verification/knowledge/discovery）

### 审计问题 4: API

**审计依据:**
- `SPRINT-1-BACKEND-API-CONTRACT.md` paths: 只有 `/missions/{id}/explain` 一个 endpoint
- 设计文档第2节 API: `GET /api/geo/missions/{id}/explain?brandId={brandId}`
- 设计文档第5节: 路由注册在 `mission-engine/routes.ts` 中

**判断依据:**
- 当前只有一个 explain endpoint，但它是按资源路径定义的（`/missions/{id}/explain`）
- 如果新增 `verification` explain，按照相同模式会新增 `/verification/{id}/explain`
- 如果新增 `knowledge` explain，按照相同模式会新增 `/knowledge/{id}/explain`
- API 路径中的资源路径前缀（missions/）是多余的，因为 explain 本身就是跨资源的
- 应该使用 `GET /api/explain?type=mission&id=xxx` 统一入口
- **结论: 按资源拆分路径的设计理念，虽然当前只有 mission 一种。**

**判定: ❌ 不通过**（路径按资源拆分的模式，未来每新增一种 explain 就需要新增一条路由）

### 审计问题 5: Evidence

**审计依据:**
- `discovery.provider.ts` 第43-70行: 硬编码 reason 文本:
  ```
  reasons.push({ label: '未提取到品牌实体', severity: 'high' });
  reasons.push({ label: '缺少支撑证据 / Claims', severity: 'high' });
  reasons.push({ label: '尚未运行发现扫描', severity: 'high' });
  reasons.push({ label: '无引用来源', severity: 'medium' });
  reasons.push({ label: 'ADI 评分低于 30，品牌可见度极低', severity: 'high' });
  ```
- `evidence.ts` 中的 `GeoEvidence` 接口: 定义了标准的证据领域对象，有 `id`, `source`, `claim`, `supportLevel`, `confidence`, `citations` 等字段
- 设计文档的 `DecisionEvidence.sourceId` 虽然指向真实 ID，但设计未强制要求 evidence 必须从 `GeoEvidence` 构建

**判断依据:**
- `DiscoveryExplainProvider` 完全不引用 `GeoEvidence`，reason 文本是硬编码的业务逻辑
- 虽然代码中有 `claims`（来自 `geoClaimRepository`）作为数据源，但 reason 的判断条件（`adi < 30`, `adi < 60` 等）是硬编码的阈值规则，不指向具体的 `GeoEvidence` 实体
- `MissionDecision` 设计的 `DecisionEvidence.sourceId` 虽然指向真实数据源，但：
  1. 未要求必须使用 `GeoEvidence` 类型
  2. `reasoning` 字段（字符串）不受 evidence 约束
  3. `scoreImpact.factors` 的描述字段本质也是硬编码文本
- **结论: 现有实现大量使用硬编码 Reason，新设计虽有所改善但仍未强制证据驱动。**

**判定: ❌ 不通过**（现有代码存在大量硬编码 Reason，新设计未强制所有 Explain 内容从真实 Evidence 构建）

---

## 3. 发现的问题清单

| # | 问题 | 严重程度 | 涉及文件 |
|---|------|---------|---------|
| P1 | MissionDecisionBuilder 可能成为新决策中心 — confidence 和 expectedScore 需要重新计算 | **高** | `mission-decision.ts` (设计文档), `mission-decision-builder.ts` (规划中) |
| P2 | API 路由按资源拆分 (`/missions/{id}/explain`)，未来扩展时需新增大量路由 | **高** | `SPRINT-1-BACKEND-API-CONTRACT.md`, `mission-engine/routes.ts` (规划中) |
| P3 | UI 组件按 mode 拆分为独立组件树，无法支持未来 verification/knowledge/discovery 扩展 | **高** | `FRONTEND-DESIGN.md`, `GeoExplainDrawer/index.vue` |
| P4 | Provider 输出不统一 — MissionDecision 与 ExplainResult 接口不兼容 | **中** | `types.ts` (ExplainResult), `mission-decision.ts` (MissionDecision) |
| P5 | DiscoveryExplainProvider 大量使用硬编码 Reason 而非真实 Evidence | **中** | `discovery.provider.ts` |
| P6 | 缺少统一 ExplainDocument 规范 — 每种 explain 类型有自己独立的响应结构 | **高** | 所有 explain 相关设计文件 |

---

## 4. 设计优化建议

### 核心建议: 引入统一 `ExplainDocument` Schema

使用统一的 `ExplainDocument` 接口作为所有 Explain API 的唯一响应格式，解决 P4 和 P6 问题。

```
ExplainDocument 替换 Strategy:
- ExplainResult → ExplainDocument (mission 扩展字段融入顶层)
- MissionDecision → ExplainDocument (Mission 特有字段进入 metadata 扩展)
- DiscoveryExplainProvider 输出 → ExplainDocument
```

### API 统一

```
当前: GET /api/geo/missions/{id}/explain?brandId=xxx
改为: GET /api/explain?type=mission&id=xxx&brandId=xxx
     GET /api/explain?type=discovery&id=xxx
     GET /api/explain?type=verification&id=xxx
     GET /api/explain?type=knowledge&id=xxx
```

解决 P2 问题。

### UI 通用化

GeoExplainDrawer 改为只接收 `ExplainDocument`，按文档内容渲染子组件，不关心 type。子组件改为数据驱动的通用组件：
- `ExplainEvidenceList` — 渲染 `ExplainDocument.evidence[]`
- `ExplainReasoningTimeline` — 渲染 `ExplainDocument.reasoning[]`
- `ExplainImpactCard` — 渲染 `ExplainDocument.impact`
- `ExplainNextActions` — 渲染 `ExplainDocument.nextActions`

解决 P3 问题。

### 强制 Evidence 驱动

所有 ExplainProvider 的输出必须从真实 `GeoEvidence` 构建，禁止硬编码 Reason。`ExplainDocument.evidence[].source` 必须指向真实数据源 ID。

解决 P5 问题。

### MissionDecision 去决策化

将 `MissionDecision` 中的 `confidence`、`score`、`scoreImpact.expectedScore` 等需要计算的字段，改为静态组装：直接从 `Mission` 获取 `score`，删除 `confidence`（Mission 层面不需要单独置信度），将 `scoreImpact` 改为从 Mission 的 `impact[]` 数组映射。Builder 只组装不计算。

解决 P1 问题。

---

## 5. 结论总评

**审计总分: 0/5 ✅ 通过**

当前 v1.1 Sprint 1 设计在以下方面存在架构性问题：
1. decision-builder 的边界模糊
2. API 路由未统一
3. UI 组件按 mode 拆分
4. 缺少统一响应 Schema
5. Evidence 驱动未强制执行

**必须进行 Phase 2 Design Optimization 才能继续进入编码阶段。**

各文件的审计标记：`[REQUIRES_REVISION]`
- SPRINT-1-mission-explainability.md — 需要补充 ExplainDocument 统一 Schema
- SPRINT-1-BACKEND-API-CONTRACT.md — 需要重写为单一 endpoint
- SPRINT-1-FRONTEND-DESIGN.md — 需要更新为 ExplainDocument 渲染器
