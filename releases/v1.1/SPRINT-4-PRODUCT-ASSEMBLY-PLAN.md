# Product Assembly Phase — Sprint 4 执行计划

> 版本: v1.2 Final | 基于 Capability Matrix 分析 + 熊大两轮评审反馈  
> 核心理念：按用户旅程 (User Journey) 排 Sprint，不做 Feature Development，做 Product Assembly

---

## 路线图更新

从本次 Sprint 开始，GEO 版本阶段正式冻结：

```
Phase A  Engine Development       （已完成）
Phase B  Workspace Foundation     （已完成）
Phase C  Product Assembly          ← Sprint 4
Phase D  First Value Release       ← VR-1 through VR-5
Phase E  Commercial Readiness
```

后续所有版本发布按 **Value Release** 命名：

```
VR-1  First Recommendation（Sprint 4-1）
VR-2  First Verification  （Sprint 4-2）
VR-3  First Publish       （Sprint 4-3）
VR-4  First Growth Loop   （Sprint 4-4）
VR-5  Knowledge Workspace （Sprint 4-5）
```

---

## 阶段转换声明

从这一刻起，GEO 开发进入 **Product Assembly Phase（产品装配阶段）**。

不再以 Engine/Component 为单位开发，而是以 **用户旅程** 为单位，将已有后端能力装配成用户可感知的完整产品闭环。

**团队讨论产品进展不再用"功能完成率"，而是用"用户是否真正获得价值"。**

---

## GEO 产品定义

> **GEO 不是帮助企业生成更多内容，而是帮助企业持续建立、验证和运营 AI 对其品牌与知识的正确认知。**

三个核心动词对应 Product Assembly Phase：
- **建立（Build）** → Sprint 4-1 / 4-2
- **验证（Verify）** → Sprint 4-3
- **运营（Operate）** → Sprint 4-4 / 4-5

---

## 三个永远有效的原则

### 原则一：Artifact Chain（资产链）

每个 Journey 必须留下一个可沉淀、可追溯、可复用的产品资产：

```
Discover         → Recommendation（优化建议）
Recommendation   → Mission（执行任务）
Mission          → Verification Record（验证记录）
Verification     → Publish Manifest（发布清单）
Publishing       → Observation Record（观察记录）
Observation      → Knowledge Update（知识更新）
Knowledge        → Discovery（下一次发现的起点）
```

整个 Workspace 不是"页面集合"，而是 **资产流（Asset Stream）**。用户每完成一步，都沉淀了一份不可逆的资产。

### 原则二：Unified Explain Experience（统一解释体验）

所有 Workspace 页面固定保留统一入口：

```
Why am I seeing this?
```

或按上下文适配：

```
Why this recommendation?
Why this score?
Why this change?
```

点击后统一展开：Explain → Evidence → Timeline → Confidence → Origin。

**整个产品只有一个 Explain Experience**，不允许多个页面各自设计解释方式。

### 原则三：No Empty Victory

任何页面不允许因为"API 回来了，页面有数据了"就算完成。必须满足四层：

```
数据 (Data)
  ↓ Insight
  ↓ Action
  ↓ Next Step
```

例如 Verification 页面不能只显示 "Score: 82" 就结束，必须回答：
- 为什么是 82？(Explain)
- Evidence 是什么？(Evidence)
- 建议做什么？(Recommendation)
- 下一步重新验证？(CTA)

---

## 北极星指标

### Journey KPIs（每个 Sprint 的局部指标）

| Sprint | KPI |
|---|---|
| 4-1 | Mission 创建率 |
| 4-2 | Verification 完成率 |
| 4-3 | Publish 成功率 |
| 4-4 | 二次优化率（Second Optimization Rate） |
| 4-5 | 知识审核完成率（Knowledge Review Completion） |

### North Star Metric（全局唯一指标）

**Successful AI Optimization Cycles per Organization per Month**

定义：一个客户在一个月内真正完成的完整闭环次数：

```
Discover → Recommend → Mission → Verify → Publish
```

