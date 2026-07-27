/**
 * Phase 4-C: Canonical Output Runtime (COR)
 * 
 * 所有 Agent 的输出，都必须符合统一 Canonical Schema。
 * 
 * 核心原则：LLM 永远不能直接决定 UI。
 *   正确：LLM → Canonical Output → Renderer → 页面
 *   错误：LLM → Markdown → 页面
 * 
 * 架构：
 *   Agent
 *     → Canonical Output Runtime
 *       → JSON Schema Validation
 *       → Renderer Adapter
 *         → Web / Mobile / Mini Program / API
 */

// ═══════════════════════════════════════════════════════════════
// 1. Evidence Object（证据对象）— 冻结 Schema
// ═══════════════════════════════════════════════════════════════

export interface Evidence {
  id: string
  source: string           // 来源：career_repository, skill_graph, job_matching, etc.
  type: 'fact' | 'statistic' | 'rule' | 'inference' | 'memory'
  confidence: number       // 0-1
  payload: Record<string, unknown>
  metadata?: {
    createdAt: number
    updatedAt: number
    version: string
  }
}

export interface EvidenceFactory {
  create(params: Omit<Evidence, 'id'>): Evidence
  createMany(params: Omit<Evidence, 'id'>[]): Evidence[]
}

// ═══════════════════════════════════════════════════════════════
// 2. Next Action（下一步行动）
// ═══════════════════════════════════════════════════════════════

export interface NextAction {
  id: string
  type: 'learn' | 'apply' | 'analyze' | 'generate' | 'evaluate' | 'search' | 'share' | 'save' | 'custom'
  title: string
  description?: string
  icon?: string
  priority: 'high' | 'medium' | 'low'
  payload?: Record<string, unknown>   // 动作参数
  url?: string                        // 跳转链接
  available: boolean                  // 是否可用
}

export interface NextActionFactory {
  create(params: Omit<NextAction, 'id'>): NextAction
  learn(title: string, payload?: Record<string, unknown>): NextAction
  apply(title: string, payload?: Record<string, unknown>): NextAction
  analyze(title: string, payload?: Record<string, unknown>): NextAction
}

// ═══════════════════════════════════════════════════════════════
// 3. Task Result（任务结果）
// ═══════════════════════════════════════════════════════════════

export interface TaskResult {
  taskId: string
  workflowId?: string
  agent: string
  status: 'success' | 'partial' | 'failed' | 'timeout'
  output: Record<string, unknown>
  duration: number          // ms
  cost: number              // 元
  score?: number            // 质量评分
  timestamp: number
  error?: string
}

// ═══════════════════════════════════════════════════════════════
// 4. Agent Response（统一 Agent 响应）
// ═══════════════════════════════════════════════════════════════

export interface AgentResponse<T = unknown> {
  id: string
  agent: string
  version: string
  status: 'success' | 'partial' | 'failed'
  data: T
  evidence: Evidence[]
  confidence: number        // 0-1
  nextActions: NextAction[]
  metrics: {
    latency: number         // ms
    tokens: number
    cost: number            // 元
  }
  promptId?: string
  promptVersion?: string
  metadata?: Record<string, unknown>
}

export interface AgentResponseFactory {
  create<T>(params: Omit<AgentResponse<T>, 'id'>): AgentResponse<T>
  success<T>(data: T, evidence: Evidence[], agent: string): AgentResponse<T>
  partial<T>(data: T, evidence: Evidence[], agent: string, reason: string): AgentResponse<T>
  failed(agent: string, error: string): AgentResponse<null>
}

// ═══════════════════════════════════════════════════════════════
// 5. UI Card Schema（UI 卡片）
// ═══════════════════════════════════════════════════════════════

export type UICardType =
  | 'career'
  | 'resume'
  | 'interview'
  | 'salary'
  | 'job'
  | 'learning'
  | 'skill'
  | 'company'
  | 'analysis'
  | 'recommendation'
  | 'warning'
  | 'info'
  | 'custom'

export interface UICard {
  id: string
  type: UICardType
  title: string
  subtitle?: string
  description?: string
  score?: number            // 评分（0-100）
  tags?: string[]
  icon?: string
  imageUrl?: string
  actions?: NextAction[]
  data?: Record<string, unknown>    // 卡片特定数据
  style?: {
    variant?: 'default' | 'highlight' | 'compact' | 'expanded'
    color?: string
    size?: 'small' | 'medium' | 'large'
  }
}

export interface UIRenderer {
  render(cards: UICard[]): string                    // 渲染为 HTML/Markdown
  renderCard(card: UICard): string
  renderActions(actions: NextAction[]): string
}

// ═══════════════════════════════════════════════════════════════
// 6. Interaction Canonical Objects (ICO) — 交互对象
// ═══════════════════════════════════════════════════════════════

