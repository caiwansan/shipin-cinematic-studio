# KM-AI-JOB-WORKSPACE-02: Enterprise Recruitment Workspace Product Reality Audit v2.0

**日期**: 2026-07-23  
**审计范围**: 企业招聘工作台全栈  
**审计原则**: 禁止新增代码，只审计、验证、打分、输出 Gap Analysis

---

## 一、产品成熟度总览

### 1.1 产品能力完成度

```
企业创建 ██████████ 100%
AI员工管理 ██████░░░░ 60%
招聘Pipeline ████████░░ 80%
Offer █████░░░░░ 50%
人才库 ██████░░░░ 60%
统计分析 █████░░░░░ 50%
AI Runtime ██░░░░░░░░ 20%
Billing ░░░░░░░░░░ 0%
```

**整体完成度: 约 55%**（按企业真实可用程度加权计算，非按功能数量）

### 1.2 产品成熟度雷达图

```
              企业创建
                A
                │
    AI员工管理  │  Pipeline
       B+      │     B
                │
   ────────────┼────────────
                │
    Offer       │  统计分析
       C+      │     C
                │
   人才库      │  AI Runtime
       B-      │     D
                │
              Billing
                F
```

---

## 二、逐页面 Reality Audit

### 2.1 `/workspace/enterprise/onboarding` — Onboarding

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 页面目的 | ✅ | 引导企业完成招聘空间初始化 |
| 用户是谁 | ✅ | 新企业 CEO/HR |
| 是否有真实数据 | ⚠️ | Step 3 Agent 预览是**前端硬编码**，非 API 返回 |
| 是否存在 Mock | ✅ | Agent Workforce 预览本地写死，API 创建在 Step 3 调用 |
| Dead Button | ❌ | 所有按钮均有功能 |
| Dead Link | ❌ | 无 |
| TODO | ❌ | 未发现 |
| Placeholder | ⚠️ | `enterpriseId` 有 fallback 硬编码 UUID |

**关键发现**: `getEnterpriseId()` 有硬编码 fallback `5ba4891a-511f-4620-8862-7dc83f37ea75`，当 localStorage 无值时默认使用。这是一个**隐藏的单租户依赖**。

---

### 2.2 `/workspace/enterprise` — CEO Dashboard + Pipeline

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 页面目的 | ✅ | AI 招聘 Dashboard + Pipeline Kanban |
| Dashboard 数据 | ⚠️ | **全量依赖 API**，但 `cost.totalMonthlyCost` 可能为 0 |
| Pipeline Kanban | ✅ | 真实数据，可拖拽 |
| Timeline Modal | ✅ | 加载真实事件 |
| AI Actions | ⚠️ | 调用真实 API，但**评分逻辑是规则匹配，非 AI** |

**关键发现**:
- `aiRescore`: 后端用 `Math.random()` + 技能数量计算，**不是真正 AI 评分**
- `aiInterview`: 调用 `InterviewAgent.generateInterviewPlan()`，**是真实模板匹配**
- `aiInvite`: 只更新 DB 阶段，**不发送真实邮件/消息**
- `aiOffer`: 用分数区间映射薪资，**非真实 Offer 生成**

---

### 2.3 `/workspace/job` — 求职者工作台

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 页面目的 | ✅ | 求职者找工作入口 |
| JobWorkspaceLayout | ⚠️ | 组件存在但功能有限 |
| 登录检测 | ✅ | 解析 JWT token |
| 导航 | ✅ | 跳转正常 |

---

## 三、功能完整度

### 3.1 CEO Dashboard

| 功能 | 状态 | 说明 |
|------|------|------|
| 企业概览 | ✅ | 名称 + 套餐标签 |
| AI员工 | ✅ | 从 API 加载 |
| 招聘漏斗 | ⚠️ | 有数据字段但**全为 0（无真实数据）** |
| 成本 | ⚠️ | 显示 `¥0.00`（无计费逻辑） |
| 最近活动 | ❌ | Dashboard 组件中**未渲染 recentResumes** |
| 快捷入口 | ⚠️ | 仅 Dashboard/Pipeline Tab 切换 |

**缺失**: 无筛选器、无时间范围、无导出

### 3.2 Pipeline

