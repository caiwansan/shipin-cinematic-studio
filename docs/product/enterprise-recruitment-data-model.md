# 企业招聘工作台 — 数据模型基线

## 业务实体映射

| 业务实体 | 当前 Prisma 模型 | 是否存在 | 是否活跃 | 缺口 | 备注 |
|---|---|---:|---|---|---|
| Enterprise | EnterpriseProfile | ✅ 是 | ✅ 是 | - | 主企业表 |
| EnterpriseWorkspace | EnterpriseJobWorkspace | ✅ 是 | ✅ 是 | - | 招聘工作区 |
| OnboardingState | EnterpriseOnboardingState | ✅ 是 | ✅ 是 | - | Onboarding 状态 |
| Job | Job | ✅ 是 | ✅ 是 | - | 职位主表 |
| Resume | ❌ | ❌ 否 | ❌ 否 | 🔴 缺失 | 需新建模型 |
| Candidate | ❌ | ❌ 否 | ❌ 否 | 🔴 缺失 | 需新建模型 |
| PipelineStage | PipelineStage | ✅ 是 | ✅ 是 | - | 管道阶段 |
| PipelineEvent | ❌ | ❌ 否 | ❌ 否 | 🟡 缺失 | 需新建模型 |
| Interview | ❌ | ❌ 否 | ❌ 否 | 🔴 缺失 | 需新建模型 |
| InterviewNote | ❌ | ❌ 否 | ❌ 否 | 🟡 缺失 | 需新建模型 |
| InterviewDecision | ❌ | ❌ 否 | ❌ 否 | 🟡 缺失 | 需新建模型 |
| Offer | ❌ | ❌ 否 | ❌ 否 | 🟡 缺失 | 需新建模型 |
| TalentPool | ❌ | ❌ 否 | ❌ 否 | 🟡 缺失 | 下一阶段 |
| TalentTag | ❌ | ❌ 否 | ❌ 否 | 🟡 缺失 | 下一阶段 |
| Activity | ❌ | ❌ 否 | ❌ 否 | 🟡 缺失 | 需新建模型 |
| AIEmployee | ❌ | ❌ 否 | ❌ 否 | 🟡 缺失 | 规划中 |
| Subscription | Subscription / EnterpriseSubscription | ✅ 是 | ✅ 是 | - | 订阅管理 |
| Billing | BillingRecord | ✅ 是 | ✅ 是 | - | 账单记录 |

## 统计

| 类别 | 数量 |
|---|---|
| 已覆盖实体 | 10 |
| 缺失实体 | 10 |
| 待确认实体 | 0 |
| 覆盖率 | 50% |

## 已有企业相关模型清单

| 模型 | 行号 | 用途 |
|---|---|---|
| EnterpriseProfile | 2853 | 企业档案 |
| EnterprisePlan | 2893 | 企业套餐 |
| EnterpriseSubscription | 2922 | 企业订阅 |
| EnterpriseLlmConfig | 6561 | 企业LLM配置 |
| EnterpriseAgentProfile | 6584 | 企业Agent配置 |
| EnterpriseAgentInstance | 6622 | 企业Agent实例 |
| EnterpriseAgentTask | 6660 | 企业Agent任务 |
| EnterpriseChannelProvider | 6702 | 渠道提供商 |
| EnterpriseCommand | 6718 | 企业命令 |
| EnterpriseKnowledge | 6738 | 企业知识库 |
| EnterpriseLeadIntelligence | 6870 | 线索智能 |
| EnterpriseRoiSnapshot | 6905 | ROI快照 |
| EnterpriseOperationEvent | 6935 | 运营事件 |
| EnterpriseSignal | 6954 | 信号 |
| EnterpriseRecommendation | 6975 | 推荐 |
| EnterpriseAction | 7013 | 行动 |
| EnterpriseOutcome | 7068 | 结果 |
| EnterpriseDecisionFeedback | 7111 | 决策反馈 |
| EnterpriseChannelAccount | 7136 | 渠道账户 |
| EnterpriseInteraction | 7172 | 互动 |
| EnterpriseChannelSyncLog | 7217 | 渠道同步日志 |
| JobCompanyProfile | 7423 | 企业招聘档案 |
| EnterpriseJobWorkspace | 7436 | 招聘工作区 |
| EnterpriseOnboardingState | 7450 | Onboarding状态 |
| EnterpriseAgentWorkforce | 7469 | Agent劳动力 |
| EnterpriseRecruitmentNeeds | 7493 | 招聘需求 |
| PipelineStage | 2434 | 管道阶段 |
| PipelineJob | 2456 | 管道职位 |
| Job | 2627 | 职位 |
| JobQueue | 2714 | 职位队列 |
| SubscriptionPlan | 5351 | 订阅计划 |
| Subscription | 5372 | 订阅 |
| BillingRecord | 5444 | 账单记录 |

## 缺失模型优先级

| 优先级 | 模型 | 影响 |
|---|---|---|
| P0 | Resume | Resume Center 无法存储 |
| P0 | Candidate | Pipeline 无法关联候选人 |
| P1 | Interview | Interview 模块无法存储 |
| P1 | PipelineEvent | Pipeline 无事件追踪 |
| P2 | Offer | 下一阶段 |
| P2 | TalentPool | 下一阶段 |
| P2 | TalentTag | 下一阶段 |
| P2 | Activity | Dashboard 活动流 |
| P2 | AIEmployee | 规划中 |
