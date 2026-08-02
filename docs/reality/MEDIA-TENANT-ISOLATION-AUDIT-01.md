# SPRINT-MEDIA-TENANT-ISOLATION-AUDIT-01 — 租户隔离 P0 审计（只审计，零代码改动）

**Date:** 2026-08-03 08:10
**Gate:** 掌柜 P0 指令（账号 B 疑似可见账号 A 的南波万渠道资产 → 先查后修，P0 优先于 QR Latency）
**结论:** 掌柜判断成立 —— **租户隔离存在 3 条 P0 级代码漏洞**；当前数据下「未串」是 500 bug 与残缺数据碰巧挡路，**非隔离有效**。

---

## 一句话判定

> 无企业用户（JWT 无 org）登录后：
> - **跨租户接口** `/api/enterprise/:tenantId/channels/accounts`：URL 传南波万 tenantId 即可读其账号（当前被权限服务 500 挡路，**修好即 IDOR 直通**）
> - **owner-view**：`organizationId === 'default'` 跳过过滤 → 返回全部 media workspace（当前因绑定 agent 数据残缺显示为空，属假阴性）
> - **tenant-guard**（TENANT_ID_FROM_JWT_ONLY 规则）：**定义了但零注册**，从未生效

---

## Task01 数据模型审计

| 模型 | 租户字段 | 现状 |
|---|---|---|
| EnterpriseChannelAccount | tenantId / governanceTenantId / organizationId / ownerId / ownerType / manageRole | ✅ 字段齐全，**但值严重混乱**（见下） |
| BrowserWorkspace | tenantId / organizationId / channelAccountId / businessType | ✅ 字段齐全，与账号 org 基本对齐 |
| AgentChannelBinding | agentInstanceId / channelAccountId / browserWorkspaceId | ✅ 字段齐全（2 条存量绑定） |

**账号租户值混乱（数据治理问题）：**

| 账号 | tenantId | organizationId | ownerId | 判定 |
|---|---|---|---|---|
| 抖音 南坡万（08a0f643） | 9af5f6bd（=昆仑镜验收测试企业 govOrg tenant ✅） | 11111111-2222（昆仑镜验收测试企业 ✅） | 0ba5bf98（用户南波万 ✅） | **账号层 OK** |
| 快手（10e0ea29） | affc9201（幽灵，无对应 org/user ❌） | affc9201（幽灵 ❌） | 0ba5bf98 | tenant 幽灵 |
| 微信 骏霄（c4a1b25f） | d57d9df8（幽灵 ❌） | **空** | **空** | **孤儿 CONNECTED** |
| 小红书（45663e51） | 0ba5bf98（=用户 id 当 tenant ❌） | 空 | 空 | 孤儿 |

**结构性矛盾（G4 实锤）:** 南波万用户 govUser 链 → tenant f28823ce → org `c7064fde`（郑州骏霄），但抖音账号 org=`11111111-2222`（昆仑镜验收测试企业）→ **南波万本人登录，owner-view 按自身 org 过滤 → 看不到自己的抖音账号**。用户→org 映射链与账号写入 org 是两条线，从未对齐。

## Task02 API 审计

### 🔴 P0-1 跨租户账户接口零校验（IDOR 通道）
```ts
// src/routes/enterprise-channel.ts:171
app.get('/api/enterprise/:tenantId/channels/accounts', async (request, reply) => {
  const { tenantId } = request.params as any          // ← URL 客户端可控
  const accounts = await channelAccountService.listAccounts(tenantId)  // ← 直接查库
})
```
- 无任何 JWT org 比对；任意登录用户传任意 tenantId 即可读该租户全部账号
- 同类：`POST /api/enterprise/:tenantId/channels/accounts`（任意用户给任意租户建账号）、`GET .../accounts/:id`（详情无校验）
- **当前 500 掩盖**：`channel-permission.service.ts:70` 调 `prisma.govUser.findFirst({ where: { userId: input.govUserId, ... } })` —— **GovUser 模型无 userId 字段** → 该权限检查**从未成功过**（Prisma Unknown field 抛错）→ 修复此 bug 后 IDOR 直接暴露

