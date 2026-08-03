# SPRINT-MEDIA-TENANT-ISOLATION-FIX-01 — 多租户边界全量修复 — COMPLETE ✅

**Date:** 2026-08-03 08:40
**Gate:** 掌柜 P0 指令（「新媒体工作台多租户基础架构没有真正成立」→ 暂停登录优化，全量修复租户边界；隔离 > QR 延迟 > 登录模型）
**核心:** 从「URL 传 tenantId 直接查库」→「JWT organizationId 强制解析 + 账号按 org 过滤」；无组织用户一律 403

---

## 修复清单

### Task01 JWT 组织解析（browser-workspace.routes.ts）
- ❌→✅ `ctx` 原 fallback 链 `user?.organizationId || user?.orgId || user?.tenantId || user?.id || 'default'`（'default' = 看全部）→ **`user?.organizationId || user?.orgId || null`**
- 无 org = 未知身份 → 调用方 403，禁止降级为「看全部」

### Task02 ChannelAccount 隔离（enterprise-channel.ts + enterprise-channel-runtime.ts）
- 新增 preHandler 租户强制校验：URL `:tenantId` 必须映射到 JWT organizationId 对应的 govOrg，不一致 → `403 TENANT_CONTEXT_INVALID`
- 新增 JWT-only 路由 `GET /api/enterprise/channels/accounts`（后端按 organizationId 过滤，listAccountsByOrg）
- **修复 account-status / ensure-account 无 org 过滤**（曾 `findFirst({channelType})` 全局取号——「账号 B 看到南波万登录状态」实锤接口）：全部按 `organizationId` 过滤；ensure-account 创建账号带 organizationId（杜绝孤儿）
- runtime `:id` 路由（connect/metrics/health/refresh-credential/wait-for-login）preHandler 校验账号 org === 用户 org（IDOR 关闭）

### Task03 OwnerView 隔离（browser-workspace.routes.ts + service）
- owner-view：无 org → `403 NO_ORGANIZATION`；wsWhere 强制 `organizationId`
- GET /workspaces 列表/创建：全局 org guard（无 org 403）
- 详情/start：workspace org 归属校验（`403 WORKSPACE_NOT_IN_ORG`）
- **修复 getOrCreate 跨 org 引用**（曾 findUnique(by channelAccountId) 返回他人 workspace）→ org 不一致抛错

### Task04 修 channel-permission.service（500 祸根）
- `govUser.findFirst({where:{userId}})`——**GovUser 无 userId 字段，该服务从未成功过（全渠道路由 500）** → 改为 user.email → govUser
- `govUser.organizationId`（字段不存在，范围检查恒通过）→ tenantId → govOrganization.id 映射

### Task05 Channel Identity Migration（数据治理，不删除）
- 新表 `ChannelAccountOwnerSnapshot`（7 条迁移记录）
- 用户对齐：**掌柜** govUser.tenant 01f909e5（无主）→ 9af5f6bd；**南波万** govUser.tenant f28823ce（骏霄）→ 9af5f6bd → 二人 JWT org=11111111（昆仑镜验收测试企业）
- 账号重归属：快手（幽灵 affc9201 → 9af5f6bd/11111111，owner 南波万保留）、骏霄（孤儿 → f28823ce/c7064fde，归郑州骏霄）、小红书（无主 → QUARANTINE 隔离区 qqqqqqqq-0000，不删除）
- BrowserWorkspace 同步对齐（e310162e/88527dbe），终检 4/4 账号-workspace org 一致，0 孤儿账号
- 备份：data/backups/tenant-isolation-fix-01-pre-migration.sql

## Reality Gate：9/9 PASS（掌柜 G1-G5 定义）

| 用例 | 结果 |
|---|---|
| G1 JWT组织解析 | ✅ 有 org 用户 JWT 携带 org=11111111；无 org 用户 JWT 无 org |
| G2 ChannelAccount隔离 | ✅ 本 org 只见 douyin+kuaishou；骏霄 tenant 跨租户 → 403；account-status 按 org；metrics 本 org 可访问 |
| G3 OwnerView隔离 | ✅ 返回 2 条全属本 org（无骏霄/小红书/他人资产） |
| G4 Agent Binding隔离 | ✅ 绑定可见性随 org 过滤，无跨 org 泄露 |
| G5 无组织访问403 | ✅ 5 入口（accounts/owner-view/跨租户/account-status/workspaces）全 403 NO_ORGANIZATION |

补充：ensure-account 有 org 200（返回本 org 账号）/无 org 403；reality API 本 org 200

## 测试账号（保留供后续验收）
- `tenant_org_test@audit.local` / AuditTest@123（昆仑镜验收测试企业，正向）
- `tenant_iso_test@audit.local` / AuditTest@123（无组织，负向）

## 关键经验
- **掌柜架构定调落地**：User→Membership→Organization→EnterpriseWorkspace→ChannelAccount→BrowserWorkspace→AI Employee Binding；查询一律 `WHERE organizationId=currentOrg`；tenantId 永不客户端决定
- 「没串数据」曾经是假象：G1 审计时 500（权限服务 bug）+ owner-view 假阴性（绑定 agent 数据残缺）+ account-status 全局取号（实锤）——三处都在本次修复
- 两套组织体系（govOrganization vs Organization 表）以 gov 体系为 media 业务真源；用户 govUser.tenant 是 org 关联键

## 待掌柜
- 真机登录确认：掌柜/南波万 QQ 账号登录 → 渠道中心可见南坡万抖音+快手 → owner-view 2 条
- 后续按掌柜排序：SPRINT-MEDIA-QR-LATENCY-OPTIMIZE-01（QR 异步化 2-5s 出码）→ LOGIN-CAPABILITY-V4（+Ownership 层）
- 安全项残留：quarantine 账号（小红书）等掌柜决策（恢复或保留隔离）；明文 Key 项仍在 Security Sprint 清单

提交：见 git log
