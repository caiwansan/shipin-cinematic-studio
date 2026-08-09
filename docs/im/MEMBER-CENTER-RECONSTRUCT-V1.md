# 昆仑镜 会员中心重构 — 产品审计与技术方案 V1

> 状态：草案，待掌柜验收拍板
> 日期：2026-08-06
> 依据：掌柜 QQ 指令（2026-08-06 05:02「会员中心需要重构」）
> 纪律：Reality Gate —— 本文件为只读产品审计 + 流程设计，通过后拆 Sprint 开发

---

## 1. 掌柜需求（原话拆解）

会员中心需要重构，包含：

| # | 模块 | 掌柜要点 |
|---|---|---|
| C1 | **设置中心** | 绑定手机号、绑定微信/支付宝（二维码）、重置登录密码、设置支付密码 |
| C2 | **我的余额** | 可提现收益余额展示 |
| C3 | **我的钻石** | 充值钻石 / 收益钻石（照搬抖音模式，IM 方案 M5 已拍板命名） |
| C4 | **我的VIP** | 当前等级 / 到期时间 / 升级续费 |
| C5 | **我的订单** | 充值 / VIP 订单列表 + 状态 |
| C6 | **我要推广** | 邀请链接 / 邀请码 / 推广奖励 |
| C7 | **我的团队** | 代理商团队 / 下级成员 |
| C8 | **我的好友** | IM 好友列表（聊天系统好友） |
| C9 | **我的社群** | IM 群聊 / 频道（聊天系统社群） |

## 2. 现状审计（已有底子 vs 缺口）

### 2.1 前端现状（pages/user/）

| 页面 | 现状 | 对应掌柜模块 |
|---|---|---|
| `center.vue` | 会员卡片 + 积分 + 5 个模块入口（作品/图库/存储/推荐/代理） | 会员中心骨架 ✅ 但模块不齐 |
| `profile.vue` | 个人资料（用户名/头像/邮箱） | 设置中心部分 ✅ |
| `bind-phone.vue` | QQ 登录绑定手机（qq_bind_token 专用） | C1 绑定手机号 ⚠️ 仅 QQ 场景 |
| `membership.vue` | VIP 升级/续费（memberPlan） | C4 我的VIP ✅ |
| `wallet.vue` | 余额/绑卡/提现 | C2 我的余额 ✅ 基础 |
| `referral.vue` | 推荐链接/邀请码/奖励积分 | C6 我要推广 ✅ 基础 |
| `agent.vue` | 代理商申请/佣金 | C7 我的团队 ⚠️ 代理向 |
| `promo.vue` | 推广（老版） | C6 冗余待合并 |
| `credits.vue` | 积分流水 | 可并入 C3 |
| `library.vue`/`gallery.vue`/`storage.vue` | 作品/图库/存储 | 保留不动 |

**缺口**：无「设置中心」统一页（无绑定微信/支付宝二维码、无重置密码、无支付密码）；无「我的订单」页；无「我的好友」页；无「我的社群」页；无钻石账户页。

### 2.2 后端现状（routes/ + schema）

| 能力 | 现状 | 缺口 |
|---|---|---|
| 用户 | `User` 表：email/username/passwordHash/phone/phoneVerified/wechatOpenId/qqOpenId/memberTier/memberExpiresAt | ❌ 无 alipayOpenId、无支付密码字段、无重置密码路由 |
| 余额 | `wallet.ts`：/api/wallet、bind-account、withdraw | ✅ 基础 |
| 收益 | `CreatorWallet`（totalEarned/balance） | ✅ 复用 |
| 钻石 | `CoinLog`（积分流水）+ Membership.credits | ❌ 无 DiamondAccount 独立表（IM 方案 M5 规划） |
| VIP | `member.ts`：plans/upgrade-vip/create-payment/submit-payment/pay-confirm + admin vip-orders | ✅ |
| 订单 | `PaymentOrder` 表（type: credit/vip、status） | ❌ 无用户端订单列表 API |
| 推广 | `user-center.ts`：/api/user/promo、referral-code、agent/apply/status | ✅ 基础（referralCode=userId） |
| 团队 | Membership.parentId/children（推广树） | ⚠️ 有树但无团队视图 API |
| 好友 | ❌ 无好友关系表（IM 聊天用 WuKongIM 频道模型） | ❌ 需自建（IM 方案 M2 范畴） |
| 社群 | WuKongIM 频道 + 昆仑茶馆（/chat 已上线公共频道） | ⚠️ 群聊开发中（IM-CHA 迭代） |
| 短信 | `sms-auth.ts`（SmsCode/发送/校验） | ✅ 可复用绑定手机 |
| 支付密码 | ❌ 无 | ❌ 需新增（提现/消费敏感操作校验） |

### 2.3 关键结论

1. **会员中心骨架已存在**（center.vue），问题是「模块入口不齐 + 无设置中心 + 页面分散」→ 重构 = 升级骨架 + 补齐 5 个缺口模块，不是推倒重来。
2. **微信绑定有底子**（wechatOpenId 微信登录已有），**支付宝绑定零底子**（无 openId 字段、无扫码绑定流程）。
3. **重置登录密码**：User 表有 passwordHash + EmailCode 验证码表 → 可做「邮箱验证码 → 重置密码」闭环。
4. **支付密码**：全新字段 + 全新校验逻辑（提现/红包/礼物消费时校验），安全红线。
5. **钻石体系**：IM 方案 M5 已拍板（充值钻石不可提现 / 收益钻石可兑 1:0.1），DiamondAccount 表未建 → 会员中心 C3 与 IM M5 是同一件事，**必须同 Sprint 一起做**，避免两套账本。
6. **好友/社群**：依赖 IM 聊天系统（好友关系表 + 群聊开发），**是 C8/C9 的前置**。

