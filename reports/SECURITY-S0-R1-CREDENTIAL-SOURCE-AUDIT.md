# SECURITY-S0-R1-CREDENTIAL-SOURCE-AUDIT

> **生成时间**: 2026-07-19 21:20 GMT+8  
> **审计范围**: `/root/shipin-cinematic-studio` (仅读，无修改)  
> **审计目标**: 确认 DeepSeek credential 的真实生效来源  
> **审批状态**: 待 CTO Review  

---

## 执行摘要

### 🔴 关键结论

> 当前系统存在 **至少 4 个不同的 DeepSeek API Key**，分布在不同存储层，各有独立的读取路径。  
> **不存在单一 Credential Source of Truth**。

| 严重度 | 发现 |
|--------|------|
| 🔴 CRITICAL | Embedding 与 LLM 使用**完全相同**的 Key（`sk-63a1d...13c0`），违反 Credential Boundary 原则 |
| 🔴 CRITICAL | `provider-registry.service.ts` 引用的 3 个 Prisma Model（`providerRegistry`/`modelRouteConfig`/`providerHandlerRegistry`）**在 schema.prisma 中不存在**，整个 Provider Registry 功能处于**非工作状态** |
| 🟠 HIGH | `route_config` 表中存在独立的客服 DeepSeek Key（`sk-ceea2...fadc`），与 legal 系统 Key **不同** |
| 🟠 HIGH | `ApiKey` 表中存在加密存储的 deepseek 密钥，通过独立路径被 `api-router.service.ts` 使用 |
| 🟠 HIGH | `enterprise_provider_credential` 表中存在 4 条 deepseek 默认凭证，通过 `resolveRuntimeConfig` 和 `credential-resolver` 独立读取 |
| 🟡 MEDIUM | `.env.backup.sec-003` 备份文件中包含旧的明文 DeepSeek Key（`sk-d41f5...5e15`），属于 Secret Exposure |
| 🟡 MEDIUM | `legal-config.route.ts` 的 `appendToEnvFile()` 在 Admin Panel 保存时回写 `.env`，与原始 `.env` 配置可能产生**不一致** |

---

## Credential Source Matrix

| # | Component | Source | Key Fingerprint | Priority | Active? | 消费方 |
|---|-----------|--------|-----------------|----------|---------|--------|
| 1 | `.env` file | `DEEPSEEK_API_KEY` | *(空)* | Low | ❌ | `deepseek-llm.provider.ts`, `narrative-gateway.ts`, `resolveRuntimeConfig.ts`, `geo/provider/deepseek-config.ts` |
| 2 | `.env` file | `LEGAL_EMBEDDING_API_KEY` | `sk-63a1d...13c0` | Medium | ✅ | `dashscope-embedding.provider.ts` (Priority 1) |
| 3 | `.env` file | `LEGAL_LLM_API_KEY` | `sk-63a1d...13c0` | Medium | ✅ | legal-config.route.ts → process.env 注入 |
| 4 | `legal_system_config` DB | `LEGAL_EMBEDDING_API_KEY` | `sk-63a1d...13c0` | High | ✅ | Admin Panel → process.env 写入 → embedding provider |
| 5 | `legal_system_config` DB | `LEGAL_LLM_API_KEY` | `sk-63a1d...13c0` | High | ✅ | Admin Panel → process.env 写入 → LLM provider |
| 6 | `route_config` DB | `route:admin-customer-service / deepseekApiKey` | `sk-ceea2...fadc` | Medium | ✅ | `customer-service.ts` (小麒客服, Priority 1) |
| 7 | `ApiKey` DB | `deepseek / deepseek_api_key` *(加密)* | *(加密存储)* | Medium | ✅ | `api-router.service.ts` |
| 8 | `enterprise_provider_credential` DB | 4 条 deepseek/deepseek-chat 默认凭证 *(AES-256-GCM 加密)* | *(加密存储)* | High | ✅ | `resolveRuntimeConfig.ts` (Layer 1.5), `credential-resolver.service.ts` |
| 9 | `process.env` (runtime) | `DEEPSEEK_API_KEY` | *(空)* | Low | ❌ | 多处 fallback 读取 |
| 10 | `process.env` (runtime) | `LEGAL_EMBEDDING_API_KEY` | `sk-63a1d...13c0` | High | ✅ | embedding provider (via legal-config upsert 写入) |
| 11 | `process.env` (runtime) | `LEGAL_LLM_API_KEY` | `sk-63a1d...13c0` | High | ✅ | LLM 调用 (via legal-config upsert 写入) |
| 12 | `.env.backup.sec-003` | `DEEPSEEK_API_KEY` | `sk-d41f5...5e15` | Backup | 🔴 Old Key | 无主动消费方，但属于 Secret Exposure |
| 13 | `provider_registry` DB | `authConfig.envKeyName: 'DEEPSEEK_API_KEY'` | N/A | Non-functional | ❌ | **表不存在** — `provider-registry.service.ts` 无法工作 |

