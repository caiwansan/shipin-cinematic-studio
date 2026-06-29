# 昆仑镜 V4 能力规范

> **版本**: v1.0 · **状态**: 架构基线 (C0) · **日期**: 2026-07-18
> **范围**: Provider 层 → Capability Runtime → Agent Registry → Workflow → Workspace

---

## 1. 能力流架构

```
Provider Layer          Capability Runtime         Agent Registry          Workflow DAG           Workspace
(OpenAI, DeepSeek,      (能力注册、路由、          (Agent 发现、           (DAG 编排、             (UI + Adapter)
 Qwen, Doubao,          调用分发、降级)            生命周期管理)            节点调度)
 Gemini, Local)
     │                       │                          │                      │                    │
     │── 注册 Provider ─────→│                          │                      │                    │
     │                       │── 注册 Agent ────────────→│                      │                    │
     │                       │                          │── 注册 DAG ─────────→│                    │
     │                       │                          │                      │── Workspace 触发 ──→│
     │                       │←── 调用能力 ─────────────│                      │                    │
     │←── 路由到 Provider ───│                          │                      │                    │
     │── 返回结果 ──────────→│── 返回给 Agent ─────────→│                      │                    │
     │                       │                          │── DAG 执行完成 ─────→│── 返回结果 ────────→│
```

**核心原则**: 能力调用路径只能从左到右，从上到下。Provider 不知道 Capability Runtime 的存在，Capability Runtime 不知道 Agent 的业务逻辑，Agent 不知道 DAG 的编排方式。

---

## 2. Provider 层

### 2.1 支持的 Provider

| Provider ID | 提供商 | 支持类型 | 优先级（数字越小越优先） |
|-------------|--------|---------|------------------------|
| `doubao` | 火山引擎 | LLM | 10 |
| `qwen` | 阿里百炼 | LLM | 20 |
| `deepseek` | DeepSeek | LLM | 30 |
| `openai` | OpenAI | LLM | 40 |
| `gemini` | Google | LLM | 50 |
| `local` | 本地模型 | LLM | 100（兜底） |

### 2.2 Provider 注册接口

```typescript
// @studio/platform/capability/provider
export interface ProviderRegistration {
  id: string                    // doubao / qwen / deepseek / openai / gemini / local
  type: CapabilityType          // llm / image / video / tts
  models: string[]              // 支持的模型列表
  priority: number              // 优先级
  enabled: boolean              // 是否启用
  config: {
    apiKey?: string
    baseUrl?: string
    maxRetries?: number
    timeoutMs?: number
    rateLimit?: {
      requestsPerMinute: number
      tokensPerMinute?: number
    }
  }
  healthCheck?: () => Promise<ProviderHealth>
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latencyMs: number
  lastError?: string
}

export interface LLMProviderAdapter {
  /** 生成文本 */
  generate(prompt: string, options?: LLMOptions): Promise<LLMResponse>
  /** 流式生成 */
  generateStream(prompt: string, options?: LLMOptions): AsyncIterable<string>
  /** 嵌入向量 */
  embed(text: string): Promise<number[]>
}

export interface LLMOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  stop?: string[]
}
```

### 2.3 Provider 实现示例

```typescript
// @studio/platform/providers/doubao.provider.ts
import { LLMProviderAdapter, LLMOptions, LLMResponse } from '../types'

export class DoubaoProvider implements LLMProviderAdapter {
  private client: any // 火山引擎 SDK

  constructor(config: { apiKey: string; baseUrl: string }) {
    this.client = new DoubaoSDK({ apiKey: config.apiKey })
  }

  async generate(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: options?.model ?? 'doubao-seed-2-0-plus-260428',
      messages: [
        ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens
    })
    return {
      content: response.choices[0].message.content,
      model: response.model,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens
      }
    }
  }

  async generateStream(prompt: string, options?: LLMOptions): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: options?.model ?? 'doubao-seed-2-0-plus-260428',
      messages: [{ role: 'user', content: prompt }],
      stream: true
    })
    return {
      [Symbol.asyncIterator]() {
        return stream[Symbol.asyncIterator]()
      }
    } as AsyncIterable<string>
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'doubao-embedding-v1',
      input: text
    })
    return response.data[0].embedding
  }
}
```

---

### 2.5 Model 层（Provider → Model → Capability）

Model 层位于 Provider 层与 Capability 之间，是 Provider 透明性和模型级路由的核心抽象。

#### 2.5.1 Model 定义