| 功能 | 状态 | 说明 |
|------|------|------|
| Kanban Board | ✅ | 5 列 + 拖拽 |
| Candidate Timeline | ✅ | 事件链 |
| Notes | ❌ | 无备注功能 |
| Attachments | ❌ | 无附件上传 |
| AI 评分 | ⚠️ | 规则匹配 + Random，非 AI |
| AI 面试题 | ⚠️ | 模板匹配，非 LLM 生成 |
| AI 邀约 | ⚠️ | 仅更新 DB，不发送真实通知 |
| AI Offer | ⚠️ | 文本模板，非真实 Offer |

### 3.3 Talent

| 功能 | 状态 | 说明 |
|------|------|------|
| 人才搜索 | ⚠️ | API 存在但搜索范围受限 |
| 人才推荐 | ⚠️ | 基于规则，非 AI 匹配 |
| 人才档案 | ⚠️ | 有 Profile 页面，数据依赖外部 |
| 关系维护 | ⚠️ | API 存在但前端**未在 Dashboard 渲染** |
| 任务 | ❌ | API 存在但前端**未使用** |

### 3.4 JD（Job Posting）

| 功能 | 状态 | 说明 |
|------|------|------|
| JD 列表 | ✅ | 从 API 加载 |
| JD 创建 | ⚠️ | 有 API 但**前端无创建 UI** |
| AI 生成 JD | ❌ | 无 |
| JD 编辑 | ❌ | 无前端 UI |
| JD 暂停/关闭 | ❌ | 无 |

### 3.5 Resume

| 功能 | 状态 | 说明 |
|------|------|------|
| 简历上传 | ❌ | 前端无上传入口 |
| 简历解析 | ⚠️ | `ResumeParserAgent` 存在但**未集成到 Pipeline** |
| 简历评分 | ⚠️ | Pipeline 中有评分但基于规则 |
| 简历详情 | ⚠️ | `ResumeProfile` 模型存在但前端无详情页 |

### 3.6 Interview

| 功能 | 状态 | 说明 |
|------|------|------|
| 面试方案生成 | ⚠️ | `InterviewAgent` 模板匹配 |
| 面试记录 | ✅ | DB 模型 + API |
| 面试评价 | ⚠️ | API 存在但**无真实 AI 评估** |
| AI 面试官 | ❌ | 无 LLM 驱动的面试 |
| 面试安排 | ⚠️ | 有 `InterviewSession` 模型 |
| 面试录音/转写 | ❌ | 无 |

### 3.7 AI Runtime Center

| 功能 | 状态 | 说明 |
|------|------|------|
| AI 员工状态 | ⚠️ | 仅 active/trial/disabled |
| BYOK | ❌ | 无 |
| 预算控制 | ❌ | 有 `dailyTokenBudget` 字段但无执行 |
| Runtime 监控 | ❌ | 无实时运行状态 |
| 成本中心 | ❌ | 有字段但无真实计费 |

### 3.8 Billing

| 功能 | 状态 | 说明 |
|------|------|------|
| 套餐展示 | ✅ | Onboarding Step 4 有套餐卡片 |
| 支付集成 | ❌ | 无真实支付 |
| 订阅管理 | ❌ | 无真实订阅周期 |
| 用量计费 | ❌ | 无 |
| 升级/降级 | ❌ | 仅 Onboarding 一次性选择 |
| 发票 | ❌ | 无 |

---

## 四、数据真实性审计

### 4.1 Dashboard 漏斗数据

```
UI 层: dashboardData.recruitment.funnel.total
  ↓
API: /api/enterprise/dashboard
  ↓
SQL: SELECT COUNT(*) FROM recruitment_pipeline WHERE workspace_id = ?
  ↓
Table: recruitment_pipeline
```

**判定**: ✅ 真实查询，但**无数据时全为 0**（正常）

### 4.2 Dashboard 成本

```
UI: dashboardData.cost.totalMonthlyCost.toFixed(2)
  ↓
API: /api/enterprise/dashboard
  ↓
计算: 固定返回 0（无真实计费逻辑）
```

**判定**: ❌ **Fake Data** — 成本始终显示 ¥0.00

### 4.3 AI 评分

```
UI: aiRescore(card) → POST /api/pipeline/{id}/ai-rescore
  ↓
SQL: UPDATE screening_score = 50 + skills*5 + exp/10 + random(-7,7)
```