为什么是这个指标？
- 如果它越来越高 → 产品有价值、用户回来了、AI 在持续变化
- 如果它停滞 → 产品装配链有断点
- 每个 Journey KPI 的改善应该最终驱动 North Star 上升

---

## Sprint 4 安排

### Sprint 4-1: Discover → Recommend（VR-1: First Recommendation）

**价值瞬间（Moment of Value）：**
> 用户点击 → AI 自动生成 Recommendation → 点击 Create Mission → Mission 已创建  
> → 用户第一次相信："GEO 知道我应该做什么。"

**KPI：第一次进入 GEO 的用户，在 3 分钟内完成第一次 Recommendation → Mission**

| 维度 | 内容 |
|---|---|
| **参与页面** | Discovery Lab、BrandOverview（推荐区）、Mission Center |
| **后端能力已就绪** | Discovery Engine (85%), Recommendation Engine (90%), Explain Engine (100%), Mission Engine (80%) |
| **当前装配完成度** | ~30% |
| **装配任务** | |
| | 1. Discovery 结果 → 自动生成 Mission（打通发现→执行链） |
| | 2. Recommendation 页面: 接入真实 Intelligence API (score + tasks + roadmap + timeline + summary) |
| | 3. Recommendation 的"创建 Mission"按钮激活 |
| | 4. BrandOverview 优化按钮解除 disabled ("即将开放" → 可用) |
| | 5. Roadmap + Timeline 数据装配到 Recommendation 页面 |
| | 6. 路由清理: 删除旧 Placeholder 文件, 统一到新页面 |
| **Artifact 产出** | Recommendation（沉淀为优化资产） |
| **Product Gate** | 让第一次使用的人看完 Recommendation → 知道下一步是创建 Mission |
| **Evidence of Value** | Mission 创建率 |
| **Target 装配完成度** | ~85% |

---

### Sprint 4-2: Execute → Verify（VR-2: First Verification）

**价值瞬间（Moment of Value）：**
> Mission 完成 → 触发 Verification → Before / After 对比  
> → 用户第一次相信："我的优化真的产生影响。"

**KPI：用户能独立完成一次完整的 Verification 闭环**

| 维度 | 内容 |
|---|---|
| **参与页面** | Mission Center、Verification、Timeline |
| **后端能力已就绪** | Mission Execution Engine (80%), Verification Engine (85%), Explain Engine (100%), Timeline Service (90%) |
| **当前装配完成度** | ~20% |
| **装配任务** | |
| | 1. Execution 状态持久化（从前端 in-memory → 后端持久化，用户可回溯） |
| | 2. Mission 完成 → 自动触发 Verification（打通执行→验证链） |
| | 3. Verification 页面: 当前品牌自动关联（不需要手动输入 entity name） |
| | 4. Before/After 对比增加可视化趋势（基础 delta → 趋势图） |
| | 5. 验证结果回流 Dashboard（Dashboard 展示最新验证状态） |
| | 6. Verification Page 的 Timeline 功能集成 |
| **Artifact 产出** | Verification Record（带 Before/After 对比的可追踪验证记录） |
| **Product Gate** | 用户执行完 Mission → 能看到验证结果 → 知道下一步怎么迭代 |
| **Evidence of Value** | Verification 完成率 |
| **Target 装配完成度** | ~80% |

---

### Sprint 4-3: Publish → Observe（VR-3: First Publish）

**价值瞬间（Moment of Value）：**
> 验证通过 → 一键发布 → 状态从 pending → live  
> → 用户第一次相信："GEO 不只是分析，它真的帮我运营。"

**KPI：用户完成第一次 Publish，并能看到发布后的状态变化**

