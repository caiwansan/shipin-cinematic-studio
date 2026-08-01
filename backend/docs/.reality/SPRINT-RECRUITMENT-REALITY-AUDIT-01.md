# SPRINT-RECRUITMENT-REALITY-AUDIT-01

**日期:** 2026-07-31 23:55 CST
**对象:** `https://aigc.fushtn.com/workspace/enterprise/`（昆仑镜招聘工作台）
**方式:** 只读审计（前端页面 → API Routes → Service Layer → Agent Runtime → LLM Provider → Subscription）
**原则:** 不修改代码。Critical 标红。

---

# Executive Summary

## 结论: ⚠️ CONDITIONAL PASS

```
架构正确性:   ✅ PASS（身份/权限/模型统一入口/数据真实全链路）
数据真实性:   ✅ PASS（无 mock AI 员工、无前端假企业数据、无硬编码数组）
模型配置:     ✅ PASS（resolveRuntimeConfig 唯一入口，招聘主链干净）
AI 能力真实性: ❌ FAIL（Bob 面试评估 = 前端评分 + 模板聚合；JD 生成 = 模板引擎）
```

**一句话：招聘工作台已经是「真实的企业 AI 员工系统」的骨架——身份真实、权限隔离、模型统一、计费接通；但 Alice/Bob/Carol 三个员工的「AI 能力」中，Carol（人才分析）是真 LLM，Alice（JD/匹配）和 Bob（面试）目前是模板+规则引擎，AI 名不副实。**

修复优先级：Bob 面试评估接 LLM > JD 生成接 LLM > 统一匹配算法。

---

# 1. Workspace Reality

| 模块 | 状态 | 证据 |
|------|------|------|
| 首页数据 | ✅ PASS | `/api/enterprise/home` → `getEnterpriseContext(userId)` → `prisma.organization.name`（真实企业名）；无企业返回真实空状态，非假数据 |
| Agent 展示 | ✅ PASS | `index.vue` AI 员工来自 `/api/enterprise/agent-profiles` → `enterpriseAgentProfileService.listAgents(tenantId)`（DB 租户隔离） |
| 订阅状态 | ✅ PASS | `subscription/current` → `enterpriseSubscription` + `plan` 表 + snapshot 字段 |
| 无 mock 数组 | ✅ PASS | 全 workspace/enterprise 前端 **0 处** `const agents=[...]` 假数据；0 处 mockAgents/MOCK_ |

前端所有页面（index/jobs/talent/interview/candidates/analytics/billing/AgentCapabilityCenter/ai-employees）数据源均为真实 API 调用。

---

# 2. AI Agent Reality

| Agent | 身份 | Runtime | LLM | 状态 |
|-------|------|---------|-----|------|
| **Carol** 人才分析师 | ✅ `EnterpriseAgentProfile`（DB，tenantId 隔离） | ✅ `enterpriseAgentRuntime`（**生产实例 c7064fde runtime=active + runtimeAgentId 已存在**） | ✅ `executeViaGateway` + 企业 LLM 配置 | **✅ 真实 AI 员工** |
| **Bob** 面试专家 | ✅ DB profile（seed 演示租户 8aed92ac，runtime=draft） | ⚠️ 未激活 | 🔴 **无 LLM**：题目=`PROJECT_TEMPLATES[Math.random()]` 随机模板；评分=`score` 前端提交；评估=公式聚合（avgScore/cultureFitScore） | **❌ 模板+规则，非 AI** |
| **Alice** 招聘顾问 | ✅ DB profile（seed 演示租户 8aed92ac，runtime=draft） | ⚠️ 未激活 | ⚠️ JD=`EnterpriseRecruitAgent.generateJD` 模板引擎；匹配=规则引擎（权重 0.35/0.2/0.2/0.15/0.1） | **⚠️ 半 AI（无 LLM 推理）** |

## Carol 详细审计（真 LLM ✅）

```
/agents/talent/analyze|explain|search
  → TalentAgentService（enterpriseId=tenantId 数据权限校验）
    → 构建 prompt（真实候选人数据：skills/experience/education/匹配记录）
    → executeViaGateway（enterpriseLlmConfig 企业配置）
    → LLM 只做解释/推荐，不编分数
匹配分 = CandidateMatch.matchScore（talent-matching.service: skill 0.40 / exp 0.30 / edu 0.15 / career 0.15）
✅ 权重与设计一致  ✅ 排序基于 DB matchScore  ✅ 企业未配置 LLM 时友好提示（不硬编码）
```

## Bob 详细审计（🔴 无 LLM）