// 6.1 Conversation Response（对话响应）
export interface ConversationResponse {
  type: 'conversation'
  message: string
  cards?: UICard[]
  nextActions?: NextAction[]
  evidence?: Evidence[]
}

// 6.2 Recommendation Response（推荐响应）
export interface RecommendationResponse {
  type: 'recommendation'
  title: string
  items: Array<{
    id: string
    name: string
    score: number
    reason: string
    evidence: string[]
    tags?: string[]
  }>
  nextActions: NextAction[]
}

// 6.3 Analysis Response（分析响应）
export interface AnalysisResponse {
  type: 'analysis'
  title: string
  summary: string
  details: Array<{
    dimension: string
    score: number
    finding: string
    suggestion?: string
  }>
  overallScore: number
  evidence: Evidence[]
  nextActions: NextAction[]
}

// 6.4 Evaluation Response（评估响应）
export interface EvaluationResponse {
  type: 'evaluation'
  title: string
  target: string
  criteria: Array<{
    name: string
    score: number
    maxScore: number
    comment: string
  }>
  overallScore: number
  overallComment: string
  nextActions: NextAction[]
}

// 6.5 Generation Response（生成响应）
export interface GenerationResponse {
  type: 'generation'
  title: string
  content: string
  format: 'text' | 'markdown' | 'html' | 'code' | 'json'
  metadata?: Record<string, unknown>
  nextActions: NextAction[]
}

//  ICO 联合类型
export type InteractionResponse =
  | ConversationResponse
  | RecommendationResponse
  | AnalysisResponse
  | EvaluationResponse
  | GenerationResponse

// ═══════════════════════════════════════════════════════════════
// 7. JSON Schema Validator（JSON Schema 验证器）
// ═══════════════════════════════════════════════════════════════

