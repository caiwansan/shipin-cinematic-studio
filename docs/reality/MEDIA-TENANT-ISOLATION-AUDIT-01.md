# SPRINT-MEDIA-TENANT-ISOLATION-AUDIT-01 — 多租户隔离 P0 审计（只审计，零改动）— COMPLETE ✅

**Date:** 2026-08-03 08:30
**Gate:** 掌柜 P0 指令（「账号 B 登录仍看到账号 A 的渠道账号 = 数据越权展示，安全级问题」→ 停止修登录，只审计不改代码，先找出哪层漏了用户身份绑定）

---

## 审计结论（先答掌柜的假设）

**掌柜判断 ✅ 成立，且问题比报的更严重，分两级：**

| 级别 | 问题 | 实测 |
|---|---|---|
| **P0-A 跨企业 IDOR**（掌柜没报，审计新发现） | `GET /channels/:id/reality` 无任何 org/owner 过滤（历史「全局资源」注释包袱） | 无组织用户 iso 读南波万抖音 → **200 + 泄露 externalAccountId=881306 + 账号名「南坡万」** |
| **P0-B 同企业用户级隔离缺失**（掌柜报的） | owner-view / accounts / account-status / ensure-account 只按 organizationId 过滤，**未绑定当前用户** | 账号B(tenant_org_test) → 看到南波万(ownerId=0ba5bf98) 的抖音+快手+2台数字电脑 |

**根因一句话：查询链只绑了「企业」（organizationId），没绑「用户」（ownerId）——Single Identity Authority 缺最后一段；channel-reality 连企业都没绑。**

---

## Task01 数据模型审计

| 模型 | tenantId | organizationId | ownerId | 结论 |
|---|---|---|---|---|
| EnterpriseChannelAccount | ✅ | ✅ | ✅ ownerId(govUser) | **归属字段齐全——但查询没用 ownerId** |
| BrowserWorkspace | ✅ | ✅ | ❌ 无 | 缺用户级归属字段 |
| AgentChannelBinding | ✅(governance tenant) | ❌ 无 | 需经 agent 反查 | 企业级归属靠反查链 |
| EnterpriseAgentInstance | ✅ | ✅ | employeeId | 归属齐（反查链可用） |

## Task02 API 审计（13 个查询点全查）

**🔴 P0-A 跨企业 IDOR（1 处）**
- `channel-reality.routes.ts:51` — `findFirst({id})` 零过滤。任何登录用户（含无组织）可读任意账号 identity/externalAccountId。代码注释声称「渠道账号是组织级全局资源，仅要求已认证」——历史包袱，与 FIX-01 的隔离原则直接冲突

**🔴 P0-B 同企业用户级隔离缺失（4 处，掌柜报的）**
- `owner-view`（browser-workspace.routes.ts:281）— `wsWhere={businessType, organizationId}` → 账号B 看到账号A 的数字电脑
- `GET /channels/accounts`（enterprise-channel.ts:200）— `listAccountsByOrg(orgId)` → 账号B 看到账号A 的账号
- `account-status`（enterprise-channel-runtime.ts:137）— `{channelType, organizationId}` → 账号B 看账号A 登录状态
- `ensure-account`（enterprise-channel-runtime.ts:174）— `{channelType, organizationId}` + `findFirst` → **写路径串号：账号B 发起连接会复用账号A 的抖音账号**（最危险：不只是读泄露，是操作串号）
- （连带）browser-workspace.routes.ts:94 创建 workspace 未指定账号时同样跨用户取号

**🟡 B 级 tenantId 语义风险（5 处，调用方来源待定，未逐条实锤）**
- enterprise-channel.ts:575 `{tenantId, channelType:'wechat_work'}`（URL tenantId，guard 已校验，低危）
- channel.service.ts:882 `{tenantId}`（调用方来源待查）
- agent-channel-binding.service.ts:212 `getAvailableChannels({tenantId})`（tenantId 参数来源待查）
- agent-channel-binding.service.ts:115 bind 校验 `{id, tenantId: dto.tenantId}`（tenantId 客户端传入，可伪造）
- roi-dashboard.service.ts:134 `{tenantId, status:'active'}`（**status 字段不存在于表**——Prisma 应报错，接口疑似恒 500）

**✅ 已隔离（FIX-01 确认，保持）**
- 跨企业 org 过滤：iso/骏霄 全部 403；无 org 用户 owner-view/accounts/workspaces 403

## Task03 实测复现（铁证）

```
账号B(tenant_org_test@audit.local) 登录：
  owner-view → 200, 2 台数字电脑（南波万抖音 b27a2e1e + 快手 e310162e）
  accounts   → 200, 3 条（南波万抖音 ownerId=0ba5bf98、快手 ownerId=0ba5bf98）

无组织用户(tenant_iso_test@audit.local)：
  reality(南波万抖音) → 200, externalAccountId=881306 泄露
```

## Task04 Reality Gate：1/4 PASS，3 FAIL（缺口实锤）

```
✅ A1 无组织用户 owner-view 403（跨企业隔离保持）
❌ A2 账号B 看到账号A 渠道账号 2 条（用户级隔离缺失）
❌ A3 账号B 看到账号A 数字电脑 2 台（用户级隔离缺失）
❌ A4 无组织用户读他人 reality 200 + externalAccountId 泄露（跨企业 IDOR）
```
脚本：scripts/reality-check-tenant-isolation-audit-01.mjs（可重复执行）

---

## 修复方案（待掌柜批准——本 sprint 只审计零改动）

**决策点 1（产品语义，掌柜定）：渠道账号是企业共享资产还是用户私有资产？**
- 选项 A「用户私有」：ownerId=登录者，他人不可见（推荐——与掌柜「谁登录的账号归谁」一致；AI 员工绑定是唯一授权通道）
- 选项 B「企业共享」：保持现状 organizationId 可见（但 ensure-account 仍须禁止 findFirst 偷取他人账号）
- 注意影响：若选 A，掌柜（非南波万）将看不到南波万账号——掌柜验收场景需「南波万→掌柜」显式共享授权或确认掌柜=南波万本人

**修复清单（批准后执行）：**
1. 🔴 `channel-reality` 补 org 校验（任何模型都必须做——跨企业 IDOR 无争议）
2. 🔴 `ensure-account` 禁止复用他人账号：账号 B 连接时只允许「新建自己账号」或「显式选中自己 ownerId 的账号」，绝不允许 findFirst 偷取
3. 🔴 owner-view / accounts / account-status 绑定 ownerId（若选 A）
4. 🟡 agent-channel-binding tenantId 语义统一（governance tenantId 或 organizationId 二选一）
5. 🟡 roi-dashboard 的 status 字段修复（疑似恒 500）

**数据迁移影响（若选 A）：** ChannelAccount 已有 ownerId 字段（南波万 0ba5bf98），无需改表；BrowserWorkspace 需补 ownerId 列（或经 channelAccountId 反查 ownerId）；AgentChannelBinding 经 agent 反查 org。
