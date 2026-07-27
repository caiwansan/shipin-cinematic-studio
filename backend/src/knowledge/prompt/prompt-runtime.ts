/**
 * Phase 4-B: Prompt Runtime
 * 
 * 目标：把散落在代码里的 Prompt，升级为可管理、可版本控制、可测试、可优化的基础设施。
 * 
 * 核心原则：Prompt 不属于 Agent。
 *   Agent 只声明 promptId，Prompt Runtime 负责渲染。
 * 
 * 架构：
 *   Agent
 *     → Prompt Runtime
 *       → Prompt Registry
 *         → Prompt Template
 *           → Context Injection
 *           → Evidence Injection
 *           → Memory Injection
 *             → LLM
 */

// ─── 1. Prompt Template 定义 ───

export interface PromptTemplate {
  id: string                    // 唯一标识：career_advisor_v1
  name: string                  // 显示名称
  agent: string                 // 所属 Agent：career_advisor
  version: string               // 版本：1.0.0
  role: string                  // 角色描述
  template: string              // 模板内容（含变量占位符）
  variables: string[]           // 变量列表：['role', 'candidate_profile', 'knowledge_context', ...]
  outputSchema?: Record<string, unknown>  // 期望输出 Schema
  status: 'draft' | 'active' | 'deprecated' | 'archived'
  createdAt: number
  updatedAt: number
  // 评估指标
  metrics?: PromptMetrics
}

export interface PromptMetrics {
  totalExecutions: number
  avgTokens: number
  avgLatencyMs: number
  avgScore: number           // 平均质量评分
  lastExecutedAt?: number
}

// ─── 2. Prompt Context（统一上下文） ───

export interface PromptContext {
  // 知识层
  knowledge?: {
    recommendations?: Array<{ name: string; score: number; reason: string }>
    transitions?: Array<{ from: string; to: string; difficulty: number }>
    skillGaps?: Array<{ name: string; priority: string }>
    raw?: string
  }
  
  // 证据层
  evidence?: Array<{ fact: string; confidence: number; type: string }>
  
  // 候选人画像
  candidate?: {
    name?: string
    currentRole?: string
    targetRole?: string
    skills?: string[]
    experience?: string
    education?: string
    fit?: Record<string, number>
  }
  
  // 企业信息
  company?: {
    name?: string
    industry?: string
    size?: string
  }
  
  // 任务定义
  task: {
    type: string              // career_recommendation | career_transition | skill_gap | ...
    description: string
    constraints?: string[]
  }
  
  // 输出约束
  outputConstraints?: {
    format: 'json' | 'markdown' | 'text'
    schema?: Record<string, unknown>
    maxTokens?: number
  }
  
  // 记忆层
  memory?: {
    previousInteractions?: Array<{ role: string; content: string; timestamp: number }>
    userPreferences?: Record<string, unknown>
  }
}

// ─── 3. Prompt Execution Log（执行日志） ───

export interface PromptExecutionLog {
  id: string
  promptId: string
  promptVersion: string
  agent: string
  model: string
  organizationId?: string
  // 输入
  context: PromptContext
  renderedPrompt: string
  // 输出
  tokens: number
  latencyMs: number
  score?: number             // 质量评分（来自 Evaluation Hook）
  // 元数据
  timestamp: number
  status: 'success' | 'error' | 'timeout'
  error?: string
}

// ─── 4. Prompt Registry（Prompt 注册中心） ───

export class PromptRegistry {
  private templates = new Map<string, PromptTemplate>()
  private versions = new Map<string, PromptTemplate[]>()  // agent -> versions[]
  private executionLogs: PromptExecutionLog[] = []

  /**
   * 注册 Prompt 模板
   */
  register(template: PromptTemplate): void {
    // 检查版本冲突
    const existing = this.templates.get(template.id)
    if (existing && existing.version === template.version) {
      throw new Error(`Prompt version conflict: ${template.id}@${template.version}`)
    }

    this.templates.set(template.id, template)

    // 添加到版本历史
    const agentVersions = this.versions.get(template.agent) || []
    agentVersions.push(template)
    agentVersions.sort((a, b) => this.compareVersions(b.version, a.version))
    this.versions.set(template.agent, agentVersions)
  }

  /**
   * 获取 Prompt 模板
   */
  get(id: string): PromptTemplate | null {
    return this.templates.get(id) || null
  }

  /**
   * 获取 Agent 的最新版本
   */
  getLatest(agent: string): PromptTemplate | null {
    const versions = this.versions.get(agent)
    if (!versions || versions.length === 0) return null
    return versions.find(v => v.status === 'active') || versions[0]
  }

  /**
   * 获取 Agent 的版本历史
   */
  getVersions(agent: string): PromptTemplate[] {
    return this.versions.get(agent) || []
  }