```
POST /recruitment-interview/:id/generate-questions
  → interviewAgent.generateInterviewPlan()  ← 模板：TECHNICAL_TEMPLATES + Math.random() 选题
POST /recruitment-interview/:id/submit-answers
  → Body: { answers: [{ questionId, answer, score }] }  ← 🔴 score 由前端提交（后端仅 clamp 0-100）
POST /recruitment-interview/:id/evaluate
  → interviewAgent.generateEvaluation()  ← 规则聚合：avgScore + cultureFitScore（默认 70）
```

🔴 **Critical（产品真实性）**：面试评估链 = 前端评分 + 模板聚合。作为"AI 面试专家 Bob"展示，能力不真实。数据不会损坏（状态机完整），但「AI 员工」名不副实。

---

# 3. Model Config Reality

## 统一入口 ✅

```
resolveRuntimeConfig（7 层）: input → enterprise_config → platform_config → user BYOK → stage → provider_registry → env
   ↑
executeViaGateway('llm', ...)
   ↑
招聘主链（enterpriseAgentRuntime.executeTask）:
  ✅ 只传 userId + tenantId + businessType（默认 'recruitment'）
  ✅ 不强制注入 provider/model（让 resolveRuntimeConfig 自然解析）
  ✅ modelSource 记录 enterpriseLlm vs UserModelConfigV2 BYOK
```

## 各链检查

| 调用链 | resolveRuntimeConfig | businessType | 判定 |
|--------|---------------------|--------------|------|
| enterpriseAgentRuntime（招聘主链） | ✅ | ✅ 默认 recruitment | ✅ 干净 |
| AgentBrainService（workflow 链） | ✅（gateway 内部） | 🔴 **未透传** | ⚠️ P2 |
| talent-agent.service（Carol） | ✅（企业配置直传 input 层） | ✅ 合理 | ✅ 企业员工用企业配置合规 |
| 直接 SDK 调用（openai/deepseek/anthropic） | — | — | ✅ **0 处** |
| `DEFAULT_MODEL` 常量 | — | — | ✅ **0 处** |

**结论**：无绕过 BYOK/企业模型/计费的硬编码调用。env fallback 仅作最后兜底（第 7 层），合规。

---

# 4. Backend Reality

| 域 | 状态 | 证据 |
|----|------|------|
| JD | ✅ PASS | `JobPosting` DB 表 + `/postings` CRUD + 模板生成（见 Findings） |
| 候选人 | ✅ PASS | `CandidateProfile` / `CareerProfile(SSOT)` / `CandidateMatch` 关系完整 |
| 匹配 | ✅ PASS | `talent-matching.service` 权重 0.40/0.30/0.15/0.15（与设计一致）+ match-evidence 可溯源 |
| 面试 | ✅ PASS | `InterviewSession` 状态机：preparing→question_ready→in_progress→evaluating→completed→decision_made；`InterviewEvaluation` + `HiringDecision` 闭环 |
| 招聘编排 | ✅ PASS | `recruitment-orchestrator` 5 stage（JD→talent→match→summary→interview）全 DB 落库（RecruitmentPlan） |
| 租户隔离 | ✅ PASS | `requireEnterpriseWorkspaceContext` 边界守卫 + enterpriseId=tenantId 数据校验（企业数据不可跨租户读取） |
| 管理端 | ✅ PASS | admin-enterprises / admin-recruitment / admin-capabilities / admin-subscription-v2 齐全 |

---

# 5. Hardcode Findings

## 🔴 P0（假数据 / mock AI 员工）: **无**

✅ 未发现 mock 数组、假企业名、假员工列表、前端写死评分展示。

## 🟠 P1（AI 能力不真实 / 逻辑重复）

| # | 位置 | 问题 | 影响 |
|---|------|------|------|
| P1-1 | `recruitment-interview.routes.ts` submit-answers | 🔴 **score 由前端提交**，非 AI 评估 | Bob「AI 面试官」名不副实 |
| P1-2 | `interview-agent.ts` generateInterviewPlan | 题目 = 模板 + `Math.random()` 随机选题 | 非 LLM 生成 |
| P1-3 | `interview-agent.ts` generateEvaluation | 评估 = 公式聚合（avgScore/cultureFitScore） | 非 LLM 推理 |
| P1-4 | `enterprise-recruit-agent.ts` generateJD | JD = 模板字符串拼接 | 「AI 生成 JD」实为模板 |
| P1-5 | 匹配算法三套并存 | ① talent-matching 0.40/0.30/0.15/0.15 ② recruit-agent 0.35/0.2/0.2/0.15/0.1 ③ search-agent 简化版 | 同一候选人不同链路分数不一致 |

## 🟡 P2（健壮性 / 规范性）

