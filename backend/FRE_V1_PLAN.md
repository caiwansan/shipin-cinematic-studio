# First Run Experience (FRE) v1 — Workstreams

**Date:** 2026-06-27  
**Owner:** 熊二  
**Epic URL:** Phase 4.1 of Architecture Convergence v1

## Total Goal

> 新用户在 **3 分钟内完成首次 AI 成功调用**。

成功标准：不是"保存了 API Key"，而是第一次 AI 生成成功。

---

## Workstream A — Frontend Studio Wizard

**Owner:** 前端  
**PRI:** ⭐⭐⭐⭐⭐

### Flow

```
首次进入 Studio
  ↓
检测是否已有 Provider (GET /api/providers/status)
  ↓
┌─ 有 Provider → 正常进入 Studio ─┐
│                                  │
└─ 无 Provider ────────────────────┘
  ↓
Provider Selection Screen
  ├── DeepSeek
  ├── OpenAI
  ├── 火山引擎
  ├── 阿里百炼
  ├── SiliconFlow
  ├── Gemini (future)
  ├── Claude (future)
  ├── Ollama (local, future)
  └── Custom (baseURL)
  ↓
API Key Input + (Optional) baseURL / model
  ↓
[Test Connection] → POST /api/providers/verify
  ↓
┌─ Success ─────────────────────┐
│  ✓ 已连接                      │
│  支持模型: [list]              │
│  延迟: 320ms                   │
│  [下一步: 首次生成]            │
└───────────────────────────────┘
  ↓
Call First AI (default model, a warm-up prompt)
  ↓
┌─ LLM: "你好，用一句话介绍杭州" ──┐
│  Image: "一只橘猫"               │
└─────────────────────────────────┘
  ↓
✅ Completion Screen
  Provider ✓ Model ✓ Connection ✓ First Generation ✓
```

### UX Requirements

- 不要让用户去菜单找"设置" — 向导在首次进入时自动弹出
- Provider 选择后，模型下拉自动填充可用模型
- Test Connection 结果直观展示：支持的模型能力、延迟、状态
- 首次生成用默认模型 + 默认 prompt，一键完成
- 完成度打分（Completion Score）：4/4 ✅

---

## Workstream B — Backend Provider Verify API

**Owner:** 后端  
**PRI:** ⭐⭐⭐⭐⭐

### API: `POST /api/providers/verify`

```typescript
// Request
{
  provider: string    // "deepseek" | "volcengine" | "aliyun" | "siliconflow" | "openai"
  apiKey: string
  baseURL?: string   // 可选，默认使用 provider 默认地址
  model?: string     // 可选，默认使用 provider 默认模型
}

// Response
{
  success: boolean
  latency: number           // ms
  availableModels: string[] // 该 Key 可用的模型列表
  capabilities: string[]    // ["llm", "image", "video", "tts"]
  error?: {
    code: string            // "INVALID_KEY" | "RATE_LIMITED" | "NETWORK_ERROR" | "UNKNOWN"
    message: string
  }
}
```

### Implementation

每个 Provider 实现 verify 方法：

```typescript
interface ProviderVerifier {
  verify(apiKey: string, baseURL?: string): Promise<VerifyResult>
  // VerifyResult: { success, latency, availableModels, capabilities }
}
```

验证策略：
- **DeepSeek**: 调用 models 列表 API
- **OpenAI**: 调用 models 列表 API
- **火山引擎**: 调用 models 列表 API / chat completions 最小请求
- **阿里百炼**: 调用 models 列表 API
- **SiliconFlow**: 调用 models 列表 API
- **Ollama**: 调用 /api/tags

### Existing Endpoints (already registered via ai-tasks)

```typescript
POST /api/tasks/ai-generate    // 实际 AI 调用 (已有)
GET  /api/tasks/:id/status     // 任务状态 (已有)
GET  /api/tasks/:id/result     // 任务结果 (已有)
```

---

