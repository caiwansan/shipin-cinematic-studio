# Recruitment Product Reality Gate

**Date:** 2026-07-30
**Auditor:** 杨玉环 (Browser Product Reality Audit)
**Gate Status:** P0 已修复，P1 待优化

---

## 用户进入路径

```
用户登录
  ↓
访问 /workspace/enterprise/
  ↓
跳转到 /workspace/enterprise/onboarding? (之前)
  ↓
直接渲染首页 (修复后)
  ↓
导航到各子页面
```

---

## Phase 1: 首页 /workspace/enterprise/

### 验证结果

| 项目 | 预期 | 实际 | 状态 |
|------|------|------|------|
| 企业名称 | 真实企业名 | "user_5989" | ⚠️ 数据问题（DB 未存真实名称） |
| 套餐状态 | 显示套餐信息 | ✅ "人事部 ¥999/月" + "已激活 / 3" | ✅ 修复后正常 |
| AI招聘成果 | 展示统计 | ✅ 本月任务/候选人/JD/成本 | ✅ |
| Alice 招聘顾问 | 展示 | ✅ 工作中 + 今日完成 | ✅ |
| Bob 面试专家 | 展示 | ✅ 工作中 + 今日完成 | ✅ |
| Carol 人才分析师 | 展示 | ✅ 工作中 + 今日完成 | ✅ |
| 招聘驾驶舱 | 展示漏斗 | ✅ 2职位→0收到简历→...漏斗 | ✅ |
| 创建岗位按钮 | 可点击 | ✅ | ✅ |
| 人才池按钮 | 可点击 | ✅ | ✅ |
| 今日任务 | 展示动态 | ✅ 待优化JD + 待处理日程 | ✅ |

### 修复记录

**P0: 首页显示"开始使用 AI 招聘团队"（未订阅态）**

- **根因：** `RecruitmentSubscriptionCard.vue` 的 `fetchSubscription()` 判断 `body?.code === 0`，但后端 API 返回 `{ success: true, data: {...} }`，`code` 为 undefined，导致条件永远 false，`subscription` 始终为 null
- **修复：** 3 个 fetch 方法的判断条件改为 `body?.code === 0 || body?.success`
- **涉及文件：** `frontend/components/recruitment/RecruitmentSubscriptionCard.vue`

**P0: Step4 套餐选择 API 500**

- **根因：** `create()` 违反 `organization_id` 唯一约束
- **修复：** `create` → `upsert`，Entitlement 改为 `findFirst+update|create`，现有订阅自动跳过
- **涉及文件：** `backend/src/routes/enterprise-onboarding.routes.ts`

---

## Phase 2: 招聘子页面

### 职位管理 /workspace/enterprise/jobs

| 项目 | 状态 |
|------|------|
| 已有岗位 | ✅ AI产品经理(5候选人) + 前端开发工程师(0候选人) |
| 创建岗位按钮 | 页面有"详情"按钮 |
| JD生成入口 | ❌ 未明显展示 |
| 页面加载 | ✅ 200 |

### 人才匹配 /workspace/enterprise/talent

| 项目 | 状态 |
|------|------|
| 候选人列表 | ✅ 空态"开始搜索候选人"（合理，无匹配任务） |
| 匹配分 | 无数据 |
| 推荐理由 | 无数据 |

### 简历管理 /workspace/enterprise/candidates

| 项目 | 状态 |
|------|------|
| 候选人列表 | ✅ 空态"暂无候选人" |
| 创建职位入口 | ✅ "📝 去创建职位" |

### 面试管理 /workspace/enterprise/interview

| 项目 | 状态 |
|------|------|
| 面试列表 | ✅ 空态"暂无面试" |

### AI员工 /workspace/enterprise/AgentCapabilityCenter

| 项目 | 状态 |
|------|------|
| Alice (career_advisor) | ✅ 运行中 + 能力 + 本月任务 |
| Bob (interview_agent) | ✅ 运行中 + 能力 + 本月任务 |
| Carol (resume_analyzer) | ✅ 运行中 + 能力 + 本月任务 |
| talent_hunter | ✅ 试用中 + 能力 + 本月任务 |

### 套餐订阅 /workspace/enterprise/billing

| 项目 | 状态 |
|------|------|
| 当前套餐 | ✅ 人事部 ¥999/月 (生效中) |
| 使用额度 | ✅ 3/3 AI员工 + 0/5 渠道 + 0/10 成员 |
| 可用套餐 | ✅ 4个套餐展示 |
| 订单记录 | ✅ 有记录（但显示"待支付"） |

---

## Phase 3: API 数据链

| API | 端点 | 状态 | 数据完整性 |
|-----|------|------|-----------|
| 套餐 | `/api/enterprise/subscription/current` | ✅ 200 | hasSubscription=true, planName, price, max |
| 首页 | `/api/enterprise/home` | ✅ 200 | funnel, metrics, needsAttention |
| AI员工 | `/api/enterprise/agent-profiles` | ✅ 200 | 4 agents |
| 任务 | `/api/enterprise/agent-tasks` | ✅ 200 | task list |

### 前端 API 契约问题

`RecruitmentSubscriptionCard.vue` 的 fetch 方法检查 `body.code === 0`，但：
- subscription/current 返回 `{ success, data }` ✅ **已修复**
- agent-profiles 返回 `{ success, data }` ✅ **已修复**
- agent-tasks 返回 `{ success, data }` ✅ **已修复**

---

## Phase 4: 修复优先级

| 优先级 | 问题 | 状态 |
|--------|------|------|
| **P0** | 首页显示"未订阅状态"（原问题） | ✅ **已修复并验证** |
| **P0** | Step4 套餐选择 API 500（原问题） | ✅ **已修复并验证** |
| P1 | 价格显示 ¥99900（后端分为单位未转换） | ❌ 待修复 |
| P1 | 企业名显示 user_5989（DB 数据问题） | ❌ 数据层 |
| P1 | 订单记录显示"待支付"（可能误导用户） | ❌ 需确认 |
| P2 | 首页左上的"← 首页"按钮重复（EnterpriseShell已有） | ❌ 体验优化 |

---

## Phase 5: 验收标准（新增）

以后 Recruitment Workspace 必须同时通过以下三重 Gate：

```
Backend Reality Gate    — API 200 + 数据正确
Browser Reality Gate    — 页面渲染 + 组件呈现
Product Reality Gate    — 用户视角功能完整
```

---

## 浏览器验证截图

**首页 (修复后):**
- 套餐卡片 ✅ 显示 "人事部 ¥999/月"
- 未订阅横幅 ❌ ~~"开始使用 AI 招聘团队"~~
- AI 团队 ✅ Alice/Bob/Carol
- 招聘驾驶舱 ✅

**子页面:**
- 职位管理 ✅ 2 个职位显示
- 人才匹配 ✅ 空态
- 简历管理 ✅ 空态
- 面试管理 ✅ 空态
- AI员工 ✅ 4 个 agent
- 套餐订阅 ✅ 生效中

---

## 结论

P0 修复验证通过：

1. **Step4 API 500** ✅ → `upsert` 处理唯一约束，已有订阅自动跳过
2. **首页未订阅横幅** ✅ → 前端 API 契约从 `code === 0` 扩展为 `code === 0 || success`

**所有子页面正常渲染，招聘工作台可用。**
