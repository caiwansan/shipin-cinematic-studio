# Sprint-RECRUITMENT-REALITY-03 — 招聘订阅商业治理与后台管理 Reality Audit

**日期:** 2026-08-01 01:10 CST
**Gate:** 掌柜指令启动（招聘 AI 员工从「功能」进入「商品」阶段）
**原则:** Subscription SSOT 唯一化 — Admin 后台是唯一套餐管理入口，所有商业规则来自 DB

---

# 最终架构（已达成）

```
Admin后台（POST /api/admin/enterprise/plans + /subscriptions）
 ↓
EnterprisePlan（DB，含 capabilityCodes 能力集）
 ↓
EnterpriseSubscription（快照保留历史）
 ↓
EnterpriseEntitlement（capability_codes 继承 Plan）
 ↓
Capability Gate（require-enterprise-capability）
 ↓
AI Employee Runtime
```

---

# Task 完成

| Task | 交付 | 状态 |
|------|------|------|
| T01 全仓套餐硬编码审计 | 审计报告（见下） | ✅ |
| T02 删除运行时自动创建套餐 | onboarding 自动创建分支 + planDefaults 硬编码删除 | ✅ |
| T03 后台套餐管理 Reality Audit | 能力已齐全；DELETE 硬删治理为「有订阅保护」 | ✅ |
| T04 Admin 人工配置订阅 | 新端点 POST /api/admin/enterprise/subscriptions 全链路 | ✅ Runtime Verified |
| T05 无效套餐治理 | 4 个 e2e 测试套餐确认 inactive（保留历史） | ✅ |
| T06 Capability 与套餐解绑 | 无 if(plan==) 判能力；Plan.capabilityCodes 继承链打通 | ✅ |
| T07 前端后台 Reality Check | 前端全部 API 驱动，无写死价格/数量 | ✅ |

---

# T01 审计结论

## 违规（已修复）

| # | 位置 | 问题 | 修复 |
|---|------|------|------|
| 1 | enterprise-onboarding.routes.ts:699 | 运行时自动创建套餐 + `planDefaults` 硬编码（starter 999 / professional 2999 / enterprise 9999） | **删除自动创建分支** → 找不到套餐返回 400，引导 Admin 先建套餐 |
| 2 | admin-*.ts ×3（recruitment/commerce/enterprise-plans） | DELETE 直接硬删（有订阅会 FK 炸 / 无订阅丢历史） | 有订阅 → 400 拒绝（引导 toggle 停用）；无订阅 → 允许删 |

## 干净（通过）

- 业务代码无 `if(plan==="professional")` 判能力（T06 ✅）
- resolveTier 已优先 plan.code（02-B 完成）
- 购买流程已检查 plan.enabled（停用不可买）
- 前端 plans/subscriptions/recruitment 页面全部 fetch API，价格仅是输入框 placeholder
- member.ts / require-member-tier.ts 的 tier 是 **C 端会员**（不同业务域，排除）

---

# T02 — 删除代码创建套餐 ✅

- `enterprise-onboarding.routes.ts`：`查找或创建 EnterprisePlan` → `查找，不存在则 400 报错`
- `prisma/seed-enterprise-plans.ts`（开发初始化脚本）：**保留**（掌柜原则：保留开发初始化，删除运行时自动创建）
- 生产规则落地：Admin 创建 → DB 保存 → 用户购买

---

# T03 — 后台套餐管理 ✅

已有能力（requireAdmin 保护）：

```
GET    /api/admin/enterprise/plans                    列表（含停用）
POST   /api/admin/enterprise/plans                    创建（name/code/price/billingCycle/maxEmployees/capabilityCodes/enabled...）
PUT    /api/admin/enterprise/plans/:id                修改（立即生效）
PATCH  /api/admin/enterprise/plans/:id/toggle         启停
DELETE /api/admin/enterprise/plans/:id                删除（新增：有订阅保护）
```

- 修改套餐（如 Professional 3→5 AI员工）：**立即生效**（下次激活/换套餐时 snapshot 更新；已激活订阅按快照保留——快照机制保证历史一致）
- 停用套餐：新用户不能购买（create-order 404「套餐不存在或已停用」），老用户订阅快照保留

---

# T04 — Admin 人工配置订阅 ✅ Runtime Verified

新端点 `POST /api/admin/enterprise/subscriptions`：

