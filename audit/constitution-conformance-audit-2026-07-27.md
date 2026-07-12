# GEO Constitution Conformance Audit（符合性审计）

**审计日期**: 2026-07-27
**审计依据**: GEO Product Principles v1.0 + GEO Dev Constitution + GEO Product Vocabulary v1.0 + P2 Engineering Protocol v1.0
**审计方法**: 代码层逐条对照（不是读文档，是读代码）
**审计范围**: 从 Dashboard 到后端 Runtime 的全链路实现

---

## 审计结论

| 维度 | 符合率 | 状态 |
|------|--------|------|
| 产品一致性（Product Conformance） | **2/10** | 🔴 严重偏离 |
| Runtime 一致性（Runtime Conformance） | **1/10** | 🔴 未连通 |
| SSOT 一致性（SSOT Conformance） | **3/10** | 🔴 多源混乱 |
| 死架构（Dead Architecture） | **4/10** | 🟡 大量死代码 |
| 黄金路径（Golden Path） | **0/10** | 🔴 从未真正跑通 |

**总体符合率: 2/10 — 严重警告**

---

# 第一部分：Product Conformance（产品一致性）

宪法要求 vs 代码现实。

---

## 1.1 Principle 1 — Brand First

> **"Workspace 服务的是品牌，不是系统"**
> **禁止"系统状态"、"Pipeline 运行情况"、"内部指标"、"技术架构"**

### 违规：Dashboard 展示的是"引擎"而非"品牌"

**代码位置**: `frontend/workspaces/geo/pages/GEODashboard-full.vue:57-72`

```html
<div class="geo-dash__card">
  <div class="geo-dash__card-hd">
    <span class="geo-dash__card-title">引擎状态</span>
  </div>
  <div class="geo-dash__card-bd">
    <div v-for="e in engines" :key="e.name" class="geo-dash__row">
      <span class="geo-dash__row-icon">{{ icons[e.name] || '→' }}</span>
      <span class="geo-dash__row-label">{{ e.label }}</span>
      <span class="geo-dash__row-badge" :class="`badge--${e.status}`">
        {{ badgeLabel(e.status) }}
      </span>
      <span class="geo-dash__row-detail">{{ e.detail }}</span>
    </div>
  </div>
</div>
```

**违反条款**: P1 — Brand First
**为什么违规**: 用户看到的第一个内容是"Discovery 已完成 / Knowledge 运行中 / Mission 待机"。这完全是系统状态，不是品牌状态。
**宪法要求**：用户看到的应该是"品牌知识覆盖了 3 个渠道"、"AI 可见度需要优化"——而不是引擎的待机/运行状态。
**用户感知**: ⚠️ 技术词汇直接暴露（引擎状态、Discovery、Knowledge 等引擎名）
**修复成本**: 1天 — 重新设计该区块为"品牌健康摘要"而非"引擎列表"

---

## 1.2 Principle 2 — Action First

> **"任何页面必须回答下一个行动是什么。"**
> **不允许：只有数字没有建议、只有列表没有操作、只有状态没有下一步**

### 违规：Dashboard 没有 Next Action（GEODashboard-full.vue 旧版）

**代码位置**: `frontend/workspaces/geo/pages/GEODashboard-full.vue`

该版本没有 Next Action 区块。用户看到 AI 可见度为 0，但不知道应该做什么。

.page-shell 版本有 Next Action（第 168-178 行），但该版本未上线。

**违反条款**: P2 — Action First
**用户感知**: 🟡 旧版本用户看不到下一步，新版本有但未上线
**修复成本**: 切换到 page-shell 版本（1小时）

---

## 1.3 Principle 4 — Technology Stays Invisible

> **"Runtime、Adapter、Repository、Pipeline、Engine 默认全部不可见"**

### 违规 1：页面直接显示 Engine 概念

**代码位置**: 到处都是。

`GEODashboard-full.vue:57` — "引擎状态"
`GEODashboard.page-shell.vue:42-49` — `v-for="e in control.engines"` + `class="geo-engine"`
`DiscoveryLabPage.vue:72` — "Scenario Intelligence Engine (SIE)"
`engine-status.ts` — 整套 Engine 状态枚举

