# ER-02 审计阶段报告
## AI Employee Profile Experience — 执行前审计

**Date**: 2026-07-17
**Author**: OpenClaw (AI CTO Office)
**Status**: 等待 CTO Review

---

# 审计 1：当前 Employee 数据模型审计

## 1.1 核心模型 — EnterpriseAgentProfile

| 字段 | 类型 | 用途 | Profile 相关性 |
| --- | --- | --- | --- |
| id | UUID | 主键 | ✅ 身份标识 |
| name | String(100) | 员工名称 | ✅ 身份 |
| avatarUrl | String? | 头像 URL | ✅ 身份 |
| description | String? | 描述 | ✅ 身份 |
| role | String(100) | 角色 | ✅ 职责 |
| agentType | String(50) | 类型 | ✅ 分类 |
| goal | String? | 目标 | ✅ 职责 |
| knowledgeScope | String(JSON) | 知识范围 | ✅ 知识库 |
| tools | String(JSON) | 工具列表 | ✅ 工具权限 |
| permissions | String(JSON) | 权限列表 | ✅ 工具权限 |
| capabilities | String(JSON) | 能力列表 | ✅ 技能 |
| kpiMetrics | String(JSON) | KPI 指标 | ✅ 贡献趋势 |
| escalationRules | String? | 升级规则 | ⚪ 未来 |
| status | String(20) | 状态 | ✅ 状态 |
| dailyTarget | Int? | 每日目标 | ✅ 今日工作 |
| workingHours | String? | 工作时间 | ✅ 工作配置 |
| managerNote | String? | CEO 指令 | ✅ CEO 指令 |
| runtimeType | String | 运行时类型 | ⚪ 技术 |
| runtimeAgentId | String? | 运行时 ID | ⚪ 技术 |
| runtimeStatus | String | 运行时状态 | ✅ 状态 |
| lastExecutionAt | DateTime? | 最后执行 | ✅ 活跃时间 |
| version | Int | 版本号 | ✅ 成长记录 |
| metadata | String(JSON) | 元数据 | ⚪ 扩展 |

## 1.2 关联模型

| 模型 | 关系 | Profile 用途 |
| --- | --- | --- |
| AgentAuditTrail | 1:N | 执行历史、成本统计 |
| AgentSchedule | 1:N | 定时任务配置 |
| AgentGoal | 1:N | 每日目标追踪 |
| AgentExecutionLog | N:1 | 执行日志 |
| EnterpriseAgentInstance | 1:1 | 运行时实例 |
| AgentModelBinding | 1:N | 模型绑定 |
| OutcomeRecord | agentId | 成果记录 |
| ImpactMeasurement | via Outcome | 业务价值 |

## 1.3 数据模型审计结论

**已有字段覆盖度**: 85%

| Profile 需求 | 已有字段 | 缺口 |
| --- | --- | --- |
| 身份 (名称/头像/描述) | name, avatarUrl, description | ❌ 无个性签名 |
| 职责 (角色/目标) | role, goal, agentType | ✅ 完整 |
| 技能 (能力列表) | capabilities | ✅ 完整 |
| 知识库 | knowledgeScope | ✅ 完整 |
| 工具权限 | tools, permissions | ✅ 完整 |
| 今日工作 | dailyTarget, kpiMetrics | ✅ 完整 |
| 历史成果 | OutcomeRecord 关联 | ✅ 完整 |
| 贡献趋势 | kpiMetrics (JSON) | ⚠️ 需时间序列化 |
| CEO 指令 | managerNote | ✅ 完整 |
| 成长记录 | version, createdAt | ⚠️ 需变更历史 |

**需新增字段 (2)**:
| 字段 | 类型 | 用途 |
| --- | --- | --- |
| bio | String? | 个性签名/自我介绍 |
| personality | String? | 性格标签 (JSON) |

---

# 审计 2：现有 AI Employee 页面审计

## 2.1 页面清单

| 页面/组件 | 路径 | 功能 | 局限 |
| --- | --- | --- | --- |
| EmployeeCard.vue | components/enterprise/ | Dashboard 员工卡片 | 仅展示今日，无深度 |
| EmployeeCardAdapter.vue | dashboard/ | 数据适配桥接 | 仅适配，无独立 UI |
| AgentCard.vue | workspace/ | 员工列表卡片 | 仅状态+健康+操作 |
| AgentDetailPanel.vue | workspace/ | 详情滑出面板 | 滑出式，非独立页面 |
| AIEmployeeConfig.vue | workspace/ | 员工管理中心 | 管理视角，非 Profile |
| EmployeesModule.vue | modules/ | 模块包装 | 仅包装 AIEmployeeConfig |

