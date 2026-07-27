# BETA-07.1 — Channel Identity Model

> 启动日期：2026-07-19
> 前置条件：BETA-06.9 ✅ AI Employee Activation Gate 完成
> 范围：统一渠道账号模型 + 授权中心 UI + AI员工权限绑定

---

## 目标

> 让 AI 员工拥有「工作对象」—— 渠道账号。
> 建立企业级授权体系：Enterprise → Channel Identity → Agent Permission。

## 闭环链路

```
管理员添加渠道账号 → 连接（模拟OAuth）→ 绑定 AI 员工 → 设置权限
    → AI 员工通过渠道身份执行业务操作（后续真实API）
```

---

## 交付清单

### 1. 数据库模型 ✅
- `channel_account` — 渠道账号（属于企业）
- `channel_binding` — AI员工↔渠道绑定（含权限）
- `channel_authorization_log` — 审计日志
- 支持平台：xiaohongshu/wechat/douyin/shipinhao/weibo/kuaishou

### 2. 后端 API ✅
- `GET /api/enterprise/channel-accounts` — 渠道列表
- `POST /api/enterprise/channel-accounts` — 添加渠道
- `POST /api/enterprise/channel-accounts/:id/connect` — 连接（模拟）
- `DELETE /api/enterprise/channel-accounts/:id` — 断开
- `GET /api/enterprise/channel-accounts/:id/bindings` — 绑定列表
- `POST /api/enterprise/channel-accounts/bindings` — 绑定AI员工
- `DELETE /api/enterprise/channel-accounts/bindings/:id` — 解绑
- `GET /api/enterprise/channel-accounts/agents` — AI员工列表

### 3. 前端 UI ✅
- `/media-department/settings/channels` — 渠道管理页面
- 渠道卡片：平台图标、账号名、状态、绑定数
- 添加渠道弹窗：选择平台、填写账号信息
- 绑定AI员工弹窗：多选AI员工、设置权限（READ/CREATE/PUBLISH/ANALYZE）

### 4. 种子数据 ✅
- demo-org-001: 3个渠道账号（wechat/xiaohongshu/douyin）
- 1个绑定：热点分析师↔微信公众号（READ, ANALYZE权限）

---

## 验证结果

```
=== Channel Accounts ===
wechat       | 微信公众号      | active   | bindings=1
xiaohongshu  | 小红书创作者号   | pending  | bindings=0
douyin       | 抖音号         | pending  | bindings=0

=== Bindings ===
热点分析师 | hotspot_analyst | active | ['READ', 'ANALYZE']

=== Frontend ===
/media-department/settings/channels → 200
/media-department → 200
/admin/enterprise/plans → 200

=== Error Fixes ===
__tc-bridge.js → 200 (correct MIME: text/javascript)
logo.png → 200 (correct Content-Length: 28376)
```

---

## 架构演进

```
之前：AI 员工没有工作对象
现在：AI 员工 + 渠道身份 = 可执行操作

完整层级：
  Plan (套餐)
    ↓
  Agent Template (AI模板)
    ↓
  EnterpriseAgentInstance (AI员工实例)
    ↓
  ChannelAccount (渠道账号)  ← 新增
    ↓
  ChannelBinding (权限绑定)  ← 新增
```

---

## 权限模型

```
Channel (微信公众号)
  ├── 热点分析师 → [READ, ANALYZE]  ✅ 可读可分析
  ├── 内容创作AI → [READ, CREATE]   ✅ 可读可创作
  └── 内容审核AI → (未绑定)          ❌ 无权限
```

---

## 关键文件

**Backend:**
- `backend/prisma/schema.prisma` — 新增 ChannelAccount/ChannelBinding/ChannelAuthorizationLog 模型
- `backend/src/routes/channels.ts` — 渠道管理路由（新增）
- `backend/src/routes/enterprise-agents.ts` — AI员工实例路由（BETA-06.9）

**Frontend:**
- `frontend/pages/media-department/settings/channels.vue` — 渠道管理页面（新增）
- `frontend/pages/media-department/index.vue` — BETA-06.9 AI员工展示

**Database:**
- `channel_account` — 渠道账号表
- `channel_binding` — 绑定关系表
- `channel_authorization_log` — 审计日志表

---

## 错误修复

构建期间修复了两个错误：
1. `__tc-bridge.js` 返回 500 + 错误 MIME 类型 → 已修复（200 + text/javascript）
2. `logo.png` Content-Length 不匹配 → 已修复（200 + 正确长度）

---

## 下一阶段

```
BETA-07.1 ✅ Channel Identity Model
BETA-07.2 → Authorization Center UI (已完成)
BETA-07.3 → Agent Permission Binding (已完成)
BETA-08 → Payment Subscription
BETA-09 → Channel Runtime (对接真实API)
```

---

*Generated: 2026-07-19T03:57:00+08:00*
