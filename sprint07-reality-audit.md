# Sprint 07 — Reality Audit Report
## 企业招聘工作台用户体验现状审计

**审计日期**: 2026-07-27  
**审计范围**: `/root/shipin-cinematic-studio` 前端 + 后端  
**审计员**: Reality Audit Agent  

---

## 1. 当前状态总结

### 1.1 前端页面现状

企业招聘工作台存在**两套并行系统**，这是本次审计发现的最核心架构问题：

| 系统 | 路由 | 定位 | 数据源 |
|------|------|------|--------|
| **新系统** | `/workspace/recruitment` | AI 招聘部门 | `/api/enterprise/postings` + `/api/enterprise/recruitment-department` |
| **旧系统** | `/workspace/enterprise` | 企业招聘中心 | `/api/enterprise/home` + `/api/enterprise/media-department/agents` |

#### 新系统 (`/workspace/recruitment`) — 功能较完整

**首页 (`index.vue`)** 包含：
- ✅ 身份验证 Gate（企业身份认证）
- ✅ 统计卡片：招聘中岗位、候选匹配、待处理推荐、待面试
- ✅ AI 招聘团队卡片（AgentWorkforceCard）
- ✅ 招聘流程可视化（创建岗位 → AI寻找人才 → 候选人筛选 → AI面试 → 录用决策）
- ✅ 招聘任务中心（岗位列表 + 状态管理）
- ✅ 候选人列表（含 AI 分析/解释匹配/面试准备 按钮）
- ✅ 空状态和错误处理

**子页面**：
- `/workspace/recruitment/jobs/create` — JD 创建（AI 解析 + 手动填写）
- `/workspace/recruitment/matches` — 匹配结果（岗位选择 + 候选列表 + 加入 Pipeline）
- `/workspace/recruitment/pipeline` — Kanban 看板
- `/workspace/recruitment/resumes` — 简历管理（上传 + 解析）
- `/workspace/recruitment/onboarding` — 重定向到企业认证

#### 旧系统 (`/workspace/enterprise`) — 现代企业 SaaS 风格

**首页 (`index.vue`)** 包含：
- ✅ Health Banner（健康状态）
- ✅ 今日概览：今日沟通、今日面试、今日简历、今日 Offer
- ✅ 招聘漏斗（RecruitmentFunnel 组件）
- ✅ 需要处理列表（PendingList 组件）
- ✅ 招聘动态（ActivityFeed 组件）
- ✅ 时间范围切换（今天/本周/本月）
- ✅ 自动刷新（60秒）

### 1.2 后端 API 现状

后端存在**大量重叠的 API 路由文件**，按功能域分类：

| 功能域 | 路由文件 | 核心端点 |
|--------|----------|----------|
| **岗位管理** | `job-posting.routes.ts` | `POST/GET/PUT /api/enterprise/postings` |
| **JD 智能生成** | `enterprise-job-intelligence.routes.ts` | `POST /api/enterprise/jobs/generate`, `POST /api/enterprise/jobs/preview` |
| **候选人管理** | `enterprise.routes.ts` (旧) | `POST /api/enterprise/match`, `GET /api/enterprise/matches` |
| **AI 招聘 Employee** | `recruitment-department.routes.ts` | `GET/POST /api/enterprise/recruitment-department` |
| **招聘流程 Pipeline** | `enterprise-pipeline.routes.ts` | `GET/POST /api/pipeline/kanban` |
| **面试管理** | `recruitment-interview.routes.ts` | `GET/POST /api/enterprise/recruitment-interview` |
| **人才猎聘** | `enterprise-talent-agent.ts` | `POST /api/enterprise/agents/talent/analyze` |
| **面试助手** | `enterprise-interview-agent.ts` | `POST /api/enterprise/agents/interview/generate` |
| **招聘宣发** | `recruitment-campaign.routes.ts` | `/api/enterprise/recruitment-campaign` |
| **沟通会话** | `recruitment-conversation.routes.ts` | `/api/enterprise/recruitment-conversation` |
| **企业首页** | `enterprise-home.ts` | `GET /api/enterprise/home` |
| **AI 员工管理** | `enterprise-agents.ts` | `GET /api/enterprise/media-department/agents` |
| **Agent Runtime** | `enterprise-agent-runtime.ts` | `POST /api/enterprise/agent-profiles/:id/activate` |
| **Intelligence** | `enterprise-intelligence.ts` | `GET /api/enterprise/agents/intelligence/summary` |