## 2.2 当前 CEO 点击路径

```
Dashboard → EmployeeCard → 无点击路径
                          → 无法查看 Profile

EmployeesModule → AgentCard → click → AgentDetailPanel (slide-over)
                            → 展示: Runtime + Health + Model + Channel + Timeline
                            → 缺失: 身份主页、贡献趋势、成长记录
```

## 2.3 页面审计结论

**核心问题**: 当前没有独立的 AI Employee Profile 页面。

- AgentDetailPanel 是 slide-over 面板，信息密度有限
- 没有"员工主页"的概念
- CEO 无法深度了解单个 AI 员工
- 没有贡献趋势可视化
- 没有成长记录时间线

---

# 审计 3：Profile 信息缺口分析

## 3.1 CTO 要求的 Profile 信息 vs 现有

| Profile 模块 | CTO 要求 | 现有实现 | 缺口 |
| --- | --- | --- | --- |
| 身份 | 名称/头像/描述 | name, avatarUrl, description | 无个性签名 |
| 职责 | 角色/目标 | role, goal | ✅ 完整 |
| 技能 | 能力列表 | capabilities | ✅ 完整 |
| 知识库 | 知识范围 | knowledgeScope | ⚠️ 仅存储，无展示 |
| 工具权限 | 工具+权限 | tools, permissions | ⚠️ 仅存储，无展示 |
| 今日工作 | 当日任务 | dailyTarget, kpiMetrics | ✅ 有数据 |
| 历史成果 | 累计成果 | OutcomeRecord 关联 | ⚠️ 无聚合展示 |
| 贡献趋势 | 时间序列 | kpiMetrics (JSON) | ❌ 无趋势数据 |
| CEO 指令 | 工作指令 | managerNote | ✅ 有数据 |
| 成长记录 | 版本/变更 | version | ❌ 无变更历史 |

## 3.2 信息缺口优先级

### P0 (必须 — Profile 核心)
1. **Profile 页面容器** — 独立路由 + 布局
2. **身份展示区** — 头像 + 名称 + 角色 + 状态 + 签名
3. **职责说明** — 目标 + 责任描述
4. **技能标签** — 能力可视化
5. **今日工作摘要** — 当日任务 + 完成度

### P1 (重要 — Profile 深度)
6. **历史成果列表** — OutcomeRecord 聚合
7. **贡献趋势图** — 时间序列 KPI
8. **CEO 指令面板** — managerNote 编辑
9. **知识库视图** — knowledgeScope 展示
10. **工具权限视图** — tools + permissions 展示

### P2 (增强 — Profile 体验)
11. **成长记录** — 版本变更时间线
12. **执行日志** — AgentAuditTrail 最近记录
13. **关联模型** — 绑定的模型信息

---

# 审计 4：ER-02 实施计划

## 4.1 目标

> 把单个 AI 员工产品化
> 从: 员工卡片
> 升级: AI 员工主页

## 4.2 产品形态

```
CEO 点击: 销售增长官
  ↓
┌──────────────────────────────────────────────┐
│  🤖 销售增长官                     [运行中]   │
│  负责企业业务增长                              │
│  "专注高价值客户发现与转化"                     │
├──────────────────────────────────────────────┤
│ 📋 职责                                      │
│ 目标: 每月发现 200 个高价值客户                │
│ 角色: 增长总监                                │
├──────────────────────────────────────────────┤
│ 🎯 技能                                      │
│ [销售] [谈判] [CRM] [分析] [报告]             │
├──────────────────────────────────────────────┤
│ 📚 知识库                                    │
│ [产品知识] [客户画像] [竞品分析] [销售话术]    │
├──────────────────────────────────────────────┤
│ 🔧 工具权限                                  │
│ [CRM读写] [客户分析] [方案生成] [渠道发布]     │
├──────────────────────────────────────────────┤
│ 📈 贡献趋势                                   │
│  ▁▂▃▅▇▅▃▂▁▂▃▅▇▆▇▅▃▂▁                      │
│  近 7 天完成任务量                            │
├──────────────────────────────────────────────┤
│ 🏆 历史成果                                   │
│ ✓ 发现高价值客户 18 个                        │
│ ✓ 生成方案 5 份                               │
│ ✓ 潜在价值 ¥50,000                            │
├──────────────────────────────────────────────┤
│ 💬 CEO 指令                                   │
│ [给AI员工的工作指令...]            [保存]     │
├──────────────────────────────────────────────┤
│ 📜 成长记录                                   │
│ v1 → v2: 增加 CRM 工具                       │
│ v2 → v3: 更新销售话术库                       │
└──────────────────────────────────────────────┘
```