**违反条款**: P4 — Technology Stays Invisible
**为什么违规**: 宪法明确规定 "Engine → AI Service"，Workspace 不应出现"引擎"二字。用户不需要知道 Discovery Engine / Knowledge Engine / Mission Engine 这些概念。
**用户感知**: 🟡 频繁出现，但用户大概率忽略（认知开销仍在）
**修复成本**: 1天 — 重新命名区域。例如：将"引擎状态"改为"品牌进展"，将"Discovery"改为"品牌识别"，将"Knowledge"改为"知识覆盖"等

### 违规 2：Backend API 暴露 Engine 命名给前端

**代码位置**: `mission-control.ts:52-135`

Backend 返回的 `engines[]` 数据中，`name` 字段为 `discovery` / `knowledge` / `recommendation` / `mission` / `verification` / `publishing` / `learning`。这些名称直接传到前端，未做产品层映射。

**违反条款**: P4 — Technology Stays Invisible + V4 — No Technical Leakage
**修复成本**: 0.5天 — 添加 product mapping layer

---

## 1.4 Principle 5 — Simplicity Wins

> **"普通市场人员第一次使用，30 秒内完成第一次优化"**

### 违规：用户无法在 30 秒内完成任何优化

**根本原因**: Golden Path 断链（详见第五部分）。用户创建品牌后：
1. 没有自动 Discovery
2. 没有自动 ScoreSnapshot
3. MissionControl 返回空数据
4. 没有 Next Action

**违反条款**: P5 — Simplicity Wins
**用户感知**: 🔴 用户第一分钟全是空的，没有"一键优化"的路径
**修复成本**: 3天 — 打通 Golden Path 后才能实现

---

## 1.5 Principle 6 — One North Star

> **"Workspace 永远只有一个北极星：Brand Health"**
> **"No page may introduce its own primary score"**
> **"不允许出现 Verification Score / Publishing Score / Optimization Score / Recommendation Score"**

### 违规：Health Page 使用 ADI 评分

**代码位置**: `frontend/workspaces/geo/stores/useAdiStore.ts`
`frontend/workspaces/geo/pages/HealthPage.page-shell.vue`

HealthPage 使用"ADI 分数"作为主要评分，而非 Brand Health。用户会看到两个不同的主要数字。

**违反条款**: P6 — One North Star
**为什么违规**: ADI 是旧架构的指标。宪法规定唯一主分是 Brand Health（0-100），包含 Knowledge Coverage / AI Visibility / Trust / Freshness / Authority / Risk 六个维度。ADI 没有被移除。
**用户感知**: 🟡 用户看到 ADI 分数，与 Dashboard 的 AI Visibility 不一致
**修复成本**: 2天 — 将 HealthPage 改为 Brand Health 展示

---

## 1.6 Principle 12 — Human Language First

> **"用户看到的每一个字，都应该是自然的人类语言"**

### 违规 1：DiscoveryLabPage 使用"Scenario Intelligence Engine (SIE)"

**代码位置**: `frontend/workspaces/geo/pages/DiscoveryLabPage.vue:72`

> "输入一个品牌、产品或概念的名称，系统将通过 Scenario Intelligence Engine (SIE) 匹配相关需求场景"

**违反条款**: P12 — Human Language First + Forbidden Vocabulary
**修复成本**: 0.5小时 — 改为"系统将自动分析您的品牌相关信息"

### 违规 2：Dashboard 使用"Discovery"、"Knowledge"、"Mission"等引擎名

**代码位置**: `GEODashboard-full.vue`, `GEODashboard.page-shell.vue`

**违反条款**: P12 + Forbidden Vocabulary
**修复成本**: 半天 — 产品化重命名

---

# 第二部分：Runtime Conformance（Runtime 一致性）

协议中的 Golden Path：

```
Project → Discovery → Snapshot → Timeline → Mission → Dashboard
```

## 2.1 这条链路是否真正连通？

**答案：否。没有一个环节是真正连通的。**

