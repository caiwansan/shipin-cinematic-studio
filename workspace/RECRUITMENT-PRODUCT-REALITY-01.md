# RECRUITMENT-PRODUCT-REALITY-01.md

> Generated: 2026-07-28 18:15 CST
> Task: Enterprise Recruitment Workspace Deep Product Review
> Source: 线上发布页面 + 前端源码 + 后端 API 路由
> Notice: 以下所有判断基于当前 a54c80b1 版本的前端代码和后端路由注册状态

---

## Task 01 — 完整页面结构还原

```
用户入口: /workspace/enterprise
Layout:   layouts/enterprise.vue (模块系统, NuxtPage被覆盖)
```

### 完整组件树

```
layouts/enterprise.vue
│
├── EnterpriseShell.vue                ← 左侧导航栏
│   ├── 未显示AI招聘中心 (RecruitmentShell 未集成)
│   └── 仅有通用导航项
│
├── EnterpriseWorkspace.vue
│   ├── EnterpriseIdentityHeader       ← 企业身份 + 员工数
│   ├── WorkspaceHeader                ← "招聘工作台"
│   ├── EnterpriseModuleRenderer.vue   ← 模块调度器
│   │   └── RecruitmentModule.vue      ← ⬅ 当前展示
│   │       ├── [区块1] rec-identity
│   │       │   ├── 企业名称(KPI) + AI员工数 + 系统状态
│   │       │   ├── KPI网格: 在招/候选人/待处理/AI在办
│   │       │   └── 操作按钮: [创建岗位] [人才池]
│   │       ├── [区块2] rec-state--loading (加载动画)
│   │       ├── [区块3] rec-state--empty (空态引导)
│   │       ├── [区块4] AI招聘团队
│   │       │   └── AiTeamDisplay.vue
│   │       │       ├── Agent卡片 (v-for)
│   │       │       │   ├── 头像 + 图标
│   │       │       │   ├── 名称 + 角色
│   │       │       │   ├── 运行状态指示器 + 状态文本
│   │       │       │   ├── 今日完成数 + 最后活跃
│   │       │       │   └── 能力标签
│   │       │       └── TodayTasks.vue (任务预览)
│   │       ├── [区块5] 招聘驾驶舱
│   │       │   ├── Pipeline流: 岗位→匹配中→候选人→待处理→Offer
│   │       │   ├── AI建议区块
│   │       │   └── 岗位预览卡片
│   │       └── [区块6] 最近在招岗位列表
│   │
│   ├── EnterpriseStatusBar            ← 底部状态
│   └── EnterpriseFooter               ← 底部信息
│
└── ─── (其他模块不可达) ───
     ├── 17 个 Nuxt pages 文件全部不可达(死代码)
     ├── 13 个其他模块组件 (Dashboard/Intelligence等)
     └── 3 个 store 未使用 (enterprise/recruitment/agent)
```

### 数据来源

| 数据 | API | 前端消费 | 数据真实性 |
|------|-----|----------|-----------|
| 企业身份 | `/api/identity/context` | EnterpriseIdentityHeader | ✅ 真实 |
| AI员工列表 | `/api/enterprise/media-department/agents` | useAgentWorkforce → AiTeamDisplay | ⚠️ 通用agent池 |
| AI员工统计 | `/api/enterprise/media-department/agents/summary` | useAgentWorkforce | ⚠️ 同上 |
| KPI数据 | 从agent列表自行计算 | RecruitmentModule.vue stats computed | ⚠️ 伪KPI |
| Pipeline状态 | 从agent列表自行计算 | RecruitmentModule.vue pipelineFlow computed | ⚠️ 伪Pipeline |
| AI建议 | 从stats简单判断 | RecruitmentModule.vue aiSuggestion computed | ⚠️ 伪AI建议 |

---

## Task 02 — 用户第一屏 Reality

### 假设场景: 企业老板首次登录

