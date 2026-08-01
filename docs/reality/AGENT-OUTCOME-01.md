# SPRINT-AGENT-OUTCOME-01 统一 Agent Outcome Layer — COMPLETE ✅

**Date:** 2026-08-01 19:10
**Gate:** 掌柜战略指令（能力层/执行层/商业层/成本层已齐，缺价值层 → 老板问「花的钱产生什么」）

## 定位

不是简单日志表。是昆仑镜**价值层 SSOT**：所有 AI 员工业务结果统一写入 `agent_outcome`，禁止 Workspace 自建结果表（RecruitmentOutcome / CareerOutcome / HDZOutcome 全禁止）。

```
能力层 Agent → 执行层 Runtime → 商业层 Subscription → 成本层 usage_logs → 价值层 agent_outcome ✅
```

## T01 安全基线文档（掌柜附带指令）

- 新增 `docs/security/KMKI-SECURITY-BASELINE.md`：KMKI 三大安全基石（Identity/Commerce/Runtime Authority）
- Identity Authority 冻结：User Token 禁止直通 Admin API；verifyToken 必须校验 isAdmin===true；requireAdmin 为后台默认鉴权
- 收录 PAYMENT-SECURITY-01 审计结论 + 支付成功唯一来源冻结 + BYOK 重申 + Outcome 统一价值层原则

## T02 agent_outcome 统一表

```sql
agent_outcome: id / organization_id / user_id / agent_instance_id /
  workspace(varchar50) / outcome_type(varchar80) / source_execution_id /
  metric_value(float default 1) / metadata(jsonb) / created_at
索引: organization_id+created_at / user_id+created_at / workspace+outcome_type / source_execution_id
```

- `outcome-registry.service.ts`：record()（类型注册表校验防 typo + sourceExecutionId 幂等防重放）+ summarize() + listByOrganization()
- 结果登记失败不阻断业务主流程（尽力而为）

## T03 真实埋点（6 个执行完成点，全部真实结果）

| 业务线 | 埋点位置 | Outcome 类型 |
|--------|----------|--------------|
| 招聘 | 渠道导入成功 | CANDIDATE_RECEIVED |
| 招聘 | AI 评价真实生成（BYOK） | EVALUATION_GENERATED |
| 招聘 | 状态→screening | CANDIDATE_SCREENED |
| 招聘 | 状态→interviewing | INTERVIEW_CREATED |
| 招聘 | 状态→hired | HIRING_RECOMMENDATION |
| 求职 | career workflow 完成（5 类映射） | JOB_MATCH_GENERATED / INTERVIEW_SIMULATION_COMPLETED / CAREER_PLAN_CREATED / SKILL_GAP_ANALYZED / SALARY_GUIDE_GENERATED |
| 求职 | 自治任务完成 | CAREER_TASK_COMPLETED |
| 求职 | /api/career/planning 成功 | CAREER_PLAN_CREATED |

不修改 Runtime 链路：执行/成本链路原样，Outcome 只在业务动作完成点登记。

## T04 CEO 罗盘 AI 员工价值中心

- 新端点 `GET /api/admin/dashboard/outcomes?days=`：真实结果聚合（workspace×outcomeType）+ 真实成本（usage_logs 按业务线归因）+ 最近 20 条明细
- ecosystem 端点同步返回 outcomes（生态地图联动）
- 新组件 `AiOutcomeValueCard.vue`：按业务线分组展示结果计数 + 真实调用成本
- **ROI 冻结：禁止估算/Mock**——ROI 待企业价值参数（如 HR 小时成本）真实配置后启用，当前仅展示真实结果与真实成本（页面明确标注）

## T05 Reality Gate（生产域实测）

| 验收项 | 结果 |
|--------|------|
| 真实渠道导入（demo 企业 BYOK deepseek-reasoner） | ✅ success + aiGenerated:true（3.8s 真实 LLM） |
| 状态流转 screening → interviewing | ✅ 均成功 |
| Career interview_prep workflow 真实执行 | ✅ status:completed |
| agent_outcome 落库 | ✅ recruitment 4 类 + career 1 类，source_execution_id 全有 |
| 罗盘聚合端点 | ✅ outcomes 分组正确，成本真实（recruitment $0.0444 / career $0.0060） |
| 浏览器生产域 | ✅ 价值中心渲染：求职管家(模拟面试 1) + 招聘(4 类结果)，ROI 诚实标注 |
| 前端 build + asset-sync + 重启 | ✅ dashboard 200 |

截图：`AGENT-OUTCOME-01-dashboard.png`
提交：待填

## 治理规则（冻结）

1. 结果表唯一入口 = agent_outcome；Workspace 自建结果表 = 架构违规
2. Outcome 数据必须来自真实执行完成点；禁止估算/Mock/手工伪造 ROI
3. ROI 公式可扩展但参数必须真实（企业自设价值参数，未配不展示）
4. 埋点方式 = 业务动作完成点调用 outcomeRegistry.record（不侵入 Runtime 链路）

## 遗留

⏸ 短剧 workspace outcome 类型已注册（SCRIPT_ANALYZED 等）未埋点（等业务指令）
⏸ 企业价值参数配置界面（HR 小时成本等）→ ROI 启用前置