Model 是 Provider 提供的一个具体模型实例。Workspace 不直接选择 Provider，而是选择 Model：

```
Provider Layer  →  Model Layer  →  Capability Layer  →  Workflow  →  Workspace
(OpenAI,        (gpt-4,         (llm.generate,      (DAG 编排,     (UI +
 DeepSeek,       deepseek-v3,   image.generate,     Agent 调度)    Adapter)
 Qwen)           qwen-max)      tts.generate)
```

#### 2.5.2 Model 接口定义

```typescript
// @studio/platform/capability/model
export interface ModelDefinition {
  /** 模型唯一 ID */
  id: string                     // e.g. "doubao-seed-2-0-plus-260428"

  /** 模型显示名称 */
  name: string                   // "Doubao Seed 2.0 Plus"

  /** 所属 Provider ID */
  providerId: string             // "doubao"

  /** 模型版本（SemVer） */
  version: string                // "2.0.0"

  /** 模型支持的能力类型 */
  capabilities: ModelCapability[]

  /** 模型上下文长度 */
  context: ModelContext

  /** 模型配置 */
  config: ModelConfig

  /** 是否启用 */
  enabled: boolean

  /** 模型优先级（同一 Provider 内排序用） */
  priority: number
}

export interface ModelCapability {
  type: 'llm' | 'image' | 'video' | 'tts' | 'embedding'
  /** 能力 ID（映射到 Capability Runtime 的能力注册） */
  capabilityId: string           // "llm.generate", "image.generate"
  /** 是否支持流式输出 */
  streaming: boolean
  /** 最大输出 Token */
  maxOutputTokens?: number
}

export interface ModelContext {
  maxInputTokens: number
  maxOutputTokens: number
  /** 是否支持函数调用 */
  supportsFunctions: boolean
  /** 是否支持结构化输出 */
  supportsStructuredOutput: boolean
}

export interface ModelConfig {
  /** 默认参数 */
  defaultTemperature?: number
  defaultTopP?: number
  /** 支持的参数列表 */
  supportedParams: string[]
  /** 定价信息 */
  pricing?: {
    inputPer1K: number
    outputPer1K: number
    currency: string
  }
}
```

#### 2.5.3 Model 注册

```typescript
// @studio/platform/capability/model
export class ModelRegistry {
  private models: Map<string, ModelDefinition> = new Map()

  /** 注册模型 */
  register(model: ModelDefinition): void {
    this.models.set(model.id, model)
    console.log(`[ModelRegistry] 模型注册: ${model.name} (${model.id})`)
  }

  /** 注销模型 */
  unregister(modelId: string): void {
    this.models.delete(modelId)
  }

  /** 获取模型 */
  getModel(modelId: string): ModelDefinition | undefined {
    return this.models.get(modelId)
  }

  /** 按能力查询模型 */
  findByCapability(capabilityId: string): ModelDefinition[] {
    return Array.from(this.models.values())
      .filter(m => m.enabled && m.capabilities.some(c => c.capabilityId === capabilityId))
      .sort((a, b) => a.priority - b.priority)
  }

  /** 按 Provider 查询模型 */
  findByProvider(providerId: string): ModelDefinition[] {
    return Array.from(this.models.values())
      .filter(m => m.enabled && m.providerId === providerId)
  }

  /** 获取模型对应的 Provider */
  getProviderForModel(modelId: string): string | undefined {
    return this.models.get(modelId)?.providerId
  }
}
```

#### 2.5.4 Provider 切换变为同模型 - 不同 Provider

通过 Model 层，Provider 切换无需修改 Workspace 代码——Workspace 指定 model，Capability Runtime 自动选择对应的 Provider：

```typescript
// 旧架构：Workspace 指定 Provider（违规）
// ❌ Workspace 直接选择 Provider
const result = await doubaoProvider.generate(prompt)  // 切换到 qwen 需要改代码

// 新架构：Workspace 指定 Model
// ✅ Workspace 选择模型，不关心 Provider
const result = await PlatformSDK.capability.invoke('llm.generate', prompt, {
  model: 'chat-model-v2'           // 逻辑模型名称，不绑定具体 Provider
})

// 后台配置：
// "chat-model-v2" → primary: doubao-seed-2-0-plus-260428 (Provider: doubao)
//                 → fallback: deepseek-v3 (Provider: deepseek)
//
// 切换时只需改映射配置：
// "chat-model-v2" → primary: qwen-max (Provider: qwen)  ← Workspace 代码不变
```

#### 2.5.5 Model 级路由