```
第1屏 (视窗顶部):
┌─────────────────────────────────────────────────┐
│ 🏢 昆仑镜科技 · 招聘工作台                        │
│ ● 3 个 AI 员工运行中 · 系统正常                   │
│                                                   │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                 │
│ │ 3   │ │ 12  │ │ 8   │ │ 5   │                 │
│ │在招 │ │候选人│ │待处理│ │AI在办│                 │
│ └─────┘ └─────┘ └─────┘ └─────┘                 │
│                                                   │
│ [📝 创建岗位]  [🔍 人才池]                        │
└─────────────────────────────────────────────────┘

第2屏 (滚动):
┌─────────────────────────────────────────────────┐
│ AI 招聘团队                                       │
│ ┌────────┐ ┌────────┐ ┌────────┐                 │
│ │ 🤖     │ │ 🔍     │ │ 🎤     │                 │
│ │ 招聘经理│ │ 猎聘顾问│ │ 面试官  │                 │
│ │ ● 活跃 │ │ ● 活跃 │ │ ● 忙碌  │                 │
│ │ 今日12 │ │ 今日8  │ │ 今日3  │                 │
│ └────────┘ └────────┘ └────────┘                 │
│ [今日任务预览]                                     │
└─────────────────────────────────────────────────┘

第3屏 (继续滚动):
┌─────────────────────────────────────────────────┐
│ 招聘驾驶舱                                        │
│ 岗位 → 匹配中 → 候选人 → 待处理 → Offer            │
│  3       2        12        8        0           │
│                                                   │
│ 💡 AI建议: 8名候选人待处理，AI已初步筛选 [查看]     │
│                                                   │
│ 最近在招岗位                                       │
│ ┌─ 高级算法工程师 ─────────────────────────────┐  │
│ │ 候选人: 5 · 2026-07-28                       │  │
│ └──────────────────────────────────────────────┘  │
│ ┌─ AIGC产品经理 ──────────────────────────────┐  │
│ │ 候选人: 3 · 2026-07-28                       │  │
│ └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 5秒信息接收度评估

| 问题 | 能否回答 | 说明 |
|------|---------|------|
| 我是谁？ | ✅ 能 | 企业名称 + 招聘工作台 |
| 现在招聘状态？ | ⚠️ 能，但有偏差 | KPI 数据来自 agent 列表伪计算 |
| AI 能帮我什么？ | ⚠️ 部分 | 看到 Agent 卡片但无法交互 |
| 下一步做什么？ | ✅ 能 | [创建岗位] [人才池] + AI建议 |

**评分: 65/100** — 信息框架对了，但数据真实度有偏差

---

## Task 03 — 完整招聘工作流还原

| 步骤 | 页面/组件 | 操作按钮 | 依赖API | 状态 |
|------|----------|---------|---------|------|
| ① 企业注册 | EnterpriseIdentityHeader | — | `/api/identity/context` | ✅ 外部已处理 |
| ② 企业认证 | EnterpriseIdentityHeader | — | — | ✅ 外部已处理 |
| ③ 进入招聘中心 | RecruitmentModule | 自动渲染 | module system routing | ✅ |
| ④ 创建岗位 | `goToCreateJob()` → `/jobs` | [📝 创建岗位] | `window.location.href` | ⚠️ 跳转后进dashboard |
| ⑤ AI生成JD | — | — | — | ❌ 无此功能 |
| ⑥ 发布岗位 | — | — | — | ❌ 无此功能 |
| ⑦ AI寻找人才 | AiTeamDisplay agent展示 | — | media-department/agents | ⚠️ 通用agent非招聘专用 |
| ⑧ 候选人进入 | Pipeline步骤"候选人" | 仅展示 | 从agent计算 | ❌ 假数据 |
| ⑨ AI匹配 | Pipeline步骤"匹配中" | 仅展示 | 同上 | ❌ 假数据 |
| ⑩ HR筛选 | Pipeline步骤"待处理" | 仅展示 | 同上 | ❌ 假数据 |
| ⑪ AI面试 | — | — | — | ❌ 无此功能 |
| ⑫ Offer | Pipeline步骤"Offer" | 仅展示 | 从agent计算 | ❌ 假数据 |
| ⑬ 入职 | — | — | — | ❌ 无此功能 |

**完整工作流完成度: 3/13 步**

### 关键断裂点

```
创建岗位 → /workspace/enterprise/jobs
             ↓
          layout initFromRoute 没有 jobs 匹配
             ↓
          显示 dashboard 模块 ← 用户迷路
```

---

## Task 04 — AI 员工体验审查

### 用户看到的是 A 还是 B?

**当前状态: B — "几个技术Agent组件"**

### 为什么不是 A?

| AI员工身份维度 | 实现状态 | 问题 |
|---------------|---------|------|
| 员工身份 | ⚠️ 有头像+名字+角色 | 数据来自通用agent池 |
| 工作状态 | ✅ 活跃/暂停/忙碌 | 技术状态，非业务状态 |
| 工作成果 | ⚠️ "今日完成N" | 通用任务计数，非招聘成果 |
| 下一步行动 | ❌ 不可交互 | 卡片不能点击，无法派任务 |

### 后端已定义的 AI 招聘角色

后端 `recruitment-department.routes.ts` 已定义的专属招聘Agent:

| 角色 | 中文名 | 能力 | 是否被前端使用 |
|------|--------|------|--------------|
| `marketing` | 招聘宣传官 | 岗位发布/社媒宣发/社群运营 | ❌ 未使用 |
| `recruiter` | AI 招聘官 | 人才扫描/排序/沟通/资料收集 | ❌ 未使用 |
| `interview` | AI 面试官 | 初面/技术面/英语测试/自动评分 | ❌ 未使用 |

**问题**: 后端定义了招聘专属Agent，但
1. 招聘Agent routes 没有注册任何 endpoint（空定义）
2. 前端使用通用 `media-department/agents` endpoint
3. `getAgentLabel()` 是纯前端映射，强把通用agent标成招聘角色

---

## Task 05 — 产品级评分

| 维度 | 分数 | 判断依据 |
|------|------|---------|
| 首页产品感 | 55 | 结构像产品首页，但内容空洞 |
| 企业身份感 | 70 | 有企业名、系统状态、KPI卡片 |
| AI员工体验 | 40 | 技术组件未转成业务角色 |
| 招聘流程完整度 | 25 | 3/13 步完成，Pipeline数据是假的 |
| 商业产品感 | 45 | 像管理后台不是商业产品 |
| 视觉一致性 | 80 | Token统一，视觉没问题 |
| 操作路径 | 50 | 能进首页，但点出去回不来 |

### 总分: **52/100**

### 分类判定: **C — 后台**

> 这不是「产品」，不是「工具」，也不是「原型」。
> 是一个 **带品牌视觉的后台页面**。

---

## Task 06 — 下一阶段建议

### Option C: 暂停上线，重新设计核心工作台

**不推荐上线。原因:**

#### 核心发现 1: 数据层与产品层脱节

```
前端 RecruitmentModule
  ↓ 使用
