# AI Provider Architecture Report — Sprint-06A-LLM-ALIGNMENT

> 审计日期：2026-07-27
> 审计范围：短剧工作台 + 企业 AI Workforce + 招聘模块
> 目标：明确「平台 AI」与「个人 AI 员工」的分层边界，输出求职管家接入方案

---

## 一、审计发现：当前并存的三套 LLM 配置体系

昆仑镜目前存在 **三套并行** 的 LLM 配置/调用链路，各自服务于不同场景：

### 体系 1：短剧工作台 HDZ LLM 链路（最成熟）

```
前端用户选择 → resolveRuntimeConfig()
                  ↓ 优先级链
              1. UserModelConfigV2（用户 BYOK，per-capability）
              2. AiStageModelConfig（阶段配置）
              3. ModelProvider（系统默认）
              4. 环境变量 fallback
                  ↓
              executeViaGateway('llm', ...)
                  ↓
              routeToProvider() → fetch('/chat/completions')
```

| 组件 | 位置 | 状态 |
|------|------|------|
| UserModelConfigV2 | `prisma/schema.prisma:1313` + `config/v2.ts` | ✅ 生产成熟，4 能力独立 Key |
| resolveRuntimeConfig | `runtime/resolveRuntimeConfig.ts` | ✅ Runtime Authority，全系统唯一入口 |
| executeViaGateway | `runtime/runtime-gateway.ts` | ✅ 唯一执行入口，trace 记录 |
| 全局模型配置 | `routes/admin-global-config.ts` | ✅ Admin 后台可配默认模型 |
| ModelProvider 表 | `prisma` + `modelProvider` | ✅ 供应商注册表 |

**UserModelConfigV2 核心字段：**
```prisma
model UserModelConfigV2 {
  userId        String   @id
  llmProvider   String   @default("volcengine")
  llmApiKey     String?  // 加密存储
  llmModel      String   @default("doubao-seed-2-0-plus-260428")
  llmEnabled    Boolean  @default(true)
  llmBaseUrl    String?
  imageProvider String   @default("volcengine")
  imageApiKey   String?
  imageModel    String?
  imageBaseUrl  String?
  videoProvider String   @default("volcengine")
  videoApiKey   String?
  videoModel    String?
  videoBaseUrl  String?
  ttsProvider   String   @default("volcengine")
  ttsApiKey     String?
  ttsModel      String?
  ttsBaseUrl    String?
}
```

**关键设计亮点：**
- per-capability baseUrl（`llmBaseUrl`, `imageBaseUrl` 等），不同能力可指向不同供应商
- 加密 Key 存储 + 解密仅在 resolveRuntimeConfig 内完成
- 显式 CONFIG_ERROR 替代 silent fallback

---

### 体系 2：企业 AI Workforce LLM 链路（招聘模块在用）

```
Agent Task → ModelRouterService.resolve()
                ↓ 四级 fallback
            1. ModelRoutingPolicy（agentType + taskType 精确匹配）
            2. EnterpriseLlmConfig（tenant 默认模型池）
            3. User BYOK（getUserLLMConfig → UserModelConfigV2）
                ↓
             enterprise-llm.service.getFullConfig() → decryptKey
                ↓
             callLLM()（HDZ llm.client.ts）
```

| 组件 | 位置 | 状态 |
|------|------|------|
| EnterpriseLlmConfig | `prisma/schema.prisma:6564` + `services/enterprise/enterprise-llm.service.ts` | ✅ 功能完整但定位模糊 |
| ModelRoutingPolicy | `prisma/schema.prisma:6813` | ✅ 路由策略表 |
| ModelRouterService | `services/enterprise/model-router.service.ts` | ✅ 四级 fallback |
| AgentBrainService | `agent-runtime/brain/agent-brain.service.ts` | ✅ 通过 Gateway 调用 |

**EnterpriseLlmConfig 核心字段：**
```prisma
model EnterpriseLlmConfig {
  id                    String   @id
  tenantId              String   // 企业/用户租户
  provider              String   // deepseek | openai | volcengine | aliyun
  modelName             String
  encryptedApiKey       String   // 加密
  baseUrl               String?
  credentialOwner       String   @default("enterprise") // enterprise | kunlun | user
  maxTokensPerDay       Int      @default(0)
  maxRequestsPerMinute  Int      @default(60)
  capabilities          String   @default("[]")
  enabled               Boolean  @default(true)
  status                String   @default("active")
}
```

**问题：** `EnterpriseLlmConfig` 同时承载了「企业 BYOK」和「平台模型」两种语义，没有区分「平台统一模型」和「企业自有模型」。

---

### 体系 3：AIProviderConfig（企业组织级，较新）