不同模型版本可以有不同的提示词和 SDK 参数：

```typescript
// @studio/platform/capability/model/routing
export interface ModelRouter {
  /** 根据模型 ID 获取对应的 Provider 调用参数 */
  getProviderParams(modelId: string): ProviderParams

  /** 根据模型 ID 获取系统提示词模板 */
  getSystemPrompt(modelId: string, taskType: string): string | null
}

export interface ProviderParams {
  providerId: string
  modelName: string             // Provider 侧的模型名
  apiKey?: string
  baseUrl?: string
  defaultParams: Record<string, unknown>
}

// 路由示例
const router: ModelRouter = {
  getProviderParams(modelId: string): ProviderParams {
    const routingTable = {
      'chat-model-v2': {
        providerId: 'doubao',
        modelName: 'doubao-seed-2-0-plus-260428',
        defaultParams: { temperature: 0.7, maxTokens: 4096 }
      },
      'chat-model-v1': {
        providerId: 'deepseek',
        modelName: 'deepseek-chat',
        defaultParams: { temperature: 0.8, maxTokens: 2048 }
      }
    }
    return routingTable[modelId]
  }
}
```

#### 2.5.6 Capability 引用方式变更

Capability 现在引用 `modelId` 而非 `providerId`：

```typescript
// AgentRegistration 中的 capabilities 保持不变（引用能力 ID）
// 但能力内部新增模型映射：
export interface CapabilityInvokeOptions {
  /** 指定使用的模型（而非 Provider） */
  model?: string

  /** 首选 Provider（可选，仅在需要覆盖时使用） */
  preferredProvider?: string

  /** 是否允许降级到其他 Provider */
  allowFallback?: boolean

  maxRetries?: number
  timeoutMs?: number
}

// CapabilityRuntime 内部调用流程更新：
// 1. Workspace 调用 capability.invoke('llm.generate', input, { model: 'chat-model-v2' })
// 2. CapabilityRuntime 查找 modelId → chat-model-v2 对应的模型定义
// 3. 从模型定义获取 providerId → doubao
// 4. 调用对应 Provider 的 LLMProviderAdapter
// 5. 如果 doubao 不可用，查找 chat-model-v2 的其他可用 Provider


## 3. Capability Runtime

### 3.1 能力注册中心

所有能力在 Platform 层的 Capability Runtime 中注册。Workspace 不得自行注册能力。

```typescript
// @studio/platform/capability
export class CapabilityRuntime {
  private providers: Map<string, ProviderRegistration> = new Map()
  private agents: Map<string, AgentRegistration> = new Map()
  private healthCache: Map<string, ProviderHealth> = new Map()

  /** 注册 Provider（由 Platform 启动时调用） */
  async registerProvider(registration: ProviderRegistration): Promise<void> {
    this.providers.set(registration.id, registration)
    console.log(`[Capability] Provider registered: ${registration.id}`)
  }

  /** 注册 Agent（由 Agent 开发者或 Workspace Adapter 调用） */
  async registerAgent(registration: AgentRegistration): Promise<void> {
    if (!registration.capabilities.every(c => this.hasProviderForCapability(c))) {
      throw new Error(`Cannot register agent ${registration.id}: missing provider for capabilities`)
    }
    this.agents.set(registration.id, registration)
    console.log(`[Capability] Agent registered: ${registration.id}`)
  }

  /** 调用能力 — 自动路由到最合适的 Provider */
  async invoke<TInput, TOutput>(
    capabilityId: string,
    input: TInput,
    options?: CapabilityInvokeOptions
  ): Promise<CapabilityResult<TOutput>> {
    const provider = await this.selectProvider(capabilityId, options?.preferredProvider)

    const startTime = Date.now()
    try {
      const output = await this.executeWithRetry(
        provider,
        capabilityId,
        input,
        options
      )
      return {
        success: true,
        data: output as TOutput,
        provider: provider.id,
        model: options?.model,
        durationMs: Date.now() - startTime
      }
    } catch (error) {
      // 自动降级 — 尝试下一个可用 Provider
      if (options?.allowFallback !== false) {
        return this.fallbackInvoke(capabilityId, input, provider.id, options)
      }
      return {
        success: false,
        error: error as Error,
        provider: provider.id,
        durationMs: Date.now() - startTime
      }
    }
  }