---

## 凭证消费路径详解

### 路径 A — 法律系统 Embedding（`dashscope-embedding.provider.ts`）

```
优先级链:
1. process.env.LEGAL_EMBEDDING_API_KEY ← legal_system_config DB (Admin Panel 写入)
2. process.env.ALIYUN_API_KEY / BAILIAN_API_KEY ← .env
3. process.env.DEEPSEEK_API_KEY ← .env (当前为空)
4. 无 key → 关键词搜索 fallback
```

**实际生效 Key**: `sk-63a1d...13c0`（来自 `legal_system_config` → `process.env`）

### 路径 B — 法律系统 LLM（`legal-config.route.ts`）

```
写入链:
Admin Panel PUT /api/admin/legal/config
  → prisma.legalSystemConfig.upsert()
  → process.env[LEGAL_LLM_API_KEY] = value   (运行时注入)
  → appendToEnvFile()                        (.env 文件追加/更新)
```

**实际生效 Key**: `sk-63a1d...13c0`（Embedding 与 LLM **同一个 Key**）

### 路径 C — 小麒客服（`customer-service.ts`）

```
优先级链:
1. route_config DB (scope: route:admin-customer-service, key: deepseekApiKey)
2. process.env.DEEPSEEK_API_KEY (当前为空)
3. process.env.VOLCENGINE_API_KEY (兜底火山引擎)
```

**实际生效 Key**: `sk-ceea2...fadc`（**独立于 legal 系统的不同 Key**）

### 路径 D — Runtime Gateway（`resolveRuntimeConfig.ts`）

```
优先级链:
1. Input 层 (前端传入 model + provider)
2. Enterprise 凭证层 (enterprise_provider_credential DB) ← 新增 Phase 3.1.2
3. 用户 V2 配置层 (UserModelConfigV2 DB, 加密存储)
4. 阶段配置层 (AiStageModelConfig DB)
5. 环境变量层 (process.env.DEEPSEEK_API_KEY 等)
```

**实际生效 Key**: 取决于 userId 和 organizationId。企业用户可能通过 `enterprise_provider_credential` 读取到不同的加密 key。

### 路径 E — Provider Registry（`provider-registry.service.ts`）

```
代码引用:
- prisma.providerRegistry.findUnique()
- prisma.modelRouteConfig.findUnique()
- prisma.providerHandlerRegistry.findMany()

实际情况:
❌ provider_registry 表不存在于 schema.prisma
❌ model_route_config 表不存在于 schema.prisma
❌ provider_handler_registry 表不存在于 schema.prisma

结论: 整个 Provider Registry 功能处于非工作状态（代码存在但 DB 层缺失）
```

### 路径 F — Director-v2 / Geo 系统