### 🔴 P0-2 owner-view 无企业用户不过滤
```ts
// src/routes/browser-workspace.routes.ts:31-37
const ctx = (request) => ({
  organizationId: user?.organizationId || user?.orgId || user?.tenantId || user?.id || 'default',
})
// :254 owner-view
const wsWhere = { businessType }
if (organizationId && organizationId !== 'default') { wsWhere.organizationId = organizationId }  // ← 'default' 不过滤！
```
- 无 org 用户（getOrganizationIdForUser 返回 null → JWT 无 org）→ fallback `'default'` → **跳过 org 过滤 → 返回全部 media workspace**
- 实测 careeruitest（无 govUser）owner-view 返回 0 —— **假阴性**：存量绑定 agent `7e0b486f` 在 DB 不存在，全部被 `agent/profile 域过滤` 跳过。一旦存在 media 域 agent 绑定，无企业用户即可见全部

### 🔴 P0-3 tenant-guard 零注册
- `src/middleware/tenant-guard.ts` 定义了严格规则（禁客户端传 tenantId / 仅 JWT 取 org），**但 `registerTenantGuard` 全仓无任何调用** → 保护从未生效
- G3 实测：带 `?tenantId=hack-attempt` 请求未被 403

### 🟡 其他
- `getAccounts(tenantId)` 带 tenantId 过滤 ✅（但上层入口把 tenantId 暴露在 URL，可信性为零）
- `resolveTenantId` 本身正确（JWT-only），只是没人用它

## Task03 前端非重点（后端响应即真相）
- 前端看到的 = 后端已返回；本审计全部聚焦后端查询链与响应
- 实测响应：跨租户 500 / owner-view [] / registry 平台能力清单（无账号数据）

## Task04 Reality Gate（scripts/reality-check-tenant-isolation-01.mjs）

**2/5 PASS，3 FAIL**

| 用例 | 预期 | 现状 | 结果 |
|---|---|---|---|
| G1 无企业用户跨租户读账号 | 被拒/空 | HTTP 500（权限服务 bug 挡路，非隔离） | ❌ FAIL |
| G2 无企业用户 owner-view | 空 | 空（假阴性，代码路径无 org 过滤） | ✅ PASS* |
| G3 tenant-guard 挂载 | 已挂载 | 未挂载（零注册） | ❌ FAIL |
| G4 南波万用户 org 一致性 | 用户 org = 账号 org | 用户 c7064fde(骏霄) ≠ 账号 11111111(昆仑镜验收测试企业) | ❌ FAIL |
| G5 registry 无敏感数据 | 无账号身份 | 仅平台能力清单 | ✅ PASS |

## 修复建议（待掌柜批准，不在本 sprint 动手）

1. **tenant-guard 挂载**到全部 `/api/enterprise/*` 路由组；无 org 用户 → 403（而非 fallback default）
2. **accounts 路由去 URL tenantId**：从 JWT 解析；删除/废弃 `:tenantId` 路径参数
3. **修 channel-permission.service**：`userId` 字段不存在 → 改按 email 关联 govUser 或改查真实字段（此 bug 当前同时是「保护」与「500 祸根」）
4. **owner-view ctx 收紧**：删除 `'default'` 宽松路径；businessType+org 双重过滤改为强制
5. **数据治理**：快手 tenant（affc9201 幽灵）、骏霄孤儿（org/owner 空）、小红书 tenant=用户 id 三类脏数据统一迁移到真实 govOrg tenant；南波万用户 org 与账号 org 对齐（决策：账号归昆仑镜验收测试企业 还是 骏霄？）

## 关联
- 冻结清单中「⏸ 安全项（明文 Key / IDOR）单独进 Security Sprint」→ 掌柜本次升级为 **P0 提前审计**；本 sprint 只审计，修复方案待批
- QR Latency 审计（qr-latency-audit-01.mjs）已就绪暂停，P0 处置后恢复
- 审计动作说明：为实测临时重置 careeruitest 密码（已恢复原 hash）、未创建任何数据、未改任何代码