| # | 位置 | 问题 |
|---|------|------|
| P2-1 | `agent-brain.service.ts` | workflow 链 `executeViaGateway` 未透传 businessType → 平台配置层无法按业务区分 |
| P2-2 | `ai-employees.vue` | `name.includes('carol') || name.includes('c')` 匹配过宽（任何含 c 的名字都会命中） |
| P2-3 | `enterprise-subscription.ts` | planTier 靠 displayName 字符串推断（includes 'pro'/'trial'），改名即失配 |
| P2-4 | `enterprise-onboarding.routes.ts` | 直接判断 `plan === 'starter'` 硬编码计划名（P1-Frozen 规范：Business Logic 禁止自行判断套餐等级） |
| P2-5 | `require-capability.ts` | middleware 定义完整（责任链 requireAuth→requireTenant→requireCapability）但 **0 个路由接入**；entitlementGate 仅在 service 层部分使用 |
| P2-6 | `talent-agent.service.ts` executeAgentLLM | 企业配置 provider/model 直传 gateway input 层（合理，但跳过用户 BYOK 层——企业员工场景合规，标注） |

---

# 6. Subscription Gap

## 现状（DB 真实套餐数据，与商业设计对齐 ✅）

| 套餐 | 价格 | maxEmployees | quota | BYOK | 对齐 |
|------|------|--------------|-------|------|------|
| Trial 体验版 | ¥0 | 2 | unlimited | 否 | ✅ |
| Basic 清包工 | ¥299/月 | 1 | fixed | 否 | ✅ |
| Professional 人事部 | ¥999/月 | 3 | fixed | 否 | ✅ |
| Enterprise HR猎头 | ¥2999/月 | 10 | unlimited | 否 | ✅ |

订阅 9 + Entitlement 9 落库，`entitlementGate(tenantId, capabilityCodes)` 运行时门控存在。

## 缺口

| # | 缺口 | 影响 |
|---|------|------|
| G1 | `requireCapability` 中间件未接入实际路由 | 能力门控未覆盖 API 层（仅 service 层部分） |
| G2 | entitlementGate 调用面窄（admin 管理 + service 内部） | 前端功能按钮 vs 后端能力的强一致未验证 |
| G3 | planTier 字符串推断 | 套餐能力判断脆（改名即错） |
| G4 | 前端「AI 员工能力」（Bob/Alice）与套餐宣传不一致 | Professional 卖点「Bob 面试官」实际是模板，商业承诺风险 |

---

# 7. Fix Plan（不重造，优先接通已有能力）

## 原则
```
已有能力接通 → 删除重复系统 → 补 Reality Gate
```

## 阶段一（P1 修复 — AI 能力真实化）

```
P1-1~3 Bob 面试接 LLM:
  submit-answers 改为只提交 answer（去 score）
  → evaluate 调 executeViaGateway（面试评估 prompt，用 enterpriseAgentRuntime 链）
  → InterviewEvaluation 由 LLM 输出（分数+优势+风险+建议），保留状态机
P1-4 JD 生成接 LLM:
  EnterpriseRecruitAgent.generateJD → 改调 executeViaGateway（企业配置）
P1-5 统一匹配算法:
  删除 recruit-agent/search-agent 的私有权重，全部走 talent-matching.service（0.40/0.30/0.15/0.15）
```

## 阶段二（P2 修复 — 治理补洞）

```
P2-1: brain 链路透传 businessType（默认 recruitment）
P2-2: ai-employees.vue 匹配改为 agentType === 'talent_analyst'
P2-3: planTier 改为 plan.code 字段（DB 增加 code 列），不再字符串推断
P2-4: onboarding 改用 CapabilityRepository / planId 查询
P2-5: requireCapability 接入核心路由（jd/generate、interview/*、agents/talent/*、workflow/*）
P2-6: 保持（企业员工用企业配置，合规）
```

## 阶段三（Reality Gate 补强）

```
G1: 前端每个功能按钮 ↔ requireCapability 路由 ↔ entitlement 的映射清单（能力矩阵文档）
G2: Reality Test: 免费用户访问 Pro 能力 → 403（API 层拦截验证）
G3: 套餐降级 → entitlement 即时失效验证
```

---

## 审计方法说明

- 只读审计：grep/sed/DB 查询，未修改任何代码
- 覆盖：前端 12 页面 + 后端 20+ 路由 + 6 服务 + Prisma 模型 + DB 实数据
- 生产证据：DB 中 c7064fde 租户的 Carol 实例 runtime=active + runtimeAgentId（真实运行中）
- 下一步：等掌柜决定 Sprint-RECRUITMENT-REALITY-02（修复）范围
