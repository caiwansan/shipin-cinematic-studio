# AI Employee Governance Rule v1.0 — AI员工治理规则（设计冻结）

**Date:** 2026-08-01
**Gate:** 掌柜战略指令（ADMIN-IA-REALITY-05 前置设计冻结：先定规则，再动页面）
**状态:** 冻结生效，05-C 页面开发必须遵守

---

## 0. 核心定位

昆仑镜卖的不是 Agent，是 **AI 员工**。
后台「AI Agent管理」= **AI 员工运营中心**（商业运营动作），不是 Agent CRUD 资产列表。

---

## 1. Agent 不是 Workspace 资产（冻结）

### ❌ 禁止
```
短剧创建自己的 Agent（AgentDef 体系）
GEO 创建自己的 Agent（AgentDefinition 体系）
招聘创建自己的 Agent
任何 xxx-workspace-agent.ts / xxx-agent.service.ts
```

### ✅ 正确
```
平台 Agent Registry（EnterpriseAgentProfile 体系）
        ↓ 授权
   Workspace / 企业
```

- Agent 注册在**平台层**，Workspace 只有「使用」与「授权」，没有「创建」
- 业务线需要新岗位 → 向平台申请模板，不走自建

### 现状处置（审计结论）
| 体系 | 表 | 数据 | 处置 |
|------|-----|------|------|
| 旧图引擎 AgentDef/AgentEdge/AgentExecution/AgentPlan | 表不存在 | 0 | **废弃冻结**，/api/admin/agents 停止引用（见 §6 事故） |
| GEO 自建 AgentDefinition/AgentSession | agent_definition=0 | 空壳 | **废弃冻结**，GEO 迁回平台体系 |
| 企业 AI 员工 EnterpriseAgentProfile/Instance | 13 / 9 | 活跃 | **唯一 SSOT** ✅ |

---

## 2. AI 员工六要素（缺一不能上线）

```
Identity        EnterpriseAgentProfile + EnterpriseAgentInstance + HermesProfileBinding
Capability      CapabilityRegistry（代码注册）+ CapabilityGrant（套餐授权）
Runtime         Instance.lifecycleState（ACTIVE/PAUSED/STOPPED/EMERGENCY_STOP/RECOVERING）
Model Policy    AgentModelBinding / EmployeeModelBinding（⚠️ 当前 0 条，05-C 前必须落地）
Memory Namespace Instance.namespace + HermesProfileBinding.memoryNamespace
Usage Record    EnterpriseAgentTask + usage_logs（enterprise_agent_*）
```

上线 Gate：六要素任一为空 → 状态必须为 `draft`，不得 `active`。
现状：13 个 Profile 中 6 个 active 但 **Model Policy 全部为空** → 治理项 A1（补绑定或降级 draft）。

---

## 3. 模板 / 实例 / 授权分层（冻结）

```
AgentTemplate（岗位模板：Alice/Bob/Carol 人设·能力·默认工具·可授权业务）
     ↓ 实例化
AgentInstance（企业 AI 员工：一个员工 = 一个 Hermes 子代理身份）
     ↓ 授权
CapabilityGrant（套餐 → capability code）
     ↓ 生效
企业员工使用（require-enterprise-capability 中间件）
```

- **模板**：平台定义（招聘顾问/面试专家/人才分析师/营销策划/小说编辑/短剧导演/法律顾问…），模板 ≠ 实例
- **实例**：企业创建/激活，绑 tenant + organization + Hermes 身份 + memory namespace
- **授权链路**：套餐 → Entitlement → Capability → Agent Instance，**禁止管理员手动塞 Agent**
- 谁决定企业拥有哪个 AI 员工？= **套餐里的 CapabilityGrant**，不是后台人工指派

---

## 4. Runtime 边界（冻结）

- 唯一 Runtime：统一 Agent Runtime（Hermes 子代理），禁止业务线自建执行器
- Instance.runtime 字段固定 `openclaw`，lifecycleState 状态机唯一（Hardening-01）
- 启停/恢复只走 Instance 状态机，禁 emergencyStop 直改
- 失败可恢复：startupRecovery 统一入口

---

## 5. 后台入口 = AI 员工运营中心（5 Tab 冻结）

```
🧠 AI Agent管理（一级导航不变）
 ├ Tab1 AI员工列表   谁在工作·服务谁·创造什么价值（员工/岗位/业务/状态/企业）
 ├ Tab2 模板中心      平台岗位模板管理（名称/人设/能力/默认工具/可授权业务）
 ├ Tab3 能力中心      Agent → Capabilities → Tools → Runtime 链路（平台注册，禁 Workspace 自注册）
 ├ Tab4 运行状态      今日任务/成功/失败/Token/成本（不是日志！）
 └ Tab5 成本与价值    成本 + 产出 + ROI（连接数据罗盘）
```

### Tab 数据源（SSOT 绑定）
| Tab | 数据源 | 状态 |
|-----|--------|------|
| Tab1 | enterprise_agent_profile + instance | ✅ 真实 |
| Tab2 | 模板表（新建 AgentTemplate，见 05-C） | ⚠️ 待建 |
| Tab3 | capability-registry（代码）+ governance_capability_grant(77) | ✅ 真实 |
| Tab4 | enterprise_agent_task(30) + usage_logs(29) | ✅ 真实 |
| Tab5 | Task.cost + usage_logs + 价值模型（05-C 定义） | ⚠️ 待定义 |

---

## 6. 已知事故（05-C 必须修复）

**/api/admin/agents（现有后台 AI Agent 管理）引用 `agent_def` 表——该表不存在**：
- 路由 admin-agents.ts 全部 4 端点（GET/POST/PUT/DELETE）写死 agentDef
- agent_def / agent_plan / agent_level_config 三表均未迁移 → 页面打开必炸
- 处置：05-C 重写为 EnterpriseAgentProfile 体系 + 5 Tab，admin-agents.ts 废弃标记

---

## 7. 冻结清单（违反即回退）

❌ Workspace 自建 Agent 体系（AgentDefinition/AgentDef 复活）
❌ 散 Agent 服务文件（xxx-agent.service.ts 新增）
❌ 后台读 agent_def / agent_definition 等旁路表
❌ 管理员手动塞 Agent 绕过套餐授权
❌ Agent 六要素不齐标 active
❌ 技术日志冒充运行状态（Tab4 只展示任务/成本/成败）
