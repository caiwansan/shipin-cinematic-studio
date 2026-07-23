# 权限、配额、路由决策分类

> 生成时间：2026-07-24
> 分支：feat/p1-a-member-tier-20260724

## 分类原则

| 类型 | 含义 | 统一机制 | 错误返回 |
|---|---|---|---|
| Access Control | 能不能访问某个功能 | `requireMemberTier` / `assertMemberTier` | 401 / 403 |
| Quota Control | 还能用多少次、还有没有额度 | `requireCredit` / `assertQuota` | 402 / 403 |
| Routing Decision | 走哪条链路、用哪个模型 | `agent router` / `model router` | 不拦截 |

## 关键区别

- **Access Control**：等级不足 → 直接拒绝访问
- **Quota Control**：等级足够但额度用完 → 提示充值/购买
- **Routing Decision**：等级影响服务质量/模型选择，但不拒绝服务

## 当前散落判断处理

| 文件 | 行号 | 类型 | 当前逻辑 | 处理方式 |
|---|---:|---|---|---|
| `customer-service.ts` | 319 | Quota Tracking | free/basic 用户追踪配额 | 保留，后续迁移到 quota guard |
| `payment.ts` | 957 | Quota / Payment Routing | 推荐人 agentStatus/memberTier 校验 | 保留，后续迁移到 payment policy |
| `cost-optimizer.ts` | 94 | Routing Decision | 根据 tier 选择 provider 路由策略 | 保留，后续迁移到 model router |

### 新增登记（P1-A 阶段发现）

| 文件 | 行号 | 类型 | 当前逻辑 | 处理方式 |
|---|---:|---|---|
| `sms-auth.ts` | 252 | Tier Sync | Membership → User 等级同步 | 保留，属于数据同步逻辑 |
| `qq-oauth.ts` | 347 | Tier Sync | Membership → User 等级同步 | 保留，属于数据同步逻辑 |
| `admin-market-agents.ts` | 99 | Display Flag | isVip 标记（管理员列表展示） | 保留，属于展示逻辑 |
| `admin-dashboard.ts` | 51 | Analytics | 统计今日新增 VIP 用户数 | 保留，属于统计查询 |

### 分类说明

- **Tier Sync**：将 Membership.tier 同步到 User.memberTier，属于数据一致性逻辑，不是访问控制
- **Display Flag**：管理员界面展示用，不影响业务权限
- **Analytics**：后台统计查询，不影响业务权限

## 业务代码规则

业务代码中允许出现 `memberTier` 的场景：

1. `require-member-tier.ts` 中间件本身
2. `memberTierGuard.ts` 断言函数本身
3. 类型定义 / 枚举映射
4. 上述 3 处已登记的配额/路由逻辑（需有注释说明）
5. 测试文件

除上述场景外，业务代码中出现 `memberTier ===` / `memberTier !==` 即视为散落判断。