## 3. 目标架构

```
会员中心 /user/center（重构后）
├── 会员总览卡（等级/到期/钻石余额/收益余额 — 聚合 API）
├── C2 我的余额     → /user/wallet（复用+改造）
├── C3 我的钻石     → /user/diamonds（新）← IM M5 DiamondAccount
├── C4 我的VIP      → /user/membership（复用）
├── C5 我的订单     → /user/orders（新，PaymentOrder 用户视图）
├── C6 我要推广     → /user/referral（复用，升级）
├── C7 我的团队     → /user/team（新，推广树/代理团队视图）
├── C8 我的好友     → /user/friends（新，IM 好友）← IM M2
├── C9 我的社群     → /user/groups（新，IM 群列表）← IM M2
└── C1 设置中心     → /user/settings（新）
    ├── 绑定手机号（sms-auth 复用）
    ├── 绑定微信（wechatOpenId，扫码/跳转授权）
    ├── 绑定支付宝（新：alipayOpenId + 扫码绑定流程）
    ├── 重置登录密码（EmailCode 验证码 → 改 passwordHash）
    └── 设置支付密码（新：payPasswordHash + 校验中间件）
```

**聚合 API**：`GET /api/member/overview` — 一次返回 钻石余额/收益余额/VIP等级到期/订单数/邀请数/团队数/好友数/群数 → 会员总览卡 + 各模块入口角标。

## 4. 新增数据模型（均独立新表/新字段，不污染现有体系）

```prisma
// User 表新增字段
alipayOpenId        String?  @unique   // 支付宝绑定
payPasswordHash     String?            // 支付密码（bcrypt）
wechatBoundAt       DateTime?          // 微信绑定时间
alipayBoundAt       DateTime?          // 支付宝绑定时间

// 新表
DiamondAccount      // 钻石账户（IM M5 已规划）：userId 1:1、rechargeDiamonds 充值钻石、earnDiamonds 收益钻石
CoinLedger          // 钻石/收益流水（或扩展 CoinLog type —— 方案 M5 待定）
UserFriend          // 好友关系：userId + friendId + status(pending/accepted) + remark
PaymentPasswordLog  // 支付密码操作审计（安全红线）
```

> 好友/社群数据若 WuKongIM 已可承载（频道订阅者模型），UserFriend 可降级为轻量关系表，群列表直接查 WuKongIM —— 待 IM M2 拆解时定。

## 5. 拍板点清单（待掌柜确认）

| # | 拍板点 | 选项 |
|---|---|---|
| D1 | 会员中心导航形态 | A. 左侧边栏 + 右侧内容（设置中心风格） B. 首页宫格入口 + 子页面（现有风格升级） |
| D2 | 绑定微信/支付宝方式 | A. 二维码扫码绑定（App 扫网页码） B. 跳转授权链接 C. 收款码展示（如果只是提现收款账户） |
| D3 | 重置密码校验 | A. 邮箱验证码 B. 手机验证码 C. 原密码 + 新密码 |
| D4 | 支付密码用途 | A. 提现 + 红包 + 礼物 B. 仅提现 C. 仅红包/礼物 |
| D5 | 我的订单范围 | A. 充值 + VIP 订单 B. 含红包/礼物消费流水 |
| D6 | 我的团队定义 | A. 推广下级（邀请树） B. 代理团队（有代理等级） C. 两者合并 |
| D7 | 钻石体系是否与 IM M5 同 Sprint | 强烈建议同 Sprint（避免两套账本） |
| D8 | 好友/社群前置 | 依赖 IM 好友关系表 + 群聊开发，是否本轮一起做 |

## 6. 建议 Sprint 拆解（待掌柜拍板后执行）

| Sprint | 内容 | 依赖 |
|---|---|---|
| MEMBER-CENTER-01 | 会员中心骨架重构（总览卡 + 聚合 API + 9 入口导航） | 无 |
| MEMBER-SETTINGS-01 | 设置中心：绑定手机/微信/支付宝 + 重置密码 + 支付密码 | 无 |
| MEMBER-ORDERS-01 | 我的订单（PaymentOrder 用户视图） | 无 |
| MEMBER-DIAMOND-01 | 钻石账户 + 流水（与 IM M5 合并执行） | IM 方案 M5 |
| MEMBER-TEAM-01 | 我的团队 + 我要推广升级 | 无 |
| IM-FRIENDS-01 | 好友关系 + 我的好友页 | IM M2 |
| IM-GROUPS-01 | 我的社群（群列表/已加入群） | IM M2 群聊 |

## 7. 冻结清单（Reality Gate）

- ❌ 不做支付牌照级功能（充值钻石提现红线不变）
- ❌ 不碰 PaymentOrder/User 现有结构（只加字段，不删）
- ❌ 支付密码不落明文（bcrypt，与登录密码同标准）
- ❌ 绑定第三方账号前必须用户授权确认（杜绝静默绑定）
- ⏸ 实名/未成年限额进入正式版前必须
