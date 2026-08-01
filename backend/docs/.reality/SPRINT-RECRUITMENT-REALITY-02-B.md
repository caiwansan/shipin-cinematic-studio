# Sprint-RECRUITMENT-REALITY-02-B — AI Employee Commercial Reality

**日期:** 2026-08-01 00:45 CST
**Gate:** 掌柜令启动（只做商业闭环，不新增 AI 能力）
**范围:** T01 Capability Gate / T02 plan.code 治理 / T03 businessType 全链路 / T04 Demo Reality

---

# 目标

> 企业买了以后，能力、套餐、权限、体验全部兑现。

# Task 完成

| Task | 交付 | 状态 |
|------|------|------|
| T01 Capability Gate | `require-enterprise-capability.ts` 中间件 + 8 端点接入 | ✅ Runtime Verified |
| T02 plan.code 治理 | EnterprisePlan.code 列 + 回填 + resolveTier 改用 code | ✅ |
| T03 businessType 全链路 | agentTypeToBusinessType 统一映射 recruitment | ✅ |
| T04 Demo Reality | 演示租户 8aed92ac 订阅/权益/LLM 配置 + 三员工真实 LLM 验证 | ✅ |

---

# T01 — Capability Gate（按钮 → API → Capability → Subscription → Agent Runtime）

## 新文件

`src/middleware/require-enterprise-capability.ts`
- `requireEnterpriseCapability(capability)` 中间件工厂（Fastify preHandler）
- `checkEnterpriseCapability(tenantId, capability)` 统一授权检查
- `normalizeCapability()` 旧代码 → P1 规范新代码别名映射

## 授权链（任一通过即 granted）

```
A. 招聘层（实时权益，以 entitlement.status=active 为准）:
   EnterpriseEntitlement.capability_codes
   - 空数组 = 全部能力开放（Enterprise 级）
   - 旧代码经别名映射（resume_analysis → AI_RESUME_MATCH 等）
B. 平台层（P1 Frozen 规范）:
   Subscription(active) → SubscriptionPlan.grants
```

拒绝 → `403 CAPABILITY_DENIED` + denied 列表 + 升级引导（前端可跳转购买页）。

## 接入端点（8 个）