## 4.3 实施任务分解

### ER-02-TASK-01: Profile Foundation

**目标**: 创建 Profile 页面骨架 + 身份/职责/技能展示

| 操作 | 文件 | 说明 |
| --- | --- | --- |
| 新增 | `pages/enterprise/agent-profile.vue` | Profile 页面 (路由入口) |
| 新增 | `components/enterprise/profile/AgentProfileHeader.vue` | 身份区 (头像+名称+状态+签名) |
| 新增 | `components/enterprise/profile/AgentResponsibility.vue` | 职责区 (目标+角色) |
| 新增 | `components/enterprise/profile/AgentSkills.vue` | 技能标签 |
| 新增 | `components/enterprise/profile/AgentKnowledge.vue` | 知识库标签 |
| 新增 | `components/enterprise/profile/AgentTools.vue` | 工具权限标签 |
| 修改 | `EmployeeCard.vue` | 添加点击 → 跳转 Profile |
| 修改 | `AgentCard.vue` | 添加点击 → 跳转 Profile |
| 新增 | `backend: GET /api/enterprise/agent-profiles/:id/profile` | Profile 聚合 API |

### ER-02-TASK-02: Profile Depth

**目标**: 贡献趋势 + 历史成果 + CEO 指令

| 操作 | 文件 | 说明 |
| --- | --- | --- |
| 新增 | `components/enterprise/profile/AgentContributionTrend.vue` | 贡献趋势图 |
| 新增 | `components/enterprise/profile/AgentOutcomes.vue` | 历史成果列表 |
| 新增 | `components/enterprise/profile/AgentCEOInstruction.vue` | CEO 指令面板 |
| 新增 | `components/enterprise/profile/AgentGrowthLog.vue` | 成长记录时间线 |
| 修改 | `enterprise-agent-profile.service.ts` | 新增 profile 聚合方法 |

### ER-02-TASK-03: Profile Integration

**目标**: 集成到 Dashboard + 员工列表

| 操作 | 文件 | 说明 |
| --- | --- | --- |
| 修改 | `DashboardModule.vue` | EmployeeCard 点击 → Profile |
| 修改 | `AIEmployeeConfig.vue` | AgentCard 点击 → Profile |
| 修改 | `AgentDetailPanel.vue` | 添加"查看完整资料"按钮 |
| 新增 | Profile 路由注册 | `/enterprise/agent/:id` |

## 4.4 技术约束

- ✅ 无新增 Agent
- ✅ 无新增 Schema (仅新增 2 个可选字段)
- ✅ Identity Boundary 保持 (JWT → organizationId)
- ✅ 复用已有 4 个数据源 + OutcomeRecord
- ✅ Adapter 模式保持

## 4.5 数据链路

```
JWT
  ↓
getOrganizationIdForUser()
  ↓
organizationId
  ↓
GET /api/enterprise/agent-profiles/:id/profile
  ↓
EnterpriseAgentProfile (organizationId filter)
  ↓
AgentAuditTrail (agentId, last 7 days)
  ↓
OutcomeRecord (agentId, last 30 days)
  ↓
AgentGoal (agentId, last 7 days)
  ↓
Profile Page
```

## 4.6 路由设计

```
当前: /enterprise?module=ai-employees → AIEmployeeConfig
新增:  /enterprise/agent/:id → AgentProfilePage

点击流:
Dashboard → EmployeeCard → navigateTo(`/enterprise/agent/${agentId}`)
EmployeesModule → AgentCard → navigateTo(`/enterprise/agent/${agentId}`)
```

## 4.7 预计工作量

| Task | 新增文件 | 修改文件 | 预计行数 |
| --- | --- | --- | --- |
| TASK-01 | 7 | 2 | ~800 |
| TASK-02 | 4 | 1 | ~600 |
| TASK-03 | 0 | 4 | ~200 |
| **合计** | **11** | **7** | **~1600** |

---

# 总结

## 审计结论

1. **数据模型成熟度**: 高 (85% 字段已存在)
2. **UI 成熟度**: 中 (有卡片+面板，无独立 Profile 页面)
3. **信息缺口**: 贡献趋势、成长记录、Profile 页面容器
4. **技术风险**: 低 (复用已有架构模式)

## ER-02 执行就绪

- ✅ 数据模型审计完成
- ✅ 现有页面审计完成
- ✅ 信息缺口分析完成
- ✅ 实施计划完成

**等待 CTO Review 后开始 ER-02-TASK-01 开发。**

---

*OpenClaw — Enterprise Engineering*
*ER-02 Audit: Complete — Awaiting CTO Review*