| 维度 | 内容 |
|---|---|
| **参与页面** | Verification、Publishing、Dashboard |
| **后端能力已就绪** | Verification Engine (85%), Manifest System (90%), Publishing Admin UI (完整) |
| **当前装配完成度** | ~15% |
| **装配任务** | |
| | 1. 验证通过 → 自动创建 Publish Manifest（打通验证→发布链） |
| | 2. Manifest → 真实发布渠道（RSS / Sitemap / API Feed adapter） |
| | 3. Publishing 页面: 接入 Manifest 真实状态（不仅是 UI 管理） |
| | 4. 发布后: Dashboard 显示发布状态变化 |
| | 5. Publishing Queue + 发布历史完善 |
| **Artifact 产出** | Observation Record（发布效果观察记录） |
| **Product Gate** | 用户做完验证 → 知道可以发布 → 发布后能看到结果 |
| **Evidence of Value** | Publish 成功率 |
| **Target 装配完成度** | ~75% |

---

### Sprint 4-4: Discovery → Learn（VR-4: First Growth Loop）

**价值瞬间（Moment of Value）：**
> 完成一轮优化 → 进入 Learning 看到信号 → 发现新机会  
> → 用户第一次相信："GEO 会越来越聪明。"

**KPI：用户能发现新的 AI 可见性机会，并立即进入下一轮优化**

| 维度 | 内容 |
|---|---|
| **参与页面** | Discovery Lab、Learning、Growth |
| **后端能力已就绪** | Discovery Engine (85%), Learning Engine (90%), Growth Service (80%) |
| **当前装配完成度** | ~10% |
| **装配任务** | |
| | 1. Learning 前端装配: 接入完整 Learning API (candidates/review/promote/dashboard) |
| | 2. Learning Review Modal (审核 UI) + Promotion History (晋升历史) |
| | 3. Growth 趋势图: 从静态数据 → 真实 API 数据 |
| | 4. GrowthService API 暴露 (forecast/optimization/monitor) |
| | 5. Discovery → Landing → 产品级呈现（不是实验室感） |
| **Artifact 产出** | Knowledge Update（学习结果反哺知识库） |
| **Product Gate** | 用户完成一轮优化 → 能看到效果 → 知道下一轮从哪开始 |
| **Evidence of Value** | 二次优化率（Second Optimization Rate） |
| **Target 装配完成度** | ~80% |

---

### Sprint 4-5: Knowledge Workspace（VR-5: Knowledge Workspace）

**价值瞬间（Moment of Value）：**
> 查看 Knowledge → Evidence → Truth → 理解 AI 判断依据  
> → 用户第一次相信："AI 为什么这么说，我终于知道了。"

**KPI：用户能找到、编辑并管理 AI 依据的知识资产**

| 维度 | 内容 |
|---|---|
| **参与页面** | Knowledge、Knowledge Quality |
| **后端能力已就绪** | Knowledge CRUD (90%), Knowledge Quality Pipeline (85%), Evidence/Claim Services (90%) |
| **当前装配完成度** | ~25% |
| **装配任务** | |
| | 1. 知识页面: 接入完整 Knowledge API（列表 + 详情 + 编辑） |
| | 2. 知识质量 Pipeline 结果在 UI 中展示和触发 |
| | 3. 实体→声明→证据→引用 知识链树状可视化 |
| | 4. 知识搜索 + 筛选功能 |
| | 5. Review Queue 接入（知识审核工作流） |
| **Artifact 产出** | 可完整追溯的 Knowledge Base（实体→声明→证据→引用链） |
| **Product Gate** | 用户能找到"AI 判断的依据是什么" → 能审查和编辑知识 |
| **Evidence of Value** | 知识审核完成率（Knowledge Review Completion） |
| **Target 装配完成度** | ~85% |

---

## 每个 Sprint 的默认验收条件（DoD）

所有 5 个 Sprint 共享：

### 1. Product Gate

> **第一次使用 GEO 的人，在完成当前页面流程后，是否知道下一步做什么？**

- 页面没有不可解释的 Loading 状态
- 空状态仅在真正无数据时出现，且有"如何开始"引导
- 每个操作都有明确的结果反馈
- 每一步都知道下一步去哪里

### 2. Artifact Check

> **本 Sprint 是否新增了一个可持续沉淀的产品资产，而不仅仅是完成一个页面？**

