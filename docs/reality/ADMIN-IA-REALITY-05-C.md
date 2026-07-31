# ADMIN-IA-REALITY-05-C — AI 员工运营中心（5 Tab）— COMPLETE ✅

**Date:** 2026-08-01
**Gate:** 掌柜战略指令（05-C 调整顺序：止血 → 模板 → Model Policy → 页面 → Reality Gate 验收）
**验收:** AI Employee Reality Gate G1-G6 浏览器全 PASS，页面零 API 404

---

## 交付

### 05-C-0 止血（旧 Agent 管理）
- admin-agents.ts / agent-plan.ts：文件头 DEPRECATED 标记 + 全部端点从「500 崩溃（引用不存在表）」改为 **410 明确废弃**（含提示新端点），路由保留不删除
- 禁补 agent_def 表 / 禁恢复旧 API（遵守冻结）

### 05-C-1 AgentTemplate 模板中心
- 新表 `agent_template`（schema + 手写 SQL 迁移，10 条真实种子）
- 模板 ≠ 实例：模板（岗位定义）→ EnterpriseAgentProfile（企业员工）→ EnterpriseAgentInstance（运行实例）
- 种子：招聘顾问/面试专家/人才分析师/AI职业助理/猎聘顾问/热点分析师/营销策划/小说编辑/短剧导演/法律顾问，含默认能力 + 默认模型策略（text/image/video 模态）

### 05-C-2 Model Policy（诚实交付）
- **侦察定案：平台无 LLM Key**（env 全空占位 / credential_vault 0 条 / ai_provider_config 空表 / system_config 无 key / 企业 key 与员工 tenant 断裂 / 仅用户 BYOK 真实存在）
- 绑定机制就绪（AgentModelBinding 表 + 校验），**不造假 key、不建空 config**
- Gate G4 如实校验：无显式模型策略 = 配置不完整（符合「不能假装上线」）

### 05-C-3 AI 员工运营中心页面
- 新路由 `/api/admin/ai-employees/*`（overview / templates CRUD / capabilities / runtime / value）
- agents.vue 重写为 5 Tab：AI员工 / 模板中心 / 能力中心 / 运行中心 / 价值中心
- 导航「Agent列表」→「AI员工」

### 05-C-4 AI Employee Reality Gate 验收（G1-G6）
- **六要素 Gate 逻辑**：Identity/Capability/Runtime/Model Policy/Memory/Usage 全 PASS → 「运行中」，否则「配置不完整」+ 缺项明细
- 浏览器验收：5 Tab 全渲染、零 API 404、模板 10 个、能力 34 个、运行/价值聚合真实

## 数据真相（诚实呈现）

| 指标 | 值 |
|------|-----|
| AI 员工总数 | 13（active 6 / draft 7） |
| 运行中（六要素全 PASS） | **0** |
| 配置不完整 | **13**（全员缺 G4 Model Policy；部分缺 G3/G5/G6） |
| AgentTemplate 模板 | 10（平台岗位模板） |
| Capability 能力 | 34（JOB_CREATE/CANDIDATE_SEARCH/AI_INTERVIEW...） |
| CapabilityGrant 授权 | 77 条真实 |
| 任务记录（Tab4 数据源） | EnterpriseAgentTask 30 条 |
| 审计记录 | agent_audit_trail 2074 条 |

**为什么运行中 = 0？** 所有员工缺 G4（无显式模型策略），因为平台无托管 LLM Key、企业 key 与员工 tenant 断裂（org 架构债同源）。这是数据真相，页面如实显示「配置不完整」而非假装上线。修复路径 = IDENTITY-REALITY-FIX（组织/订阅/权益统一）→ 企业配 Key → 员工绑定 → Gate 自动转绿。

## 提交
`待填`（05-C 全量）

## 冻结清单（持续）
❌ 旧 Agent 体系复活（agent_def/agent_definition 表）❌ 平台假 Key ❌ 绕过套餐授权手动塞 Agent
⏸ IDENTITY-REALITY-FIX（掌柜单独指令启动）