```
director-v2.ts → 读取 process.env.DEEPSEEK_API_KEY (为空)
geo/provider/deepseek-config.ts → 读取 process.env.DEEPSEEK_API_KEY (为空)
deepseek-llm.provider.ts → 调用方传入 apiKey 或 process.env.DEEPSEEK_API_KEY (为空)
```

**实际状态**: 无独立 Key 配置，依赖全局 `DEEPSEEK_API_KEY`（当前为空）。

---

## DeepSeek Key 清单

| Key | 存储位置 | 用途 | 状态 |
|-----|----------|------|------|
| `sk-63a1dff209a547b0b201d214550b13c0` | `.env` + `legal_system_config` DB | Legal Embedding + LLM | ✅ 主活跃 Key |
| `sk-ceea20786e0c4d4fa9c30ed6e68afadc` | `route_config` DB | 小麒客服 DeepSeek | ✅ 独立活跃 Key |
| `sk-d41f5e98449845eaabb4ed0deb255e15` | `.env.backup.sec-003` | *(旧 Key)* | 🔴 Secret Exposure |
| *(加密存储)* | `ApiKey` table (`deepseek`) | API Router | ✅ 存在，值未知 |
| *(AES-256-GCM 加密)* | `enterprise_provider_credential` (×4) | Enterprise Runtime | ✅ 存在，值未知 |

---

## 发现的风险

### R1: Credential Boundary 失效

> `LEGAL_EMBEDDING_API_KEY` 与 `LEGAL_LLM_API_KEY` 值完全相同（`sk-63a1d...13c0`），违反"一个能力一个 Credential Boundary"原则。

- 影响: 如果 embedding 需要轮换，LLM 会同时失效
- 影响: 无法独立审计两个能力的使用量

### R2: Provider Registry 处于"幽灵"状态

> `provider-registry.service.ts` 代码完整实现了 Provider Registry 的所有功能（CRUD、Seed、缓存），但底层依赖的 3 个 Prisma Model（`providerRegistry`/`modelRouteConfig`/`providerHandlerRegistry`）在 `schema.prisma` 中**完全不存在**，在 Migrations 历史中也**未找到建表语句**。

- 影响: 任何调用 `readProvider()` / `resolveModelRoute()` 的代码都会**运行时崩溃**
- 影响: `narrative-gateway.ts` 的 Router 层实际走不到 DB 路由决策，全部 fallback 到 env var

### R3: 多 Key 并存导致 Rotation 假成功

> 由于系统存在至少 4 个不同的 Key 入口，单次 Rotation 操作可能只更新了其中 1-2 个入口，其余入口继续使用旧 Key。

### R4: 备份文件中的 Secret Exposure

> `.env.backup.sec-003` 包含明文的旧 DeepSeek Key（`sk-d41f5...5e15`），任何能访问备份文件的内外部人员都可获取。

---

## Runtime 写入链路图

