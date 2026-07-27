# GA-00 KunLunJing SaaS Integration Audit

**Phase**: Productization — Pre-GA Integration Audit
**Date**: 2026-07-17
**Author**: OpenClaw (AI CTO Office)

---

## 审计目标

验证企业数字部门 (Enterprise Digital Department) 作为昆仑镜 SaaS 高级子系统，是否与现有用户/权限/支付/VIP 体系正确打通。

---

## 1. 用户体系 ✅ 已存在

### 现有模型

| 模型 | 用途 | 状态 |
|------|------|------|
| `User` | 用户账号 (email/username/phone) | ✅ |
| `User.memberTier` | VIP 等级 (free/vip/pro) | ✅ |
| `User.memberExpiresAt` | VIP 过期时间 | ✅ |
| `Organization` | 企业资料 | ✅ |
| `Organization.plan` | 企业套餐 (free/pro/enterprise) | ✅ |
| `OrgMember` | 企业成员关系 | ✅ |

### 集成点

```
User (昆仑镜账号)
  ↓ memberTier
  ↓
VIP 权限 (普通/VIP)
  ↓
Organization (企业资料)
  ↓ plan
  ↓
Enterprise Subscription (企业数字部门订阅)
  ↓
Hermes Runtime (AI 员工运行)
```

**结论**: 用户体系已打通，无需新建。

---

## 2. VIP 与企业数字部门订阅分离 ✅ 已存在

### 现有模型

| 模型 | 用途 | 状态 |
|------|------|------|
| `MemberPlan` | VIP 套餐 (价格/配额/功能) | ✅ |
| `EnterprisePlan` | 企业数字部门套餐 | ✅ |
| `EnterpriseSubscription` | 企业订阅关系 | ✅ |

### 权限分离

```
普通/VIP 用户:
  ✅ 创建企业资料 (Organization)
  ✅ 创建 AI 员工档案 (EnterpriseAgentProfile)
  ❌ 无法运行 AI 员工 → EnterpriseSubscription 未购买
  ❌ 无法调用 Hermes Runtime

企业数字部门订阅用户:
  ✅ EnterpriseSubscription.status = 'active'
  ✅ Hermes Runtime 激活
  ✅ AI 员工执行权限
```

**结论**: VIP 与企业订阅已分离。`EnterprisePlan.requireOwnLLMKey = true` 已支持 BYOK。

---

## 3. 支付体系 ✅ 已存在

### 现有模型

| 模型 | 用途 | 状态 |
|------|------|------|
| `PaymentConfig` | 支付方式配置 | ✅ |
| `PaymentOrder` | 支付订单 | ✅ |
| `PaymentSecret` | 支付密钥 | ✅ |
| `EnterpriseSubscription.orderId` | 关联支付订单 | ✅ |

### 支付流程

```
用户选择 EnterprisePlan
  ↓
创建 PaymentOrder
  ↓
支付完成
  ↓
创建 EnterpriseSubscription
  ↓
Hermes Runtime 激活
```

**结论**: 支付体系已打通，复用统一支付。

---

## 4. 企业数字部门套餐 ✅ 已存在

### EnterprisePlan 字段

| 字段 | 用途 | 状态 |
|------|------|------|
| `name` | 套餐标识 | ✅ |
| `displayName` | 显示名称 | ✅ |
| `price` | 价格（分） | ✅ |
| `billingCycle` | 计费周期 | ✅ |
| `maxEmployees` | AI 员工上限 | ✅ |
| `maxChannels` | 渠道上限 | ✅ |
| `maxMembers` | 企业成员上限 | ✅ |
| `requireOwnLLMKey` | BYOK 策略 | ✅ |
| `allowedProviders` | 允许的模型供应商 | ✅ |
| `quotaPolicy` | 额度策略 | ✅ |
| `features` | 功能特性 | ✅ |

### 套餐示例

| 套餐 | AI员工 | 能力 |
|------|--------|------|
| 基础版 | 3个 | 基础执行 |
| 专业版 | 10个 | 多 Agent |
| 企业版 | 不限 | 完整数字部门 |

**结论**: 套餐模型已存在，管理员可后台配置。

---

## 5. BYOK (自带模型 API) ✅ 已存在

### 现有模型

| 模型 | 用途 | 状态 |
|------|------|------|
| `AIProviderConfig` | 用户自己的 LLM API Key | ✅ |
| `EnterprisePlan.requireOwnLLMKey` | 是否要求自带 Key | ✅ |
| `EnterprisePlan.allowedProviders` | 允许的模型供应商 | ✅ |

### 流程

```
用户配置自己的 LLM API Key
  ↓
AIProviderConfig (per Organization)
  ↓
Hermes Runtime 使用用户 Key
  ↓
AI 员工执行
```

**结论**: BYOK 已支持。昆仑镜不承担推理成本。

---

## 6. 缺失/需补充

### 6.1 渠道接入层 (Channel Adapter)

**现状**: 无统一渠道适配器
**需要**: 新增 Channel Adapter Layer

```
Channel Adapter Layer
  ├── 抖音 (Douyin)
  ├── 快手 (Kuaishou)
  ├── 小红书 (Xiaohongshu)
  ├── 视频号 (WeChat Channels)
  ├── 微博 (Weibo)
  ├── B站 (Bilibili)
  ├── 企业微信 (WeCom)
  └── 更多...
```

**原则**:
- 官方授权登录
- OAuth / Token 授权
- 平台允许的开放接口
- 禁止账号密码代理登录

### 6.2 企业数字部门管理后台

**现状**: 无独立管理入口
**需要**: 新增后台菜单

```
昆仑镜管理后台
├── 用户管理
├── VIP 管理
├── 支付管理
├── 内容管理
└── 企业数字部门管理 ⭐
    ├── 套餐配置 (EnterprisePlan CRUD)
    ├── 价格设置
    ├── AI 员工数量限制
    ├── 企业权限
    └── 使用统计
```

### 6.3 用户创建路径前端

**现状**: 无完整用户旅程
**需要**: 新增前端页面流

```
注册企业 → 选择岗位 → 生成 AI 员工 → 启动员工 → 第一次任务
```

---

## 7. GA-00 验收矩阵

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 用户体系打通 | ✅ | User → Organization → Subscription |
| VIP 与企业订阅分离 | ✅ | MemberPlan vs EnterprisePlan |
| 支付体系打通 | ✅ | PaymentOrder → EnterpriseSubscription |
| 套餐可配置 | ✅ | EnterprisePlan 全字段 |
| BYOK 自带模型 | ✅ | AIProviderConfig + requireOwnLLMKey |
| 权限体系 | ✅ | Organization.plan 控制 |
| 渠道接入层 | ⏳ | 需新建 |
| 管理后台 | ⏳ | 需新建 |
| 用户创建路径 | ⏳ | 需新建 |

---

## 8. GA-00 结论

**现有 SaaS 基础设施已完备**。用户/权限/支付/VIP/套餐/BYOK 全部就绪。

**Productization 重点不是重建底层，而是**:
1. 渠道接入层 (Channel Adapter)
2. 管理后台 (Enterprise Plan CRUD)
3. 用户创建路径前端 (Customer Journey)
4. CEO Command Center 完善
5. 生产安全审计
6. Beta 客户启动

---

*OpenClaw — Enterprise Engineering*
*GA-00 KunLunJing SaaS Integration Audit — COMPLETE ✅*