  private async selectProvider(
    capabilityId: string,
    preferredProvider?: string
  ): Promise<ProviderRegistration> {
    // 1. 用户首选 Provider
    if (preferredProvider && this.providers.has(preferredProvider)) {
      const provider = this.providers.get(preferredProvider)!
      if (provider.enabled) return provider
    }

    // 2. 按优先级排序的健康 Provider
    const candidates = Array.from(this.providers.values())
      .filter(p => p.enabled && p.type === this.getCapabilityType(capabilityId))
      .sort((a, b) => a.priority - b.priority)

    for (const candidate of candidates) {
      const health = await this.checkHealth(candidate.id)
      if (health.status === 'healthy') return candidate
    }

    // 3. 全部不可用 — 最后兜底
    const lastResort = candidates[candidates.length - 1]
    if (lastResort) return lastResort

    throw new Error(`No available provider for capability: ${capabilityId}`)
  }

  private async fallbackInvoke(
    capabilityId: string,
    input: unknown,
    failedProviderId: string,
    options?: CapabilityInvokeOptions
  ): Promise<CapabilityResult<unknown>> {
    const fallbackProvider = Array.from(this.providers.values())
      .find(p => p.id !== failedProviderId && p.enabled)

    if (!fallbackProvider) {
      throw new Error(`All providers failed for capability: ${capabilityId}`)
    }

    console.warn(`[Capability] Falling back from ${failedProviderId} to ${fallbackProvider.id}`)
    return this.invoke(capabilityId, input, {
      ...options,
      preferredProvider: fallbackProvider.id,
      allowFallback: false // 只降级一次
    })
  }

  private async checkHealth(providerId: string): Promise<ProviderHealth> {
    // 缓存 30 秒的健康状态
    const cached = this.healthCache.get(providerId)
    if (cached && Date.now() - cached.latencyMs < 30000) {
      return cached
    }
    // 实际健康检查（略）
    return { status: 'healthy', latencyMs: 0 }
  }

  private hasProviderForCapability(capabilityId: string): boolean {
    return Array.from(this.providers.values())
      .some(p => p.enabled && p.type === this.getCapabilityType(capabilityId))
  }

  private getCapabilityType(capabilityId: string): string {
    const mapping: Record<string, string> = {
      'llm.generate': 'llm',
      'llm.embed': 'llm',
      'image.generate': 'image',
      'video.generate': 'video',
      'tts.generate': 'tts'
    }
    return mapping[capabilityId] || 'llm'
  }

  private async executeWithRetry(
    provider: ProviderRegistration,
    capabilityId: string,
    input: unknown,
    options?: CapabilityInvokeOptions
  ): Promise<unknown> {
    const maxRetries = options?.maxRetries ?? 2
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 实际调用 Provider（略）
        return {}
      } catch (error) {
        lastError = error as Error
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
        }
      }
    }
    throw lastError
  }
}
```

---

## 4. Agent Registry

### 4.1 Agent 注册契约

**所有 Agent 必须在 Platform 层注册**。Workspace 层不能有自己的 Agent 注册表。

```typescript
// @studio/platform/capability/agent
export interface AgentRegistration {
  id: string                            // 全局唯一 Agent ID
  name: string                          // 显示名称
  description: string                   // 功能描述
  workspace: string                     // 所属 Workspace（geo / video / novel 等）
  capabilities: string[]                // 依赖的能力 ID
  handler: (input: unknown, ctx: AgentContext) => Promise<unknown>
  version: string                       // semver

  // 可选
  tags?: string[]
  timeoutMs?: number
  retries?: number
}

export interface AgentContext {
  capabilities: {
    llm: {
      generate: (prompt: string, options?: LLMOptions) => Promise<LLMResponse>
      generateStream: (prompt: string, options?: LLMOptions) => AsyncIterable<string>
      embed: (text: string) => Promise<number[]>
    }
    // 其他能力...
  }
  logger: Logger
  trace: TraceContext
  userId: string
}
```

### 4.2 Agent 实现示例

```typescript
// @studio/platform/agents/knowledge-claim.agent.ts
import { AgentRegistration } from '@studio/platform/capability'

