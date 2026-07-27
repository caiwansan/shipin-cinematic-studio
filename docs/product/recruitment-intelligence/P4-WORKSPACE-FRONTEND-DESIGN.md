# P4 Recruitment Workspace Frontend Design

**Date:** 2026-07-25
**Type:** Frontend Design Gate (前端设计冻结前)
**Backend Dependency:** P4-01 ~ P4-04 ALL FROZEN
**Status:** PENDING CTO APPROVAL

---

## 1. 定位

### 1.1 是什么

> **Enterprise AI Recruitment Workspace** — 企业 AI 招聘部门工作台

不是"招聘管理 CRUD 页面"。

是企业进入 AI 招聘中心的**唯一入口**。

### 1.2 不是什么

| 旧链路 | 新工作台 |
|--------|----------|
| `/api/enterprise/postings` | `/api/job/match/*` |
| Legacy Recruitment CRUD | AI Recruitment v1 |
| 手动填写表单 | JD → AI 结构化 → 匹配 → 解释 |
| `pages/workspace/enterprise/jobs.vue` | `pages/workspace/recruitment/*` |

### 1.3 与旧链路关系

```
Enterprise Workspace
 ├── 财务
 ├── 运营
 ├── 创意工作室
 ├── 招聘管理 (旧 jobs.vue) ← 保留，不删除
 └── AI 招聘中心 (新) ← 本文档范围
```

旧 `jobs.vue` 保留兼容，新工作台独立运行。等稳定后再决定迁移策略。

---

## 2. 页面信息架构

### 2.1 路由结构

```
/workspace/recruitment/
├── index.vue                        # 招聘主页（工作台入口）
├── jobs/
│   ├── create.vue                   # 创建岗位（JD 输入 + AI 解析）
│   └── [id].vue                     # 岗位详情（匹配结果 + Top Candidates）
└── matches/
    └── [id].vue                     # 匹配详情（P4-02 解释 + 证据链）
```

### 2.2 页面层级

```
Recruitment Home (index)
 ├── Stats: 岗位数 | 匹配任务 | 候选人才 | 待处理推荐
 ├── Quick Actions: 创建岗位 | 查看所有匹配
 └── Recent Jobs List → click → Job Detail
                          ├── Job Info + Status
                          ├── AI Match Status
                          ├── Top Candidates List → click → Match Detail
                          │                         ├── Match Score + Breakdown
                          │                         ├── AI Explanation (P4-02)
                          │                         ├── Evidence Chain
                          │                         └── Risk Flags
                          └── Trigger New Match (P4-04)
```

---

## 3. 用户流程

### 3.1 核心闭环

```
┌─────────────────────────────────────────────────────────┐
│  企业登录 → 进入 AI 招聘中心                               │
│       ↓                                                  │
│  ① 创建岗位                                              │
│     输入 JD 文本                                          │
│       ↓                                                  │
│  ② AI 解析 JD（P4-03）                                   │
│     展示结构化结果：职位/技能/经验/学历                      │
│     企业确认/编辑                                         │
│       ↓                                                  │
│  ③ 保存岗位要求 → 自动触发匹配（P4-04）                    │
│       ↓                                                  │
│  ④ 查看 Top Candidates                                   │
│     排名列表 + 匹配分数                                    │
│       ↓                                                  │
│  ⑤ 点击候选人 → 查看匹配解释（P4-02）                     │
│     优势 / 风险 / 证据链                                   │
│       ↓                                                  │
│  ⑥ 招聘决策（收藏/标记/备注）                              │
└─────────────────────────────────────────────────────────┘
```

### 3.2 异常流程

| 场景 | 处理 |
|------|------|
| AI 解析失败 (无 LLM Key) | 提示"AI 暂不可用，请手动填写"，降级为手动表单 |
| 匹配无结果 | 展示"暂无匹配候选人，请稍后查看" |
| LLM 解释超时 | 降级为 Template Explanation |
| 企业未订阅 | 引导到订阅页面 |
| 权限不足 | 403 → 引导联系管理员 |

---

## 4. API Mapping

### 4.1 招聘主页 (`index.vue`)