## Workstream C — Provider Registry Metadata

**Owner:** 后端  
**PRI:** ⭐⭐⭐⭐

### Architecture

```
ProviderRegistry
  │
  ├── ProviderMetadata[]
  │     ├── id: string
  │     ├── name: string
  │     ├── type: "cloud" | "local"
  │     ├── baseURL: string
  │     ├── models: ModelInfo[]
  │     │     ├── id: string
  │     │     ├── capabilities: string[]  // ["llm", "image", "video", "tts"]
  │     │     ├── defaultModel: boolean
  │     │     └── contextWindow?: number
  │     ├── icon: string
  │     ├── docs: string
  │     └── health: ProviderHealth
  │
  ├── register(provider: ProviderLifecycle)
  ├── getProvider(id: string): ProviderMetadata
  ├── listProviders(): ProviderMetadata[]
  ├── listModels(capability: string): ModelInfo[]
  └── verify(provider: string, apiKey: string, baseURL?: string): VerifyResult
```

### ProviderLifecycle Interface

```typescript
interface ProviderLifecycle {
  id: string
  name: string
  metadata: ProviderMetadata
  
  verify(apiKey: string, baseURL?: string): Promise<VerifyResult>
  health(): Promise<ProviderHealth>
  models(apiKey?: string): Promise<ModelInfo[]>
  capabilities(): string[]
  defaultModel(capability: string): string
}
```

**Architecture Constraint:** 所有新 Provider 必须实现 `ProviderLifecycle`，否则不能进入 Registry。

---

## Workstream D — UX Details

**Owner:** 设计 + 前端  
**PRI:** ⭐⭐⭐⭐

### Completion Score

显示在用户设置页：

```
Provider    ✓   (已验证 2026-06-27)
Model       ✓   (deepseek-v4-flash)
Connection  ✓   (320ms)
First Gen   ✓   (2026-06-27 10:00)

Score: 100% — Ready to go!
```

### Error Messages (Human-readable)

- ❌ `INVALID_KEY` → "API Key 无效，请检查是否复制完整"
- ❌ `RATE_LIMITED` → "该 Key 请求过于频繁，请稍后再试"
- ❌ `NETWORK_ERROR` → "无法连接到 Provider，请检查网络或 baseURL"
- ❌ `QUOTA_EXCEEDED` → "账户余额不足，请充值"

---

## Workstream E — Default Capabilities

**Owner:** 后端  
**PRI:** ⭐⭐⭐

### Default Models by Provider

| Provider | LLM | Image | Video | TTS |
|----------|-----|-------|-------|-----|
| DeepSeek | deepseek-chat | — | — | — |
| 火山引擎 | doubao-pro | seedream-image | volcengine-video | volcengine-tts |
| 阿里百炼 | qwen-turbo | wan-image | aliyun-video | aliyun-tts |
| SiliconFlow | deepseek-v3 | siliconflow-image | — | siliconflow-tts |
| OpenAI | gpt-4o-mini | dalle-image | — | — |
| Ollama | llama3 | — | — | — |

### First Generation Flow

首次调用后端自动选择：
1. 检查用户配置的 Provider
2. 取该 Provider 的默认模型
3. 发送预设 prompt（不要求用户输入）
4. 返回结果 → 显示在完成页面

---

## Success Criteria

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Time to first AI call | < 3 min | 从注册到首次成功调用耗时 |
| Wizard completion rate | > 80% | 进入向导的用户中完成所有步骤的比例 |
| First generation success | > 90% | 首次调用成功率（排除无效 Key 场景） |
| Time to value | < 5 min | 从注册到用户完成第一个完整项目 |

## Future Work (Post-FRE)

- Prompt Governance (Prompt Registry / Versioning / A/B Test)
- Asset Center (角色 / 世界观 / 风格 / 素材 / 跨项目复用)
- GEO Workbench (GEO / Knowledge Graph / Semantic Optimization)
