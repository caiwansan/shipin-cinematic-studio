# ADMIN-IA-REALITY-05-B — Agent 域 SSOT 审计报告

**Date:** 2026-08-01
**Gate:** 掌柜指令（05-B 数据库审计：确认 AgentProfile/AgentInstance/Capability/Entitlement/Runtime/Usage/Memory 是否真正 SSOT）

---

## 1. 审计结论（TL;DR）

**✅ 企业 AI 员工体系（EnterpriseAgent*）是唯一活跃 SSOT，数据真实。**
**❌ 但存在 3 套 Agent 体系并存 + 1 个后台事故（引用不存在表）。**

---

## 2. 三套 Agent 体系全景

| # | 体系 | 模型 | 表 | 数据量 | 服务引用 | 判定 |
|---|------|------|-----|--------|----------|------|
| 1 | 旧图引擎 | AgentDef/AgentEdge/AgentExecution/AgentPlan/MarketAgent/AgentLevelConfig | agent_def / agent_plan / agent_level_config **全部不存在** | 0 | aigc-orchestrator、workflow-executor、**admin-agents.ts（事故）** | 🔴 死体系，但被后台错误引用 |
| 2 | GEO 自建 | AgentDefinition/AgentSession/AgentStepExecution/AgentEvent/AgentContextMemory | agent_definition = **0 条** | 0 | geo-registry、research.agent、entity.agent | 🟠 空壳未落地，违反「Agent 不是 Workspace 资产」 |
| 3 | **企业 AI 员工** | EnterpriseAgentProfile/Instance + HermesProfileBinding + AgentModelBinding + EnterpriseAgentTask | 13 / 9 / 14 / 0 / 30 | 活跃 | enterprise-agents.ts、career-activation.ts、admin-recruitment.ts、recruitment-department | ✅ **唯一 SSOT** |

---

## 3. SSOT 域逐项审计

### 3.1 Identity ✅
- enterprise_agent_profile：**13 条**（active runtime 6 + draft 7）
- enterprise_agent_instance：**9 条**（lifecycleState 状态机 + runtime=openclaw + namespace）
- hermes_profile_binding：**14 条**（一个员工 = 一个 Hermes 子代理身份，soulMd/toolAllowList/memoryNamespace）
- 真实员工样例：招聘顾问 Alice / 面试专家 Bob / 人才分析师 Carol / 用户的AI职业助理 / 热点分析师小镜 / AI 猎聘顾问
- ⚠️ 发现：6 个 active 员工有 2 个带测试性质（Test Agent、reality_test 前缀）→ 05-C 需清理或标测试

### 3.2 Capability ✅（代码注册制）
- capability-registry：代码注册（CapabilityContract 模型在 schema，**表未迁移但不需要**——纯内存注册表）
- governance_capability_grant：**77 条**（套餐 → capability code 授权，真实）
- ⚠️ capability_contract 表不存在 = 正常（注册制），但 schema 里有模型 → 文档需注明避免误迁移

### 3.3 Entitlement ⚠️
- governance_capability_grant 77 条 ✅（主链路）
- enterprise_entitlement：**仅 1 条** ← 与已知架构债同源（生产订阅挂在断裂 org id 52f4e88b，多数企业无权益解析）
- require-enterprise-capability 中间件 + quota.service 已接 Entitlement，但数据断裂 → **05-C 前需先修 org 链路或明确降级策略**
- 治理项 A2：企业权益解析（entitlement 断裂）——建议并入既存「org 解析三套体系」架构债，05-C 不阻塞但页面需诚实显示

### 3.4 Runtime ✅
- enterprise_agent_task：**30 条真实**（generate_reply 11 / profile_extraction 11 / career_activation 4 / interview_recommendation 1 / matching_report 1；成功 19 / 失败 9；avg cost ~¥0.001）
- usage_logs：enterprise_agent_* taskType **29 条**（与数据罗盘「招聘 29 调用」吻合 ✅）
- instance.lifecycleState：ACTIVE/PAUSED/STOPPED/EMERGENCY_STOP/RECOVERING 状态机（Hardening-01）

### 3.5 Usage ✅
- EnterpriseAgentTask 字段完备：agentInstanceId/taskType/status/tokenInput/tokenOutput/cost/durationMs/startedAt/completedAt → **Tab4 运行状态直接数据源**
- agent_audit_trail：**2074 条**（全量审计，价值分析可复用）
- agent_schedule 10 / agent_goal 35（目标与日程真实存在）

### 3.6 Model Policy 🔴
- agent_model_binding：**0 条**
- employee_model_binding：**0 条**
- **结论：AI 员工六要素中 Model Policy 完全未落地**（员工靠默认配置跑）→ 治理项 A1（05-C 前必须落地或全部降级 draft）

### 3.7 Memory ✅（Namespace 层）
- instance.namespace：tenant_<id>_<role>
- hermes_profile_binding.memory_namespace：tenant/{tenantId}/agent/{agentInstanceId}
- 双 namespace 并存但语义一致（实例层 + 绑定层）→ 05-C 统一展示用绑定层

---

## 4. 事故清单（05-C 必修）

| # | 事故 | 位置 | 影响 |
|---|------|------|------|
| E1 | /api/admin/agents 4 端点引用**不存在的 agent_def 表** | backend/src/routes/admin-agents.ts | 后台 AI Agent 管理页打开必炸 |
| E2 | agent_plan/agent_level_config 表不存在但 agent-plan.ts 引用 | backend/src/routes/agent-plan.ts | /api/admin/agent-plans 必炸 |
| E3 | 前端 agents.vue 消费 /api/admin/agents | frontend/pages/admin/aigc/agents.vue | Tab1 现状 = 死页面 |
| E4 | enterprise_entitlement 仅 1 条 | 全链路 | 多数企业能力判定断裂（架构债同源） |

---

## 5. 数据源绑定（05-C 页面设计依据）

| 页面元素 | 唯一数据源 | 现状 |
|----------|-----------|------|
| 员工列表 | enterprise_agent_profile + instance | ✅ 13/9 |
| 运行状态 | enterprise_agent_task + usage_logs | ✅ 30/29 |
| 能力中心 | capability-registry + governance_capability_grant | ✅ 77 |
| 模板中心 | **新建 AgentTemplate 表**（05-C 建） | ⚠️ 无 |
| 成本价值 | Task.cost + usage_logs + 价值模型 | ⚠️ 待定义 |

---

## 6. 冻结动作

1. admin-agents.ts / agent-plan.ts 补 DEPRECATED 标记（禁引用死表），05-C 重写
2. GEO AgentDefinition 体系冻结（表空壳，代码保留待迁移）
3. Model Policy 落地为 05-C 前置 Gate（A1）
4. Entitlement 断裂并入「org 解析三套体系」架构债统一治理（不阻塞 05-C）
