# 配置/端点硬编码审查报告

审查时间：2026-06-02
审查范围：backend/src/*.ts, frontend/studio-v2/*.ts/*.vue, shared/*.ts
审查原则：宪法第6条——禁止硬编码 provider/模型/API/端点

---

## 🔴 严重违规（业务运行时路径中硬编码模型名/端点/Provider）

### 1. endpoints 硬编码为常量

| 文件 | 行 | 硬编码值 | 类型 |
|------|-----|---------|------|
| `backend/src/runtime/providers/deepseek.provider.ts` | 11 | `'https://api.deepseek.com'` | 端点 |
| `backend/src/runtime/providers/openai.provider.ts` | 43–49 | `'https://api.openai.com/v1'`, `'https://api.moonshot.cn/v1'`, `'https://api.siliconflow.cn/v1'`, `'https://dashscope.aliyuncs.com/compatible-mode/v1'` + fallback `'https://api.openai.com/v1'` | 端点 |
| `backend/src/runtime/providers/provider.registry.ts` | 28, 36 | `'https://ark.cn-beijing.volces.com/api/v3'`, `'https://dashscope.aliyuncs.com/compatible-mode/v1'` | 端点 |
| `backend/src/runtime/resolveRuntimeConfig.ts` | 58–63 | `PROVIDER_BASE_URLS` 映射表：bailian/aliyun/deepseek/openai/siliconflow/volcengine 各端点 | 端点 |
| `backend/src/runtime/runtime-gateway.ts` | 167, 228 | `'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'`（两次） | 端点 |
| `backend/src/providers/adapters/openai-compatible.adapter.ts` | 59, 112 | `'https://api.deepseek.com'`（fallback 值） | 端点 |
| `backend/src/services/unified-ai-gateway.ts` | 73 | `'https://api.openai.com/v1'`（fallback） | 端点 |
| `backend/src/services/capability.service.ts` | 24–26 | `DEFAULT_ENDPOINTS`：deepseek/openai/bailian 端点 | 端点 |
| `backend/src/services/voice-manager.service.ts` | 23 | `BASE_URL = 'https://dashscope.aliyuncs.com'` | 端点 |
| `backend/src/model-adapters/llm/openai-compat.adapter.ts` | 19–21 | `BASE_URLS`：deepseek/openai/siliconflow 端点 | 端点 |
| `backend/src/model-adapters/llm/aliyun-llm.adapter.ts` | 19 | `DEFAULT_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'` | 端点 |
| `backend/src/model-adapters/llm/volcengine-llm.adapter.ts` | 19 | `DEFAULT_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'` | 端点 |
| `backend/src/model-adapters/images/wan-image.adapter.ts` | 26–28 | `V2_ENDPOINT`, `TEXT2IMG_ENDPOINT`, `COMPAT_ENDPOINT` | 端点 |
| `backend/src/model-adapters/images/qwen-image.adapter.ts` | 20 | `COMPAT_ENDPOINT` | 端点 |
| `backend/src/model-adapters/images/seedream-image.adapter.ts` | 33 | `BASE_URL` | 端点 |
| `backend/src/model-adapters/images/siliconflow-image.adapter.ts` | 16 | `BASE_URL` | 端点 |
| `backend/src/model-adapters/images/dalle-image.adapter.ts` | 15 | `BASE_URL` | 端点 |
| `backend/src/model-adapters/video/aliyun-video.adapter.ts` | 27–28 | `SUBMIT_URL`, `QUERY_URL` | 端点 |
| `backend/src/model-adapters/video/volcengine-video.adapter.ts` | 25 | `BASE_URL` | 端点 |
| `backend/src/model-adapters/tts/volcengine-tts.adapter.ts` | 12 | `BASE_URL` | 端点 |
| `backend/src/model-adapters/tts/aliyun-tts.adapter.ts` | 19 | `TTS_URL` | 端点 |
| `backend/src/model-adapters/tts/siliconflow-tts.adapter.ts` | 21 | `BASE_URL` | 端点 |
| `backend/src/production-loop/video/bailian.video.ts` | 15 | `this.baseUrl = 'https://dashscope.aliyuncs.com/api/v1'` | 端点 |
| `backend/src/production-loop/video/replicate.video.ts` | 7 | `REPLICATE_API = 'https://api.replicate.com/v1'` | 端点 |
| `backend/src/production-loop/video/volcengine.video.ts` | 9 | `BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'` | 端点 |
| `backend/src/production-loop/video/volcengine.image.ts` | 8 | `BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'` | 端点 |
| `backend/src/runtime/providers/replicate.image.provider.ts` | 18 | `REPLICATE_API = 'https://api.replicate.com/v1'` | 端点 |
| `backend/src/config/env.ts` | 17, 23, 25, 27, 30, 35 | 多个端点默认值 | 端点 |
| `backend/src/routes/system-health.ts` | 19–47 | 硬编码配置测试 endpoint 和 models | 端点 |
| `backend/src/routes/payment.ts` | 643, 645, 661 | `'https://dashscope.aliyuncs.com/compatible-mode/v1'` fallback | 端点 |
| `backend/src/routes/admin-global-config.ts` | 117, 400, 480 | 硬编码 API 端点 | 端点 |
| `backend/src/routes/customer-service.ts` | 18 | `'https://ark.cn-beijing.volces.com/api/v3'` fallback | 端点 |
| `backend/src/services/music/mureka.provider.ts` | 24 | `'https://api.mureka.ai/v1'` fallback | 端点 |
| `backend/src/services/music/suno.provider.ts` | 24 | `'https://api.suno.ai/v1'` fallback | 端点 |
| `backend/src/services/music/music15.provider.ts` | 23 | `'https://api.music15.ai/v1'` fallback | 端点 |
| `backend/src/services/music/registry.ts` | 122 | `'https://api.deepseek.com/chat/completions'` 直连 (bypass gateway) | 端点 |

### 2. 模型名硬编码

| 文件 | 行 | 硬编码值 | 严重性 |
|------|-----|---------|--------|
| `backend/src/services/unified-ai-gateway.ts` | 80 | `config.model \|\| 'doubao-seed-2-0-plus-260428'` | ⚠ 运行时 fallback |
| `backend/src/services/unified-ai-gateway.ts` | 92 | `config.model \|\| 'deepseek-chat'` | ⚠ 运行时 fallback |
| `backend/src/services/unified-ai-gateway.ts` | 101 | `config.model \|\| 'gpt-4o'` | ⚠ 运行时 fallback |
| `backend/src/routes/payment.ts` | 668 | `model: 'qwen-turbo'` | ⚠ 测试调用 |
| `backend/src/routes/customer-service.ts` | 19 | `process.env.VOLCENGINE_LLM_MODEL \|\| 'doubao-seed-2-0-mini-260428'` | ⚠ fallback |
| `backend/src/services/user-model-resolver.ts` | 44 | `config.llmModel \|\| (prov === 'aliyun' ? 'qwen-max' : prov === 'volcengine' ? 'doubao-seed-2-0-plus-260428' : 'deepseek-chat')` | ⚠ fallback |
| `backend/src/services/music/registry.ts` | 124 | `model: 'deepseek-chat'` | ⚠ 直连调用 |
| `backend/src/production-loop/video/bailian.video.ts` | 22 | `models = ['qwen-video-plus', 'qwen-video-turbo', 'wan-aigc-video']` | ⚠ 模型列表 |
| `backend/src/production-loop/video/volcengine.video.ts` | 12 | `VIDEO_MODEL = 'doubao-seedance-2-0-260128'` | ⚠ 硬编码默认模型 |
| `backend/src/production-loop/video/volcengine.image.ts` | 10 | `IMAGE_MODEL = 'doubao-seedream-4-5-251128'` | ⚠ 硬编码默认模型 |
| `backend/src/config/env.ts` | 20–21 | `VOLCENGINE_VIDEO_MODEL`, `VOLCENGINE_IMAGE_MODEL`, `VOLCENGINE_LLM_MODEL` 默认值 | ⚠ fallback |
| `backend/src/config/env.ts` | 31 | `ALIYUN_IMAGE_MODEL`, `ALIYUN_VIDEO_MODEL` 默认值 | ⚠ fallback |
| `backend/src/capability-registry.ts` | 38–93 | 大量模型名+family 映射表 | ⚠ 静态注册表 |

### 3. Provider 名称硬编码

| 文件 | 行 | 硬编码值 | 说明 |
|------|-----|---------|------|
| `backend/src/runtime/resolveRuntimeConfig.ts` | 79–86 | `envKeyForProvider()` 映射表 | Provider 名称到 env key |
| `backend/src/services/user-model-resolver.ts` | 31 | `providers = ['aliyun', 'volcengine', 'deepseek']` | Provider 优先级扫描 |
| `backend/src/runtime/providers/provider.registry.ts` | 20–37 | `new DeepSeekProvider()`, `new OpenAIProvider({name:'volcengine',...})`, `new OpenAIProvider({name:'bailian',...})` | Provider 注册 |
| `backend/src/services/unified-ai-gateway.ts` | 39–100 | `builtInAdapters: { aliyun, volcengine, deepseek, openai }` | Adapter 注册表 |

### 4. 代码中直连 provider（绕过 Gateway）的严重违规

| 文件 | 行 | 说明 |
|------|-----|------|
| `backend/src/services/music/registry.ts` | 118–125 | **已标记 DEPRECATED** — 直连 `fetch('https://api.deepseek.com/chat/completions')` 使用 `model: 'deepseek-chat'` bypass gateway |
| `backend/src/routes/system-health.ts` | 193–196 | 直接 fetch endpoint 做健康检查（非网关路径） |
| `backend/src/routes/admin-global-config.ts` | 117, 400, 480 | 直接 fetch 端点拉取模型列表 |
| `backend/src/routes/payment.ts` | 668 | 直接 fetch 测试连接 |

---

## 🟡 中等违规（fallback 默认值 / .env 默认值）

### process.env fallback 为硬编码字符串

| 文件 | 行 | 变量 | Fallback 值 |
|------|-----|------|------------|
| `backend/src/routes/customer-service.ts` | 17–19 | `VOLCENGINE_API_KEY` / `VOLCENGINE_BASE_URL` / `VOLCENGINE_LLM_MODEL` | `''` / `'https://ark...'` / `'doubao-...'` |
| `backend/src/routes/wechat-oauth.ts` | 106, 195 | `JWT_SECRET` | `'aigc-director-runtime-secret-key-2026'` |
| `backend/src/routes/qq-oauth.ts` | 159, 252 | `JWT_SECRET` | `'aigc-director-runtime-secret-key-2026'` |
| `backend/src/routes/sms-auth.ts` | 239 | `JWT_SECRET` | `'aigc-director-runtime-secret-key-2026'` |
| `backend/src/routes/admin-models-v2.ts` | 7 | `CRYPTO_ENCRYPTION_KEY` | `'default-dev-key-32chars!!'` |
| `backend/src/services/crypto.service.ts` | 15 | `CRYPTO_ENCRYPTION_KEY` | (有生成函数) |
| `backend/src/services/user-model-resolver.ts` | 13 | `ENCRYPTION_KEY` | `'aigc-scs-default-key-change-me-in-prod-12'` |
| `backend/src/services/user-model-resolver-v2.ts` | 26 | `ENCRYPTION_KEY` | `'aigc-scs-default-key-change-me-in-prod-12'` |
| `backend/src/utils/redis-state.ts` | 16 | `REDIS_URL` | `'127.0.0.1:6379'` |
| `backend/src/routes/upload.ts` | 11 | `PUBLIC_HOST` | `'https://aigc.fushtn.com'` |
| `backend/src/routes/execution-images.ts` | 165, 341, 984 | `http://localhost:PORT` | `'http://localhost:4002'` (PORT fallback) |
| `backend/src/routes/images.ts` | 58, 124 | `http://localhost:PORT` | `'http://localhost:4000'` (PORT fallback) |
| `backend/src/routes/user-center.ts` | 468–470 | 客户端下载地址 | `'https://shipin.fushtn.com/downloads/...'` |

### .env 配置文件中硬编码默认模型（env.ts zod schema）

| 变量 | 默认值 |
|------|--------|
| `VOLCENGINE_VIDEO_MODEL` | `'doubao-seedance-1-5-pro-251215'` |
| `VOLCENGINE_IMAGE_MODEL` | `'doubao-seedream-4-0-250828'` |
| `VOLCENGINE_LLM_MODEL` | `'doubao-seed-2-0-mini-260428'` |
| `ALIYUN_IMAGE_MODEL` | `'wanx2.1-t2i-turbo'` |
| `ALIYUN_VIDEO_MODEL` | `'wan2.7-t2v'` |

### 支付/回调 URL 硬编码

| 文件 | 行 | 值 |
|------|-----|-----|
| `backend/src/payment/config/index.ts` | 20 | `notifyUrl: 'https://shipin.fushtn.com/api/payment/wechat/notify'` |
| `backend/src/payment/config/index.ts` | 37–39 | `gateway: 'https://openapi.alipay.com/gateway.do'`, `notifyUrl: 'https://shipin.fushtn.com/api/payment/alipay/notify'`, `returnUrl: 'https://shipin.fushtn.com/user/credits'` |

---

## 🟢 合规（从 DB / 运行时配置读取）

### 1. RuntimeConfig 解析链（合规）

- `backend/src/runtime/resolveRuntimeConfig.ts` — ✅ **已合规重构**：严格 5 级解析链（输入 → 用户配置 → 阶段配置 → Provider 注册表 → 环境变量），provider/model/apiKey 全部动态解析
- `backend/src/runtime/runtime-gateway.ts` — ✅ 统一执行入口，model/config/apiKey 从 `resolveRuntimeConfig()` 获取
- `backend/src/runtime/build-runtime-payload.ts` — ✅ 从 config 对象透传，不硬编码
- `backend/src/runtime/runtime-payload.ts` — ✅ 类型定义，无硬编码值
- `backend/src/config-runtime/v2-resolver.ts` — ✅ 从 DB V2 配置读取
- `backend/src/services/user-model-resolver-v2.ts` — ✅ 从 DB V2 读取，解密 apiKey

### 2. 路由层（合规）

- `backend/src/routes/api-keys.ts` — ✅ 用户配置存储，来自 request.body
- `backend/src/routes/unified-model-config.ts` — ✅ 来自 request.body
- `backend/src/routes/admin-models.ts` — ✅ 来自 DB
- `backend/src/routes/models.ts` — ✅ 来自 DB
- `backend/src/routes/ai-tasks.ts` — ✅ 从 `resolved` 对象读取

### 3. 核心中层（合规）

- `backend/src/core/runtime/runtime-dispatcher.ts` — ✅ 从 `resolved` 对象读取
- `backend/src/runtime/provider-middleware.ts` — ✅ 从 context 读取
- `backend/src/services/with-user-key.ts` — ✅ 从 DB 读取
- `backend/src/services/api-router.service.ts` — ✅ 从 DB/配置读取
- `backend/src/llm-execution-graph-v2/graph-builder.ts` — ✅ 从 config 读取

### 4. Providers 适配器（部分合规 + 部分违规）

- OpenAI/DeepSeek provider 类 — **apiKey 通过构造/字段传入（合规）**，但 `baseUrl` 硬编码 fallback（违规）
- Model Adapters — **apiKey 从 runtime 传入（合规）**，但端点常量（DEFAULT_ENDPOINT 等）硬编码（违规）
- Replicate provider — `REPLICATE_API_KEY` 从 `process.env` 直接读取（部分违规）

---

## 📊 统计摘要

| 类别 | 数量 |
|------|------|
| 🔴 硬编码端点 URL（严重） | ~48 处 |
| 🔴 硬编码模型名 fallback（严重） | ~18 处 |
| 🔴 硬编码 provider 名称注册表（严重） | ~8 处 |
| 🔴 直连 provider bypass gateway（严重） | 2 处（music/registry, payment test） |
| 🟡 process.env fallback 默认值（中等） | ~25 处 |
| 🟡 .env schema 默认模型（中等） | 5 个 |
| 🟢 合规（DB/配置读取） | ~25 处 |

### 关键发现问题

1. **model-adapters/ 统一违规**：所有 adapter 文件的 `BASE_URL` / `DEFAULT_ENDPOINT` 常量都是硬编码的端点。这些应该从 Provider Registry 或 DB 中动态读取，或至少从 env.ts 统一引用。

2. **`runtime-gateway.ts` 中的 阿里原生端点**：第 167 和 228 行的 `'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'` 是两个硬编码的 fallback 端点，用于兼容模式失败时的降级。

3. **`services/music/registry.ts` 直连 DeepSeek**：第 118–125 行在注释中明确声明 DEPRECATED 且 bypass gateway，使用了硬编码 `model: 'deepseek-chat'`。

4. **`services/unified-ai-gateway.ts` 中 3 个模型 fallback**：volcengine/doubao-seed-2-0-plus-260428, deepseek-chat, gpt-4o 都是硬编码默认值。

5. **`production-loop/video/` 下 3 个文件**：bailian.video.ts、volcengine.video.ts、volcengine.image.ts 都包含硬编码的 baseUrl 和默认模型名。

6. **`env.ts` 定义的多个默认值**是合法的（zod schema 默认值用于开发环境），但在生产环境中未被环境变量覆盖时将使用硬编码模型名。
