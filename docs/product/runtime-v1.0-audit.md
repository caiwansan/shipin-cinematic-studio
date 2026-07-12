# Runtime v1.0 — Workspace Integration Audit

## 扫描时间
2026-07-04

## Summary

| Workspace | Runtime 依赖率 | 直接 Provider 访问 | 自推断 Capability | 自推断 Runtime 状态 |
|-----------|:------------:|:-----------------:|:----------------:|:------------------:|
| GEO       | 100%         | **0 (RC2 已修复)**| N                | N                  |
| 短剧       | N/A          | —                 | —                | —                  |
| 小说       | N/A          | —                 | —                | —                  |

> **注：** `short-drama` 和 `novel` 服务目录不存在（未有对应 workspace），仅审计 GEO 服务。

## GEO 详细扫描

### ✅ 使用 UnifiedAIGateway 的组件（共 6 个文件）
通过这些文件通过 `UnifiedAIGateway.invokeAI()` 统一调用 AI Runtime：
- `routes/geo-knowledge-quality.route.ts` — 知识质量检查
- `runtime/generation/StructuredExecutor.ts` — 结构化 AI 执行
- `runtime/provider-health.ts` — Provider 健康检查探针
- `growth/content-generator.service.ts` — 内容生成
- `v1/geo-scan.service.ts` — 品牌扫描服务
- `v1/geo-scan-v2.service.ts` (如存在)

### ❌ 直接 Provider 访问 — 绕过 UnifiedAIGateway（12 个文件）

#### Presence Engine Adapters（11 个适配器直接 `fetch()` 调用 Provider API）
所有适配器均在 `services/geo/presence/adapters/` 下，直接使用 `fetch()` 调用 Provider 的原始 API（chat/completions）：

| 文件 | Provider | 问题描述 |
|------|----------|----------|
| `presence/adapters/chatgpt.ts` | OpenAI/ChatGPT | 直接 `fetch(`${OPENAI_BASE_URL}/chat/completions`)` |
| `presence/adapters/claude.ts` | Claude | 直接 `fetch(`${CLAUDE_BASE_URL}/v1/messages`)` |
| `presence/adapters/deepseek.ts` | DeepSeek | 直接 `fetch(`${baseURL}/chat/completions`)` |
| `presence/adapters/doubao.ts` | 豆包/火山引擎 | 直接 `fetch(.../chat/completions)` |
| `presence/adapters/kimi.ts` | Kimi | 直接 `fetch(.../chat/completions)` |
| `presence/adapters/perplexity.ts` | Perplexity | 直接 `fetch(.../chat/completions)` |
| `presence/adapters/tongyi.ts` | 通义千问 | 直接 `fetch(.../chat/completions)` |
| `presence/adapters/wenxin.ts` | 文心一言 | 直接 `fetch(.../chat/completions)` |
| `presence/adapters/xinghuo.ts` | 讯飞星火 | 直接 `fetch(.../chat/completions)` |
| `presence/adapters/yuanbao.ts` | 元宝 | 直接 `fetch(.../chat/completions)` |
| `presence/adapters/gemini.ts` | Gemini | 直接 `fetch(GEMINI_ENDPOINT)` |

**影响：** PresenceEngine (`presence/engine.ts`) 通过 `ProviderAdapterRegistry` 调用这些适配器，所有 AI presence 检查均绕过 UnifiedAIGateway，无法被 Credential Lifecycle 和 Provider Health 监控管理。

#### Discovery Runner Adapter（1 个文件）
| 文件 | Provider | 问题描述 |
|------|----------|----------|
| `runtime/discovery/legacy-deepseek-adapter.ts` | DeepSeek | 直接 `fetch(.../chat/completions)`，直接读取 `options.apiKey` |

**影响：** Discovery Runner 的 DeepSeek 调用绕过 UnifiedAIGateway，直接管理 API Key。

### ✅ 无自推断 AI Capability
GEO 服务未发现本地 `providerHealth` 自判断或 `modelList` 自判断可用性的情况。所有 capability 判断均通过 `runtime-readiness.service.ts` 和 `capability.route.ts`。

### ✅ 无自推断 Runtime 状态
GEO 服务未发现本地计算 readiness 或直接读取 credential lifecycle 状态的情况。

### ✅ 认证通过 CredentialLifecycleService
GEO 服务引用的凭证相关文件：
- `runtime/provider-health.ts` — 使用 `providerHealthRegistry` 进行健康检查
- `runtime/discovery/discovery-runner.ts` — 通过 `GeoCredentialProvider` 获取凭据
- `presence/geo-credential-provider.ts` — 从 `UserModelConfigV2` 读取凭证
- `repositories/resource-credential.repository.ts` — 凭证仓库层
- `repositories/api-key.repository.ts` — API Key 仓库层

## 发现的问题

### P1: Presence Engine 所有适配器绕过 UnifiedAIGateway（11 个文件）
- **严重性：** ⚠️ 中
- **路径：** `services/geo/presence/adapters/*.ts`
- **描述：** 12 个 Provider 适配器均通过原生 `fetch()` 直接调用 Provider API，不经过 `UnifiedAIGateway`。这意味着：
  - 无法通过 Credential Lifecycle Service 统一管理凭证状态
  - Provider 健康状态无法统一监控
  - API Key 泄露风险（直接传入 `Authorization: Bearer`）
- **建议：** 重构适配器，通过 `UnifiedAIGateway.invokeAI()` 调用，或通过 `GeoCredentialProvider` 统一获取凭证。

### P2: Discovery Runner 遗留 DeepSeek Adapter 直接调用 API（1 个文件）
- **严重性：** ⚠️ 中
- **路径：** `services/geo/runtime/discovery/legacy-deepseek-adapter.ts`
- **描述：** `DeepSeekProvider.execute()` 直接 `fetch()` 调用 DeepSeek API，通过 `ExecuteOptions.apiKey` 传入明文 API Key。
- **建议：** 迁移到 UnifiedAIGateway 或通过 ProviderHealthRegistry 获取凭证。

### P3: 遗留 Geo Provider 层可能为 Dead Code（2 个文件）
- **严重性：** ℹ️ 低
- **路径：** `services/geo/provider/deepseek-provider.ts`, `services/geo/provider/deepseek-config.ts`
- **描述：** 这两个文件存在但未被任何代码 import。`deepseek-provider.ts` 内部也使用直接 `fetch()` 调用。如果已废弃，建议删除或标记。
- **建议：** 确认是否仍被使用（搜索确认无 import），如已废弃则删除。

## Capability API 路径问题

### GET /runtime/capability — 缺少 /api/ 前缀
- **严重性：** ℹ️ 低
- **路径：** `runtime/credential-lifecycle/capability.route.ts` 注册为 `/runtime/capability`
- **描述：** 其他 Runtime API 均统一使用 `/api/runtime/*` 前缀（如 `/api/runtime/summary`、`/api/runtime/recovery`、`/api/runtime/providers`），而 Capability API 注册为 `/runtime/capability`（缺少 `/api` 前缀）。
- **建议：** 路由注册路径改为 `/api/runtime/capability`，保持命名规范一致（需要注意前端是否已适配当前路径）。