```
enterprise-foundation.ts → aiProviderConfigService
                              ↓
                        AIProviderConfig 表（per-organization）
```

| 组件 | 位置 | 状态 |
|------|------|------|
| AIProviderConfig | `prisma/schema.prisma:2874` | ✅ 已有迁移 |
| AIProviderConfigService | `services/enterprise/organization/ai-provider-config.service.ts` | ✅ CRUD 完整 |

**AIProviderConfig 核心字段：**
```prisma
model AIProviderConfig {
  id              String   @id
  organizationId  String   // 绑定组织
  provider        String   // deepseek | openai | claude | qwen | zhipu
  encryptedApiKey String
  baseUrl         String?
  model           String
  maxTokensPerDay Int      @default(0)
  enabled         Boolean  @default(true)
  status          String   @default("active")
}
```

**定位：** 这是最接近「企业组织级 BYOK」的模型，但和 EnterpriseLlmConfig 功能重叠。

---

## 二、问题诊断：当前架构的「错位」

### 问题 1：Career Agent 走 EnterpriseLlmConfig — 语义错误

当前：
```
求职管家 → Career Agent → EnterpriseLlmConfig → 模型
```

`EnterpriseLlmConfig` 是「企业自有模型池」语义（credentialOwner=enterprise），但 Career Agent 是**用户个人 AI 员工**，应该走 BYOK。

### 问题 2：平台 AI 求职顾问缺少统一入口

短剧工作台有完整的「管理员配置全局模型 → 用户无感使用」链路（admin-global-config → resolveRuntimeConfig → env fallback）。求职管家的**平台级 AI 能力**（简历分析、职业咨询等）缺少对应入口，当前被硬塞进 EnterpriseLlmConfig。

### 问题 3：三套体系并行，维护成本高

| 体系 | 配置表 | 调用入口 | 加密方式 | 适用场景 |
|------|--------|----------|----------|----------|
| HDZ V2 | UserModelConfigV2 | resolveRuntimeConfig → Gateway | AES-256-GCM | 用户 BYOK（短剧验证） |
| Enterprise Workforce | EnterpriseLlmConfig | ModelRouter → callLLM | AES-256-GCM | 企业/招聘（新建） |
| AIProviderConfig | AIProviderConfig | aiProviderConfigService | AES-256-GCM | 组织级（最新） |

三套体系各自有独立的加密、独立的路由、独立的调用入口，但底层都是同一件事：选 provider → 取 key → 调 LLM。

---

## 三、目标架构：两层分离

### 设计原则

> **平台 AI 能力 = 管理员配置，用户无感使用**
> **个人 AI 员工 = 用户 BYOK，完全隔离**

```
┌─────────────────────────────────────────────────────────┐
│                  昆仑镜 AI Gateway                       │
│                  (统一执行入口)                           │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  短剧    │  │  求职    │  │  PPT    │  │ 音乐   │ │
│  │ 平台模型 │  │ 平台模型 │  │ 平台模型 │  │ 平台.. │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│           ↑ 管理员统一配置，业务标签区分                    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │         User BYOK (UserModelConfigV2)            │   │
│  │  用户自己的 Key → 个人 AI 员工                    │   │
│  └─────────────────────────────────────────────────┘   │
│           ↑ 用户自带 Key，Hermes Identity 隔离          │
└─────────────────────────────────────────────────────────┘
```

### 分层定义

#### 第一层：平台 AI 能力（Platform AI）

**用途：** 所有「打开即用」的 AI 功能
- 短剧：文风分析、剧本拆解、角色生成、封面 prompt
- 求职：简历分析、职业咨询、岗位解释、面试问题生成
- PPT：排版建议、内容生成（预留）
- 音乐：歌词生成、旋律建议（预留）

**特点：**
- 用户无需配置 API Key
- 由管理员后台配置供应商和模型
- 统一走 `executeViaGateway` 链路
- 按业务标签区分，不重复建设

**模型来源：** 复用短剧工作台 `admin-global-config.ts` 架构，扩展 `businessType` 标签

**实现方式：**
```typescript
// 复用现有 resolveRuntimeConfig 链路
// 新增 businessType 维度
await resolveRuntimeConfig('llm', {
  businessType: 'career', // 'hdz' | 'career' | 'ppt' | 'music'
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
});
```

**复用清单：**
| 组件 | 是否复用 | 备注 |
|------|----------|------|
| resolveRuntimeConfig() | ✅ 复用 | 扩展 businessType 参数 |
| executeViaGateway() | ✅ 复用 | 唯一执行入口 |
| runtime-gateway.ts | ✅ 复用 | trace + 路由 |
| UserModelConfigV2 (BYOK) | ✅ 复用 | 用户自带 Key 路径 |
| admin-global-config.ts | ✅ 复用 | 扩展业务标签 |
| usage_logs | ✅ 复用 | 统一 Token 统计 |
| usage-quota.service | ✅ 复用 | 统一配额管理 |
| ModelProvider 表 | ✅ 复用 | 供应商注册表 |
| AiStageModelConfig | ✅ 复用 | 阶段配置层 |