| 功能 | API | 方法 |
|------|-----|------|
| 岗位列表 | `/api/job/match/batch/list` | GET |
| 统计信息 | 前端从列表数据计算 | — |

### 4.2 创建岗位 (`jobs/create.vue`)

| 功能 | API | 方法 |
|------|-----|------|
| AI 解析 JD | `/api/job/match/requirements/extract` | POST |
| 验证 JD | `/api/job/match/requirements/validate` | POST |
| 创建岗位要求 | `/api/job/match/requirements` | POST |
| 技能词汇提示 | `/api/job/match/skills/vocabulary` | GET |

### 4.3 岗位详情 (`jobs/[id].vue`)

| 功能 | API | 方法 |
|------|-----|------|
| 岗位要求详情 | `/api/job/match/requirements/:id` | GET |
| 更新岗位要求 | `/api/job/match/requirements/:id` | PUT |
| 匹配结果列表 | `/api/job/match/requirements/:id/results` | GET |
| 触发批量匹配 | `/api/job/match/batch` | POST |
| 批量匹配状态 | `/api/job/match/batch/:batchId` | GET |
| 批量匹配结果 | `/api/job/match/batch/:batchId/results` | GET |

### 4.4 匹配详情 (`matches/[id].vue`)

| 功能 | API | 方法 |
|------|-----|------|
| 匹配结果详情 | `/api/job/match/results/:id` | GET |
| 证据链 | `/api/job/match/evidence/:resultId` | GET |
| AI 解释 | `/api/job/match/explanation/:resultId` | GET |
| 模板解释 | `/api/job/match/explanation/:resultId/template` | GET |

### 4.5 API Client 新建

新建 `frontend/studio-v2/api/recruitment-api.ts`：

```typescript
const BASE = '/api/job/match'

// 岗位要求
export async function extractRequirement(jdText: string, enterpriseId: string)
export async function createRequirement(data: CreateRequirementInput)
export async function getRequirement(id: string)
export async function updateRequirement(id: string, data: UpdateRequirementInput)
export async function listRequirements(enterpriseId: string)

// 匹配
export async function triggerBatchMatch(jobRequirementId: string, options?: BatchOptions)
export async function getBatchStatus(batchId: string)
export async function getBatchResults(batchId: string)
export async function listBatchJobs(enterpriseId: string)

// 结果
export async function getMatchResult(id: string)
export async function getEvidenceChain(resultId: string)
export async function getExplanation(resultId: string)
export async function getTemplateExplanation(resultId: string)

// 技能
export async function getSkillVocabulary()
```

复用 `token-cache.ts` 的 `getToken()` 做认证。

---

## 5. 状态管理

### 5.1 原则

- **不使用 Pinia Store**（招聘工作台是独立模块，不需要全局 Store）
- **使用 Composition API + Composable** 模式
- 每个页面管理自己的状态

### 5.2 Composable 设计

```typescript
// composables/useRecruitmentApi.ts
// 封装 API 调用 + 错误处理

// composables/useJobRequirement.ts
// 岗位要求 CRUD 逻辑

// composables/useBatchMatching.ts
// 批量匹配触发 + 轮询状态

// composables/useMatchExplanation.ts
// 匹配解释获取 + 降级逻辑
```

### 5.3 轮询策略

批量匹配状态轮询：

```typescript
// 每 3 秒轮询一次，最多 60 次（3 分钟）
const POLL_INTERVAL = 3000
const MAX_POLLS = 60

// 状态变为 COMPLETED / FAILED 时停止轮询
```

---

## 6. 空状态设计

### 6.1 招聘主页

| 状态 | 展示 |
|------|------|
| 无岗位 | 插图 + "开始使用 AI 招聘" + "创建首个岗位"按钮 |
| 有岗位但无匹配 | 岗位卡片 + "AI 正在分析候选人" |
| 加载失败 | "加载失败，请刷新重试" + 刷新按钮 |

### 6.2 创建岗位

| 状态 | 展示 |
|------|------|
| 初始 | JD 输入框 + "粘贴 JD 或手动输入" |
| AI 解析中 | 解析动画 + "AI 正在理解岗位要求..." |
| 解析成功 | 左侧原始 JD + 右侧结构化结果（可编辑） |
| 解析失败 | "AI 暂不可用" + 手动填写表单 |

