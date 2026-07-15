# Enterprise Digital Department Workspace Architecture & Product Design Spec v1.0

> 定位：将 Enterprise Growth Runtime 封装为面向企业客户的 AI 数字部门产品
> 编制：Engineering Agent (OpenClaw) 产品组 | 日期：2026-07-16
> 输入：《Enterprise Workspace Reality Report v1.0》✅ APPROVED
> 约束：CTO冻结令 — 零代码修改直至本Spec批准

---

## Chapter 0 — Executive Summary

### 0.1 背景

Phase 3 Gateway Runtime 已完成验证（✅ CLOSED）。系统已具备：
- 8渠道分发能力
- 内容生产→发布→互动→线索→归因全链路
- 5个AI Agent运行时
- ROI三分离计算引擎
- Tesla验证数据：213篇内容 + 880互动 + 348线索

### 0.2 问题

当前 Enterprise Digital Department 存在"有运行能力，缺产品体验"的gap：
- 10个页面骨架完整但缺产品叙事
- 所有后端API就绪但渠道健康度未展示
- AI Agent有运行时但无身份感
- CEO有数据墙但无决策叙事

### 0.3 方案

Phase 4.0 不新增能力，只重构体验层：
- **Epic1** — CEO Dashboard 三问模型重构
- **Epic2** — AI员工身份化升级
- **Epic3** — 产品命名统一
- **Epic4** — 跨页面行动流打通

### 0.4 核心原则

> Phase 3 = 造发动机。Phase 4.0 = 造汽车内饰和驾驶舱。

```
Runtime 已经成立
↓
Workspace 负责让用户理解、使用、信任、购买
```

---

## Chapter 1 — Product Philosophy

### 1.1 产品定义

**企业数字部门** — AI驱动的企业增长与运营中心。

不是：
- ❌ CRM（不管理客户关系）
- ❌ BI工具（不做数据仓库）
- ❌ 营销自动化（不做EDM/短信群发）
- ❌ Agent调试平台（不暴露技术细节）

而是：
> 企业拥有的一套 **AI 增长团队**，每天自动执行发现→生产→发布→分析→建议的全流程。

### 1.2 目标用户

| 角色 | 核心诉求 |
|------|----------|
| CEO / 创始人 | 30秒判断增长状态 + 今日行动建议 |
| 市场负责人 | 渠道效果归因 + 内容策略建议 |
| 增长负责人 | 转化率优化 + 增长实验追踪 |
| 销售负责人 | 线索优先级排序 + 跟进建议 |
| 企业运营负责人 | 任务派发 + 审批流 + AI员工管理 |

### 1.3 Core Promise

用户打开系统后，不是看到：
> "这里有很多 AI 功能。"

而是：
> "我的 AI 部门正在帮我运营企业增长。"

### 1.4 产品人格

- **不是工具**，是团队
- **不是报表**，是建议
- **不是后台**，是门户
- **不是配置面板**，是员工工位

---

## Chapter 2 — Workspace Architecture

### 2.1 信息架构

```
企业数字部门
├── 📊 CEO驾驶舱                    [首页]
│   ├── AI今日工作摘要 (Q1)
│   ├── 增长成果总览 (Q2)
│   ├── AI行动建议    (Q3)
│   └── 渠道健康度矩阵
│
├── 🤖 AI员工                       [原agents]
│   ├── 内容增长专员
│   ├── 渠道运营专员
│   ├── 商机分析专员
│   ├── 销售参谋专员
│   └── 企业大脑专员
│
├── 📋 工作任务                     [原tasks]
├── 📚 企业大脑                     [原knowledge]
├── 📣 渠道增长                     [新页面]
├── 🎯 商机洞察                     [原leads]
├── 💰 增长收益                     [原roi]
├── ✅ 审批中心                     [原approval]
└── ⚙️ 设置                         [新页面]
```

### 2.2 页面映射（现有→产品身份）

| 现有页面 | 行数 | Phase 4身份 | 改造幅度 | 优先级 |
|----------|------|-------------|----------|--------|
| index.vue | 402 | CEO驾驶舱 | 60%重写 | P0 |
| agents.vue | 106 | AI员工中心 | 50%重写 | P1 |
| tasks.vue | 221 | 任务中心 | 30%改造 | P1 |
| knowledge.vue | 264 | 企业大脑 | 20%改造 | P2 |
| leads.vue | 214 | 商机洞察 | 20%改造 | P2 |
| roi.vue | 148 | 增长收益 | 20%改造 | P2 |
| sales.vue | 110 | 销售参谋 | 20%改造 | P2 |
| approval.vue | 154 | 审批中心 | 20%改造 | P2 |
| leads/[id].vue | 156 | 线索详情 | 10%改造 | P3 |
| intro.vue | 347 | 产品介绍页 | 已成型 | P3 |
| (新) 渠道增长 | — | 渠道增长 | 100%新增 | P0 |
| (新) 设置 | — | 设置 | 100%新增 | P3 |