#### 第二层：个人 AI 员工（Personal AI Employee / BYOK）

**用途：** 用户的长期 AI 职业员工
- Career Agent：每日岗位扫描、职业路线维护、模拟面试
- 企业 AI 员工：招聘经理、招聘官、宣传官等（已有 Hermes 体系）

**特点：**
- 用户自带 API Key（BYOK 宪法）
- Hermes Identity 隔离（Memory/Tool/Session）
- 独立的生命周期管理

**模型来源：** `UserModelConfigV2` → `resolveRuntimeConfig()` 用户配置层优先

**调用链：**
```
Career Agent
    ↓
HermesProfileBinding（Identity 映射）
    ↓
resolveRuntimeConfig('llm', { userId })
    ↓ 优先读取
UserModelConfigV2（用户 BYOK）
    ↓ fallback
admin-global-config（管理员配置的默认供应商，仅 Key 仍由用户提供）
```

---

## 四、现有组件处置建议

### 4.1 EnterpriseLlmConfig — 需要拆解

**当前状态：** 混用了「企业 BYOK」和「平台模型」两种语义。

**建议：**

| 用途 | 处置 | 迁移到 |
|------|------|--------|
| 企业 AI 员工的模型配置 | 保留，但限定为 `credentialOwner='enterprise'` | 继续用 EnterpriseLlmConfig |
| 平台 AI 求职顾问 | **迁移出** | 复用 admin-global-config + businessType |
| Career Agent 模型 | **迁移走** | 走 UserModelConfigV2 BYOK |
| credentialOwner='user' 的记录 | 迁移到 | UserModelConfigV2 |

**过渡方案：**
1. 新增 `businessType` 字段的 admin-global-config 扩展
2. Career Agent 走 `resolveRuntimeConfig` 用户层优先
3. EnterpriseLlmConfig 仅服务于企业 AI 员工（`credentialOwner='enterprise'`）
4. 已有的 `credentialOwner='user'` 记录可逐步迁移到 UserModelConfigV2

### 4.2 AIProviderConfig — 定位澄清

**当前状态：** 较新的组织级配置表，功能与 EnterpriseLlmConfig 高度重叠。

**建议：**
- 如果 EnterpriseLlmConfig 继续作为「企业 AI 员工」的模型配置，AIProviderConfig 可作为备用/替代
- 但不应新建第三套调用入口，统一走 `executeViaGateway`

### 4.3 ModelRouterService — 瘦身

**当前状态：** 四级 fallback（Agent Binding → Routing Policy → Default Pool → User BYOK）。

**建议：**
- 保留 Routing Policy 机制（企业 AI 员工需要按岗位路由不同模型）
- 「Default Pool」改为从 admin-global-config 读取，不再走 EnterpriseLlmConfig 兜底
- User BYOK 链路直接调用 `resolveRuntimeConfig()`，不绕道 ModelRouter

---

## 五、求职管家接入方案

### Phase 1：平台 AI 能力接入（Platform AI）

**目标：** 求职管家的「打开即用」AI 功能（简历分析、职业咨询等）复用短剧链路。

**步骤：**

1. **扩展 admin-global-config 业务标签**
   ```typescript
   // admin-global-config.ts 新增业务维度
   interface BusinessTypeConfig {
     businessType: 'hdz' | 'career' | 'ppt' | 'music';
     providers: ProviderConfig[];
   }
   ```

2. **新增 Career AI Provider Adapter**
   ```typescript
   // services/career/career-ai-provider.adapter.ts
   export async function resolveCareerAIProvider(
     capability: 'llm',
     options?: { userId?: string; businessType?: string }
   ): Promise<ResolvedRuntimeConfig> {
     // 复用 resolveRuntimeConfig，传入 businessType
     return resolveRuntimeConfig(capability, {
       businessType: 'career',
       ...options,
     });
   }
   ```

3. **前端配置入口统一**
   - 管理员后台增加「求职」业务标签页
   - 配置入口与短剧共用组件，通过 tab 区分

4. **Token 统计复用**
   - 所有 career AI 调用走 `executeGateway`，trace 自动记录
   - UsageLog 增加 `businessType` 字段区分来源

### Phase 2：Career Agent BYOK（个人 AI 员工）

**目标：** Career Agent 作为用户个人 AI 员工，走 BYOK。

**步骤：**