export const knowledgeClaimAgent: AgentRegistration = {
  id: 'knowledge-claim',
  name: 'Knowledge Claim Extractor',
  description: '从文本中提取知识声明（Claim）',
  workspace: 'geo',
  capabilities: ['llm.generate'],
  version: '1.0.0',
  tags: ['knowledge', 'quality', 'geo'],

  handler: async (input: { text: string; context?: string }, ctx) => {
    ctx.logger.info('[Agent:knowledge-claim] 开始提取声明')

    const response = await ctx.capabilities.llm.generate(
      `Extract factual claims from the following text. Return as JSON array:
       Each claim must have: title, content, source, confidence (0-1).

       Text: ${input.text}
       ${input.context ? `Context: ${input.context}` : ''}

       Return ONLY valid JSON, no other text.`,
      {
        temperature: 0.3,
        systemPrompt: 'You are a precise claim extraction specialist.'
      }
    )

    const claims = JSON.parse(response.content)

    ctx.logger.info(`[Agent:knowledge-claim] 提取完成: ${claims.length} 条声明`)

    return {
      claims,
      metadata: {
        agent: 'knowledge-claim',
        model: response.model,
        usage: response.usage
      }
    }
  }
}
```

### 4.3 Agent 注册

```typescript
// @studio/platform/agents/index.ts — 所有 Agent 在此注册
import { CapabilityRuntime } from '@studio/platform/capability'
import { knowledgeClaimAgent } from './knowledge-claim.agent'
import { knowledgeEvidenceAgent } from './knowledge-evidence.agent'
// ...

export async function registerAllAgents(runtime: CapabilityRuntime): Promise<void> {
  const agents = [
    knowledgeClaimAgent,
    knowledgeEvidenceAgent,
    // ...
  ]

  for (const agent of agents) {
    await runtime.registerAgent(agent)
  }

  console.log(`[AgentRegistry] 已注册 ${agents.length} 个 Agent`)
}
```

---

## 5. Provider 切换不修改 Workspace

**核心目标**: 从 Doubao 切换到 Qwen 不需要修改任何 Workspace 代码。

```
当前: Workspace → CapabilityRuntime.invoke('llm.generate') → 自动路由到 Doubao
切换后: Workspace → CapabilityRuntime.invoke('llm.generate') → 自动路由到 Qwen
         ↑ Workspace 代码不变 ↑                    ↑ 仅修改 Provider 注册配置 ↑
```

### 5.1 实现保障

| 机制 | 说明 |
|------|------|
| Provider 抽象 | 所有 Provider 实现相同的 `LLMProviderAdapter` 接口 |
| 运行时路由 | CapabilityRuntime 根据健康状态 + 优先级路由 |
| 配置驱动 | Provider 切换仅修改配置，不修改代码 |
| 自动降级 | Provider 不可用时自动切换到下一个 |

### 5.2 Provider 切换配置

```typescript
// 仅在 Platform 配置中修改，Workspace 不受影响
{
  "capability": {
    "providers": {
      "llm": {
        // 只需要改动这里
        "primary": "qwen",          // 从 doubao 改为 qwen
        "fallbacks": ["deepseek", "openai", "local"],
        "priority": {
          "doubao": 10,             // 从 10 改为 50
          "qwen": 20                // 从 20 改为 10
        }
      }
    }
  }
}
```

---

## 6. 能力发现

Workspace 可以通过 Platform SDK 发现可用能力：

```typescript
// @studio/platform/capability
export interface CapabilityDiscovery {
  /** 列出所有可用能力 */
  listCapabilities(): Promise<CapabilityInfo[]>

  /** 列出可用的 Agent */
  listAgents(filter?: { workspace?: string; tags?: string[] }): Promise<AgentInfo[]>

  /** 检查 Provider 健康状态 */
  checkAllProviders(): Promise<Record<string, ProviderHealth>>
}

export interface CapabilityInfo {
  id: string
  name: string
  description: string
  type: 'llm' | 'image' | 'video' | 'tts'
  providers: string[]     // 可用 Provider 列表
  models: string[]
  status: 'available' | 'degraded' | 'unavailable'
}

export interface AgentInfo {
  id: string
  name: string
  description: string
  workspace: string
  capabilities: string[]
  version: string
}
```

---

## 7. 验证规则

```
□ 所有 Provider 是否实现了 LLMProviderAdapter（或其他类型 Adapter）接口？
□ Provider 切换是否不需要修改 Workspace 代码？
□ Agent 是否在 Platform Agent Registry 中注册？
□ Agent 是否通过 ctx.capabilities 调用能力，而非直接调用 Provider？
□ Workspace 是否通过 Platform SDK capability.invoke 调用能力？
□ 是否有自动降级机制？
□ 是否有健康检查？
□ 是否有 rate limiting？
```

---

*能力规范确保了昆仑镜平台的 Provider 透明性。Workspace 开发者不需要知道底层使用的是哪个 Provider，也不需要在 Provider 切换时修改代码。*
*任何绕过 Capability Runtime 直接调用 Provider 的行为都是架构违规。*