### 2.3 Runtime能力→产品层映射

```
Runtime Layer (Phase 3)              Product Layer (Phase 4)
─────────────────────────           ──────────────────────────
Channel Gateway (8渠道)       →     CEO驾驶舱渠道矩阵 + 渠道增长页
Engagement Collection (880)   →     增长漏斗 + 互动趋势
Lead Intelligence (348)       →     商机洞察列表 + 详情
ROI Attribution (三分离)       →     增长收益页
Agent Runtime (5员工)         →     AI员工中心（身份化展示）
Task Execution ()             →     任务中心（）
Knowledge Base ()             →     企业大脑（知识管理）
Approval Workflow ()          →     审批中心（内容审核）
Sales Recommendation ()       →     销售参谋（CEO建议）
```

---

## Chapter 3 — Experience Design

### 3.1 CEO Dashboard 三问模型

首页唯一职责：帮CEO在30秒内判断企业增长状态。

#### Q1：AI今天做了什么？

数据模型：
```typescript
DailyAIReport {
  employee: DigitalEmployee    // 员工身份
  action: string               // 做了什么（动作+数量）
  output: string               // 产生了什么（具体产出）
  timestamp: DateTime          // 时间
}
```

展示设计：
```
今日AI部门报告

┌─────────────┬─────────────┬─────────────┐
│ 李墨         │ 张渠道       │ 王分析       │
│ 内容增长专员  │ 渠道运营专员  │ 商机分析专员  │
│              │              │              │
│ ✓ 12篇内容   │ ✓ 8渠道同步   │ ✓ 23个机会    │
│ ✓ 3个热点    │ ✓ 136次互动   │ ✓ 7个高意向   │
│ ✓ 5个选题    │ ✓ 2篇文章爆款  │ ✓ 3条建议     │
└─────────────┴─────────────┴─────────────┘
```

数据来源：
- Agent Runtime → 内容生产数
- Channel Gateway → 发布/互动数
- Lead Intelligence → 线索发现数

#### Q2：AI产生了什么价值？

展示设计：
```
增长成果

  213         880         348         ¥128,600
 内容资产     用户互动     商业线索     预测商机价值

  ┌──────────────────────────────────────────────────┐
  │  增长漏斗                                        │
  │  曝光 ████████████████████ 213                   │
  │  互动 ████████████████████████████ 880            │
  │  线索 ██████████████ 348                          │
  │  ████████ 热线索 116                              │
  └──────────────────────────────────────────────────┘
```

注意：所有内容→互动→线索的转化率必须从真实数据计算，禁止前端mock。

#### Q3：ADVISOR建议

展示设计：
```
💡 AI部门建议

1. 抖音内容模型表现最佳
   线索转化率比其他渠道高42%
   建议：复制TOP5内容结构到小红书
   预期：+10~15个有效线索/周

2. 23个高意向线索等待跟进
   其中 7 个来自公众号的深度阅读用户
   建议：安排销售参谋专员48小时内接触
```

当前阶段：基于规则的建议（top-performing渠道、hot线索排序）
未来阶段：Decision Intelligence模型驱动的增长实验建议

### 3.2 渠道健康度矩阵

位置：CEO驾驶舱底部（Q2下方）

展示设计：
```
渠道8宫格

┌────────┬────────┬────────┬────────┐
│ 微信公众号 │ 企业微信 │ 抖音    │ 小红书  │
│   A+    │   A    │   A+   │   A    │
│ 29篇    │ 23篇   │ 27篇   │ 27篇   │
│ 136互动 │ 82互动  │ 126互动 │ 118互动 │
│ 54线索  │ 51线索  │ 54线索  │ 49线索  │
├────────┼────────┼────────┼────────┤
│ 快手    │ 视频号  │ 微博    │ B站    │
│   B    │   B+   │   B+   │   B    │
│ 20篇    │ 23篇   │ 23篇   │ 22篇   │
│ 78互动  │ 99互动  │ 82互动  │ 81互动  │
│ 29线索  │ 28线索  │ 29线索  │ 27线索  │
└────────┴────────┴────────┴────────┘
等级计算：A+（转化率>45%）/ A（35-45%）/ B（25-35%）/ C（<25%）
```

