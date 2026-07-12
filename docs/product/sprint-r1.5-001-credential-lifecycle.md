# Sprint R1.5-001: Credential Lifecycle (AI Runtime Engine v1.0)

> **Credential Lifecycle 是 Runtime 唯一可信状态（Single Source of Truth）。**
> 任何地方都不能自己推断 Provider 状态，必须读取 CredentialLifecycleService。

## 数据分层架构

```
UserModelConfigV2           ← 用户配置（Desired State）
    "我希望用 DeepSeek V3"

ApiKey                      ← 凭据存储（Credential Storage）
    "加密后的 sk-xxxxx"

CredentialRuntimeState      ← 运行时生命周期（Observed State）【新增】
    "sk-xxxxx → ACTIVE / 上次验证: 5分钟前"

ProviderStateService        ← 健康、缓存与统计（Runtime View）
    "DeepSeek: Healthy / 延迟 320ms / 连续成功 17次"
```

## Credential Lifecycle 状态机

```
NEW ──→ VALIDATING ──→ ACTIVE
                         │
                         ├──→ INVALID（Provider 返回认证失败 / API Key 错误）
                         │
                         ├──→ REQUIRES_RECONFIGURATION
                         │       （Encryption Mismatch / 无法恢复）
                         │
                         └──→ DISABLED（仅来自用户/管理员主动关闭）
```

**规则：**
- ACTIVE 不直接跳 DISABLED（必须通过用户/管理员主动操作）
- INVALID 来自 Provider 的认证错误，不是加密错误
- REQUIRES_RECONFIGURATION 来自加密不匹配或凭据丢失/不可恢复
- DISABLED 只来自用户/管理员主动关闭

## 任务

### R1.5-001-A: Prisma 模型

新增表 `CredentialRuntimeState`：

```prisma
enum CredentialLifecycleStatus {
  NEW
  VALIDATING
  ACTIVE
  INVALID
  REQUIRES_RECONFIGURATION
  DISABLED
}

model CredentialRuntimeState {
  id                   String   @id @default(uuid()) @db.Uuid
  provider             String
  ownerType            String   // 'user' | 'org' | 'platform'
  ownerId              String   // userId / orgId / 'platform'
  lifecycleStatus      CredentialLifecycleStatus @default(NEW)

  // 生命周期来源——指向具体的凭据
  credentialSourceType String?  // 'ApiKey' | 'UserModelConfigV2'
  credentialSourceId   String?  // 对应的表主键 id

  // 运行时数据
  lastValidatedAt      DateTime?
  lastSuccessAt        DateTime?
  lastFailureAt        DateTime?
  failureReason        String?
  failureCode          String?
  validationCount      Int      @default(0)
  consecutiveFailures  Int      @default(0)

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@unique([ownerType, ownerId, provider])
  @@index([ownerId, provider])
  @@map("credential_runtime_state")
}
```

### R1.5-001-B: CredentialLifecycleService

新建 `backend/src/runtime/credential-lifecycle/credential-lifecycle.service.ts`

**职责：**
- 唯一 SSOT：所有状态转换必须通过此 Service
- 提供 `transition()` 方法，确保只有合法转换
- 提供 `getStatus()` / `getAllForOwner()` / `getAllForUser()` 查询
- 状态变更时同步通知 ProviderStateService

**不允许：** UI/API 直接写入状态。

### R1.5-001-C: Runtime Summary API

新建 `GET /api/runtime/summary`

返回：
```json
{
  "runtimeReady": true,
  "readinessScore": 92,
  "providers": 6,
  "healthy": 5,
  "reconfigurationRequired": 1,
  "credentialLifecycle": {
    "active": 18,
    "invalid": 2,
    "requiresReconfiguration": 1,
    "disabled": 4
  },
  "lastValidation": "2026-07-04T14:20:00Z"
}
```

### R1.5-001-D: 集成到启动流程

- 启动时从 ApiKey + UserModelConfigV2 初始化 CredentialRuntimeState（迁移现有数据）
- 启动后运行验证：同步 Encryption Guard 结果到 Lifecycle 状态
- 已有 DECRYPT_FAILED 的 Key → `REQUIRES_RECONFIGURATION`

### R1.5-001-E: 状态转换验证

单元测试覆盖所有合法/非法转换：
- NEW → VALIDATING ✅
- VALIDATING → ACTIVE ✅
- ACTIVE → INVALID ✅（Provider 认证失败）
- ACTIVE → REQUIRES_RECONFIGURATION ✅（加密不匹配）
- ACTIVE → DISABLED ✅（管理员操作）
- INVALID → REQUIRES_RECONFIGURATION ✅
- REQUIRES_RECONFIGURATION → NEW / VALIDATING ✅
- DISABLED → ACTIVE ❌（必须经过 VALIDATING）

## 设计原则

**不把生命周期放进：**
- ❌ UserModelConfigV2（职责：用户配置）
- ❌ ApiKey（职责：凭据存储）

**不允许：**
- ❌ 任何地方自己判断 "decrypt failed → Provider 不可用"
- ❌ UI/API 直接写 `lifecycleStatus`
- ❌ ProviderStateService 维护独立状态机

**唯一可信来源：** `CredentialLifecycleService`
