# SPRINT-MEDIA-TENANT-ISOLATION-FIX-02 — 用户私有资产模型（方案 A）落地 — COMPLETE ✅

**Date:** 2026-08-03 09:20
**Gate:** 掌柜 P0 批准（「选 A：渠道账号 = 用户私有资产。禁止企业成员默认共享。新增授权层，不通过迁移 owner 绕过授权。先修 P0 隔离，再处理二维码性能」）
**前置:** AUDIT-01 实锤 3 缺口（P0-A reality IDOR / P0-B 同企业用户级隔离缺失 / 写路径串号）

---

## 冻结的资产模型（掌柜批准）

```
User ── owns ──> ChannelAccount（第一归属 ownerId=登录创建者）
                     │
                     │ authorized by（第二归属 organizationId = 工作环境）
                     ▼
                Organization
                     │ binds
                     ▼
                AI Employee（AgentChannelBinding = 授权使用）
                     ▲
                共享访问 = ChannelAccountShare（READ/ANALYZE/MANAGE），禁止改 ownerId 绕过
```

## Task01 数据隔离硬修复（读取全链路绑 ownerId+share）

| 端点 | 修复 |
|---|---|
| GET /channels/accounts | listAccountsByOrgForUser：`{organizationId} ∩ {accessibleIds}`（owner ∪ share grantee） |
| owner-view | wsWhere 加 `channelAccountId ∈ accessibleIds`；无可访问账号 → 空列表（不回落看全部） |
| GET /workspaces/:id + start/stop/restart/health/logs/trajectory | assertWsUserAccess：canAccess(MANAGE) |
| GET /channels/runtime/:platform/account-status | `{channelType, orgId, id ∈ accessibleIds}` |
| GET /channels/runtime/:id/metrics | 前置 canAccess(READ)（实测 iso→南波万 403 ✅） |
| GET /channels/:id/reality | 前置 canAccess(READ)（P0-A IDOR 关闭） |
| POST /agents/:agentInstanceId/channels（绑定） | 前置 canAccess(MANAGE)（防授权绕过） |

## Task02 写路径防串号（P0 事故预防）

- `ensure-account`：`findFirst({channelType, organizationId})`（偷取他人账号）→ **`{channelType, organizationId, ownerId: user.id}`**；找不到 → 新建自己账号（ownerId=user.id）
- `connectAccount`：写死 `ownerId:''` → **ownerId 参数必传**（创建者即 owner）
- browser-workspace 未指定账号时同样 ownerId 限定
- **唯一约束迁移**：`(tenant_id, channel_type)` → `(owner_id, channel_type)`（同组织多用户可各持账号；一个用户一个平台一个账号）

## Task03 reality API 权限化

- `GET /channels/:id/reality`：authContext → canAccess（owner 或 grantee）→ 返回；知道 id 不再等于可访问
- 无组织用户若是 owner 本人仍可读（账号属人，不属组织）

## Task04 数据治理（零删除）

- **无主账号（ownerId=''）5 条** → 独立幽灵 `unclaimed-<id>`（保持不可见，不冲突），全部记入 `channel_ownership_migration`
- 南波万账号（08a0f643/10e0ea29）ownerId=0ba5bf98 **保留原值**（幽灵，待掌柜确认真实归属；不猜不改）
- `ChannelOwnershipMigration` 审计表：7 条迁移记录（operator/reason 齐备）
- 验收残留清理：测试假 grantee share 已删

## 授权层 ChannelAccountShare（新增）

- 表：`channel_account_share`（channelAccountId + granteeUserId 唯一，permission READ/ANALYZE/MANAGE，expiresAt 可过期）
- API：POST/GET/DELETE `/api/enterprise/channels/:id/shares`（仅 owner 或 MANAGE 授权人可管理）
- 权限分级：MANAGE ⊃ ANALYZE ⊃ READ；过期自动失效

## 验收

**FIX-02 Reality Gate 9/9**（scripts/reality-check-tenant-isolation-fix-02.mjs）：
```
✅ A1 无组织用户 owner-view 403（跨企业保持）        ✅ A6 ensure-account 不串号（新建自己账号）
✅ A2 账号B(无授权) 不见南波万账号                    ✅ A7 授权(MANAGE)后可见（列表+reality 200）
✅ A3 账号B(无授权) 不见南波万 workspace              ✅ A8 MANAGE 可管理（创建共享 200）
✅ A4 无组织用户读 reality 403（IDOR 关闭）           ✅ A9 撤销授权后不可见
✅ A5 账号B(无授权) 读 reality 403
```
**FIX-01 回归 9/9**（脚本断言更新为新语义：G2/G2c/G3 从「org 共享可见」改为「无授权不可见」——跨企业隔离 G2b/G4/G5 保持）
**metrics IDOR 复测**：无组织用户 → 403 ✅

## 关键经验

- 测试污染：验收脚本二次 login 会吊销旧 token（tokenVersion 机制）→ 断言内禁止重复登录；授权种子需在脚本开头清理，否则下一轮误判
- Prisma unique 约束实际是**唯一索引**（pg_indexes 查，pg_constraint 查不到）；db push 会因 ai_provider 存量冲突失败 → 用 SQL 直接迁移约束
- 约束迁移顺序：先治理数据（无主账号幽灵化）→ 再建新唯一索引（防重复组冲突）

## 待掌柜

1. **掌柜登录账号的 user id** 提供给我 → 给南波万账号 seed MANAGE share（注：FIX-03 发现 0ba5bf98 其实是掌柜 QQ 登录账号 qq_6F736FAC37ED3A3AF774AE0924374F4D@aigc.fushtn.com 的 id——南波万 owner=掌柜本人，本报告「幽灵」判定错误，已更正）
2. 南波万账号 ownerId=0ba5bf98 真实归属确认（FIX-03 已确认 = 掌柜 QQ 账号，无需再迁移）
3. 遗留：POST /workspaces/recover（服务恢复）仍是全局恢复（运维动作，无数据泄露但可跨 org 拉起浏览器）→ 待办列入后续

## 优先级确认（掌柜指令）

1. 🔴 租户/用户隔离 ✅ 完成
2. 🔴 写路径防串号 ✅ 完成
3. 🟡 二维码速度优化（下一轮）
4. 🟢 登录能力继续扩展（冻结中）