数据来源：`GET /api/enterprise/:tenantId/dashboard/channels`（✅ API已就绪，前端未接入）

### 3.3 用户旅程设计

#### 首次进入（Day 1）
```
登录/注册
    → /enterprise/intro（产品介绍页，已有）
    → 企业订阅激活
    → /enterprise（CEO驾驶舱）
```

#### 日常进入（Day 2+）
```
登录
    → /enterprise（CEO驾驶舱）
    → 扫一眼Q1/Q2/Q3
    → 如有AI建议 → 点击执行
    → 如有效益变化 → 点击查看详情
    → 如有待审批 → 点击进入审批
```

#### 工作流路径
```
发现机会（商机洞察页）
    ↓ AI执行（自动：内容→发布→互动采集）
    ↓ 人工审批（审批中心）
    ↓ 渠道发布（渠道增长页）
    ↓ 结果反馈（CEO驾驶舱Q2）
    ↓ AI建议（CEO驾驶舱Q3）
```

---

## Chapter 4 — Digital Employee System

### 4.1 核心模型

```typescript
// Presentation Model — 不做数据库改动
// 从Runtime Agent实时映射
DigitalEmployee {
  id: string                    // Runtime agent ID
  name: string                  // 员工姓名（非Agent ID）
  role: string                  // 岗位名称（非角色标识）
  avatar: string                // 头像（角色头像）
  currentStatus: 'working' | 'waiting' | 'idle'
  todayTasks: TodayTask[]       // 今日工作
  todayContribution: Contribution  // 今日贡献（可量化）
  executionHistory: Execution[]    // 最近记录
  businessImpact: Impact           // 贡献归因
}

TodayTask {
  description: string           // 做了什么
  status: 'completed' | 'running' | 'pending'
  output: string                // 产出了什么
}

Contribution {
  interactions: number          // 带来互动
  leads: number                 // 发现线索
  content: number               // 生产内容
  channels: number              // 覆盖渠道
}
```

### 4.2 员工身份库

Dynamic mapping from Runtime Agent to Digital Employee presentation:

| Runtime Agent ID | 员工姓名 | 岗位名称 | 头像 | 职责 |
|------------------|----------|----------|------|------|
| ai-content-manager | 李墨 | 内容增长专员 | 📝 | 行业趋势分析、内容策略、内容生产 |
| ai-channel-manager | 张渠道 | 渠道运营专员 | 📡 | 渠道分发、账号管理、同步策略 |
| ai-lead-analyst | 王分析 | 商机分析专员 | 🔍 | 线索发现、意图识别、评分排序 |
| ai-sales-advisor | 陈参谋 | 销售参谋专员 | 💼 | 客户跟进建议、话术生成、商机推荐 |
| ai-research-analyst | 刘研究 | 企业大脑专员 | 📚 | 行业研究、知识库维护、内容审核 |

### 4.3 展示设计

```
AI员工中心页面

┌──────────────────────────────────────────────────────────┐
│ AI员工总数: 5     本周在线率: 100%    今日任务完成: 47/52 │
└──────────────────────────────────────────────────────────┘

┌─ 李墨 · 内容增长专员 ──────────────────────────────────────┐
│ 📝                                                       │
│ 🟢 工作中                                                │
│ Today: ✓ 分析12个热点 ✓ 生成20篇内容 ✓ 发布8渠道           │
│ 贡献: 54互动 | 18线索 | 213阅读                          │
│ 本周: ████████████████ 120篇内容                          │
└──────────────────────────────────────────────────────────┘

┌─ 张渠道 · 渠道运营专员 ────────────────────────────────────┐
│ 📡                                                       │
│ 🟢 工作中                                                │
│ Today: ✓ 8渠道同步 ✓ 互动回收 ✓ 趋势监测                   │
│ 贡献: 8渠道 | 136互动 | 54阅读                          │
└──────────────────────────────────────────────────────────┘

┌─ 王分析 · 商机分析专员 ────────────────────────────────────┐
│ 🔍                                                       │
│ 🟡 等待决策                                               │ |
│ Today: ✓ 348线索分析 ✓ 23个高意向 ✓ 7个紧急               │
│ 贡献: 348线索 | 116热线索 | ¥128K预测价值                 │
└──────────────────────────────────────────────────────────┘
```

### 4.4 与设计原则对齐