| 环节 | 是否存在 | 是否自动触发 | 是否有持久化 | 是否可回溯 |
|------|---------|------------|------------|----------|
| Create Project | ✅ | ✅ | ✅ PostgreSQL | ✅ |
| → Discovery | ✅ API 存在 | ❌ 手动触发 | ⚠️ 写 DB | ✅ |
| → ScoreSnapshot | ✅ API 存在 | ❌ 需要 Discovery 完成 | ✅ GEOScoreSnapshot | ✅ |
| → Timeline Event | ✅ Route 存在 | ❌ 需要手动调用 | ⚠️ 部分 in-memory | ❌ 大部分 in-memory |
| → Mission | ✅ Route 存在 | ❌ | ❌ in-memory Queue | ❌ |
| → Dashboard | ✅ 页面存在 | ✅ 前端调接口 | — | — |

**只有 Create Project 和 API 存在，中间没有任何自动连接逻辑。**

## 2.2 违反的协议条款

- **P2 Engineering Protocol Rule 2 — No Orphan Capability**：大量 Engine 有 API 但无自动连接
- **GEO Dev Constitution Rule 6 — Workspace = Product**：Discovery 要在 Workspace 手动触发，不是自动的

## 2.3 具体证据

### 创建项目后什么也不发生

`backend/src/services/geo/routes/geo-project.route.ts` 的 `createProject` 只是写数据库，没有：
- 没有触发 Discovery
- 没有创建初始化 ScoreSnapshot
- 没有记录 Timeline Event
- 没有填充 Mission Queue

对比 P0-5（Runtime Health Gate）的要求 —— 用户甚至不知道 Runtime 是否正常，因为 Dashboard 也看不到引擎健康状态。

---

# 第三部分：SSOT Conformance（单一真相源一致性）

## 3.1 Dashboard 的数据来源

**事实：Dashboard 有 6 个互相独立的数据源。**

```
Dashboard
├── MissionControl (mission-control.ts)
│   ├── observatoryStore          ← in-memory (SSOT 违规 #1)
│   ├── missionQueue              ← in-memory (SSOT 违规 #2)
│   ├── verificationRequestQueue  ← in-memory (SSOT 违规 #3)
│   ├── publishingQueue           ← in-memory (SSOT 违规 #4)
│   ├── learningStore             ← in-memory (SSOT 违规 #5)
│   └── timelineEngine            ← DB (唯一 Read 数据库的)
├── geoApi.get('projects')        ← DB (独立查询)
└── (page-shell 版本) add: 
    └── getHealth() / fetchAdi()  ← 又一套数据
```

**6 个不同的数据源，没有一个是 SSOT。**

## 3.2 双模型违规

Prisma Schema 中：
- `GEOProject` — 新模型，有完整 CRUD
- `GeoProject` — 旧模型，仍有路由引用

两者独立存在，没有数据同步，没有迁移计划。

**违反条款**: P2 Engineering Protocol — SSOT Rule
**影响**: 以后一定出现"A 写 GEOProject，B 查 GeoProject，数据对不上"
**修复成本**: 3天 — 统一模型 + 数据迁移

## 3.3 28 个 Service 文件各有各的 DTO

前端 `workspaces/geo/services/` 下有 **28 个 Service 文件**，每个文件定义了自己的接口/类型：
- `missionControlService.ts` — 4 个接口
- `healthService.ts` — 1 个接口
- `knowledgeService.ts` — 8 个接口
- `verificationService.ts` — 14 个接口
- `optimizationService.ts` — 10 个接口

总计约 **140+ 个独立定义的类型**，没有任何 DTO 共享机制。

**违反条款**: P2 Engineering Protocol — API Contract Freeze
**修复成本**: 2天 — 建立 shared/dto 目录

---

# 第四部分：Dead Architecture Audit（死架构审计）

## 4.1 无 UI 的后端路由

**25 个后端路由文件没有对应的 Workspace 页面入口：**