**判定**: ⚠️ **规则 + 随机**，非 AI。无 LLM 调用。

### 4.4 AI 面试题

```
POST /api/pipeline/{id}/ai-interview
  ↓
InterviewAgent.generateInterviewPlan(job, resume)
  ↓
模板匹配: 技术问题模板 + 行为问题模板
```

**判定**: ⚠️ **模板匹配**，非 LLM 生成。有简历时定制化程度很低。

### 4.5 招聘需求

```
Step 2 → POST /api/enterprise/onboarding/step2
  ↓
INSERT/UPDATE enterprise_recruitment_needs
```

**判定**: ✅ 真实写入 DB

---

## 五、Agent 审计

### 5.1 AI 招聘经理 (career_advisor)

| 项 | 状态 |
|------|------|
| 存在 Agent 类 | ❌ | 
| 调用 Runtime | ❌ |
| 实际运行 | ❌ |
| 仅接口定义 | ✅ | 仅 DB 模型 + displayName |

**结论**: 🚫 **仅存在于 DB 和 Onboarding UI，无任何后端逻辑**

### 5.2 AI 简历分析师 (resume_analyzer)

| 项 | 状态 |
|------|------|
| 存在 Agent 类 | ✅ | `ResumeParserAgent` |
| 调用 Runtime | ❌ |
| 实际运行 | ❌ |
| 仅模板匹配 | ✅ | |

**结论**: 🚫 **Agent 类存在但未集成**。Pipeline 评分走的是规则，不是 ResumeParserAgent。

### 5.3 AI 面试官 (interview_agent)

| 项 | 状态 |
|------|------|
| 存在 Agent 类 | ✅ | `InterviewAgent` |
| 调用 Runtime | ❌ |
| 实际运行 | ⚠️ | 被 Pipeline API 调用 |
| 模板匹配 | ✅ | |

**结论**: ⚠️ **仅模板匹配**，无 LLM 调用。生成面试题基于关键词匹配。

### 5.4 AI 猎聘顾问 (talent_hunter)

| 项 | 状态 |
|------|------|
| 存在 Agent 类 | ✅ | `TalentSearchAgent` |
| 调用 Runtime | ❌ |
| 实际运行 | ❌ |
| 仅接口定义 | ✅ | |

**结论**: 🚫 **仅存在于 DB 和 Talent 路由，无真实搜索能力**

---

## 六、企业真实使用流程

```
注册 ✅
↓
创建企业 ✅ (Onboarding Step 1)
↓
购买套餐 ⚠️ (Onboarding Step 4 仅选择，无真实支付)
↓
AI部门 ✅ (创建 DB 记录，员工 status=active)
↓
招聘 ⚠️ (有 Pipeline 但无真实简历来源)
↓
Offer ⚠️ (生成文本模板，无审批流)
↓
入职 ❌ (无入职流程)
↓
查看成本 ❌ (始终 ¥0.00)
↓
月底报告 ❌ (无报告生成)
```

**断裂点**: 购买套餐后无真实支付验证，招聘无真实候选人来源，成本始终为零。

---

## 七、商业化审计

| 项 | 状态 | 说明 |
|------|------|------|
| 企业购买 AI 员工 | ⚠️ | 仅选择套餐，无支付 |
| 升级套餐 | ❌ | 无升级入口 |
| 超额计费 | ❌ | 无用量追踪 |
| BYOK | ❌ | 无 |
| Billing 页面 | ❌ | 无 |
| 订阅周期 | ❌ | 无 |

**判定**: ❌ **当前不是真正 SaaS**，只是"选择套餐"的一次性行为。

---

## 八、产品评分

| 模块 | 评分 | 说明 |
|------|------|------|
| Onboarding | **A** | 5 步流程完整，前后端打通，数据持久化 |
| Dashboard | **C+** | 有骨架，但无真实数据、成本为 0、无快捷操作 |
| Pipeline | **B-** | Kanban + 拖拽 + Timeline 完整，AI 动作为规则匹配 |
| Talent | **C** | API 齐全但前端未充分使用，无真实搜索 |
| Resume | **D+** | 有 DB 模型，无上传入口，无前端详情页 |
| Interview | **C-** | API 齐全但无 AI 评估，面试官仅模板 |
| Runtime | **D** | 有 DB 字段，无执行 |
| Billing | **F** | 无真实计费 |