### 6.3 岗位详情

| 状态 | 展示 |
|------|------|
| 未匹配 | "点击'AI 寻找候选人'开始匹配" |
| 匹配中 | 进度条 + "已扫描 N 位候选人" |
| 匹配完成 | Top Candidates 列表 |
| 无匹配结果 | "暂无匹配候选人，建议调整岗位要求" |

### 6.4 匹配详情

| 状态 | 展示 |
|------|------|
| 加载中 | Skeleton 骨架屏 |
| LLM 解释中 | "AI 正在生成匹配分析..." |
| LLM 超时 | 自动降级为 Template Explanation |
| 无证据 | "暂无证据链数据" |

---

## 7. 权限边界

### 7.1 认证

| 来源 | 方式 |
|------|------|
| 企业用户 | JWT (复用 `token-cache.ts`) |
| API 鉴权 | `Authorization: Bearer <token>` Header |

### 7.2 权限

| 角色 | 权限 |
|------|------|
| 企业管理员 | 创建/编辑/删除岗位、触发匹配、查看所有结果 |
| 企业成员 | 查看岗位列表、查看匹配结果 |
| 非企业用户 | 重定向到 `/workspace/enterprise/onboarding` |

### 7.3 数据隔离

- 所有 API 请求携带 `enterpriseId`（从 `useIdentityStore` 获取）
- 后端已做 tenant isolation（P4-01 Search API 验证过）
- 前端不做额外隔离（信任后端权限检查）

---

## 8. UI 设计规范

### 8.1 复用 Enterprise Workspace 设计体系

| 元素 | 来源 |
|------|------|
| 顶部导航 | `WorkspaceSwitcher` + 企业身份 |
| 配色方案 | `#0A0F1E` 背景 + `#1A2240` 边框 + `#60a5fa` 主色 |
| 按钮风格 | `.ceo-btn-primary` / `.ceo-btn-secondary` |
| 卡片样式 | `.job-profile-card` 风格 |
| 字体层级 | 复用现有 rem 尺度 |

### 8.2 AI Recruitment Design Language

新增专属设计元素：

| 元素 | 说明 |
|------|------|
| 匹配分数环 | 圆形进度条展示 0-100 分 |
| 证据链标签 | `✓ 证据` / `△ 风险` 标签 |
| AI 解析动画 | JD → 结构化结果的过渡动画 |
| 排名徽章 | Top 1/2/3 金银铜色 |
| 技能匹配标签 | `Vue3 ✓` / `React △` 对比展示 |

### 8.3 关键组件

```
components/recruitment/
├── JobCard.vue              # 岗位卡片（列表项）
├── MatchScoreRing.vue       # 匹配分数圆环
├── CandidateRankCard.vue    # 候选人排名卡片
├── EvidenceChain.vue        # 证据链展示
├── SkillMatchTags.vue       # 技能匹配标签
├── JdExtractPanel.vue       # JD 解析面板
├── MatchProgress.vue        # 匹配进度条
└── EmptyState.vue           # 空状态（复用）
```

---

## 9. 页面详细设计

### 9.1 招聘主页 (`/workspace/recruitment/`)

```
┌──────────────────────────────────────────────┐
│  ← 返回工作台中心    [WorkspaceSwitcher]       │
├──────────────────────────────────────────────┤
│                                              │
│  🤖 AI 招聘中心                               │
│  智能匹配，一键找到最佳候选人                    │
│                                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │岗位数│ │匹配中│ │候选人│ │待处理│        │
│  │  3  │ │  1  │ │ 28  │ │  5  │        │
│  └──────┘ └──────┘ └──────┘ └──────┘        │
│                                              │
│  [➕ 创建岗位]  [🔄 刷新]                     │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ 📋 高级前端工程师         招聘中       │    │
│  │    Top 1: 张三 92分                   │    │
│  │    已扫描 86 位候选人                  │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ 📋 Java 后端工程师        招聘中       │    │
│  │    Top 1: 李四 88分                   │    │
│  │    已扫描 42 位候选人                  │    │
│  └──────────────────────────────────────┘    │
│                                              │
└──────────────────────────────────────────────┘
```