资产必须是：
- 可追踪的（有 ID / 历史记录）
- 可复用的（其他页面能引用）
- 不随 Session 消失的（持久化到后端）

### 3. Explain Check

> **用户在任何关键决策点，都能回答"为什么会看到这个建议？"**

统一通过 Unified Explain Experience 入口实现，不允许每个页面自建 Explain 机制。

---

## Product Assembly Board

| 旅程 | 后端能力 | 当前装配 | 目标装配 | 用户价值可见 | Evidence of Value | 产出资产 | RC 状态 |
|---|---|---|---|---|---|---|---|
| **1. 发现→建议** (S4-1) | 90% | 30% | 85% | ❌ | Mission 创建率 | Recommendation | Assembly |
| **2. 执行→验证** (S4-2) | 85% | 20% | 80% | ❌ | Verification 完成率 | Verification Record | Assembly |
| **3. 发布→观察** (S4-3) | 80% | 15% | 75% | ❌ | Publish 成功率 | Observation Record | Assembly |
| **4. 增长循环** (S4-4) | 85% | 10% | 80% | ❌ | 二次优化率 | Knowledge Update | Assembly |
| **5. 知识运营** (S4-5) | 90% | 25% | 85% | ❌ | 知识审核完成率 | Knowledge Base | Assembly |

**北极星指标：每月有效 AI 优化闭环数 / 组织（Successful AI Optimization Cycles per Org per Month）**

---

## 装配完成后 → First Value Release Audit

Sprint 4 全部完成后做一次完整的 **First Value Release 审计**：

审计对象不再是"组件漂不漂亮"，而是：
1. 进入 Workspace 的第一分钟，知道做什么吗？
2. Artifact Chain 是否形成闭环？
3. 每个 Moment of Value 是否真实可感？
4. Unified Explain Experience 是否贯穿全程？
5. North Star Metric 是否可测量且有基线数据？
6. 是否存在"功能都有，但不知道下一步去哪"的地方？

审计完成后 → **First Value Release (VR)**。

---

## 工程底线

**Sprint 4 期间不再新增任何基础 Engine。** 所有工作围绕装配已有能力展开。

如发现后端能力缺口，先确认：
- 是否可以通过已有 API 组合解决？
- 是否必须新增 Engine？（若必须，标记为 Phase E 工作）

---

## 冻结记录

**版本**: v1.2 Final  
**冻结日期**: 2026-07-05  
**审批人**: 熊大  
**状态**: ✅ 正式冻结  
**下一阶段**: Sprint 4-1 — Discover → Recommend

### Sprint 4-1 执行边界

1. **不新增基础 Engine** — 仅复用和装配已有能力
2. **不新增领域模型** — 优先使用 TaskCardModel / Explain 等统一契约
3. **不为单页面做特例** — 特殊逻辑应提升为全 Workspace 可复用能力
4. **Sprint 结束必须完成真实 Dogfood**

### Sprint 4-1 DoD

1. **Journey Complete** — 首次用户 3 分钟内完成 Recommendation → Mission
2. **Moment of Value Achieved** — 用户明确感受到"GEO 知道我下一步该做什么"
3. **Artifact Created** — Mission 成功创建并可持续存在
4. **Explain Available** — 关键建议都能解释"为什么"
5. **Next Step Clear** — 完成后系统自然引导进入 Execute → Verify
6. **Dogfood Passed** — 至少一次真实端到端体验，无需开发介入

### Sprint 结束产品验收报告内容

- **Journey Replay** — 用户从 Discover 到 Mission 的完整操作路径
- **Moment of Value Review** — 价值瞬间是否真实发生
- **Artifact Verification** — 产品资产是否真正沉淀
- **North Star Impact** — 对"每月有效优化闭环数"的贡献
- **下一 Sprint 阻塞项** — 仅列真正影响用户旅程的阻塞

---

## 冻结记录

**版本**: v1.2 Final  
**冻结日期**: 2026-07-05  
**审批人**: 熊大  
**状态**: ✅ 正式冻结  
**下一阶段**: Sprint 4-1 — Discover → Recommend
