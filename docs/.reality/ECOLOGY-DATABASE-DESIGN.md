# ECOLOGY-DATABASE-DESIGN.md

> **昆仑镜 AI 应用生态平台 — Task 10 数据库生态扩展设计**
> 版本：V1.0 | 类型：架构设计（只读，不实施） | 日期：2026-08-03

---

## 一、设计原则

1. **禁止修改核心**：`User` / `Tenant`（Organization/GovOrganization）/ `Commerce`（PaymentOrder/Subscription 族）现有表零改动。
2. **优先复用**：Identity / Subscription / Billing / Audit 已有模型直接引用。
3. **新增领域隔离**：生态表独立前缀命名空间，不混入现有工作台表。
4. **兼容迁移**：新增表只增不改；存量数据通过回填脚本迁移（借鉴新媒体 migration 双通道经验）。

---

## 二、新增领域清单（6 域 14 表）

### 2.1 应用域（Application Marketplace）

```prisma
model EcologyApplication {          // 应用（工作台）
  id            String   @id
  slug          String   @unique   // kunlun-media
  name          String
  icon          String?
  description   String?
  category      String
  authorOrgId   String?            // 开发者组织（平台内置=null）
  isPlatformBuiltIn Boolean @default(false)
  status        String   @default("draft")  // draft|review|published|deprecated
  pricingModel  String   @default("free")   // free|subscription|per_seat
  createdAt     DateTime @default(now())
}

model EcologyApplicationVersion {
  id            String   @id
  applicationId String
  version       String               // semver
  changelog     String?
  frontendEntry String               // /workspaces/media
  backendModule String               // enterprise/channel
  schemaVersion String?
  minPlatformVersion String?
  manifest      Json                  // 能力声明
  status        String   @default("draft") // draft|testing|approved|released
  @@unique([applicationId, version])
}

model EcologyApplicationInstall {
  id            String   @id
  organizationId String
  applicationId String
  versionId     String?
  status        String   @default("installing") // installing|active|disabled|uninstalling
  config        Json?
  installedAt   DateTime @default(now())
  lastUsedAt    DateTime?
  @@unique([organizationId, applicationId])
}

model EcologyApplicationPermission {
  id          String @id
  installId   String
  permission  String               // browser|content|analytics...
  grantedBy   String?
  grantedAt   DateTime @default(now())
  expiresAt   DateTime?
  status      String @default("active")
}
```

### 2.2 插件域（Plugin Marketplace）

```prisma
model EcologyPlugin {
  id          String   @id
  manifestId  String   @unique      // media-manager
  name        String
  type        String                // agent|tool|workflow
  authorOrgId String
  status      String   @default("draft") // draft|review|gray|published|removed
  rating      Float    @default(0)
  installCount Int     @default(0)
  manifest    Json                  // 完整 Manifest 快照
  createdAt   DateTime @default(now())
}

model EcologyPluginVersion {
  id         String @id
  pluginId   String
  version    String
  packageUrl String
  manifest   Json
  reviewStatus String @default("pending") // pending|passed|rejected
  reviewNote String?
  releaseStatus String @default("draft")  // draft|gray|released|rolled_back
  @@unique([pluginId, version])
}

model EcologyPluginInstall {
  id         String @id
  tenantId   String
  pluginId   String
  versionId  String
  status     String @default("installing") // installing|active|disabled
  config     Json?
  installedAt DateTime @default(now())
  @@unique([tenantId, pluginId])
}
```

### 2.3 订阅/授权域（复用现有 Subscription 扩展）

```prisma
model EcologyPluginSubscription {
  id          String @id
  installId   String
  tenantId    String
  pluginId    String
  plan        String               // monthly|quarterly|yearly
  status      String @default("trialing") // trialing|active|past_due|canceled|expired
  trialEndsAt DateTime?
  currentPeriodStart DateTime?
  currentPeriodEnd   DateTime?
  cancelAtPeriodEnd  Boolean @default(false)
}

model EcologyLicense {
  id          String @id
  licenseKey  String @unique
  tenantId    String
  scope       String               // plugin:{id} | app:{id}
  deviceLimit Int    @default(1)
  status      String @default("active")
  expiresAt   DateTime?
  revokedAt   DateTime?
}
```

### 2.4 收入/结算域