### 9.2 创建岗位 (`/workspace/recruitment/jobs/create`)

```
┌──────────────────────────────────────────────┐
│  ← 返回 AI 招聘中心                           │
├──────────────────────────────────────────────┤
│                                              │
│  ➕ 创建岗位                                  │
│                                              │
│  ┌─────────────────┐ ┌─────────────────┐    │
│  │ 📝 输入 JD       │ │ 🤖 AI 解析结果   │    │
│  │                 │ │                 │    │
│  │ [JD 文本输入框]  │ │ 职位：高级前端   │    │
│  │                 │ │                 │    │
│  │                 │ │ 技能：          │    │
│  │                 │ │  ✓ Vue3         │    │
│  │                 │ │  ✓ TypeScript   │    │
│  │                 │ │  ✓ Node.js      │    │
│  │                 │ │                 │    │
│  │                 │ │ 经验：5年以上    │    │
│  │                 │ │ 学历：本科       │    │
│  │                 │ │ 级别：Senior    │    │
│  │                 │ │                 │    │
│  │                 │ │ [编辑字段]       │    │
│  └─────────────────┘ └─────────────────┘    │
│                                              │
│  [🤖 AI 解析]  [💾 保存并发布匹配]            │
│                                              │
└──────────────────────────────────────────────┘
```

### 9.3 岗位详情 (`/workspace/recruitment/jobs/[id]`)

```
┌──────────────────────────────────────────────┐
│  ← 返回 AI 招聘中心                           │
├──────────────────────────────────────────────┤
│                                              │
│  📋 高级前端工程师                    [编辑]  │
│  状态：招聘中                                 │
│                                              │
│  AI 匹配状态：                                │
│  ✅ 已扫描 86 位候选人                         │
│  🎯 8 位匹配（≥60分）                         │
│  ⭐ 3 位推荐（≥80分）                         │
│                                              │
│  Top Candidates:                             │
│  ┌──────────────────────────────────────┐    │
│  │ 🥇 张三    92分    [查看详情 →]       │    │
│  │    技能: Vue3 ✓ TS ✓ Node ✓          │    │
│  │    经验: 6年 | 学历: 本科             │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ 🥈 李四    88分    [查看详情 →]       │    │
│  │    技能: Vue3 ✓ TS ✓ React △         │    │
│  │    经验: 5年 | 学历: 硕士             │    │
│  └──────────────────────────────────────┘    │
│  ┌──────────────────────────────────────┐    │
│  │ 🥉 王五    84分    [查看详情 →]       │    │
│  │    技能: Vue3 ✓ TS ✓                 │    │
│  │    经验: 8年 | 学历: 本科             │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  [🔄 重新匹配]                                │
│                                              │
└──────────────────────────────────────────────┘
```

### 9.4 匹配详情 (`/workspace/recruitment/matches/[id]`)