export interface SchemaDefinition {
  name: string
  version: string
  schema: Record<string, unknown>
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export class SchemaValidator {
  private schemas = new Map<string, SchemaDefinition>()

  /**
   * 注册 Schema
   */
  register(definition: SchemaDefinition): void {
    this.schemas.set(definition.name, definition)
  }

  /**
   * 验证数据
   */
  validate(schemaName: string, data: unknown): ValidationResult {
    const schema = this.schemas.get(schemaName)
    if (!schema) {
      return { valid: false, errors: [`Schema not found: ${schemaName}`] }
    }

    const errors: string[] = []

    // 简化版 JSON Schema 验证
    if (schema.schema.required && Array.isArray(schema.schema.required)) {
      for (const field of schema.schema.required) {
        if (data && typeof data === 'object' && !(field in (data as Record<string, unknown>))) {
          errors.push(`Missing required field: ${field}`)
        }
      }
    }

    // 类型检查
    if (schema.schema.properties && data && typeof data === 'object') {
      for (const [key, prop] of Object.entries(schema.schema.properties as Record<string, { type: string }>)) {
        const value = (data as Record<string, unknown>)[key]
        if (value !== undefined && prop.type) {
          const actualType = Array.isArray(value) ? 'array' : typeof value
          if (actualType !== prop.type && prop.type !== 'any') {
            errors.push(`Field ${key} expected ${prop.type}, got ${actualType}`)
          }
        }
      }
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * 获取 Schema
   */
  getSchema(name: string): SchemaDefinition | null {
    return this.schemas.get(name) || null
  }

  /**
   * 列出所有 Schema
   */
  listSchemas(): string[] {
    return Array.from(this.schemas.keys())
  }
}

// ═══════════════════════════════════════════════════════════════
// 8. Canonical Output Runtime (COR) 主类
// ═══════════════════════════════════════════════════════════════

export interface CORConfig {
  validator: SchemaValidator
  renderer: UIRenderer
}

export class CanonicalOutputRuntime {
  private responseFactory: AgentResponseFactory
  private evidenceFactory: EvidenceFactory
  private nextActionFactory: NextActionFactory

  constructor(private config: CORConfig) {
    this.responseFactory = {
      create: <T>(params: Omit<AgentResponse<T>, 'id'>) => ({
        ...params,
        id: this.generateId(),
      }),
      success: <T>(data: T, evidence: Evidence[], agent: string) => ({
        id: this.generateId(),
        agent,
        version: '1.0.0',
        status: 'success',
        data,
        evidence,
        confidence: 0.8,
        nextActions: [],
        metrics: { latency: 0, tokens: 0, cost: 0 },
      }),
      partial: <T>(data: T, evidence: Evidence[], agent: string, reason: string) => ({
        id: this.generateId(),
        agent,
        version: '1.0.0',
        status: 'partial',
        data,
        evidence,
        confidence: 0.5,
        nextActions: [],
        metrics: { latency: 0, tokens: 0, cost: 0 },
        metadata: { reason },
      }),
      failed: (agent: string, error: string) => ({
        id: this.generateId(),
        agent,
        version: '1.0.0',
        status: 'failed',
        data: null,
        evidence: [],
        confidence: 0,
        nextActions: [],
        metrics: { latency: 0, tokens: 0, cost: 0 },
        metadata: { error },
      }),
    }

    this.evidenceFactory = {
      create: (params: Omit<Evidence, 'id'>) => ({
        ...params,
        id: this.generateId(),
      }),
      createMany: (params: Omit<Evidence, 'id'>[]) =>
        params.map(p => ({ ...p, id: this.generateId() })),
    }

    this.nextActionFactory = {
      create: (params: Omit<NextAction, 'id'>) => ({
        ...params,
        id: this.generateId(),
      }),
      learn: (title: string, payload?: Record<string, unknown>) => ({
        id: this.generateId(),
        type: 'learn',
        title,
        priority: 'medium',
        available: true,
        payload,
      }),
      apply: (title: string, payload?: Record<string, unknown>) => ({
        id: this.generateId(),
        type: 'apply',
        title,
        priority: 'high',
        available: true,
        payload,
      }),
      analyze: (title: string, payload?: Record<string, unknown>) => ({
        id: this.generateId(),
        type: 'analyze',
        title,
        priority: 'medium',
        available: true,
        payload,
      }),
    }
  }

  /**
   * 创建 Agent Response
   */
  createResponse<T>(params: Omit<AgentResponse<T>, 'id'>): AgentResponse<T> {
    return this.responseFactory.create(params)
  }

  /**
   * 创建 Evidence
   */
  createEvidence(params: Omit<Evidence, 'id'>): Evidence {
    return this.evidenceFactory.create(params)
  }

  /**
   * 创建 Next Action
   */
  createNextAction(params: Omit<NextAction, 'id'>): NextAction {
    return this.nextActionFactory.create(params)
  }

  /**
   * 验证输出
   */
  validateOutput(schemaName: string, data: unknown): ValidationResult {
    return this.config.validator.validate(schemaName, data)
  }

  /**
   * 渲染 UI Cards
   */
  renderCards(cards: UICard[]): string {
    return this.config.renderer.render(cards)
  }

  /**
   * 创建 UI Card
   */
  createCard(params: Omit<UICard, 'id'>): UICard {
    return {
      ...params,
      id: this.generateId(),
    }
  }

  /**
   * 从 Agent Response 提取 UI Cards
   */
  extractCards(response: AgentResponse<unknown>): UICard[] {
    const data = response.data
    
    // 推荐类型
    if (data && typeof data === 'object' && 'recommendations' in data) {
      const recs = (data as { recommendations: Array<{ name: string; score: number; reason: string }> }).recommendations
      return recs.map(r => this.createCard({
        type: 'career',
        title: r.name,
        subtitle: `${r.score}分`,
        description: r.reason,
        score: r.score,
        actions: response.nextActions,
      }))
    }

    // 技能缺口类型
    if (data && typeof data === 'object' && 'gaps' in data) {
      const gaps = (data as { gaps: Array<{ name: string; priority: string }> }).gaps
      return gaps.map(g => this.createCard({
        type: 'skill',
        title: g.name,
        subtitle: g.priority === 'high' ? '高优先级' : g.priority === 'medium' ? '中优先级' : '低优先级',
        tags: [g.priority],
      }))
    }

    // 通用卡片
    return [this.createCard({
      type: 'info',
      title: response.agent,
      description: JSON.stringify(data).slice(0, 100),
      actions: response.nextActions,
    })]
  }

  /**
   * 从 ICO 渲染 Cards
   */
  renderICO(ico: InteractionResponse): UICard[] {
    switch (ico.type) {
      case 'recommendation':
        return ico.items.map(item => this.createCard({
          type: 'career',
          title: item.name,
          subtitle: `${item.score}分`,
          description: item.reason,
          score: item.score,
          tags: item.tags,
          actions: ico.nextActions,
        }))

      case 'analysis':
        return ico.details.map(d => this.createCard({
          type: 'analysis',
          title: d.dimension,
          subtitle: `${d.score}分`,
          description: d.finding,
          score: d.score,
          actions: ico.nextActions,
        }))

      case 'evaluation':
        return ico.criteria.map(c => this.createCard({
          type: 'analysis',
          title: c.name,
          subtitle: `${c.score}/${c.maxScore}`,
          description: c.comment,
          score: Math.round((c.score / c.maxScore) * 100),
          actions: ico.nextActions,
        }))

      case 'generation':
        return [this.createCard({
          type: 'info',
          title: ico.title,
          description: ico.content.slice(0, 200),
          actions: ico.nextActions,
        })]

      default:
        return [this.createCard({
          type: 'info',
          title: '响应',
          description: JSON.stringify(ico).slice(0, 100),
        })]
    }
  }

  /**
   * 创建 Recommendation ICO
   */
  createRecommendationResponse(params: Omit<RecommendationResponse, 'type'>): RecommendationResponse {
    return { type: 'recommendation', ...params }
  }

  /**
   * 创建 Analysis ICO
   */
  createAnalysisResponse(params: Omit<AnalysisResponse, 'type'>): AnalysisResponse {
    return { type: 'analysis', ...params }
  }

  /**
   * 创建 Evaluation ICO
   */
  createEvaluationResponse(params: Omit<EvaluationResponse, 'type'>): EvaluationResponse {
    return { type: 'evaluation', ...params }
  }

  /**
   * 创建 Generation ICO
   */
  createGenerationResponse(params: Omit<GenerationResponse, 'type'>): GenerationResponse {
    return { type: 'generation', ...params }
  }

  private generateId(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }
}

// ═══════════════════════════════════════════════════════════════
// 9. 默认渲染器
// ═══════════════════════════════════════════════════════════════

export class MarkdownRenderer implements UIRenderer {
  render(cards: UICard[]): string {
    return cards.map(card => this.renderCard(card)).join('\n\n')
  }

  renderCard(card: UICard): string {
    const parts: string[] = []
    
    // 标题
    parts.push(`### ${card.title}`)
    if (card.subtitle) parts.push(`*${card.subtitle}*`)
    if (card.score !== undefined) parts.push(`**评分: ${card.score}分**`)
    if (card.description) parts.push(`\n${card.description}`)
    
    // 标签
    if (card.tags && card.tags.length > 0) {
      parts.push(`\n标签: ${card.tags.map(t => `\`${t}\``).join(' ')}`)
    }

    // 操作
    if (card.actions && card.actions.length > 0) {
      parts.push('\n' + this.renderActions(card.actions))
    }

    return parts.join('\n')
  }

  renderActions(actions: NextAction[]): string {
    return actions.map(a => {
      const icon = a.type === 'learn' ? '📚' : a.type === 'apply' ? '🚀' : a.type === 'analyze' ? '🔍' : '👉'
      return `- ${icon} **${a.title}**${a.description ? ` — ${a.description}` : ''}`
    }).join('\n')
  }
}

// ═══════════════════════════════════════════════════════════════
// 10. 预设 JSON Schemas
// ═══════════════════════════════════════════════════════════════

export const PRESET_SCHEMAS: SchemaDefinition[] = [
  {
    name: 'AgentResponse',
    version: '1.0.0',
    schema: {
      type: 'object',
      required: ['id', 'agent', 'status', 'data', 'evidence', 'confidence', 'nextActions', 'metrics'],
      properties: {
        id: { type: 'string' },
        agent: { type: 'string' },
        version: { type: 'string' },
        status: { type: 'string' },
        data: { type: 'any' },
        evidence: { type: 'array' },
        confidence: { type: 'number' },
        nextActions: { type: 'array' },
        metrics: { type: 'object' },
      },
    },
  },
  {
    name: 'RecommendationResponse',
    version: '1.0.0',
    schema: {
      type: 'object',
      required: ['type', 'title', 'items', 'nextActions'],
      properties: {
        type: { type: 'string' },
        title: { type: 'string' },
        items: { type: 'array' },
        nextActions: { type: 'array' },
      },
    },
  },
  {
    name: 'AnalysisResponse',
    version: '1.0.0',
    schema: {
      type: 'object',
      required: ['type', 'title', 'summary', 'details', 'overallScore'],
      properties: {
        type: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
        details: { type: 'array' },
        overallScore: { type: 'number' },
      },
    },
  },
  {
    name: 'Evidence',
    version: '1.0.0',
    schema: {
      type: 'object',
      required: ['id', 'source', 'type', 'confidence', 'payload'],
      properties: {
        id: { type: 'string' },
        source: { type: 'string' },
        type: { type: 'string' },
        confidence: { type: 'number' },
        payload: { type: 'object' },
      },
    },
  },
]

// ═══════════════════════════════════════════════════════════════
// 11. 便捷工厂函数
// ═══════════════════════════════════════════════════════════════

export function createCanonicalOutputRuntime(): CanonicalOutputRuntime {
  const validator = new SchemaValidator()
  const renderer = new MarkdownRenderer()

  // 注册预设 Schema
  for (const schema of PRESET_SCHEMAS) {
    validator.register(schema)
  }

  return new CanonicalOutputRuntime({ validator, renderer })
}