---

## 九、Top 20 Gap（按优先级排序）

### P0 — 阻塞 GA

| # | Gap | 影响 |
|---|-----|------|
| G1 | **成本中心始终为 0** | 企业无法信任数据 |
| G2 | **AI 评分用 Random + 规则** | 非真正 AI，失去产品核心价值 |
| G3 | **无真实简历来源** | Pipeline 无候选人流入 |
| G4 | **无支付集成** | 不是真正 SaaS |
| G5 | **AI 员工全部未连接 Runtime** | "AI 招聘"名不副实 |
| G6 | **Onboarding 有硬编码 enterpriseId fallback** | 多租户风险 |
| G7 | **aiInvite 不发送真实通知** | 邀约断裂 |
| G8 | **aiOffer 无审批流** | Offer 无法真正发出 |

### P1 — 高优先级

| # | Gap | 影响 |
|---|-----|------|
| G9 | **无 JD 创建/编辑 UI** | 无法管理岗位 |
| G10 | **无简历上传入口** | Pipeline 无法添加候选人 |
| G11 | **Dashboard 无筛选/时间范围** | 无法分析趋势 |
| G12 | **无入职流程** | Pipeline 终点断裂 |
| G13 | **套餐选择后无验证** | 任何企业都能"选择" Enterprise |
| G14 | **无用量追踪** | 无法计费 |
| G15 | **InterviewAgent 无 LLM 调用** | 面试题质量低 |

### P2 — 中优先级

| # | Gap | 影响 |
|---|-----|------|
| G16 | **无人才库真实搜索** | Talent 模块空洞 |
| G17 | **无面试录音/转写** | 无法回溯 |
| G18 | **无月底报告** | 无法向老板汇报 |
| G19 | **无自定义 AI 员工** | Enterprise 套餐承诺未兑现 |
| G20 | **无移动端适配** | 招聘场景移动需求高 |

---

## 十、Roadmap 建议

```
当前状态: Beta 0.2.0 RC
│
▼
Beta 0.2.1 (Stabilization)
│  - G1: 成本中心接入真实 Token 计费
│  - G6: 移除硬编码 enterpriseId
│  - G7: 接入真实通知（邮件/站内信）
│  - G13: 套餐选择后付费验证
│
▼
Beta 0.3 (AI Integration)
│  - G2: 接入真实 LLM 评分
│  - G5: AI 员工连接 Runtime
│  - G15: InterviewAgent LLM 化
│
▼
Beta 0.4 (Resume Flow)
│  - G3: 简历上传 + 解析
│  - G9: JD 管理 UI
│  - G10: 候选人添加 UI
│
▼
GA 1.0
│  - G4: 支付集成
│  - G14: 用量计费
│  - G18: 月度报告
│
▼
GA 1.1+
│  - G19: 自定义 AI 员工
│  - G20: 移动端
```

---

## 十一、最终回答

### Q1: 现在到底完成了多少？

**约 55%**（按企业真实可用程度）

- **骨架**: 90%（页面、路由、DB、API 齐全）
- **功能**: 55%（能跑通流程，但关键能力是规则/模板）
- **数据**: 10%（几乎无真实数据）
- **商业化**: 5%（仅选择，无支付）
- **AI 能力**: 10%（全部是规则匹配，无 LLM 调用）

### Q2: 企业老板今天能不能真正用它招聘？

**不能。**

原因:
1. 没有候选人来源（无简历上传、无搜索）
2. AI 评分不可信（Random + 规则）
3. 邀约发不出去（无通知集成）
4. 成本不可信（始终为 0）
5. 无入职流程

**能用的部分**: 企业创建、Onboarding 流程、Pipeline 手动管理、Dashboard 查看（但无数据）

### Q3: 距离 GA 还差什么？

**核心差距**:
1. **真实 AI**: 当前是"AI 概念"而非"AI 能力"
2. **真实数据**: 需要简历来源 + 候选人流入
3. **真实商业化**: 需要支付 + 计费 + 订阅周期
4. **完整闭环**: 从招聘需求到入职的完整链路

**估算**: 按当前完成度，距离 GA 还需要 **2-3 个 Beta 版本**（约 6-8 周），取决于 AI Runtime 的集成速度。

---

*审计基于代码审查，非线上数据。如有出入，以线上实际为准。*