```
┌──────────────────────────────────────────────┐
│  ← 返回岗位详情                               │
├──────────────────────────────────────────────┤
│                                              │
│  张三 × 高级前端工程师                         │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │         ╭───────╮                    │    │
│  │        │   92   │  匹配分数           │    │
│  │        │  分    │                    │    │
│  │         ╰───────╯                    │    │
│  │                                      │    │
│  │  技能  ████████░░  85                │    │
│  │  经验  █████████░  90                │    │
│  │  教育  ████████░░  80                │    │
│  │  职业  █████████░  88                │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  🤖 AI 匹配分析                               │
│  ┌──────────────────────────────────────┐    │
│  │ ✅ 优势                              │    │
│  │  ✓ 6年 Vue3 项目经验（高度匹配）      │    │
│  │  ✓ SaaS 平台开发经验                  │    │
│  │  ✓ 本科学历，计算机专业               │    │
│  │                                      │    │
│  │ ⚠ 风险                               │    │
│  │  △ 缺少大型团队管理经验               │    │
│  │  △ Node.js 经验仅 1 年               │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  📎 证据链                                    │
│  ┌──────────────────────────────────────┐    │
│  │  ✓ 工作经历 #1 — 某公司前端负责人      │    │
│  │  ✓ 技能证明 — Vue3 (置信度 0.95)      │    │
│  │  ✓ 教育背景 — 某大学计算机本科         │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  [🤍 收藏]  [📤 标记已联系]                   │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 10. 技术约束

### 10.1 框架

- Nuxt 3 (复用现有项目)
- Vue 3 Composition API
- TypeScript (strict mode)
- Pinia (仅复用 `identityStore`，不新建 Store)

### 10.2 已有基础设施复用

| 组件/工具 | 来源 | 用途 |
|-----------|------|------|
| `useIdentityStore` | `stores/identity.ts` | 企业身份上下文 |
| `useEnterpriseContext` | `composables/useEnterpriseContext.ts` | 企业 ID |
| `getToken()` | `utils/token-cache.ts` | JWT 认证 |
| `WorkspaceSwitcher` | `components/WorkspaceSwitcher.vue` | 工作空间切换 |

### 10.3 后端依赖

| 模块 | 状态 | 依赖的 API |
|------|------|-----------|
| P4-01 Talent Matching | ✅ FROZEN | 6 个 API |
| P4-02 Match Explanation | ✅ FROZEN | 2 个 API |
| P4-03 Job Understanding | ✅ FROZEN | 3 个 API |
| P4-04 Batch Matching | ✅ FROZEN | 5 个 API |

### 10.4 性能要求

| 指标 | 目标 |
|------|------|
| 首屏加载 | < 2s |
| AI 解析响应 | < 10s (LLM) / 立即 (规则) |
| 匹配轮询 | 3s 间隔，最多 3 分钟 |
| 页面切换 | < 500ms |

---

## 11. 实施计划

### Phase R1: 招聘闭环 MVP

| 步骤 | 页面 | 优先级 | 预估 |
|------|------|--------|------|
| 1 | 招聘主页 `index.vue` | P0 | 1 天 |
| 2 | 创建岗位 `jobs/create.vue` | P0 | 2 天 |
| 3 | 岗位详情 `jobs/[id].vue` | P1 | 1.5 天 |
| 4 | 匹配详情 `matches/[id].vue` | P1 | 1.5 天 |
| 5 | API Client `recruitment-api.ts` | P0 | 0.5 天 |
| 6 | 组件库 `components/recruitment/` | P1 | 1 天 |
| 7 | 联调 + Reality Test | — | 1 天 |

**总计:** ~8.5 天

---

## 12. Reality Test 计划

### 12.1 测试场景

| 场景 | 验证点 |
|------|--------|
| 创建岗位 → AI 解析 | JD 文本 → 结构化结果展示 → 编辑 → 保存 |
| 自动触发匹配 | 保存后自动触发 → 轮询状态 → 完成 |
| 查看 Top Candidates | 排名正确 → 分数展示 → 点击查看详情 |
| 查看匹配解释 | AI 解释加载 → 优势/风险/证据链展示 |
| LLM 不可用降级 | 关闭 LLM → 模板解释降级 |
| 空状态 | 无岗位/无匹配/无候选人 |
| 权限隔离 | 企业 A 看不到企业 B 的数据 |

### 12.2 验证标准

- 所有 API 调用成功
- UI 展示与后端数据一致
- 异常流程正确降级
- 无控制台报错

---

## 13. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| LLM Key 未配置 | 高 | AI 解析不可用 | 降级为手动表单 |
| 候选人池不足 | 中 | 无匹配结果 | 提示"暂无匹配" |
| 旧 jobs.vue 混淆用户 | 中 | 用户不知道用哪个 | 在旧页面顶部加引导 Banner |
| P4 API 性能 | 低 | 匹配超时 | 前端设 30s 超时 + 重试 |

---

## 14. 待确认项

| 项目 | 待确认 |
|------|--------|
| 路由前缀 | `/workspace/recruitment` 是否与现有路由冲突？ |
| 导航入口 | Enterprise Workspace 侧边栏是否新增"AI 招聘中心"入口？ |
| 旧页面引导 | 旧 `jobs.vue` 顶部是否加"试试 AI 招聘"Banner？ |
| 订阅校验 | 是否需要在前端校验企业订阅等级？ |

---

**Status:** PENDING CTO APPROVAL

CTO 确认后进入 Implement 阶段。
