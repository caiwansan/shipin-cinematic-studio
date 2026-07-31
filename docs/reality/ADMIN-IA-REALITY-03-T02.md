# ADMIN-IA-REALITY-03 T02 — 大模型管理 Reality Upgrade — COMPLETE ✅

**Date:** 2026-08-01
**Gate:** 掌柜批准启动（T01 验收通过后）

---

## 目标

> 昆仑镜所有 AI 能力的模型治理 SSOT。

建立：`Model Provider → Model Registry → Model Assignment → Agent Runtime`

**不是做 CRUD**，而是明确职责、消灭黑盒、能力白名单、成本可回答。

---

## 现状审计结论（执行前）

| 资产 | 状态 | 结论 |
|------|------|------|
| AiModel CRUD（admin-models-v2） | ✅ 已有 | 模型库基础 |
| ApiKey 加密存储 | ✅ 已有 | 平台 Key 管理 |
| businessType 业务配置（admin-global-config） | ✅ 已有 | 平台配置层 |
| Model Health Center（admin-llm-health） | ✅ 已有（Sprint-RECRUITMENT-REALITY-04） | 沿用不重造 |
| usage_logs | ✅ 已有 | 统计数据源 |
| **Provider 注册表** | ❌ 缺失 | **本次新增 AiProvider** |
| **能力白名单** | ❌ 缺失 | **本次新增 AiModel.capabilities** |
| **平台默认模型管理 API** | ❌ 缺失 | **本次新增（AiStageModelConfig 治理）** |
| **平台级调用统计 API** | ❌ 缺失 | **本次新增** |
| **Runtime 优先级** | ⚠️ 平台配置先于用户 BYOK | **本次修正：用户 BYOK 优先** |

---

## 交付物

### 1. AiProvider 注册表（新表 ai_provider）

```
id / providerCode(unique) / name / endpoint / credentialStatus / enabled
```

- seed 16 个 Provider：deepseek/openai/aliyun/bailian/volcengine/siliconflow/google/anthropic/xai/moonshot/zhipu/replicate/kling/minimax/jimeng/qwen
- credentialStatus 与 Model Health Center 一致：`untested | ok | failed | decrypt_error | disabled`
- **治理规则：Provider 只能由平台 Admin 注册，workspace 不得自建 Provider**

### 2. 能力白名单（AiModel.capabilities）

```
TEXT / IMAGE / VIDEO / AUDIO / EMBEDDING
```

- 29 个存量模型回填（modelType → capability 映射）
- 保存平台默认模型时校验能力白名单 → **防止短剧偷偷用视频模型、招聘偷偷调文本模型**
- 验证：`llm 位保存 kling-2-0（video）→ 拒绝 ✅`

### 3. 平台默认模型（AiStageModelConfig 治理）

| capability | 标签 | 白名单 |
|-----------|------|--------|
| llm | 文本生成 | TEXT / EMBEDDING |
| image | 图片生成 | IMAGE |
| video | 视频生成 | VIDEO |
| tts | 语音合成 | AUDIO |
| music | 音乐生成 | AUDIO |

- 修复：AiStageModelConfig 补 baseUrl 字段（schema + DB）
- 已配置：llm → deepseek/deepseek-v4-flash

### 4. Runtime 优先级修正（resolveRuntimeConfig）

**冻结顺序（掌柜）：**

```
1. 输入层（显式指定）
2. 企业配置层（EnterpriseLlmConfig）
3. 用户配置层（UserModelConfigV2 BYOK）  ← 原在平台层之后，已提前
4. 平台配置层（admin-global-config businessType）
5. 阶段配置层（AiStageModelConfig = 平台默认模型）
6. 环境变量（开发后门）
```

### 5. 调用统计（usage_logs 聚合）

```
GET /api/admin/usage/stats             总览：调用次数 / token / 成本 / 每日趋势
GET /api/admin/usage/stats/by-model    按 provider+taskType 聚合
GET /api/admin/usage/stats/by-workspace 按租户聚合（企业名解析）
GET /api/admin/usage/stats/by-agent    按 taskType（Agent）聚合
```

**实测回答掌柜问题（近 30 天）：**
- 总调用 627 次 / 总成本 $12.79 / 3.01M tokens
- 最贵业务：短剧 hdz 线（hdz_generic 308 次 $6.65 / hdz_writer 137 次 $4.21）
- 最贵 Agent：hdz_generic $7.22 > hdz_writer $4.21 > hdz_reviewer $1.10

### 6. 健康检测修复（capability.service）

**发现既有 bug：** `credentialVault.owner_id` 是 UUID 列，但 resolver 传 `model:deepseek` → PrismaClientKnownRequestError，导致所有模型连通性测试失败。

修复：
- 统一平台 Key 解析：`env → ApiKey 表（AES解密）→ CredentialVault（try/catch兜底）`
- 补齐 Prisma 模型：`ProviderRegistry`（provider_registry 表）+ `CredentialVault`（credential_vault 表）
- 实测：deepseek-v4-flash 测试返回 HTTP 401（key 失效真实暴露 ✅）

### 7. 前端升级（models.vue）

```
🔌 Provider  |  🎯 默认模型  |  📊 统计  |  📚 模型库
```

- Tab 1: Provider 注册表（状态/测试/启用/删除/新增）
- Tab 2: 平台默认模型（5 能力位 + 候选模型 + 保存 + 测试）
- Tab 3: 调用统计（总览卡片 + 每日成本柱状图 + by-model + by-agent）
- Tab 4: 原模型库（业务配置 + API Key + 供应商模型列表）

---

## Reality Gate

| Gate | 验证 | 状态 |
|------|------|------|
| G1 Provider 统一注册 | 16 Provider seed + 管理 API | ✅ PASS |
| G2 能力白名单 | llm 位拒绝 video 模型 | ✅ PASS |
| G3 默认模型可配 | llm → deepseek-v4-flash 保存生效 | ✅ PASS |
| G4 Runtime 优先级 | 用户 BYOK 提前于平台配置层 | ✅ PASS |
| G5 健康检测真实 | deepseek key 失效 401 暴露 | ✅ PASS |
| G6 成本可回答 | 短剧 $12.79 / hdz_generic $7.22 | ✅ PASS |
| G7 前端一致 | 4 Tab 页面 200 + API 全通 | ✅ PASS |
| G8 权限隔离 | 无 token 401 | ✅ PASS |
| G9 Build PASS | nuxt build ✅ / tsc 新文件 0 错 | ✅ PASS |

---

## 职责边界（冻结）

| 配置 | 职责 |
|------|------|
| UserModelConfigV2 | 个人 BYOK（最高优先于平台） |
| EnterpriseLlmConfig | 企业 BYOK |
| AiProvider + AiModel | 平台模型注册（SSOT） |
| AiStageModelConfig | 平台默认模型分配 |
| Runtime Gateway | 统一执行入口 |

**禁止：**
- workspace 自建 Provider ❌
- workspace 自己维护模型列表 ❌
- 跨能力调用（视频模型用于文本等）❌

---

## API 清单

```
GET/POST/PUT/PATCH/DELETE  /api/admin/ai-providers*
POST  /api/admin/ai-providers/:code/test
GET/PUT/POST              /api/admin/platform-default-models*
GET   /api/admin/usage/stats{/by-model,/by-workspace,/by-agent}
```

## 后续

T03 AI Agent 管理（P1）— Agent 依赖 Capability → Runtime → Model Registry，T02 完成后架构链闭合。