### 1.3 AI Employee 架构现状

AI 招聘团队在 `recruitment-department.routes.ts` 中定义了三个核心角色：

```typescript
const RECRUITMENT_AGENT_TYPES = {
  marketing: { shortName: '招聘宣传官', capabilities: ['岗位发布', '社交媒体宣发', '社群运营'] },
  recruiter:  { shortName: 'AI 招聘官',   capabilities: ['人才扫描', '候选人排序', '主动沟通'] },
  interview: { shortName: 'AI 面试官',   capabilities: ['初面', '技术面', '英语测试', '行为面试'] },
}
```

在 `AgentWorkforceCard.vue` 中展示的角色映射：
- `recruiter` → AI 招聘官（带 Copilot 交互区）
- `career_advisor` → AI 招聘经理（带 Intelligence Report）
- `talent_hunter` → AI 猎聘顾问
- `interview_agent` → AI 面试官
- `marketing` → AI 宣传官
- `resume_analyzer` → AI 简历分析师

---

## 2. 发现的问题（按严重程度排序）

### 🔴 P0 — 系统级阻断

#### 问题 1：两套并行系统，用户认知分裂

**现象**：
- `/workspace/recruitment` 和 `/workspace/enterprise` 同时存在
- 两者数据源不同、API 不同、展示逻辑不同
- 用户无法确定应该使用哪个入口

**影响**：
- 用户困惑，不知道哪个是"真正的"招聘工作台
- 维护成本翻倍
- 数据不一致风险

**证据**：
- `RecruitmentShell.vue` 导航指向 `/workspace/enterprise` 路由
- `enterprise/index.vue` 使用 `/api/enterprise/home` 数据
- `recruitment/index.vue` 使用 `/api/enterprise/postings` 数据

#### 问题 2：招聘闭环存在多处断点

**完整闭环**：创建岗位 → AI生成JD → 人才搜索 → 候选匹配 → AI筛选 → AI面试 → 录用建议

**断点分析**：

| 环节 | 状态 | 问题 |
|------|------|------|
| 创建岗位 | ✅ 完整 | `jobs/create.vue` + `POST /api/enterprise/postings` |
| AI生成JD | ⚠️ 部分 | 有 `extractRequirement` 但依赖 `/api/job/match/requirements/validate`，与主流程分离 |
| 人才搜索 | ❌ 缺失 | `searchTalent` API 存在但前端无入口 |
| 候选匹配 | ⚠️ 部分 | `matches/index.vue` 有展示，但触发匹配的入口不清晰 |
| AI筛选 | ⚠️ 部分 | `analyzeCandidate` 在候选人卡片上有，但结果展示简陋 |
| AI面试 | ⚠️ 部分 | `generateInterviewQuestions` 存在，但无完整面试流程页面 |
| 录用建议 | ❌ 缺失 | 无录用决策页面，Pipeline 的 `offer` 阶段无操作入口 |

### 🟡 P1 — 体验严重缺陷

#### 问题 3：首页价值感传达不足

**期望**：首页展示 "我的 AI 招聘团队正在帮我招聘" 的价值感

**实际**：
- 新系统 (`/workspace/recruitment`) 有 "🤖 AI 招聘部门" 标题 + "你的 AI 招聘团队正在协助企业寻找人才" 副标题
- 但统计卡片默认全零，无动态感
- AI 招聘团队卡片在空状态下显示 "暂无 AI 招聘员工"
- 缺少 "今日招聘任务" 的紧迫感展示