```
Admin 选企业 → 选套餐 → 创建 Subscription（快照） → createFromSubscription 生成 Entitlement → provisionEmployeesForPlan 部署 AI 员工 → 审计日志
```

实测（免费企业「淡定」0a016198）：

| 步骤 | 结果 |
|------|------|
| Admin 开通 Basic | ✅ subscription active + entitlement caps=["AI_JD_GENERATE"] |
| 用户调 jd/generate | ✅ 200 放行 |
| 用户调 interview 出题 | ✅ 403 CAPABILITY_DENIED（Basic 无 AI_INTERVIEW） |
| Admin 升级 PRO（change-plan） | ✅ entitlement 更新为 5 能力 |
| 用户再调 interview | ✅ Gate 放行 → 业务层（Bob 能力立即开启） |
| 测试后清理 | ✅ 订阅/entitlement 删除，企业恢复免费状态 |

---

# T05 — 无效套餐 ✅

DB 现存 8 套餐：5 正式（FREE/TRIAL/BASIC/PRO/ENTERPRISE）+ 4 个 e2e 测试套餐。
- 4 个 e2e 测试套餐 **已 inactive**（enabled=false）✅ 保留历史不删除
- starter(FREE) 也 inactive（免费入口走 onboarding，不卖）

---

# T06 — Capability 与套餐解绑 ✅ + 架构补强

- 全仓扫描：无 `if(plan===)` 直接判能力（onboarding isStarter 仅是 trialOnly 初始状态，非功能授权）
- **补强**：`EnterprisePlan.capabilityCodes` 字段（schema + migration + 回填）→ Plan 定义能力集 → createFromSubscription 继承到 Entitlement → Gate 消费。**Plan → PlanCapability → Entitlement → Gate 链路完整**
- 回填：ENTERPRISE 7 能力 / PRO 5 / BASIC 3 / TRIAL 3 / FREE 0（[]=全开语义，starter 已停用不影响）

---

# T07 — 前端 Reality Check ✅

- 写死扫描：0 critical（价格仅 placeholder，套餐列表全 API）
- admin-subscription-v2.vue / admin-capabilities.vue / admin-enterprises.vue 不存在同名页面；实际使用：
  - `/admin/enterprise/plans.vue` + `plans/[id].vue`（套餐管理）
  - `/admin/enterprise/subscriptions.vue`（订阅管理）
  - `/admin/enterprise/recruitment.vue`（招聘总控台）

---

# 过程中修复的存量 bug

| # | 问题 | 修复 |
|---|------|------|
| 1 | **Admin 创建套餐运行时必炸**：`capabilityCodes` 不在 EnterprisePlan schema → Prisma Unknown argument（P0，直接影响 T03） | schema + migration + generate |
| 2 | **interview 端点 Capability Gate 永远 401**：recruitment-interview.routes.ts 无全局 JWT 认证（enterprise.routes 有），request.user 恒空 → Gate 认证层直接拒 | 补全局 onRequest jwtVerify |
| 3 | 演示租户 02-B 已修 3 处 include candidate 同类（本次复核无复发） | — |

---

# Reality Gate

| Gate | 验证 | 状态 |
|------|------|------|
| G1 商业SSOT | 所有套餐来自 DB；onboarding 不再自动创建；无 planDefaults 硬编码 | ✅ PASS |
| G2 无硬编码 | grep 套餐关键词：0 critical（onboarding planDefaults 已删） | ✅ PASS |
| G3 管理员控制 | Admin 创建 Basic → 用户登录 → 只能 Basic 能力（JD ✅ / Interview 403 ✅） | ✅ PASS |
| G4 动态升级 | Basic → Admin 升级 PRO → Bob(AI_INTERVIEW) 立即开启（403→放行） | ✅ PASS |
| G5 删除套餐安全 | 停用 → 新购 404 ✅ + 历史订阅快照保留 ✅ + 有订阅硬删拒绝 ✅ | ✅ PASS |

# 遗留（存量，非本次范围）

- admin-recruitment.ts AuditLog 查询类型错误（1042-1058 行，schema 与代码不同步，存量）
- enterprise-entitlement.service.ts EnterpriseAgentInstance 相关类型错误（67-172 行，存量）
- enterprise-onboarding.routes.ts JsonValue 类型错误（存量，运行正常）
- 12 个 enterpriseLlmConfig 中 11 个 key 失效（待掌柜 key 治理决策）