  /**
   * 获取所有模板
   */
  getAll(): PromptTemplate[] {
    return Array.from(this.templates.values())
  }

  /**
   * 按 Agent 获取模板
   */
  getByAgent(agent: string): PromptTemplate[] {
    return this.getAll().filter(t => t.agent === agent)
  }

  /**
   * 废弃旧版本
   */
  deprecate(id: string): boolean {
    const template = this.templates.get(id)
    if (!template) return false
    template.status = 'deprecated'
    template.updatedAt = Date.now()
    return true
  }

  /**
   * 记录执行日志
   */
  logExecution(log: PromptExecutionLog): void {
    this.executionLogs.push(log)
    
    // 更新模板指标
    const template = this.templates.get(log.promptId)
    if (template) {
      const metrics = template.metrics || {
        totalExecutions: 0,
        avgTokens: 0,
        avgLatencyMs: 0,
        avgScore: 0,
      }
      metrics.totalExecutions++
      metrics.avgTokens = (metrics.avgTokens * (metrics.totalExecutions - 1) + log.tokens) / metrics.totalExecutions
      metrics.avgLatencyMs = (metrics.avgLatencyMs * (metrics.totalExecutions - 1) + log.latencyMs) / metrics.totalExecutions
      if (log.score) {
        metrics.avgScore = (metrics.avgScore * (metrics.totalExecutions - 1) + log.score) / metrics.totalExecutions
      }
      metrics.lastExecutedAt = log.timestamp
      template.metrics = metrics
    }
  }

  /**
   * 获取执行日志
   */
  getExecutionLogs(filter?: { agent?: string; promptId?: string; organizationId?: string }): PromptExecutionLog[] {
    let logs = this.executionLogs
    if (filter?.agent) logs = logs.filter(l => l.agent === filter.agent)
    if (filter?.promptId) logs = logs.filter(l => l.promptId === filter.promptId)
    if (filter?.organizationId) logs = logs.filter(l => l.organizationId === filter.organizationId)
    return logs
  }

  /**
   * 获取最佳版本（按评分）
   */
  getBestVersion(agent: string): PromptTemplate | null {
    const versions = this.versions.get(agent)
    if (!versions || versions.length === 0) return null
    return versions.reduce((best, current) => {
      const bestScore = best.metrics?.avgScore || 0
      const currentScore = current.metrics?.avgScore || 0
      return currentScore > bestScore ? current : best
    })
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number)
    const partsB = b.split('.').map(Number)
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const diff = (partsA[i] || 0) - (partsB[i] || 0)
      if (diff !== 0) return diff
    }
    return 0
  }
}

// ─── 5. Prompt Template Engine（模板引擎） ───

export class PromptTemplateEngine {
  /**
   * 渲染 Prompt 模板
   * 
   * 支持变量：{variable_name}
   * 支持条件：{#if condition}...{/if}
   * 支持循环：{#each items as item}...{/each}
   */
  render(template: string, variables: Record<string, unknown>): string {
    let result = template

    // 1. 简单变量替换 {varName}
    result = result.replace(/\{(\w+)\}/g, (match, varName) => {
      const value = variables[varName]
      if (value === undefined || value === null) return match
      if (Array.isArray(value)) return value.join(', ')
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    })

    // 2. 条件渲染 {#if varName}...{/if}
    result = result.replace(/\{#if (\w+)\}([\s\S]*?)\{\/if\}/g, (match, varName, content) => {
      const value = variables[varName]
      if (value && (typeof value !== 'object' || Object.keys(value).length > 0)) {
        return content
      }
      return ''
    })

    // 3. 循环渲染 {#each items as item}...{/each}
    result = result.replace(/\{#each (\w+) as (\w+)\}([\s\S]*?)\{\/each\}/g, (match, arrayName, itemName, content) => {
      const array = variables[arrayName]
      if (!Array.isArray(array)) return ''
      return array.map((item, index) => {
        let itemContent = content.replace(new RegExp(`\\{${itemName}\\}`, 'g'), typeof item === 'string' ? item : JSON.stringify(item))
        itemContent = itemContent.replace(/\{index\}/g, String(index))
        return itemContent
      }).join('\n')
    })

    return result.trim()
  }

  /**
   * 构建 System Prompt
   */
  buildSystemPrompt(params: {
    role: string
    context: PromptContext
    template: string
  }): string {
    const variables = this.flattenContext(params.context)
    variables['role'] = params.role
    return this.render(params.template, variables)
  }

  /**
   * 构建 User Prompt
   */
  buildUserPrompt(params: {
    context: PromptContext
    template: string
  }): string {
    const variables = this.flattenContext(params.context)
    return this.render(params.template, variables)
  }