#### 问题 4：招聘漏斗数据静态化

**现象**：`RecruitmentFunnel` 组件仅展示传入的 `stages` 数据，无交互

**问题**：
- 漏斗各阶段不可点击下钻
- 无转化率计算和展示
- 无历史趋势对比
- 在 `/workspace/enterprise` 中依赖 `data.funnel`，但 `enterprise-home.repository.ts` 返回的 funnel 数据可能为空

#### 问题 5：AI Employee 展示与实际脱节

**现象**：
- `AgentWorkforceCard` 从 `/api/enterprise/media-department/agents` 获取数据
- 但 `recruitment-department.routes.ts` 从 `enterprise_agent_workforce` 表获取数据
- 两者是不同的数据源，可能导致展示的员工与实际配置不一致

#### 问题 6：BYOK 配置流程冗长

**现象**：AI 员工激活需要：
1. 创建企业 → 2. 配置模型 → 3. 绑定员工 → 4. 激活员工

**问题**：
- 步骤 2-4 分散在不同页面
- 无引导式配置向导
- 用户可能卡在某个环节无法继续

### 🟢 P2 — 体验优化项

#### 问题 7：招聘流程可视化静态

**现象**：`recruitment/index.vue` 中的流程步骤（创建岗位 → AI寻找人才 → ...）仅高亮当前阶段

**缺失**：
- 无进度百分比
- 无预计完成时间
- 无可操作入口（如"继续下一步"）

#### 问题 8：候选人管理分散

**现象**：候选人信息分布在：
- `/workspace/recruitment/index.vue` 的候选人列表
- `/workspace/recruitment/matches/index.vue` 的匹配结果
- `/workspace/recruitment/pipeline.vue` 的 Kanban 卡片

**问题**：无统一候选人详情页，无法查看完整候选人档案

#### 问题 9：面试流程不完整

**现象**：
- `generateInterviewQuestions` API 存在
- 但无面试执行页面（无实时面试 UI）
- 无面试结果录入界面
- `recruitment-interview.routes.ts` 有完整的 InterviewSession 生命周期管理，但前端对接不完整

#### 问题 10：数据刷新机制不一致

**现象**：
- `/workspace/enterprise` 有 60 秒自动刷新
- `/workspace/recruitment` 无自动刷新，需手动操作

---

## 3. 改进建议（按优先级排序）

### 🔴 P0 — 立即修复

#### 建议 1：统一入口，消除双系统

**方案**：
1. 确定 `/workspace/recruitment` 为主入口（功能更完整）
2. 将 `/workspace/enterprise` 重定向到 `/workspace/recruitment`
3. 或反之，将旧系统的 Health Banner 和 Time Switcher 集成到新系统

**预期收益**：消除用户困惑，降低维护成本

#### 建议 2：补齐招聘闭环断点

**需补齐的环节**：
1. **人才搜索**：在 `matches/index.vue` 增加"AI 搜索"按钮，调用 `searchTalent`
2. **触发匹配**：在岗位详情增加"开始匹配"按钮，调用 `triggerBatchMatch`
3. **录用建议**：在 Pipeline 的 `offer` 阶段增加"生成录用建议"操作
4. **面试执行**：创建面试会话页面，对接 `recruitment-interview.routes.ts`

### 🟡 P1 — 本 Sprint 修复

#### 建议 3：首页价值感升级

**具体改动**：
1. 统计卡片增加趋势指示（如 "↑ 3 个新增"）
2. AI 招聘团队卡片默认展示"待激活"状态而非空状态
3. 增加"今日任务"区域：显示待处理候选人、待生成面试、待审核简历
4. 增加快捷操作：一键创建岗位、一键查看匹配

#### 建议 4：招聘漏斗可交互化

**具体改动**：
1. 漏斗各阶段可点击，跳转到对应列表
2. 显示阶段间转化率
3. 空漏斗时显示引导："创建岗位后，漏斗将自动填充"

#### 建议 5：统一 AI Employee 数据源