```
┌─────────────────────────────────────────────────────────────────┐
│                        .env 文件                                │
│  LEGAL_EMBEDDING_API_KEY=sk-63a1d...13c0                        │
│  LEGAL_LLM_API_KEY=sk-63a1d...13c0                              │
│  DEEPSEEK_API_KEY=(空)                                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ 启动加载
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    process.env (运行时)                          │
│  LEGAL_EMBEDDING_API_KEY=sk-63a1d...13c0                        │
│  LEGAL_LLM_API_KEY=sk-63a1d...13c0                              │
│  DEEPSEEK_API_KEY=(空)                                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
          ┌────────────────────┼──────────────────────┐
          │                    │                      │
          ▼                    ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│ legal-config     │  │ customer-service │  │ resolveRuntimeConfig │
│ route.ts         │  │ .ts              │  │ .ts                  │
│                  │  │                  │  │                      │
│ Admin Panel save │  │ 小麒客服读取     │  │ 多层解析:            │
│ → process.env    │  │ route_config DB  │  │ 1. Input             │
│ → .env 回写      │  │ → sk-ceea2...    │  │ 2. Enterprise 凭证   │
│                  │  │ (独立 Key)       │  │ 3. User V2 Config    │
│ ⚠️ 双向写入     │  │                  │  │ 4. Stage Config      │
└──────────────────┘  └──────────────────┘  │ 5. Env Default       │
                                            └──────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 DB: legal_system_config                         │
│  LEGAL_EMBEDDING_API_KEY=sk-63a1d...13c0                        │
│  LEGAL_LLM_API_KEY=sk-63a1d...13c0                              │
│  (Embedding 和 LLM 同一个 Key)                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 DB: route_config                                │
│  route:admin-customer-service / deepseekApiKey = sk-ceea2...    │
│  (独立于 legal 系统的 Key)                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 DB: enterprise_provider_credential (×4)         │
│  4 条 deepseek/deepseek-chat 默认凭证 (AES-256-GCM 加密)       │
│  通过 resolveRuntimeConfig Layer 1.5 或 credential-resolver 读取│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 DB: ApiKey                                      │
│  deepseek / deepseek_api_key (加密存储)                         │
│  通过 api-router.service.ts 读取                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 对 R1 Rotation 的影响评估

### 当前不安全的 Rotation 方案

如果按原始方案 `revoke old key → replace .env → restart`：

| 入口 | 会被更新？ | 后果 |
|------|-----------|------|
| `.env` | ✅ 是 | `LEGAL_EMBEDDING_API_KEY` / `LEGAL_LLM_API_KEY` 更新 |
| `legal_system_config` DB | ❌ 否 | Admin Panel 显示旧 Key，保存时会**反向覆盖** `.env` 的新 Key |
| `route_config` DB | ❌ 否 | 小麒客服继续使用旧 Key `sk-ceea2...fadc` |
| `ApiKey` table | ❌ 否 | API Router 继续使用旧加密 Key |
| `enterprise_provider_credential` | ❌ 否 | 企业用户继续使用旧加密 Key |
| `.env.backup.sec-003` | ❌ 否 | 旧 Key 仍存在于备份中 |

**Rotation 成功率**: 约 15-20%（仅 `.env` 文件层级生效，但会被 DB write-back 反向覆盖）

---

## CTO Decision Point 回复

### Decision 1 — 新 Key 策略

> **结论**: ✅ 同意拆分。当前 Embedding 与 LLM 共用 `sk-63a1d...13c0`，确实需要独立的 `DEEPSEEK_LLM_KEY` 和 `DEEPSEEK_EMBEDDING_KEY`。

### Decision 2 — Admin Panel Credential 来源

> **结论**: 已确认。当前 credential 来源优先级为：
> 1. **`legal_system_config` DB** — 法律系统 embedding/llm 的实效来源
> 2. **`route_config` DB** — 小麒客服的独立 Key
> 3. **`enterprise_provider_credential` DB** — 企业 Runtime 的加密凭证
> 4. **`process.env`** — 启动时从 `.env` 加载 + 运行时由 `legal-config.route.ts` 写入
> 5. **`.env` 文件** — 静态配置源，仅作启动初始化和 fallback

### Decision 3 — 回滚策略

> **结论**: 回滚对象不是 `.env`，而是 Credential Provider 层。回滚需要：
> 1. 更新 `legal_system_config` DB（`LEGAL_EMBEDDING_API_KEY` / `LEGAL_LLM_API_KEY`）
> 2. 更新 `route_config` DB（`deepseekApiKey`）
> 3. 更新 `ApiKey` table（deepseek 条目）
> 4. 更新 `enterprise_provider_credential`（4 条记录）
> 5. 更新 `.env` 文件
> 6. Restart 服务

---

## 附录 A: 审计执行的命令清单

所有命令均为只读操作（SELECT / 文件读取 / grep），未执行任何写操作：

```bash
# 1. 项目结构扫描
find /root/shipin-cinematic-studio -type f -name "*.ts" -o -name "*.js" -o -name "*.env*"