  /**
   * 将 PromptContext 展平为变量映射
   */
  private flattenContext(context: PromptContext): Record<string, unknown> {
    const variables: Record<string, unknown> = {}

    // 知识层
    if (context.knowledge) {
      variables['knowledge_recommendations'] = context.knowledge.recommendations || []
      variables['knowledge_transitions'] = context.knowledge.transitions || []
      variables['knowledge_skill_gaps'] = context.knowledge.skillGaps || []
      variables['knowledge_raw'] = context.knowledge.raw || ''
    }

    // 证据层
    if (context.evidence) {
      variables['evidence'] = context.evidence.map(e => `- ${e.fact} (置信度: ${Math.round(e.confidence * 100)}%)`)
    }

    // 候选人
    if (context.candidate) {
      variables['candidate_name'] = context.candidate.name || '用户'
      variables['candidate_role'] = context.candidate.currentRole || ''
      variables['candidate_target'] = context.candidate.targetRole || ''
      variables['candidate_skills'] = context.candidate.skills || []
      variables['candidate_experience'] = context.candidate.experience || ''
      variables['candidate_education'] = context.candidate.education || ''
      variables['candidate_fit'] = context.candidate.fit ? JSON.stringify(context.candidate.fit) : ''
    }

    // 企业
    if (context.company) {
      variables['company_name'] = context.company.name || ''
      variables['company_industry'] = context.company.industry || ''
      variables['company_size'] = context.company.size || ''
    }

    // 任务
    variables['task_type'] = context.task.type
    variables['task_description'] = context.task.description
    variables['task_constraints'] = context.task.constraints || []

    // 输出约束
    if (context.outputConstraints) {
      variables['output_format'] = context.outputConstraints.format
      variables['output_schema'] = context.outputConstraints.schema ? JSON.stringify(context.outputConstraints.schema) : ''
      variables['output_max_tokens'] = context.outputConstraints.maxTokens || 2000
    }

    // 记忆
    if (context.memory) {
      variables['memory_interactions'] = context.memory.previousInteractions || []
      variables['memory_preferences'] = context.memory.userPreferences ? JSON.stringify(context.memory.userPreferences) : ''
    }

    return variables
  }
}

// ─── 6. Prompt Runtime 主类 ───

export interface PromptRuntimeConfig {
  registry: PromptRegistry
  templateEngine: PromptTemplateEngine
}

export class PromptRuntime {
  private executionLogs: PromptExecutionLog[] = []

  constructor(private config: PromptRuntimeConfig) {}

  /**
   * 获取 Prompt 模板
   */
  getTemplate(id: string): PromptTemplate | null {
    return this.config.registry.get(id)
  }

  /**
   * 获取 Agent 最新 Prompt
   */
  getLatestForAgent(agent: string): PromptTemplate | null {
    return this.config.registry.getLatest(agent)
  }

  /**
   * 渲染 System Prompt
   */
  renderSystemPrompt(params: {
    promptId: string
    context: PromptContext
  }): string {
    const template = this.config.registry.get(params.promptId)
    if (!template) {
      throw new Error(`Prompt not found: ${params.promptId}`)
    }

    return this.config.templateEngine.buildSystemPrompt({
      role: template.role,
      context: params.context,
      template: template.template,
    })
  }

  /**
   * 渲染 User Prompt
   */
  renderUserPrompt(params: {
    promptId: string
    context: PromptContext
    userMessage: string
  }): string {
    const template = this.config.registry.get(params.promptId)
    if (!template) {
      throw new Error(`Prompt not found: ${params.promptId}`)
    }

    // 将用户消息注入上下文
    const context: PromptContext = {
      ...params.context,
      task: {
        ...params.context.task,
        description: params.userMessage,
      },
    }

    return this.config.templateEngine.buildUserPrompt({
      context,
      template: template.template,
    })
  }

  /**
   * 记录执行日志
   */
  logExecution(log: PromptExecutionLog): void {
    this.executionLogs.push(log)
    this.config.registry.logExecution(log)
  }

  /**
   * 获取执行日志
   */
  getExecutionLogs(filter?: { agent?: string; promptId?: string }): PromptExecutionLog[] {
    return this.config.registry.getExecutionLogs(filter)
  }

  /**
   * 获取最佳 Prompt 版本
   */
  getBestVersion(agent: string): PromptTemplate | null {
    return this.config.registry.getBestVersion(agent)
  }
}

// ─── 7. 预设 Prompt 模板 ───