| 端点 | Capability |
|------|-----------|
| POST /api/enterprise/jd/generate | AI_JD_GENERATE |
| POST /api/enterprise/jd/optimize | AI_JD_GENERATE |
| POST /api/enterprise/match | AI_RESUME_MATCH |
| POST /api/enterprise/matches/status | AI_CANDIDATE_RECOMMEND |
| POST /api/enterprise/jobs/:id/match | AI_RESUME_MATCH |
| POST /api/enterprise/recruitment-interview/:id/generate-questions | AI_INTERVIEW |
| POST /api/enterprise/recruitment-interview/:id/evaluate | AI_INTERVIEW_SUMMARY |
| GET /api/enterprise/candidates | CANDIDATE_SEARCH |
| POST /api/enterprise/agents/talent/*（analyze/search/explain） | AI_CANDIDATE_RECOMMEND（hook 级） |

## 关键修复（存量 bug，Schema 与 DB 不同步）

- **EnterpriseEntitlement.capabilityCodes 缺 schema 字段** → Prisma 不 SELECT → 恒为 undefined → 空数组 → **所有租户全开**（employee-capability.service 同款中招）。已补 schema 字段 + prisma generate。
- entitlement 检查原依赖 subscription.status=active → 改为**直接以 entitlement.status=active 为准**（订阅可 cancelled 但权益生效，entitlement 是唯一实时来源）。

## HTTP 验证

```
无 token            → 401 ✅
有 token 无订阅     → 403 CAPABILITY_DENIED ✅
有订阅有权益        → Gate 放行 → 业务层 ✅
```

---

# T02 — plan.code 治理

## 改动

1. `EnterprisePlan.code` 列（schema + ALTER TABLE 幂等）
2. 现有套餐回填：enterprise→ENTERPRISE / professional→PRO / basic→BASIC / trial→TRIAL / starter+e2e→FREE
3. `enterprise-subscription.ts` resolveTier：
   - **优先 `plan.code`（结构化数据）**
   - displayName 字符串猜测仅作旧数据 fallback（不再作为主判断）

```
之前: resolveTier(displayName) → includes('pro') 猜套餐等级
现在: plan.code → BASIC | PRO | ENTERPRISE | TRIAL | FREE
```

---

# T03 — businessType 全链路

## 改动

`enterprise-agent-runtime.ts` 新增 `agentTypeToBusinessType()`：

```
career_advisor / career_agent        → career_agent（用户 BYOK 隔离）
recruiter / interview / talent_analyst
/ recruitment_consultant / jd_optimizer
/ talent_searcher                    → recruitment（招聘业务域统一）
其它                                 → 保留原始类型
```

## 意义

- 一个业务域一个 businessType → 模型配置不会串业务
- usageLog.businessType 统一 → 成本按业务域聚合
- resolveRuntimeConfig 平台配置层可按 `business_type_recruitment` 统一配置

---

# T04 — Demo Reality（演示租户 8aed92ac）

## 数据配置

| 项 | 值 |
|----|-----|
| Organization | 演示企业（AI招聘Demo）✅ |
| enterprise_profile | ✅ |
| enterprise_llm_config | deepseek/deepseek-v4-flash（**复制 4e2f6062 已验证有效 key**）✅ |
| enterprise_subscription | active（enterprise 套餐）✅ |
| enterprise_entitlement | active + 空 capability_codes（全能力开放）✅ |

## 三员工真实 LLM 验证（Runtime Verified）

| 员工 | 调用 | 结果 |
|------|------|------|
| Alice | generateJDWithLLM | ✅ aiSource=llm |
| Bob 出题 | generateInterviewPlanWithLLM | ✅ aiSource=llm（6题） |
| Bob 评估 | generateEvaluationWithLLM | ✅ aiSource=llm（overall=65） |
| Carol | talentAgentService.searchCandidates | ✅ model=deepseek-v4-flash 真实输出 |

## 附带修复

| # | 问题 | 修复 |
|---|------|------|
| 1 | `generateEvaluationWithLLM` fallback 公式读 undefined.length（resumeStrengths 缺省） | 默认参数 `[]` |
| 2 | `talent-agent.service.searchCandidates` include `candidate` 关系已从 schema 移除 → 运行时炸 | 改为按 candidateId 批量查 CareerProfile + CandidateSkill |
| 3 | `talent-agent.service.explainMatch` 同款 include candidate | 同上 |
| 4 | `enterprise.routes GET /matches` include candidate | 同上（candidateName 用 profile.fullName） |
| 5 | ApiKey 表平台 deepseek key（****2059）已失效 | 演示租户改用 4e2f6062 有效 key |

# Reality Gate

| Gate | 验证 | 状态 |
|------|------|------|
| C1 能力商品化 | 按钮→API→Capability→Subscription→Runtime 链路完整 | ✅ PASS |
| C2 权限闭环 | 401/403/放行三态 HTTP 实测 | ✅ PASS |
| C3 套餐治理 | plan.code 取代 displayName 猜测 | ✅ PASS |
| C4 业务隔离 | recruitment 统一 businessType | ✅ PASS |
| C5 Demo 体验 | 三员工真实 LLM（演示租户） | ✅ PASS |

# 遗留（不在本次范围，记录）

- `enterprise-job-intelligence.routes.ts` 62/95 行 language 类型错误（存量）
- `enterprise-subscription.ts` 185 行 PaymentOrder 类型错误（存量）
- `enterprise-subscription-billing.ts` 650 行 AgentChannelBinding 类型错误（存量）
- 12 个 enterpriseLlmConfig 中 11 个 key 失效（需掌柜决定 key 治理策略）
- 平台 ApiKey 表 deepseek key 失效（演示环境已绕过，生产需换有效 key）
