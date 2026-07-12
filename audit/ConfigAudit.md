# Audit Q: 配置中心审计 (ConfigAudit.md)

## 1. 配置来源分析

昆仑镜系统使用以下配置来源:

| 配置来源 | 优先级 | 路径 |
|---------|--------|------|
| 环境变量 | 最高 | `.env`, `process.env.X` |
| Zod Schema | 编译时 | `config/env.ts` |
| JSON 配置文件 | 中 | `config/*.json` |
| DB 配置表 | 运行时 | 多个 Prisma 模型 |
| 代码常量 | 最低 | 各文件中 `const X = ...` |

## 2. 配置模型 (DB)

| 模型 | 配置内容 |
|------|---------|
| `AiStageModelConfig` | AI 阶段模型映射 |
| `AiModel` | AI 模型定义 |
| `ModelProvider` | Provider 配置 |
| `StorageConfig` | 存储配置 |
| `StoragePack` | 存储套餐 |
| `PaymentConfig` | 支付配置 |
| `PaymentSecret` | 支付密钥 |
| `StyleProfile` | 风格配置 |
| `RouteConfig` | 路由配置 |
| `AgentLevelConfig` | Agent 等级 |
| `MemberPlan` | 会员方案 |
| `SubscriptionPlan` | 订阅计划 |
| `UserModelConfigV2` | 用户模型配置 |
| `ProviderState` | Provider 状态 |
| `CapabilityContract` | 能力合约 |
| `ResourceContract` | 资源合约 |
| `ResourceCredential` | 资源凭据 |
| `CostBudget` | 成本预算 |
| `Quota` | 配额 |
| `RateLimit` | 速率限制 |
| `ShadowConfig` | Shadow 配置 |
| `AiRoutingPolicy` | 路由策略 |
| `AiFallbackRule` | 降级规则 |
| `AiCircuitBreaker` | 断路器 |
| `AiTimeoutConfig` | 超时配置 |

## 3. 配置碎片化问题

### 3.1 Model/AI 配置

| 配置项 | 来源 | 分歧 |
|--------|------|------|
| Provider 列表 | `.env` + `ModelProvider` 表 | ❌ 双重来源 |
| 模型路由 | `AiStageModelConfig` + `AiRoutingPolicy` | ❌ 可能冲突 |
| API Key | `.env` + `ResourceCredential` | ❌ 双重来源 |
| Base URL | `.env` + DB | ❌ |

### 3.2 功能开关 (Feature Flag)

| 项 | 方式 | 文件 |
|---|------|------|
| Feature Flag | `config/feature-flags.ts` | 代码级 |
| GEO Brand Model V2 | `.env` `GEO_BRAND_MODEL_V2=true` | 环境变量 |

**问题**: Feature Flag 分散在代码常量和环境变量中

### 3.3 会员/Pricing 配置

| 项 | 来源 |
|---|------|
| 会员价格 | `payment/services/index.ts` 常量 |
| 套餐定义 | `MemberPlan` DB 表 |
| 订阅计划 | `SubscriptionPlan` DB 表 |
| 存储套餐 | `StoragePack` DB 表 |

**问题**: 价格硬编码在 services 中，与 DB 共存

## 4. 统一配置对比

| 配置域 | 统一 | 现状 |
|--------|:----:|------|
| Model 配置 | ❌ | .env + DB 模型配置 + 代码常量 |
| AI Runtime | ❌ | env + DB + 代码 |
| Storage | ⚠️ | 有 StorageConfig 但部分硬编码 |
| Queue | ❌ | env REDIS_URL |
| Retry | ❌ | 各组件独立实现 |
| Rate Limit | ⚠️ | 有 RateLimit 模型但未全用 |
| 会员 | ❌ | 价格硬编码 + DB |
| Prompt | ❌ | DB + 硬编码 |
| Feature Flag | ❌ | 环境变量 + 代码 |

## 5. Config Runtime 分析

`backend/src/config-runtime/` 意图作为统一的配置运行时:

**文件**: `config-runtime/index.ts` — 但尚未集成所有配置域

实际配置读取路线:
```
config/env.ts (Zod) → 组件中使用
config/v2.ts (独立) → 部分
config/saveUnified.ts (统一保存) → 写入
```

## 6. 建议

1. **统一配置中心**: 所有运行时配置使用 `config-runtime/` 读取
2. **消除双重来源**: 每个配置项只保留一个 Truth Source
3. **Feature Flag 统一**: 使用 DB 中的 Feature Flag 表
4. **价格中心化**: 会员/套餐价格移到 DB
5. **Config Schema**: 所有配置域使用 Zod schema 验证
6. **热更新**: 配置变更通过 Event Bus 通知各组件