当前（工程师视角）：
```
Agent ID: ai-content-manager
Status: running
Goal: 12
Completed: 10
```

目标（用户视角）：
```
李墨 · 内容增长专员
今日：分析了12个行业趋势，生成20篇内容，发布8个平台
贡献：带来54次互动、18个销售机会
```

---

## Chapter 5 — Product Language Migration

### 5.1 命名冻结表

| 旧（技术语言） | 新（用户语言） | 使用位置 |
|----------------|----------------|----------|
| ROI驾驶舱 | 增长收益 | 路由 + 导航 + 页面标题 |
| Lead Intelligence | 商机洞察 | 路由 + 导航 + 页面标题 |
| Agent Management | AI员工中心 | 路由 + 导航 + 页面标题 |
| Task Center | 任务中心 | 路由 + 导航 + 页面标题 |
| Knowledge Center | 企业大脑 | 路由 + 导航 + 页面标题 |
| Channel Gateway | 渠道增长 | 路由 + 导航 + 页面标题 |
| Approval Center | 审批中心 | 不变 |
| Sales Advisor | 销售参谋 | 不变 |

### 5.2 导航标签映射

| 导航键 | 旧标题 | 新标题 | 产品名 |
|--------|--------|--------|--------|
| /dashboard | CEO Command Center | 📊 CEO驾驶舱 | 首页 |
| /agents | AI 员工管理中心 | 🤖 AI员工 | 二级 |
| /tasks | CEO 任务中心 | 📋 工作任务 | 二级 |
| /knowledge | 企业知识中心 | 📚 企业大脑 | 二级 |
| /channels | — | 📣 渠道增长 | 二级（新） |
| /leads | 线索智能中心 | 🎯 商机洞察 | 二级 |
| /roi | ROI 驾驶舱 | 💰 增长收益 | 二级 |
| /sales | 销售参谋 | 💼 销售参谋 | 二级 |
| /approval | 审批中心 | ✅ 审批中心 | 二级 |
| /settings | — | ⚙️ 设置 | 二级（新） |

---

## Chapter 6 — Migration Plan

### 6.1 改造优先级

#### Sprint 1 — CEO驾驶舱 + 导航 (P0, 预计2天)

1. **index.vue 三问重构**
   - Q1区块：AI员工日报（已有，加入身份化命名）
   - Q2区块：增长成果（已有，格式化优化）
   - Q3区块：AI建议（新增placeholder，优先级排序）
   - 渠道健康度矩阵（接入channel API）
   
2. **KunlunNav子导航**
   - 新增：📣 渠道增长 / ⚙️ 设置
   - 标签替换：ROI→增长收益 / 线索→商机洞察 / 知识→企业大脑

#### Sprint 2 — AI员工 + 身份 (P1, 预计2天)

3. **agents.vue 身份化改造**
   - 员工名字+头像+岗位名称替换Agent ID
   - 今日工作从数字变为具体任务列表
   - 贡献归因（带来线索/互动/内容数）
   - 状态可视化（工作中/等待/休息）

4. **产品命名统一**
   - 全Enterprise页面标题替换
   - 路由path调整（/leads→/opportunities 等，可选）
   - 面包屑替换

#### Sprint 3 — 新增页面 (P2, 预计1天)

5. **渠道增长页面（新建）**
   - 8渠道卡片矩阵
   - 内容发布历史
   - 互动趋势

6. **设置页面（新建）**
   - 订阅信息
   - 企业基本信息
   - API Key管理（如适用）

#### Sprint 4 — 行动流 + 收尾 (P2, 预计1天)

7. **跨页面操作流**
   - 线索详情页→AI建议→创建任务
   - 审批通过→自动发布→监控结果
   
8. **性能优化 + 移动端适配**

### 6.2 技术方案

全部改造遵循：

```
现有页面 → 保留后端API → 只改前端
```

不新增Service、不新增Route、不新增数据库表。

唯一例外是 **渠道增长页面**（新页面但消费已有API）。

---

## Chapter 7 — Architecture Governance

### 7.1 数据链路原则

**必须**：
```
UI → fetch() → Service Route → Database
```

**禁止**：
```
Page → Prisma直连
Page → Mock数据
Page → 前端聚合计算商业指标
```

### 7.2 Enterprise边界

**禁止**：
- ❌ CRM模型膨胀（客户管理、联系人库、销售阶段）
- ❌ 新增重复数据源（所有Runtime数据必须来自Enterprise namespace表）
- ❌ Dashboard假指标（所有KPI必须有API数据源追溯）
- ❌ Agent散落调用（必须经过Model Router）

