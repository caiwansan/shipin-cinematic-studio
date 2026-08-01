# SPRINT-MEDIA-IDENTITY-ALIGN-01-REPORT

**Date:** 2026-08-02 09:10
**Gate:** 掌柜战略指令（新媒体工作台进入真实产品阶段后的基础身份链路缺口：产品有了，但还不是「昆仑镜里的一个 Workspace」——优先补齐 Identity Reality，不做 01C，不进入商业化）
**结论:** ✅ **身份链路对齐完成，R1-R7 全 PASS**

---

## 一、401 根因（T03 排查结论）

浏览器抓包 + 代码审计 + 数据库实查（130 用户 / 45 有 governance_user）三重确认：

| # | 根因 | 证据 |
|---|------|------|
| 1 | **JWT payload 只有 `{id, email, tokenVersion}`，从不携带 organizationId** | `auth.service.ts:56` / `auth.ts:154,251` sign 明文 |
| 2 | **auth/me 不返回企业上下文**（organizationId/orgName/tenantId 全缺）→ 前端无统一身份数据源 | `auth.ts /me` 返回字段实测 |
| 3 | **media-platform.ts 的 preHandler 对真实 JWT 用户不注入 tenantContext**（仅 `Bearer demo-token` 后门注入）→ `/api/enterprise/media-department/media/*` 组（accounts/health/connect）对真实用户 403 NO_TENANT | `media-platform.ts:29-45` |
| 4 | **enterprise-readonly.resolveOrgId 每次请求 3 跳查库**（User→email→govUser→tenantId→govOrganization），且无企业用户（85/130）→ 401「无企业身份」 | `identity-bootstrap.service.ts:181` + DB 实查 |

实测：demo 用户只有 personal tenant（演示企业复用其 tenantId=9af5f6bd），能解析出「昆仑镜验收测试企业」→ media/overview 200；但身份缺失是事实（auth/me 无企业字段 + 左栏无身份卡 + media-platform 组 403 潜在）。

## 二、修复（后端 4 文件 + 前端 2 文件）

### 后端 — Identity Authority 注入
| 文件 | 改动 |
|------|------|
| `services/auth.service.ts` | login JWT sign 注入 `organizationId`（查 identity-bootstrap）+ login 返回 user.organizationId |
| `routes/auth.ts` | register/refresh sign 注入 organizationId；**auth/me 返回 organizationId + organizationName + tenantId**（短剧/招聘/新媒体统一身份数据源） |
| `routes/media-platform.ts` | preHandler jwtVerify 成功后注入 tenantContext：`user.organizationId ?? 查库`（老 token 兼容）→ 修复 403 NO_TENANT |
| `routes/enterprise-readonly.routes.ts` | resolveOrgId 优先 `user.organizationId`（新 token 零查库），缺失 fallback 原查库链 |

### 前端 — 复用昆仑镜统一身份组件（零新建）
| 文件 | 改动 |
|------|------|
| `components/media/MediaWorkspaceShell.vue` | 侧栏底部复用 **WorkspaceUserCard**（短剧/招聘同款：头像/用户名/企业/VIP 套餐 + 模型/套餐按钮）+ 挂载统一 **ModelSettingsModal**（filterCapability="llm"）；身份数据 auth/me + subscription/current |
| `pages/workspace/media/index.vue` | 401/无企业身份 → 引导条「⚠️ 未找到企业身份」而非裸 toast |

**未新建任何 Media 用户/模型组件**：无 MediaUserCard / MediaModelCard / MediaModelSettings / MediaUser / MediaAccount / MediaProfile / MediaModelConfig。

## 三、Reality Gate

| Gate | 要求 | 结果 |
|------|------|------|
| R1 | 登录进入 /workspace/media 不 401 | ✅ 生产域实测 API 全 200（overview/accounts 全绿） |
| R2 | 左栏显示用户身份卡 | ✅ 头像/用户名/昆仑镜验收测试企业/HR猎头 ¥2999/月 |
| R3 | 左栏显示模型设置入口 | ✅ 模型/套餐按钮（WorkspaceUserCard 统一形态） |
| R4 | 模型入口打开统一 ModelSettings | ✅ 点击「模型」→ 统一 ModelSettingsModal（实测弹出） |
| R5 | 短剧/招聘工作台无影响 | ✅ /workspace/enterprise（EnterpriseShell）正常 |
| R6 | 无 MediaUser/MediaModelConfig 残留 | ✅ 全仓 grep 无代码残留（仅注释说明禁止项） |
| R7 | build + 生产验证 | ✅ Nuxt build PASS + PM2 重启 + 浏览器生产域实测 |

额外验证：
- JWT 实测携带 `organizationId: 11111111-2222-4333-8444-555555555555` ✅
- auth/me 实测返回 `organizationId / organizationName(昆仑镜验收测试企业) / tenantId` ✅
- subscription/current → planName「HR猎头 ¥2999/月」→ 身份卡套餐状态 ✅

## 四、修改范围合规

| 范围 | 状态 |
|------|------|
| ✅ frontend/components/media/MediaWorkspaceShell.vue + pages/workspace/media/index.vue | 复用组件，零新建 Media 系 |
| ✅ backend/src（auth.service/auth.ts/media-platform/enterprise-readonly） | 身份注入（T03 题中之义，不涉及 DB/schema/migration） |
| ❌ 未动 database/schema/migration | 零 schema 变更 |
| ❌ 未动 微信/Commerce/AI员工 runtime | 零触碰 |
| ❌ 未新建 MediaUser/MediaModelConfig/MediaAccount/MediaProfile | R6 确认 |

## 五、兼容性说明

- 老 token（无 organizationId）：所有读取处 fallback 查库（media-platform preHandler / resolveOrgId / auth/me），不强制重新登录
- 新登录 token 自带 organizationId → 读取零查库 + tenant-guard 体系（如启用）可直接工作
- 无企业用户（85/130）：media 页显示引导条（创建/加入企业），Identity Authority 边界正确（不放行）

截图：`audit-screenshots/IDENTITY-ALIGN-01-{sidebar,model-modal}.png`
