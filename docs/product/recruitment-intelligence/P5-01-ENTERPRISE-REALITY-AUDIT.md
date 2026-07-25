# P5-01 Enterprise Recruitment Reality Audit

**审计日期:** 2026-07-26
**审计范围:** `/workspace/recruitment` 全链路
**审计目标:** 验证企业招聘中心是否具备真实 SaaS 产品价值

---

## A. 首页现状

### 当前首页承担

- ✅ 身份 Gate（无企业身份 → 引导入驻）
- ✅ 4 个统计卡片：岗位数 / 匹配任务 / 候选人才 / 待处理推荐
- ✅ 岗位列表（标题 / 状态 / 地点 / 技能 / 匹配数 / 创建时间）
- ✅ 空状态引导（无岗位时 → 创建首个岗位）
- ✅ 创建岗位入口

### 缺失

- ❌ 岗位卡片 `matchCount` 字段未从 API 返回（前端显示永远为 0，隐藏匹配 badge）
- ❌ `pendingReview` 是前端硬算 `Math.min(totalCandidates, 5)`，不是真实待审核数
- ❌ 无招聘效率指标（如 "AI 筛选完成率"、"平均匹配时间"）
- ❌ 无下一步行动引导（企业不知道创建岗位后该做什么）
- ❌ 无快速筛选/搜索（岗位多时无法管理）
- ❌ 无招聘看板视图（只有列表）

---

## B. Reality Score

| 维度 | 分数 | 说明 |
|------|------|------|
| 身份进入 | 9/10 | Gate 清晰，onboarding 三步合理 |
| 首页价值 | 5/10 | 有统计但 `matchCount` 断链，`pendingReview` 是假数据 |
| 岗位管理 | 7/10 | 创建流程完整（AI 解析 JD → 编辑 → 保存），但无编辑/暂停/关闭 |
| 候选管理 | 3/10 | 仅显示匹配数，无候选人列表/详情页 |
| AI 能力体现 | 6/10 | JD 解析有，但匹配/面试/决策无入口暴露 |
| 数据真实性 | 5/10 | 2 处 Reality Debt（matchCount、pendingReview） |
| 闭环完整性 | 4/10 | 创建岗位 → 匹配 → 面试 → 决策链路未在前端贯通 |
| **总分** | **39/70** | **不合格（< 60%）** |

---

## C. 全链路闭环审计

| 环节 | 页面存在 | API 存在 | 真实数据 | 用户可完成 | 问题 |
|------|----------|----------|----------|------------|------|
| 企业入驻 | ✅ onboarding | ✅ /enterprise/onboarding/* | ✅ | ✅ | — |
| 创建岗位 | ✅ jobs/create | ✅ /job/match/requirements | ✅ | ✅ | — |
| AI 解析 JD | ✅ 内嵌 create | ✅ /job/match/requirements/validate | ✅ | ✅ | — |
| 查看岗位列表 | ✅ index | ✅ /job/match/requirements | ✅ | ✅ | — |
| 触发匹配 | ❌ | ✅ /job/match/batch | ✅ | ❌ | 无页面入口 |
| 查看匹配结果 | ❌ | ✅ /job/match/batch/:id/results | ✅ | ❌ | 无页面 |
| 查看候选人详情 | ❌ | ✅ /job/match/results/:id | ✅ | ❌ | 无页面 |
| AI 面试 | ❌ | ✅ /enterprise/recruitment-interview/* | ✅ | ❌ | 无页面 |
| 招聘决策 | ❌ | ❌ | ❌ | ❌ | 无 |

### 关键发现

**后端 API 完整度远高于前端页面覆盖度。**

后端已实现：
- ✅ 岗位要求 CRUD
- ✅ JD AI 解析/验证
- ✅ 批量匹配触发/查询/结果
- ✅ 匹配证据链
- ✅ AI 解释生成
- ✅ 面试管理
- ✅ 招聘对话
- ✅ 招聘 Campaign

前端仅覆盖：
- ✅ 身份 Gate
- ✅ 入驻引导
- ✅ 创建岗位（AI 解析 + 保存）
- ✅ 岗位列表

**结论：后端能力已具备 80%，前端产品面仅展现 30%。**

---

## D. Reality Debt 清单

### RD-01: `matchCount` 字段断链

**位置:** `recruitment/index.vue:108`
```vue
<div class="job-match-info" v-if="job.matchCount > 0">
```

**问题:** `listRequirements()` 返回的 `JobRequirement` 类型无 `matchCount` 字段。前端永远不显示匹配 badge。

**影响:** 企业看不到每个岗位的匹配人数，招聘驾驶舱缺少核心指标。

**修复方向:** API 返回时联表查询 `COUNT(match_results)` 或新增 `/requirements/:id/stats` 端点。

### RD-02: `pendingReview` 假数据

**位置:** `recruitment/index.vue:160`
```js
const pendingReview = totalCandidates > 0 ? Math.min(totalCandidates, 5) : 0
```

**问题:** 不是真实待审核数，是前端硬算的占位值。

**影响:** 企业看到虚假的"待处理推荐"数字，信任度受损。

**修复方向:** 后端新增 `/job/match/stats` 聚合端点，返回真实统计。

---

## E. 后续优先级

### P5-02 必须项（按优先级排序）

**P5-02-A: 修复 Reality Debt（1-2 天）**
- 修复 `matchCount` 断链
- 修复 `pendingReview` 假数据
- 后端新增聚合统计端点 `/job/match/stats`

**P5-02-B: 招聘驾驶舱升级（2-3 天）**
- 首页从"功能入口"升级为"招聘状态看板"
- 核心指标：岗位数 / 进行中匹配 / 待面试 / 待决策 / 已完成
- 每个数字连接真实 API
- 添加"下一步行动"引导

**P5-02-C: 匹配结果页（2-3 天）**
- 岗位卡片可点击进入匹配结果
- 展示候选人列表（分数 / 技能匹配 / 差距）
- 支持触发新的匹配任务

### P5-03 后置项

- 岗位编辑/暂停/关闭
- AI 面试入口
- 招聘决策面板
- 候选人 Pipeline 管理
- Campaign 发布

### 禁止

- ❌ 新增 Schema
- ❌ 新增营销功能
- ❌ 扩展新产品面
- ❌ 先于 P5-02-A 做 P5-02-C

---

## F. 总结

### 一句话结论

> **后端能力 80%，前端展现 30%，产品价值传递 0%。**

企业进入招聘中心后看到的是一个岗位列表 + 4 个统计卡片，但：
1. 2 个统计数字是假数据/断链
2. 无法看到匹配结果
3. 无法进入面试流程
4. 不知道下一步该做什么

### 产品状态判断

| 维度 | 状态 |
|------|------|
| 架构边界 | ✅ P4 已闭合 |
| API 完整度 | ✅ 80% |
| 前端覆盖度 | ⚠️ 30% |
| 数据真实性 | ❌ 有假数据 |
| 闭环可用性 | ❌ 未贯通 |
| 商业价值传递 | ❌ 无 |

**P5-01 结论: Product Reality FAIL。需要 P5-02 修复。**
