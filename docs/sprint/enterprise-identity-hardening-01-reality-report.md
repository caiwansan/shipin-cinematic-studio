# Sprint: Enterprise Identity Hardening 01 — Reality Report

**验收人:** 掌柜
**验收时间:** 2026-07-27
**结论:** 🟢 PASS

---

## 核心价值判断

解决企业招聘工作空间进入生产阶段后暴露的三个基础风险：

| 风险 | 原状态 | 修复后 |
|------|--------|--------|
| 身份 Token 多源 | token/accessToken/auth_token 并存 | 单一 Token Authority |
| 企业身份入口分叉 | recruitment onboarding 独立创建路径 | Enterprise onboarding 统一入口 |
| 数据失败误导 | API失败显示空状态 | 明确 error state |

本质：**Identity → Tenant → Workspace 链路不够单一**，已向 KMKI 的 Single Identity Authority / Single Tenant Authority 靠拢。

---

## Phase 4: Token Unified Authority ✅

### 改造前
```
localStorage
├── token
├── accessToken
└── auth_token
```
风险：不同模块读取不同 key、登录状态判断不一致、登出无法完全清理、新旧 Workspace 混用身份。

招聘 Workspace 扩展后链路：
```
用户 → Career Workspace → Enterprise Workspace → AI Employee Runtime
```
身份入口不唯一会导致 Hermes binding、tenant runtime 漂移。

### 改造后
新增 `utils/auth/token.ts` 成为 Auth Token Authority：
```
Auth Token Authority
├── API调用
├── 登录检查
└── 登出清理
```
统一为 `auth_token`，符合后续架构方向：
```
User Identity → OrgMember → Enterprise Tenant → Hermes Agent Identity
```

---

## Phase 5: Onboarding Merge ✅

之前 recruitment onboarding 独立创建招聘空间，容易形成 Recruitment Tenant + Enterprise Tenant 双身份污染。

现在统一到 enterprise onboarding，符合产品边界：**企业招聘不是独立企业，而是企业能力 Workspace**。

架构：
```
Enterprise
└── Recruitment Workspace
```

---

## Phase 6: WorkspaceSwitcher 修复 ✅

用户路径治理：
```
用户进入 WorkspaceSwitcher
├── hasEnterprise=true → 创建招聘空间
└── hasEnterprise=false → 创建企业
```

避免已有企业用户误创建重复企业，保护：
- Tenant 数量
- 企业资产归属
- AI Employee 绑定关系

后续 Hermes 依赖此入口稳定：
```
Enterprise → AI Employee → Hermes Sub-Agent
```

---

## Phase 7: Recruitment Error State ✅

产品真实性修复，SaaS 必备状态机：
```
loading → success → empty → error
```

招聘产品必须区分：
- 空数据 = 正常业务状态
- 错误 = 系统状态异常

---

## 构建验证
```
npx nuxt build → ✅ Build complete
.output/server/index.mjs
465 files
v0.2.0-c1-27-ga54c80b1
```

---

## 综合评分

| Gate | 状态 |
|------|------|
| Token Authority 单一化 | ✅ |
| Identity 链路收敛 | ✅ |
| Enterprise Onboarding 唯一入口 | ✅ |
| Workspace 创建逻辑 | ✅ |
| Recruitment Error UX | ✅ |
| Production Build | ✅ |

**Final: 🟢 Enterprise Identity Hardening 01 = PASS**

---

## 下一阶段建议：Sprint Enterprise Identity Hardening 02

### 1. API Tenant Boundary Audit
检查 request.user → orgId → enterpriseId → workspaceId 是否所有招聘 API 都使用同一来源。

### 2. Hardcoded UUID 清理
之前审计发现的 hardcoded enterpriseId、mock user id、fallback UUID 需要继续清。

### 3. Enterprise Agent Runtime Binding Audit
验证 EnterpriseAgentInstance → HermesProfileBinding → Hermes Sub-Agent 是否全部走新的 identity authority。

---

## 当前状态

```
Enterprise Recruitment Workspace
├── Identity Layer ✅
├── Tenant Layer 🟡 (待二次审计)
├── Workspace Layer ✅
├── AI Runtime Layer 🟡
└── Commercial Layer 🟡
```

本次 Sprint 是必要的基础收敛，可作为后续 P5 Commercialization Gate 的前置稳定版本。
