# RELEASE-01 — Enterprise Recruitment v1.0 Production Release

> 状态: IN PROGRESS
> 决策: 从「建设模式」切换到「运营模式」
> 原则: 发布，不扩展

---

## Task 1 — Release Candidate Freeze ✅

### 冻结清单: `enterprise-recruitment-v1.0`

**Frontend (已冻结):**

| 文件 | 提交 | 冻结版本 |
|------|------|---------|
| `layouts/enterprise.vue` | `a54c80b1` | Locked |
| `components/enterprise/workspace/modules/RecruitmentModule.vue` | `a54c80b1` | Locked |
| `components/enterprise/AiTeamDisplay.vue` | `a54c80b1` | Locked |
| `components/enterprise/TodayTasks.vue` | `a54c80b1` | Locked |
| `components/recruitment/RecruitmentShell.vue` | `a54c80b1` | Locked |
| `assets/styles/recruitment-tokens.css` | `a54c80b1` | Locked |

**Backend Routes (已冻结):**

| 路由 | 状态 |
|------|------|
| `/api/enterprise/jobs/*` | Locked |
| `/api/enterprise/candidates/*` | Locked |
| `/api/enterprise/pipeline/*` | Locked |
| `/api/enterprise/agents/*` | Locked |
| `/api/enterprise/recruitment/*` | Locked |
| `/api/identity/context` | Locked |

**Schema (已冻结):**

| Schema | 状态 |
|--------|------|
| Prisma schema | Locked |

### 当前 Build

| 组件 | 版本 |
|------|------|
| Frontend Build | `v0.2.0-c1-27-ga54c80b1` |
| Mode | SPA |
| Assets | 484 (hash: 76a1097310e9e25e) |

---

## Task 2 — Production Smoke Test Checklist

### 用户入口测试

| 测试点 | 期望 | 状态 |
|--------|------|------|
| `/workspace/enterprise` 加载 | 企业身份显示 | ⏳ |
| 企业名称显示 | 昆仑镜科技 | ⏳ |
| 招聘首页加载 | RecruitmentModule 渲染 | ⏳ |
| AI 团队展示 | 3个Agent卡片 + 状态 | ⏳ |
| 岗位列表显示 | 在招岗位展示 | ⏳ |
| 候选人列表 | 候选人数据 | ⏳ |
| Pipeline 流程 | 岗位→匹配→候选人→待处理→Offer | ⏳ |
| 创建岗位操作 | 跳转 /jobs path (回recruitment模块) | ⏳ |
| 空态引导 | 三步引导文案 | ⏳ |

### API 端点测试

| 端点 | 延迟期望 | 状态码期望 | 状态 |
|------|---------|-----------|------|
| `/api/identity/context` | < 200ms | 200 | ⏳ |
| `/api/enterprise/jobs` | < 500ms | 200 | ⏳ |
| `/api/enterprise/candidates` | < 500ms | 200 | ⏳ |
| `/api/enterprise/pipeline` | < 500ms | 200 | ⏳ |
| `/api/enterprise/agents` | < 500ms | 200 | ⏳ |

---

## Task 3 — Monitoring Window

### 上线后观察: 24-48 小时

**P0 告警 (需立即介入):**

```
- 500 error rate > 0%
- 403/401 abnormal spike
- Identity context 获取失败
- Workspace boundary 被突破
- 模块切换导致页面空白
```

**P1 告警 (1小时内处理):**

```
- Agent Runtime timeout > 5%
- API latency > 1000ms
- Frontend hydration error
- 认证重定向异常
```

**P2 告警 (下一个上线窗口):**

```
- Chunk 加载过慢 (> 3s)
- 非关键 API 超时
- Token 刷新异常
```

---

## Task 4 — 暂缓登记

### 🟡 FRONTEND-ROUTING-REALITY-AUDIT (下一 Sprint)

**问题:**
- `layouts/enterprise.vue` 模块系统覆盖 Nuxt Pages
- 17个 `pages/workspace/enterprise/*.vue` 文件为死代码
- Nuxt Router 与 Enterprise Module Router 双轨并行

**当前缓解:**
- TASK-UX-02 已修复 recruitment 子路径 fallback
- 用户路径已闭环

**目标:**
统一路由系统，减少死代码和创新导致的隐藏跳转。

### 🟡 AgentWorkforceCard 重构 (P2)

**现状:**
```
1109 lines
56% CSS (620 lines)
40 v-if branches
```

**风险定级:** 维护性债务，非线上风险

**建议方案:**
```
AgentWorkforceCard
├── AgentIdentity.vue
├── AgentStatus.vue
├── AgentMetrics.vue
├── AgentActions.vue
└── AgentReport.vue
```

保持 props/API 不变。

---

## 发布决策日志

```
日期:      2026-07-28
决策者:    掌柜 + 技术总监
决策:      ✅ 推进 v1.0 Production Release
原则:      发布，不扩展
下一步:    切换到运营模式，跟踪真实用户行为
暂缓:     Routing 治理 + AgentWorkforceCard 重构 (后置)
```

---

## 历史记录 — 完整交付链路

| Sprint | 交付 | 状态 |
|--------|------|------|
| P4 招聘智能化 | AI 招聘 Agent 框架 | ✅ |
| P5 商业化验证 | 企业级招聘工作流 | ✅ |
| SSOT身份治理 | Identity 对齐 | ✅ |
| Schema Cleanup | Prisma 清理 | ✅ |
| API Consolidation | API 收口 | ✅ |
| TASK-UX-01 | UI 产品化 (RecruitmentModule) | ✅ |
| TASK-UX-02 | 稳定性 Gate (验证 + 文档) | ✅ |
| RELEASE-01 | **生产发布** | ▶️ **当前** |