**必须**：
- ✅ Enterprise namespace隔离
- ✅ Adapter统一渠道入口
- ✅ Repository模式访问数据（Service层）
- ✅ SSOT（Single Source of Truth）数据链

### 7.3 Runtime不可变性

Phase 4.0 **不允许修改**：
- `agent-scheduler.runtime.ts`
- `channel.adapter.ts` 系列
- `enterprise-planner.service.ts`
- `lead-scoring.ts`
- `roi-calculator.ts`
- 任何Phase 3建立的数据模型

Phase 4.0 **只消费** Runtime Output。

### 7.4 例外审批

如需突破上述约束，需要：
1. RFC文档说明理由
2. CTO书面批准
3. 回归测试方案

---

## Appendix A — Data Flow

### A.1 CEO Dashboard数据流

```
[AgentRuntime] ──→ agent-profiles API ──→ Q1: 今日工作
[ChannelRuntime] ──→ channels API ──→ Q1: 渠道团队工作
[LeadRuntime] ──→ leads API ──→ Q2: 线索总数
[ROI Runtime] ──→ roi API ──→ Q2: 预测价值
[ChannelHealth] ──→ channels API ──→ 渠道矩阵
```

### A.2 AI员工页数据流

```
[AgentRuntime] ──→ GET /api/enterprise/agent-profiles
    → 返回: [{id, name, status, dailyTarget}]
    → 前端映射为 Digital Employee View Model
    → 展示: 姓名/岗位/状态/今日贡献
```

### A.3 渠道增长页数据流

```
[ChannelRuntime] ──→ GET /api/enterprise/:tenantId/dashboard/channels
    → 返回: [{label, published, interactions, leads, status}]
    → 前端展示: 8宫格卡片矩阵
```

---

## Appendix B — GO Gate Checklist

### Gate 1 — Product Gate

| 标准 | 验证方式 | 通过条件 |
|------|----------|----------|
| 30秒理解价值 | 用户测试（CTO扮演客户） | CEO说出"AI部门今天做了X，产生Y价值，建议Z" |
| 知道下一步 | 用户测试 | ≥3/5用户知道点击"下一步操作"按钮 |
| 感知AI部门 | 用户测试 | ≥4/5用户说出员工名字而非Agent ID |
| 模块之间有流 | 用户测试 | CEO从"查看线索"→"创建任务"→"审批"无需回首页 |

### Gate 2 — Architecture Gate

| 标准 | 验证方式 | 通过条件 |
|------|----------|----------|
| API数据链完整 | 接口测试 | 每个页面元素有对应API字段 |
| 无Mock数据 | Code Review | 前端无mock/simulated数据 |
| Runtime零改动 | Git diff | enterprise-channel, agent-*, lead-scoring等文件无变更 |
| Enterprise边界 | Schema Review | 无新增enterprise_customer/sales_user等表 |

### Gate 3 — Experience Gate

| 标准 | 验证方式 | 通过条件 |
|------|----------|----------|
| 部门感 | 用户感知评分 | "AI像我的员工"得分≥4/5 |
| CEO视角 | 内容审查 | 首页无"Agent""Lead"等技术术语 |
| 行动流 | 端到端测试 | 完成一次"发现→建议→执行→审批→验证"闭环 |
| 品牌统一 | 文案审查 | CEO看到的所有文案符合命名冻结表 |

---

## Appendix C — Risk Register

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 前端改数据映射出错 | Dashboard显示异常 | 中 | 每个字段加单元测试，保留降级数据 |
| API响应慢 | CEO页加载超时 | 低 | 已有PM2预热，可加Skeleton |
| 产品名称不一致 | 用户混淆 | 中 | 建立术语对照表，全局grep检查 |
| Runtime改动 | Phase 3基线破坏 | 低 | CTO冻结令 + Git保护分支 |

---

## Appendix D — Implementation Timeline

```
Week 1:
├── Day 1-2: index.vue三问重构 + 导航标签替换
├── Day 3: 渠道健康度API接入 + 渠道增长页骨架
├── Day 4-5: AI员工身份化改造

Week 2:
├── Day 1-2: 新增渠道增长页面 + 设置页
├── Day 3: 跨页面行动流
├── Day 4: 端到端测试 + 体验走查
├── Day 5: CTO验收
```

总计：10人日Engineering工作。

---

*本Spec待CTO批准后进入实施阶段。批准后Engineering Agent按Sprint顺序执行。*

*当前约束：NO CODE until APPROVED。*