useAgentWorkforce()
  ↓ 调用
/api/enterprise/media-department/agents  <── 通用agent API
  ↓ 返回
全量企业AI员工 (含影视制作agent)
  ↓ 前端强行
getAgentLabel() 映射 → "招聘经理"  ← 假的!
```

#### 核心发现 2: 招聘工作流 3/13 步完成

完整的招聘链路有 13 步，当前只覆盖 `进入中心` 和 `创建岗位`（还是坏的）。Pipeline 的 5 个阶段全是前端从 Agent 统计数据假造的展示。

#### 核心发现 3: "招聘部门"不存在

后端有 `recruitment-department.routes.ts`（定义了 Marketing / Recruiter / Interview 三个招聘Agent），但:
- 没有注册任何 endpoint
- 前端没有对接
- `EnterpriseShell.vue` 侧边栏没有招聘入口

---

### 修正路线 (Option B+)

不是从零重写，而是「修复桥梁」：

```
Sprint A: 后端招聘API激活 (1-2天)
  ├── recruitment-department.routes.ts 注册 endpoint
  ├── POST /api/enterprise/recruitment-department/agents
  ├── GET  /api/enterprise/recruitment-department/state
  └── 为种子企业的3个Agent创建 recruitment 角色

Sprint B: 前端API切换 (0.5天)
  ├── useRecruitmentDepartment() composable (代替 useAgentWorkforce)
  ├── 对接 /api/enterprise/recruitment-department/*
  └── 删除 getAgentLabel() 假映射

Sprint C: Pipeline真数据接入 (1-2天)
  ├── 对接 recruitment-pipeline endpoint
  ├── KPI 从真实招聘数据计算
  └── Pipeline 5 阶段全部走真实数据

Sprint D: 创建岗位 + 跳转修复 (0.5天)
  ├── 创建岗位 inline modal (不跳出页面)
  ├── 或在 layout 中修复 jobs 模块
  └── 解决 layout 覆盖问题
```

---

### 我的建议

```
当前:
┌──────────────────┐
│ RecruitmentModule│  ← 漂亮的展示层
│ • KPI (假数据)    │
│ • Agent (通用)    │
│ • Pipeline (伪)   │
│ • 建议(前端if判断) │
└──────┬───────────┘
       │ 调用
       ▼
┌──────────────────┐
│ media-department │  ← 错的后端
│   /agents        │
└──────────────────┘

需要成为:
┌──────────────────┐
│ RecruitmentModule│  ← 产品层不变
│ • KPI (真数据)    │
│ • Agent (招聘专用) │
│ • Pipeline (真实)  │
│ • 建议(真AI判断)   │
└──────┬───────────┘
       │ 调用
       ▼
┌──────────────────────┐
│ recruitment-department│  ← 对的后端
│   /agents            │  (已定义但未启用)
│   /state             │
│   /pipeline          │
└──────────────────────┘
```

### 决策: **Option C → 暂停上线**

东西是美的，但骨架是空的。

当前状态是一个 **「产品原型」**——有完整的展示层但没有真实数据支撑。

建议:
1. **不要上线** — 用户看到的是假数据，信任会一次消耗完
2. **用 3-5 天修复桥梁** — 激活后端 API + 切换前端 + Pipeline 真数据
3. 修复后重新做 Product Reality Check

---

## 附录 A: 后端 Route Dead Code 证明

```
src/routes/recruitment-department.routes.ts

├── 定义了 3 个 AI 招聘 Agent ✓
│   ├── marketing (招聘宣传官)
│   ├── recruiter (AI招聘官)
│   └── interview (AI面试官)
├── 定义了 ensureWorkforceExists() ✓
├── 定义了 syncToHermes() ✓
└── 但没有一行 app.get/post/put/delete ❌
    → 所有代码都是"定义未注册"
```

## 附录 B: 前端假数据证明

```
RecruitmentModule.vue script:

stats = computed(() => {
  const instances = workforceState.value.instances
  return {
    totalJobs: instances.length,           ← 把agent数量当成在招岗位数
    matchingTasks: instances.filter(...).length, ← 把活跃agent当匹配中
    totalCandidates: instances.reduce(...usage), ← 把agent使用量当候选人
    pendingReview: instances.reduce(...usage),   ← 同上，重复
  }
})
```

结论: KPI 卡的 4 个数字全部来自 Agent Instance 列表，和真实的招聘数据无关。