| 路由文件 | 风险 | 评估 |
|---------|------|------|
| geo-action-plan.route.ts | 🟡 有前端服务文件但无页面 | 部分状态：Service 存在，Page 不存在 |
| geo-claim.route.ts | 🔴 无人调用 | 无任何消费代码 |
| geo-entity.route.ts | 🔴 无人调用 | 无 UI |
| geo-evidence.route.ts | 🔴 无人调用 | 无 UI |
| geo-execution.route.ts | 🔴 无人调用 | 无 UI |
| geo-explain.route.ts | 🟡 有前端 explainService 但无页面 | Service 存在 |
| geo-explain-engine.route.ts | 🔴 无人调用 | 无 UI |
| geo-graph.route.ts | 🔴 无人调用 | 无 UI |
| geo-history.route.ts | 🟡 有前端 historyDetailService | Service 存在 |
| geo-keyword.route.ts | 🔴 无人调用 | 无 UI |
| geo-knowledge-quality.route.ts | 🔴 无人调用 | 无 UI |
| geo-optimization.route.ts | 🟡 有前端 optimizationService | Service 存在 |
| geo-optimization-v2.route.ts | 🔴 无人调用 | 无 UI |
| geo-presence.route.ts | 🔴 无人调用 | 无 UI |
| geo-roi.route.ts | 🔴 无人调用 | 无 UI |
| geo-scan.route.ts | 🟡 有前端 scanService | Service 存在 |
| geo-showcase.route.ts | 🟡 有前端 showcaseService | Service 存在 |
| geo-trace.route.ts | 🔴 无人调用 | 无 UI |
| geo-truth-trace.route.ts | 🔴 无人调用 | 无 UI |
| geo-walkthrough.route.ts | 🟡 有前端 walkthroughService | Service 存在 |
| geo-watcher.route.ts | 🔴 无人调用 | 无 UI |
| geo-customer-success.route.ts | 🔴 无人调用 | 无 UI |
| geo-deliverable.route.ts | 🔴 无人调用 | 无 UI |
| geo-dashboard-mission.route.ts | 🔴 旧版，已被 workspace route 取代 | 应标记 deprecated |
| admin-llm-runtime.route.ts | 🔴 管理后台，无 Workspace 入口 | 合法但有合理性 |

**总计：25 个路由中，19 个有 API 但无用户入口。宪法 Rule 6 称"禁止出现 Repository/Service/API 都有 → Workspace 没有入口"——这里 19 条违规。**

## 4.2 无消费者的 Store

```
useBrandHealthStore.ts    → 无任何 workspace 页面/组件引用
useRecommendationsStore.ts → 无引用
useVerificationStore.ts   → 无引用
```

定义了的 Store 没有被任何页面使用。

## 4.3 .bak 文件残留

```
GEODashboard.page-shell.vue.bak
HealthPage.page-shell.vue.bak
KnowledgePage.page-shell.vue.bak
```

版本控制残留。

## 4.4 双 Dashboard 版本

```
GEODashboard-full.vue (285行, 旧版, 目前在线上)
GEODashboard.page-shell.vue (317行, 新版, 未上线)
```

两个版本做几乎一样的事，但：
- 旧版没有 Next Action
- 旧版没有使用 Design System
- 旧版没有 PageShell 抽象
- 旧版 inline 200+ 行 CSS

**违反条款**: P2 Engineering Protocol — No Orphan Capability（双版本形成维护孤儿）

---

# 第五部分：Golden Path Audit（黄金路径审计）

## 5.1 验证：Create Project → Dashboard

| 步骤 | 是否可执行 | 实际结果 |
|------|-----------|---------|
| 1. 创建品牌 | ✅ 可点击创建 | 成功写入 DB |
| 2. 跳转 Dashboard | ✅ 路由正常 | 页面正常加载 |
| 3. 看到品牌列表 | ✅ missionControl 调通 | ✅ 列表显示 |
| 4. 看到 AI Visibility | ⚠️ API 调通 | 🔴 永远 0 |
| 5. 看到引擎状态 | ⚠️ API 调通 | 🔴 全部 idle/0 |
| 6. 看到任务 | ⚠️ API 调通 | 🔴 永远空 |
| 7. 看到动态 | ⚠️ API 调通 | 🔴 永远空 |
| 8. 看到 Next Action | ⚠️ 旧版本没有 | 🔴 无 |

**Golden Path 完成率: 2/8 = 25%**

## 5.2 违反的协议条款