export const PRESET_PROMPTS: PromptTemplate[] = [
  {
    id: 'career_advisor_v1',
    name: '职业顾问',
    agent: 'career_advisor',
    version: '1.0.0',
    role: '资深职业规划师',
    template: `你是昆仑镜的{role}。

你的职责：
1. 基于知识库提供的证据进行推理
2. 不要编造任何知识库中没有的信息
3. 每个结论必须引用具体的证据
4. 输出结构化 JSON 格式

{#if candidate_role}
当前用户：{candidate_role}
技能：{candidate_skills}
目标：{candidate_target}
{/if}

{#if evidence}
## 知识证据
{#each evidence as item}
{item}
{/each}
{/if}

{#if task_constraints}
## 约束条件
{#each task_constraints as item}
- {item}
{/each}
{/if}

## 任务
{task_description}

请按照以下 Schema 输出：
{output_schema}`,
    variables: ['role', 'candidate_role', 'candidate_skills', 'candidate_target', 'evidence', 'task_description', 'task_constraints', 'output_schema'],
    outputSchema: {
      type: 'object',
      properties: {
        recommendations: { type: 'array' },
        confidence: { type: 'number' },
        evidence: { type: 'array' },
        nextActions: { type: 'array' },
      },
    },
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'resume_analyzer_v1',
    name: '简历分析师',
    agent: 'resume_analyzer',
    version: '1.0.0',
    role: '资深HR专家',
    template: `你是昆仑镜的{role}。

你的职责：
1. 分析简历与目标职位的匹配度
2. 识别简历中的亮点和不足
3. 提供具体的改进建议
4. 输出结构化 JSON 格式

{#if candidate_role}
当前用户：{candidate_role}
技能：{candidate_skills}
{/if}

{#if evidence}
## 职位要求
{#each evidence as item}
{item}
{/each}
{/if}

## 任务
{task_description}

请按照以下 Schema 输出：
{output_schema}`,
    variables: ['role', 'candidate_role', 'candidate_skills', 'evidence', 'task_description', 'output_schema'],
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'interview_agent_v1',
    name: '面试助手',
    agent: 'interview_agent',
    version: '1.0.0',
    role: '资深面试官',
    template: `你是昆仑镜的{role}。

你的职责：
1. 根据职位要求生成面试问题
2. 评估候选人回答的质量
3. 提供改进建议
4. 输出结构化 JSON 格式

{#if candidate_role}
当前用户：{candidate_role}
技能：{candidate_skills}
{/if}

{#if evidence}
## 职位要求
{#each evidence as item}
{item}
{/each}
{/if}

## 任务
{task_description}

请按照以下 Schema 输出：
{output_schema}`,
    variables: ['role', 'candidate_role', 'candidate_skills', 'evidence', 'task_description', 'output_schema'],
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'jd_generator_v1',
    name: 'JD生成器',
    agent: 'jd_generator',
    version: '1.0.0',
    role: '招聘专家',
    template: `你是昆仑镜的{role}。

你的职责：
1. 根据企业需求生成职位描述（JD）
2. 确保 JD 符合行业最佳实践
3. 包含必要的技能要求和经验要求
4. 输出结构化 JSON 格式

{#if company_name}
企业：{company_name}
行业：{company_industry}
规模：{company_size}
{/if}

## 任务
{task_description}

请按照以下 Schema 输出：
{output_schema}`,
    variables: ['role', 'company_name', 'company_industry', 'company_size', 'task_description', 'output_schema'],
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'media_advisor_v1',
    name: '新媒体顾问',
    agent: 'media_advisor',
    version: '1.0.0',
    role: '新媒体运营专家',
    template: `你是昆仑镜的{role}。

你的职责：
1. 分析内容策略和受众画像
2. 提供内容创作建议
3. 输出结构化 JSON 格式

{#if evidence}
## 内容数据
{#each evidence as item}
{item}
{/each}
{/if}

## 任务
{task_description}

请按照以下 Schema 输出：
{output_schema}`,
    variables: ['role', 'evidence', 'task_description', 'output_schema'],
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'legal_advisor_v1',
    name: '法律顾问',
    agent: 'legal_advisor',
    version: '1.0.0',
    role: '专业律师',
    template: `你是昆仑镜的{role}。

你的职责：
1. 基于法律知识库进行分析
2. 引用具体法律条文
3. 输出结构化 JSON 格式

{#if evidence}
## 法律依据
{#each evidence as item}
{item}
{/each}
{/if}

## 任务
{task_description}

请按照以下 Schema 输出：
{output_schema}`,
    variables: ['role', 'evidence', 'task_description', 'output_schema'],
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

// ─── 8. 便捷工厂函数 ───

export function createPromptRuntime(): PromptRuntime {
  const registry = new PromptRegistry()
  const templateEngine = new PromptTemplateEngine()

  // 注册预设模板
  for (const prompt of PRESET_PROMPTS) {
    registry.register(prompt)
  }

  return new PromptRuntime({ registry, templateEngine })
}
