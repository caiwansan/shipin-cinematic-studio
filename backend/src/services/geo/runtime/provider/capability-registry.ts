// ============================================================
// Capability Registry — KMKI-RUNTIME-003
// 定义 Provider × Capability 映射
// Agent 声明 needs，Runtime 自动匹配可用的 provider
// ============================================================

/** 标准能力类型 */
export type Capability =
  | 'chat'           // 通用对话
  | 'structured_json' // 结构化 JSON 输出（response_format）
  | 'vision'         // 图片理解
  | 'embedding'      // 向量嵌入
  | 'rerank'         // 重排序
  | 'tool_call'      // 工具/函数调用
  | 'streaming'      // 流式输出
  | 'thinking'       // 思考链

/** Provider 能力声明 */
export interface ProviderCapability {
  provider: string
  model: string
  displayName: string
  supports: Capability[]
  costPer1KTokens?: {
    input: number
    output: number
  }
  maxTokens: number
}

/** Agent 能力需求 */
export interface AgentCapabilityRequirement {
  agentCode: string
  agentName: string
  requires: Capability[]
  preferredProvider?: string  // 可选偏好
}

// ============================================================
// 内置 Provider 能力登记表
// ============================================================

const PROVIDER_CAPABILITIES: ProviderCapability[] = [
  {
    provider: 'deepseek',
    model: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    supports: ['chat', 'structured_json', 'streaming', 'thinking'],
    maxTokens: 65536,
  },
  {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    displayName: 'DeepSeek Reasoner',
    supports: ['chat', 'streaming', 'thinking'],
    maxTokens: 65536,
  },
  {
    provider: 'volcengine',
    model: 'doubao-seed-2-0-mini-260428',
    displayName: 'Doubao Seed Mini',
    supports: ['chat', 'structured_json', 'streaming'],
    maxTokens: 16384,
  },
  {
    provider: 'volcengine',
    model: 'doubao-seed-2-0-plus-260428',
    displayName: 'Doubao Seed Plus',
    supports: ['chat', 'structured_json', 'streaming'],
    maxTokens: 16384,
  },
  {
    provider: 'openai',
    model: 'gpt-4o',
    displayName: 'GPT-4o',
    supports: ['chat', 'structured_json', 'vision', 'tool_call', 'streaming'],
    maxTokens: 16384,
  },
  {
    provider: 'siliconflow',
    model: 'Pro/deepseek-chan',
    displayName: 'SiliconFlow DeepSeek',
    supports: ['chat', 'structured_json', 'streaming'],
    maxTokens: 32768,
  },
  {
    provider: 'aliyun',
    model: 'qwen-max',
    displayName: '通义千问 Max',
    supports: ['chat', 'structured_json', 'streaming'],
    maxTokens: 32768,
  },
]

// ============================================================
// 注册表
// ============================================================

class CapabilityRegistry {
  private providers = new Map<string, ProviderCapability[]>()

  constructor() {
    for (const pc of PROVIDER_CAPABILITIES) {
      const list = this.providers.get(pc.provider) || []
      list.push(pc)
      this.providers.set(pc.provider, list)
    }
  }

  /** 注册（或覆盖）一个 provider 的能力 */
  register(pc: ProviderCapability): void {
    const list = this.providers.get(pc.provider) || []
    const idx = list.findIndex((l) => l.model === pc.model)
    if (idx >= 0) list[idx] = pc
    else list.push(pc)
    this.providers.set(pc.provider, list)
  }

  /** 查询某个 provider 是否支持某种能力 */
  supports(provider: string, model: string, cap: Capability): boolean {
    const list = this.providers.get(provider)
    if (!list) return false
    const pc = list.find((l) => l.model === model)
    if (!pc) return false
    return pc.supports.includes(cap)
  }

  /** 根据 Agent 需求推荐 provider */
  recommend(required: Capability[], preferredProvider?: string): ProviderCapability[] {
    const candidates: ProviderCapability[] = []

    for (const [, models] of this.providers) {
      for (const pc of models) {
        const hasAll = required.every((c) => pc.supports.includes(c))
        if (hasAll) candidates.push(pc)
      }
    }

    // 按优先级排序：preferredProvider 优先
    if (preferredProvider) {
      candidates.sort((a) => (a.provider === preferredProvider ? -1 : 1))
    }

    return candidates
  }

  /** 获取某个 provider 的所有模型 */
  getModels(provider: string): ProviderCapability[] {
    return this.providers.get(provider) || []
  }

  /** 列出所有注册的 provider */
  listProviders(): string[] {
    return Array.from(this.providers.keys())
  }
}

export const capabilityRegistry = new CapabilityRegistry()