**方案**：
1. `AgentWorkforceCard` 改为从 `/api/enterprise/recruitment-department` 获取数据
2. 或统一两个数据源的 Schema
3. 确保 `sync-employees` 自动触发

### 🟢 P2 — 后续迭代

#### 建议 6：增加招聘流程引导

**方案**：
1. 在流程可视化区域增加"下一步"按钮
2. 根据当前状态智能推荐操作
3. 增加进度保存和恢复

#### 建议 7：统一候选人视图

**方案**：
1. 创建 `/workspace/recruitment/candidates/:id` 详情页
2. 聚合：基本信息、匹配分析、面试记录、Pipeline 历史
3. 支持快捷操作：发送消息、安排面试、加入 Pipeline

#### 建议 8：完善面试工作流

**方案**：
1. 创建面试会话页面
2. 支持实时问答（WebSocket）
3. 自动评分和总结

---

## 4. Sprint 07 具体实施建议

### Week 1: 统一入口 + 闭环补齐

| 任务 | 优先级 | 预估工时 | 负责 |
|------|--------|----------|------|
| 确定主入口，旧系统重定向 | P0 | 2h | Frontend |
| 人才搜索前端入口 | P0 | 4h | Frontend |
| 触发匹配按钮 | P0 | 3h | Frontend |
| 首页"今日任务"区域 | P1 | 4h | Frontend |
| 统计卡片趋势指示 | P1 | 2h | Frontend |

### Week 2: 体验优化 + 数据统一

| 任务 | 优先级 | 预估工时 | 负责 |
|------|--------|----------|------|
| AI Employee 数据源统一 | P1 | 4h | Full-stack |
| 招聘漏斗可交互化 | P1 | 6h | Frontend |
| 候选人详情页 | P2 | 8h | Frontend |
| 面试执行页面 | P2 | 10h | Full-stack |

### Week 3: 测试 + 打磨

| 任务 | 优先级 | 预估工时 | 负责 |
|------|--------|----------|------|
| 端到端流程测试 | P1 | 4h | QA |
| 空状态和错误处理完善 | P1 | 3h | Frontend |
| 性能优化（自动刷新统一） | P2 | 3h | Frontend |

---

## 5. 架构风险提示

### 5.1 后端路由重叠风险

当前存在以下路由文件功能重叠：
- `enterprise.routes.ts` vs `enterprise-job-intelligence.routes.ts` vs `job-posting.routes.ts`
- `enterprise-agents.ts` vs `recruitment-department.routes.ts`

**建议**：Sprint 08 进行路由合并，减少维护成本。

### 5.2 数据一致性风险

`enterprise_agent_workforce` 与 `enterprise_agent_instance` 之间无 Prisma relation，依赖手动同步（`sync-employees` API）。

**建议**：增加数据库级约束或自动触发同步。

### 5.3 身份验证链路风险

部分路由使用 `app.authenticate`，部分使用 `request.jwtVerify()`，行为可能不一致。

**建议**：统一认证中间件。

---

## 6. 审计结论

企业招聘工作台在 Sprint 06-08 期间已经建立了**完整的基础设施**：
- ✅ 前端页面骨架完整
- ✅ 后端 API 覆盖全面
- ✅ AI Employee 架构设计合理
- ✅ 数据模型设计完善

**核心问题**是"最后一公里"的连通性：
1. 双系统并行导致用户分裂
2. 招聘闭环存在 3 个断点（人才搜索、触发匹配、录用建议）
3. 首页价值感不足，默认空状态
4. AI Employee 展示与实际数据源不一致

**Sprint 07 应聚焦于**：
1. **统一入口**（1-2 天）
2. **补齐闭环**（3-5 天）
3. **首页价值感升级**（2-3 天）

完成以上工作后，企业招聘工作台将具备**可演示的端到端体验**。

---

*报告生成时间: 2026-07-27 21:50 CST*  
*审计工具: Clawdbot Subagent Reality Audit*
