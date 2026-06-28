# 会员等级系统架构 · Membership System

> **状态: FROZEN (v2)**
> 冻结时间: 2026-06-24
> 仅新增映射入口时不视为架构变更

---

## 核心契约

```
Membership.tier (Database — 唯一真相源)
    │
    ▼  (自动同步)
User.memberTier (Cache — 不使用时不影响正确性)
    │
    ▼  (前端读取)
frontend/constants/membership.ts
  ├── getTierLabel(tier)       → 等级中文名
  ├── getTierColorClass(tier)  → Badge CSS 颜色
  ├── isVip(tier)              → 非 free 即 VIP
  └── MEMBERSHIP_LABELS[]      → 标签映射表
```

## 数据结构

### 数据库

| 表 | 字段 | 角色 |
|---|---|---|
| `Membership` | `tier` | **唯一真相源 (Source of Truth)** |
| `User` | `memberTier` | 缓存 (Cache)，由各登录/升级接口自动同步 |

### 前端映射 (唯一入口)

**文件:** `frontend/constants/membership.ts`

```typescript
MEMBERSHIP_LABELS   // tier → 中文标签
MEMBERSHIP_COLORS   // tier → CSS color token
TIER_LEGACY_MAP     // 旧等级 → 新等级兼容
```

## 约束规则

### ❌ 禁止
- 任何新页面 `switch(tier)`、`if(tier === 'vip')`、`tier === 'premium'`
- 任何新页面维护独立的 `TIER_MAP`、`tierLabel`、`tierBadgeClass`
- 直接读取 `User.memberTier` 作为权威来源（必须走 `Membership.tier`）

### ✅ 必须
- 所有等级展示 → `getTierLabel(tier)`
- 所有 Badge 颜色 → `getTierColorClass(tier)`
- 所有 VIP 判断 → `isVip(tier)`
- 新增等级 → 只改 `frontend/constants/membership.ts` (O(1))

## 数据流链路

### 写入链路 (已验证 all clean)

```
用户购买/升级/管理员修改
    │
    ▼
API 接口 (payment.ts / member.ts / admin-auth.ts)
    │
    ├── Membership.tier  (写入 Truth Source)
    └── User.memberTier  (同步写入 Cache)
```

### 读取链路 (已验证 all clean)

```
用户登录 / 页面加载
    │
    ▼
API 接口 (auth.ts / member.ts / user-center.ts)
    │
    ├── Membership.tier  (读取 Truth Source)
    └── User.memberTier  (Fallback，已有自动同步)
          │
          ▼
    前端 getTierLabel(tier) → 统一映射
```

## 历史等级兼容

系统历史存在以下旧等级，`membership.ts` 维持向后兼容：

| 旧等级 | 当前映射 |
|--------|----------|
| `gold` | 黄金会员 |
| `premium` | 黄金会员 |
| `vip` | VIP |
| `vip_season` | VIP季卡 |
| `vip_year` | VIP年卡 |
| `Pro` | 钻石会员 |
| `director` | 至尊会员 |
| `standard` | 标准 |
| `flagship` | 旗舰 |
| `ultra` | 至尊 |

## 已修复记录

### 2026-06-24: 前端 UI 统一 (TASK-UI-TIER-UNIFICATION)

| 文件 | 修复内容 |
|------|----------|
| `frontend/constants/membership.ts` | **新建** — 唯一映射源 |
| `pages/user/profile.vue` | 替换 7 行旧等级 switch |
| `pages/admin/aigc/cos.vue` | 替换 `=== 'vip' || 'premium'` 白名单 |
| `pages/director-os/aigc/cos.vue` | 同上 |
| `pages/director-os/aigc/members.vue` | 替换 TIER_MAP + tierBadgeClass |
| `pages/user/agent.vue` | 补充新等级映射 |

### 2026-06-xx: 后端 login/sync 链路

| 文件 | 修复内容 |
|------|----------|
| `backend/src/routes/auth.ts` | auth/me 自动同步 membership.tier |
| `backend/src/routes/qq-oauth.ts` | QQ 登录以 membership.tier 为准 |
| `backend/src/routes/sms-auth.ts` | 短信登录以 membership.tier 为准 |
| `backend/src/routes/member.ts` | 管理员修改 + 自助升级同步两表 |
| `backend/src/routes/payment.ts` | 支付回调同步两表 |
| `backend/src/routes/admin-auth.ts` | GET /api/admin/users 返回 membership.tier |

## 后续清理 (非紧急)

4 个读 `memberTier` 而非 `membership.tier` 的接口，**影响等级低，可暂时不修**：

- `GET /api/member/profile` (member.ts)
- `GET /api/admin/dashboard` (统计仅用 != 'free')
- `GET /api/admin/market-agents/:id/members` (isVip 判断)
- `GET /api/user/info` (配额读取)

同步机制已保证 memberTier 与 membership.tier 一致，误判概率 ≈ 0。

---

*文档维护者: OpenClaw | 冻结版本: v2 | 下次审视: 新增等级时*
