// ============================================================
// B3-002: Capability Matrix — Provider 能力声明矩阵
//
// Pipeline 不依赖具体 Provider，只依赖 Capability
// CapabilityResolver 根据需求自动选择最优 Provider
// ============================================================

/** 引擎能力类型 */
export type DiscoveryCapability =
  | 'presence-scan'     // 品牌存在感扫描
  | 'entity-discovery'  // 实体发现
  | 'knowledge-depth'   // 深度知识覆盖
  | 'competitor-scan'   // 竞争对手扫描
  | 'sentiment-analyze' // 情感分析
  | 'faq-generation'    // FAQ 生成
  | 'schema-extraction' // Schema 提取
  | 'summary'           // 摘要能力

/** 每个 Provider 的能力声明 */
export interface CapabilityDeclaration {
  provider: string
  capabilities: DiscoveryCapability[]
}

/**
 * 默认能力矩阵
 * 每个 Provider 声明自己支持哪些能力
 * PipeLine 通过 CapabilityResolver 决定谁执行
 */
export const DEFAULT_CAPABILITY_MATRIX: CapabilityDeclaration[] = [
  {
    provider: 'deepseek',
    capabilities: [
      'presence-scan',
      'entity-discovery',
      'knowledge-depth',
      'faq-generation',
      'summary',
    ],
  },
  {
    provider: 'chatgpt',
    capabilities: [
      'presence-scan',
      'entity-discovery',
      'knowledge-depth',
      'competitor-scan',
      'sentiment-analyze',
      'faq-generation',
      'schema-extraction',
      'summary',
    ],
  },
  {
    provider: 'claude',
    capabilities: [
      'presence-scan',
      'entity-discovery',
      'knowledge-depth',
      'competitor-scan',
      'sentiment-analyze',
      'summary',
    ],
  },
  {
    provider: 'gemini',
    capabilities: [
      'presence-scan',
      'entity-discovery',
      'summary',
    ],
  },
  {
    provider: 'doubao',
    capabilities: [
      'presence-scan',
      'entity-discovery',
      'knowledge-depth',
    ],
  },
  {
    provider: 'tongyi',
    capabilities: [
      'presence-scan',
      'entity-discovery',
      'knowledge-depth',
      'faq-generation',
    ],
  },
]

/**
 * 能力解析器
 * Pipeline 根据需求自动选择最优 Provider
 */
export class CapabilityResolver {
  private matrix: Map<string, DiscoveryCapability[]>

  constructor(declarations: CapabilityDeclaration[] = DEFAULT_CAPABILITY_MATRIX) {
    this.matrix = new Map()
    for (const decl of declarations) {
      this.matrix.set(decl.provider.toLowerCase(), decl.capabilities)
    }
  }

  /** 查询 Provider 是否支持某能力 */
  hasCapability(provider: string, capability: DiscoveryCapability): boolean {
    const caps = this.matrix.get(provider.toLowerCase())
    return caps ? caps.includes(capability) : false
  }

  /** 获取支持某能力的所有 Provider */
  getProvidersWithCapability(capability: DiscoveryCapability): string[] {
    const result: string[] = []
    for (const [provider, caps] of this.matrix) {
      if (caps.includes(capability)) result.push(provider)
    }
    return result
  }

  /** 获取 Provider 的全部能力 */
  getCapabilities(provider: string): DiscoveryCapability[] {
    return this.matrix.get(provider.toLowerCase()) ?? []
  }

  /** 注册或更新 Provider 能力声明 */
  register(declaration: CapabilityDeclaration): void {
    this.matrix.set(declaration.provider.toLowerCase(), declaration.capabilities)
  }
}

/** 全局单例 */
export const capabilityResolver = new CapabilityResolver()