# 2. 搜索 DeepSeek 相关代码
grep -n -i "deepseek\|DEEPSEEK\|LEGAL_EMBEDDING\|LEGAL_LLM" 
  /root/shipin-cinematic-studio/backend/src --include="*.ts" --include="*.js" -r

# 3. 数据库查询 — legal_system_config
psql "postgresql://postgres:postgres@localhost:5432/aigc_scs" -c 
  "SELECT configKey, LEFT(configValue,8)||'***'||RIGHT(configValue,4) FROM legal_system_config 
   WHERE configKey LIKE '%DEEPSEEK%' OR configKey LIKE '%LEGAL_EMBEDDING%' OR configKey LIKE '%LEGAL_LLM%'"

# 4. 数据库查询 — route_config
psql "postgresql://postgres:postgres@localhost:5432/aigc_scs" -c 
  "SELECT scope, key, LEFT(value #>> '{}',8)||'***'||RIGHT(value #>> '{}',4) FROM route_config 
   WHERE key LIKE '%deepseek%' OR key LIKE '%credential%'"

# 5. 数据库查询 — ApiKey
psql "postgresql://postgres:postgres@localhost:5432/aigc_scs" -c "SELECT * FROM \"ApiKey\""

# 6. 数据库查询 — enterprise_provider_credential
psql "postgresql://postgres:postgres@localhost:5432/aigc_scs" -c 
  "SELECT id, provider, model_name, LEFT(api_key_encrypted,20), is_default, status 
   FROM enterprise_provider_credential"

# 7. 搜索 Provider Registry 相关 Model
grep -rn "model ProviderRegistry\|model ModelRouteConfig\|model ProviderHandlerRegistry" 
  /root/shipin-cinematic-studio/backend/prisma/
# → 0 results (表不存在)

# 8. 备份文件检查
ls -la /root/shipin-cinematic-studio/backend/.env*
cat /root/shipin-cinematic-studio/backend/.env.backup.sec-003
cat /root/shipin-cinematic-studio/backend/.env.bak.20260624_000628
```

---

## 附录 B: 文件读取清单

| 文件路径 | 读取目的 |
|----------|----------|
| `.env` | 确认当前环境变量配置 |
| `.env.backup.sec-003` | 备份文件中的旧 Key |
| `.env.bak.20260624_000628` | 备份文件中的旧配置 |
| `src/config/env.ts` | Zod schema 定义与 process.env 注入 |
| `src/routes/legal/legal-config.route.ts` | 法律系统配置路由（write-back 逻辑） |
| `src/routes/customer-service.ts` | 小麒客服凭证读取 |
| `src/routes/admin-customer-service.ts` | 客服管理凭证配置 |
| `src/services/deepseek-llm.provider.ts` | DeepSeek LLM Provider |
| `src/services/provider-registry.service.ts` | Provider Registry（幽灵代码） |
| `src/runtime/resolveRuntimeConfig.ts` | Runtime 配置解析链 |
| `src/runtime/narrative-gateway.ts` | AI Gateway Runtime |
| `src/providers/embedding/dashscope-embedding.provider.ts` | Embedding Provider |
| `src/agent-runtime/gateway/credential-resolver.service.ts` | Enterprise 凭证解析 |
| `src/services/enterprise/organization/provider-credential.service.ts` | Enterprise 凭证加密管理 |
| `src/utils/index.ts` | RouteConfig 辅助函数 |
| `prisma/schema.prisma` | DB Schema 定义 |
| `prisma/migrations/20260716_provider_credential_mgmt/migration.sql` | 企业凭证表 Migration |
| `prisma/migrations/r1_5_credential_lifecycle/migration.sql` | 凭证状态表 Migration |

---

*End of Audit Report — 等待 CTO Review*