1. **CareerAgentInstance + HermesProfileBinding**（已有表，继续扩展）
   ```prisma
   model CareerAgentInstance {
     id              String   @id
     userId          String   // 绑定用户（非 tenant）
     name            String
     hermesBinding   HermesProfileBinding?
     status          String   @default("active")
     createdAt       DateTime @default(now())
   }
   ```

2. **BYOK 链路接入**
   ```typescript
   // Career Agent 执行时
   const userConfig = await resolveRuntimeConfig('llm', {
     userId: careerAgent.userId, // 强制走用户 BYOK
   });
   // 用户未配置 Key → 抛出 CONFIG_ERROR，引导用户配置
   ```

3. **Hermes Identity 隔离**
   ```
   namespace: user/{userId}/agent/career-assistant
   ```

4. **前端引导**
   - 用户首次创建 Career Agent → 检测 UserModelConfigV2 是否有 Key
   - 无 Key → 弹出配置面板（复用短剧工作台的 Key 配置组件）
   - 支持 DeepSeek/OpenAI/Claude/通义/豆包

### Phase 3：逐步退役 EnterpriseLlmConfig 中的非企业记录

**目标：** 清理历史数据，明确 EnterpriseLlmConfig = 企业 AI 员工专属。

---

## 六、关键决策点

### 决策 1：是否保留 EnterpriseLlmConfig 表？

**建议：保留，但缩小范围。**

- 继续作为 `credentialOwner='enterprise'` 的企业 AI 员工模型配置
- 不再承载「平台模型」和「用户 BYOK」语义
- 与 ModelRoutingPolicy 配合，服务企业的多模型路由需求

### 决策 2：Career Agent 是否复用 UserModelConfigV2？

**建议：是，完全复用。**

- UserModelConfigV2 已经是成熟的 per-capability BYOK 配置
- 有加密存储、per-capability baseUrl、显式 CONFIG_ERROR
- 不需要新建 `UserAIProviderConfig` 表

### 决策 3：AIProviderConfig 表是否继续使用？

**建议：暂停新增，评估与 EnterpriseLlmConfig 合并。**

- 两个表功能高度重叠（per-organization/per-tenant + provider + encrypted Key + model）
- 继续同时维护两套会增加不一致风险
- 建议：AIProviderConfig 作为 EnterpriseLlmConfig 的替代，但需要统一调用入口

---

## 七、Reality Gate（验证标准）

| 编号 | 验证项 | 通过标准 |
|------|--------|----------|
| R1 | 平台 AI 求职顾问无感使用 | 用户不配 Key 即可使用简历分析/职业咨询 |
| R2 | Career Agent BYOK 隔离 | 用户 A 的 Key 不会用于用户 B 的 Career Agent |
| R3 | 短剧与求职平台模型独立配置 | 修改短剧默认模型不影响求职 |
| R4 | Token 统计统一 | 短剧和求职的 usage_logs 可正确区分来源 |
| R5 | Career Agent 未配 Key 友好提示 | 用户看到引导配置面板，而非 500 错误 |
| R6 | executeViaGateway 统一入口 | 所有 LLM 调用（短剧/求职/企业员工）均走 Gateway |

---

## 八、附录：关键文件索引

### 短剧工作台（HDZ）— 复用参考

| 文件 | 职责 |
|------|------|
| `runtime/resolveRuntimeConfig.ts` | Runtime Authority，配置解析链 |
| `runtime/runtime-gateway.ts` | 全系统唯一执行入口 |
| `config/v2.ts` | UserModelConfigV2 读取封装 |
| `services/hdz/llm.client.ts` | LLM 调用客户端（callLLM, getUserLLMConfig） |
| `routes/admin-global-config.ts` | 管理员全局模型配置 |
| `services/usage-quota.service.ts` | 每日配额管理 |
| `prisma/schema.prisma:1313` | UserModelConfigV2 模型定义 |

### 企业 AI Workforce — 需改造

| 文件 | 职责 | 改造方向 |
|------|------|----------|
| `services/enterprise/enterprise-llm.service.ts` | EnterpriseLlmConfig CRUD | 缩小为仅企业 BYOK |
| `services/enterprise/model-router.service.ts` | 四级 fallback 路由 | Default Pool → admin-global |
| `routes/llm-config.ts` | 企业 LLM 配置路由 | 不再服务 Career Agent |
| `agent-runtime/brain/agent-brain.service.ts` | Agent Brain，通过 Gateway 调用 | 保持不变 |

### 求职管家 — 新建

| 文件 | 职责 |
|------|------|
| `services/career/career-ai-provider.adapter.ts` | 平台 AI 适配器（复用 Gateway） |
| `services/career/career-agent.service.ts` | Career Agent BYOK 执行 |
| `routes/career-agent.ts` | Career Agent API |

---

_报告完成。等待掌柜确认后进入实施阶段。_
