/**
 * Enterprise AI Workforce — Enterprise Agent Profile Service
 * 企业 AI 员工管理
 */
import { prisma } from '../../utils/index.js'

export interface CreateAgentInput {
  tenantId: string
  organizationId?: string
  name: string
  role: string
  agentType: string
  goal?: string
  description?: string
  avatarUrl?: string
  knowledgeScope?: string[]
  tools?: string[]
  permissions?: string[]
  capabilities?: string[]
  escalationRules?: Record<string, any>
  kpiMetrics?: Record<string, any>
  isDefault?: boolean
  metadata?: Record<string, any>
}

export class EnterpriseAgentService {
  /**
   * 创建 AI 员工
   */
  async create(input: CreateAgentInput) {
    return await prisma.enterpriseAgentProfile.create({
      data: {
        tenantId: input.tenantId,
        organizationId: input.organizationId || null,
        name: input.name,
        role: input.role,
        agentType: input.agentType,
        goal: input.goal || null,
        description: input.description || null,
        avatarUrl: input.avatarUrl || null,
        knowledgeScope: JSON.stringify(input.knowledgeScope || []),
        tools: JSON.stringify(input.tools || []),
        permissions: JSON.stringify(input.permissions || []),
        capabilities: JSON.stringify(input.capabilities || []),
        escalationRules: input.escalationRules ? JSON.stringify(input.escalationRules) : null,
        kpiMetrics: JSON.stringify(input.kpiMetrics || {}),
        isDefault: input.isDefault ?? false,
        metadata: JSON.stringify(input.metadata || {}),
        status: 'active',
      },
    })
  }

  /**
   * 列出企业所有 Agent
   */
  async listByTenant(tenantId: string, organizationId?: string) {
    return await prisma.enterpriseAgentProfile.findMany({
      where: {
        tenantId,
        ...(organizationId ? { organizationId } : {}),
        status: 'active',
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  /**
   * 获取单个 Agent（含解析 JSON 字段）
   */
  async getById(id: string) {
    const agent = await prisma.enterpriseAgentProfile.findUnique({ where: { id } })
    if (!agent) return null
    return this.parseAgent(agent)
  }

  /**
   * 更新 Agent
   */
  async update(id: string, data: Partial<CreateAgentInput>) {
    const update: any = {}
    if (data.name !== undefined) update.name = data.name
    if (data.role !== undefined) update.role = data.role
    if (data.agentType !== undefined) update.agentType = data.agentType
    if (data.goal !== undefined) update.goal = data.goal
    if (data.status !== undefined) update.status = data.status
    if (data.organizationId !== undefined) update.organizationId = data.organizationId
    if (data.avatarUrl !== undefined) update.avatarUrl = data.avatarUrl
    if (data.description !== undefined) update.description = data.description
    if (data.knowledgeScope !== undefined) update.knowledgeScope = JSON.stringify(data.knowledgeScope)
    if (data.tools !== undefined) update.tools = JSON.stringify(data.tools)
    if (data.permissions !== undefined) update.permissions = JSON.stringify(data.permissions)
    if (data.capabilities !== undefined) update.capabilities = JSON.stringify(data.capabilities)
    if (data.escalationRules !== undefined) update.escalationRules = JSON.stringify(data.escalationRules)
    if (data.kpiMetrics !== undefined) update.kpiMetrics = JSON.stringify(data.kpiMetrics)
    if (data.metadata !== undefined) update.metadata = JSON.stringify(data.metadata)

    return await prisma.enterpriseAgentProfile.update({ where: { id }, data: update })
  }

  /**
   * 软删除
   */
  async deactivate(id: string) {
    return await prisma.enterpriseAgentProfile.update({
      where: { id },
      data: { status: 'deactivated' },
    })
  }

  /**
   * 默认 AI 部门模板（5个AI员工）
   */
  getDefaults(industry?: string): CreateAgentInput[] {
    return [
      {
        tenantId: '', organizationId: undefined,
        name: 'AI增长总监', role: '增长总监', agentType: 'growth_director',
        goal: '负责企业增长策略制定、市场分析、竞品监控',
        capabilities: ['market_analysis', 'strategy_planning', 'competitive_intelligence', 'growth_forecasting'],
        tools: ['web_search', 'data_analysis', 'report_generation'],
        permissions: ['read_all_content', 'write_strategy'],
      },
      {
        tenantId: '', organizationId: undefined,
        name: 'AI内容经理', role: '内容经理', agentType: 'content_manager',
        goal: '负责内容生产、内容分发、内容效果优化',
        capabilities: ['content_generation', 'copywriting', 'seo_optimization', 'content_curation'],
        tools: ['web_search', 'content_editor', 'seo_analyzer'],
        permissions: ['write_content', 'edit_content', 'publish_content'],
      },
      {
        tenantId: '', organizationId: undefined,
        name: 'AI市场分析师', role: '市场分析师', agentType: 'market_analyst',
        goal: '负责行业监控、趋势发现、数据洞察',
        capabilities: ['trend_analysis', 'sentiment_analysis', 'industry_monitoring', 'data_visualization'],
        tools: ['web_search', 'data_analyzer', 'chart_generator'],
        permissions: ['read_all_data', 'generate_reports'],
      },
      {
        tenantId: '', organizationId: undefined,
        name: 'AI客户运营', role: '客户运营', agentType: 'customer_ops',
        goal: '负责评论分析、用户互动、客户分类',
        capabilities: ['sentiment_analysis', 'customer_segmentation', 'response_generation'],
        tools: ['comment_tracker', 'customer_db', 'message_templates'],
        permissions: ['read_customer_data', 'write_interactions'],
      },
      {
        tenantId: '', organizationId: undefined,
        name: 'AI销售助理', role: '销售助理', agentType: 'sales_assistant',
        goal: '负责线索整理、客户跟进建议、销售话术',
        capabilities: ['lead_scoring', 'customer_followup', 'sales_content', 'objection_handling'],
        tools: ['lead_tracker', 'crm_lookup', 'email_templates'],
        permissions: ['read_leads', 'write_followup'],
      },
    ]
  }

  /**
   * 为企业批量创建默认部门
   */
  async createDefaultDepartment(tenantId: string, organizationId: string) {
    const templates = this.getDefaults()
    const created = []
    for (const tpl of templates) {
      const agent = await this.create({ ...tpl, tenantId, organizationId })
      created.push(agent)
    }
    return created
  }

  private parseAgent(agent: any) {
    return {
      ...agent,
      knowledgeScope: JSON.parse(agent.knowledgeScope || '[]'),
      tools: JSON.parse(agent.tools || '[]'),
      permissions: JSON.parse(agent.permissions || '[]'),
      capabilities: JSON.parse(agent.capabilities || '[]'),
      kpiMetrics: JSON.parse(agent.kpiMetrics || '{}'),
      metadata: JSON.parse(agent.metadata || '{}'),
    }
  }
}

export const enterpriseAgentService = new EnterpriseAgentService()