```prisma
model EcologyRevenueRecord {
  id            String @id
  orderId       String               // 关联 PaymentOrder
  pluginId      String
  tenantId      String
  grossAmount   Decimal              // 实收
  developerShare Decimal
  ecosystemShare Decimal
  platformShare  Decimal
  partnerId     String?              // 推广伙伴
  period        String               // 2026-08
  status        String @default("pending") // pending|settled
  createdAt     DateTime @default(now())
}

model EcologyDeveloperWallet {
  id          String @id
  orgId       String @unique
  balance     Decimal @default(0)
  totalEarned Decimal @default(0)
  totalWithdrawn Decimal @default(0)
  updatedAt   DateTime @updatedAt
}

model EcologySettlement {
  id          String @id
  orgId       String
  period      String
  type        String               // developer|partner
  amount      Decimal
  detail      Json                 // 订单级明细
  status      String @default("pending") // pending|approved|paid
  paidAt      DateTime?
  @@unique([orgId, period, type])
}
```

### 2.5 开发者域

```prisma
model EcologyDeveloper {
  id          String @id
  orgId       String @unique
  level       String @default("individual") // individual|team|enterprise
  verified    Boolean @default(false)
  apiKeyHash  String?
  status      String @default("active")
}
```

### 2.6 推广域（Partner）

```prisma
model EcologyPartnerNode {
  id          String @id
  userId      String
  orgId       String?
  parentId    String?              // 直推上级
  level       String @default("normal") // normal|eco|region|city|province|partner
  partnerCode String @unique
  status      String @default("active")
}

model EcologyPartnerPerformance {
  id            String @id
  partnerId     String
  period        String             // 2026-08
  teamVolume    Decimal            // 团队总业绩
  maxLineVolume Decimal            // 最大业绩线
  cellVolume    Decimal            // 小区业绩
  settledVolume Decimal
  levelAtPeriod String
  @@unique([partnerId, period])
}

model EcologyPartnerReward {
  id            String @id
  performanceId String
  amount        Decimal
  shareRate     Float
  status        String @default("pending")
}
```

### 2.7 Agent 模板域（AI员工插件模板）

```prisma
model EcologyAgentTemplate {
  id            String @id
  pluginId      String @unique     // agent 类型插件
  soulTemplate  String             // soul.md 模板
  defaultTools  Json               // 默认工具白名单
  defaultWorkflows Json            // 预置工作流
  modelDefaults Json               // 模型偏好
  version       String
}
```

---

## 三、与现有表的关系（零冲突）

| 生态表 | 引用现有 | 说明 |
|--------|---------|------|
| EcologyApplication.authorOrgId | Organization | 开发者组织 |
| EcologyPluginInstall.tenantId | Tenant/Organization | 安装租户 |
| EcologyRevenueRecord.orderId | PaymentOrder | 支付实收 |
| EcologyLicense | EnterpriseSubscription/PersonalEntitlement | 订阅授权联动 |
| EcologyDeveloper.orgId | Organization | 复用企业认证 |
| 审计 | AuditLog（现有） | 生态动作审计不建新表 |
| Agent 插件实例 | EnterpriseAgentInstance + HermesProfileBinding（现有） | **插件实例化直接复用 AI 员工体系** |

---

## 四、迁移路线（分阶段）

| 阶段 | 迁移内容 | 风险 |
|------|---------|------|
| Phase A | 新增 Application/Plugin/PluginVersion/PluginInstall 4 表（纯新增） | 无 |
| Phase B | Subscription/License/Revenue/Wallet/Settlement 5 表（纯新增，关联现有 PaymentOrder） | 无 |
| Phase C | Developer/Partner 3 表（纯新增） | 无 |
| Phase D | AgentTemplate 表 + EnterpriseAgentInstance 增加 pluginId 可空列（唯一改动现有表） | 低（可空列，回填 null） |

**执行纪律**：所有迁移只增不改；现有 461 表零结构变更；`prisma db execute` + 手写 SQL 双通道（沿用团队模式经验）。

---

## 五、数据规模预估

| 表 | 3 年预估 | 说明 |
|----|---------|------|
| EcologyPlugin | 5k | 开发者生态成熟后 |
| EcologyPluginInstall | 500k | 订阅安装 |
| EcologyRevenueRecord | 10M | 月度订单流水 |
| EcologyPartnerPerformance | 100k | 月度业绩 |
| EcologySettlement | 50k | 月度结算 |

→ 无需分库分表（Postgres 单库可承载），但 RevenueRecord 需按月分区索引（period 前缀索引）。