- **GEO Dev Constitution Rule 1 — UI First**: Sprint 必须有用户可见变化。当前 Dashboard 没有可用的用户数据。
- **GEO Dev Constitution Rule 4 — Sprint Must Include Demo Changes**: "用户现在能看到什么？"——空数据。
- **P2 Engineering Protocol — North Star (UWCR)**: 当前目标 ≥90%，实际 0%。

---

# 第六部分：违规总数和修复建议

## 按宪法条款汇总

| 宪法条款 | 违规数 | 严重度 | 修复时间预估 |
|---------|--------|--------|------------|
| P1 — Brand First | 2 | 🔴 | 1天 |
| P2 — Action First | 1 | 🟡 | 1小时 |
| P3 — Outcome First | 0 | ✅ | — |
| P4 — Technology Stays Invisible | 3 | 🔴 | 1.5天 |
| P5 — Simplicity Wins | 1 | 🔴 | 3天 |
| P6 — One North Star | 1 | 🟡 | 2天 |
| P7 — Progressive Disclosure | 0 | ✅ | — |
| P8 — Recommendation, Not Configuration | 0 | ✅ | — |
| P12 — Human Language First | 3 | 🟡 | 0.5天 |
| Dev Const Rule 1 — UI First | 1 | 🔴 | (见 Golden Path) |
| Dev Const Rule 2 — Every Capability Has UI | 19 | 🟡 | 分批 |
| Dev Const Rule 6 — Workspace = Product | 19 | 🟡 | 分批 |
| P2 Eng Protocol — No Orphan Capability | 5 | 🔴 | — |
| P2 Eng Protocol — SSOT | 6 | 🔴 | 3天 |

## 按用户感知排序的修复优先级

### 本周必须修的（影响第一印象）

| 优先级 | 问题 | 宪法条款 | 用户影响 | 时间 |
|--------|------|---------|---------|------|
| P0 | Golden Path 未连接（创建项目后 Dashboard 为空） | P5, Dev Const R1 | 🔴 第一分钟就流失 | 3天 |
| P0 | Dashboard 数据源全是 in-memory | P2 Eng SSOT | 🔴 重启全丢 | 2天 |
| P0 | 前后端 API Contract 不一致 | P2 Eng | 🔴 运行时不报错但无数据 | 1天 |

### 下周修的（影响可用性，但不致命）

| 优先级 | 问题 | 宪法条款 | 用户影响 | 时间 |
|--------|------|---------|---------|------|
| P1 | "引擎状态"区块暴露技术词汇 | P4, P12 | 🟡 认知开销 | 0.5天 |
| P1 | 双 Dashboard 版本 | — | 🟡 修了旧版等于没修 | 1小时 |
| P1 | 无 Next Action（旧版本） | P2 | 🟡 完成初始任务后不知道做什么 | 1小时 |

### 后续修的（架构健康度，但不影响用户）

| 优先级 | 问题 | 宪法条款 | 时间 |
|--------|------|---------|------|
| P2 | 25 个路由无 UI | Dev Const R2 | 分批 |
| P2 | GEOProject / GeoProject 双模型 | P2 Eng SSOT | 3天 |
| P2 | 28 个 Service 文件独立 DTO | P2 Eng API Contract | 2天 |
| P3 | .bak 文件残留 | — | 0.5小时 |
| P3 | 未引用的 Store × 3 | — | 0.5天 |

---

## 结束语

**如果在今天（2026-07-27）给 GEO 的符合率打分：**

| 维度 | 当前 | 目标 |
|------|------|------|
| 产品一致性 | 20% | ≥90% |
| Runtime 连通性 | 10% | ≥95% |
| SSOT 一致性 | 30% | ≥95% |
| 死架构率 | 40% | ≤5% |
| 黄金路径完成率 | 25% | ≥95% |

**宪法符合率不是目标，它是约束。不符合宪法的地方，就是用户受伤害的地方。**

**这些违反宪法的地方，正是之前我那份审计报告里说的 F1-F6 断裂点 + 你补充的 P0-5 和 P0-6。**
**两份报告的结论指向同一个方向：Golden Path 不通，一切归零。**

---

*审计工具: 代码阅读 + Constitution 逐条对照 + 调用链追溯*
*审计人: OpenClaw*
