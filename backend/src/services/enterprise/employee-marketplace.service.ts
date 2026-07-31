/**
 * Employee Marketplace Service — GA-02
 * AI Employee Template Registry + Creation Flow
 *
 * 定位: "招聘 AI 员工" 不是 "下载 Agent"
 * 关系: EmployeeTemplate → EmployeeProfile → SOUL Generator → Hermes Sub-Agent
 *
 * 职责:
 *   1. 岗位模板 CRUD
 *   2. 从模板创建 AI 员工
 *   3. 模板 → SOUL → Hermes 绑定
 */
import { prisma } from '../../utils/index.js'

// ─── Types ───────────────────────────────────────────────

export interface EmployeeTemplateDTO {
  id: string
  name: string
  department: string
  role: string
  description: string
  icon: string
  capabilities: string[]
  defaultTools: string[]
  defaultMemoryPolicy: string
  requiredChannels: string[]
  isPublic: boolean
  isSystem: boolean
  sortOrder: number
  createdAt: string
}

export interface CreateEmployeeFromTemplateInput {
  organizationId: string
  templateId: string
  employeeName?: string  // 自定义名称，不填则用模板名称
  customCapabilities?: string[]  // 自定义能力，不填则用模板默认
}

// ─── Service ─────────────────────────────────────────────

export class EmployeeMarketplaceService {

  /**
   * 获取所有公开模板
   */
  async getPublicTemplates(): Promise<EmployeeTemplateDTO[]> {
    const templates = await prisma.employeeTemplate.findMany({
      where: { isPublic: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return templates.map(this.toDTO)
  }

  /**
   * 按部门获取模板
   */
  async getTemplatesByDepartment(department: string): Promise<EmployeeTemplateDTO[]> {
    const templates = await prisma.employeeTemplate.findMany({
      where: { isPublic: true, department },
      orderBy: { sortOrder: 'asc' },
    })
    return templates.map(this.toDTO)
  }

  /**
   * 获取所有部门列表
   */
  async getDepartments(): Promise<string[]> {
    const results = await prisma.employeeTemplate.findMany({
      where: { isPublic: true },
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    })
    return results.map((r) => r.department)
  }

  /**
   * 获取单个模板
   */
  async getTemplate(id: string): Promise<EmployeeTemplateDTO | null> {
    const template = await prisma.employeeTemplate.findUnique({ where: { id } })
    if (!template) return null
    return this.toDTO(template)
  }

  /**
   * 创建模板 (管理员)
   */
  async createTemplate(data: {
    name: string
    department: string
    role: string
    description: string
    icon?: string
    capabilities?: string[]
    defaultTools?: string[]
    defaultMemoryPolicy?: string
    requiredChannels?: string[]
    isPublic?: boolean
    sortOrder?: number
  }): Promise<EmployeeTemplateDTO> {
    const template = await prisma.employeeTemplate.create({
      data: {
        name: data.name,
        department: data.department,
        role: data.role,
        description: data.description,
        icon: data.icon || '🎯',
        capabilities: JSON.stringify(data.capabilities || []),
        defaultTools: JSON.stringify(data.defaultTools || []),
        defaultMemoryPolicy: data.defaultMemoryPolicy || 'business',
        requiredChannels: JSON.stringify(data.requiredChannels || []),
        isPublic: data.isPublic !== false,
        isSystem: false,
        sortOrder: data.sortOrder || 0,
        metadata: '{}',
      },
    })
    return this.toDTO(template)
  }

  /**
   * 更新模板
   */
  async updateTemplate(id: string, data: Partial<{
    name: string
    department: string
    role: string
    description: string
    icon: string
    capabilities: string[]
    defaultTools: string[]
    defaultMemoryPolicy: string
    requiredChannels: string[]
    isPublic: boolean
    sortOrder: number
  }>): Promise<EmployeeTemplateDTO | null> {
    const template = await prisma.employeeTemplate.findUnique({ where: { id } })
    if (!template || template.isSystem) return null  // 系统模板不可修改

    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.department !== undefined) updateData.department = data.department
    if (data.role !== undefined) updateData.role = data.role
    if (data.description !== undefined) updateData.description = data.description
    if (data.icon !== undefined) updateData.icon = data.icon
    if (data.capabilities !== undefined) updateData.capabilities = JSON.stringify(data.capabilities)
    if (data.defaultTools !== undefined) updateData.defaultTools = JSON.stringify(data.defaultTools)
    if (data.defaultMemoryPolicy !== undefined) updateData.defaultMemoryPolicy = data.defaultMemoryPolicy
    if (data.requiredChannels !== undefined) updateData.requiredChannels = JSON.stringify(data.requiredChannels)
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder

    const updated = await prisma.employeeTemplate.update({
      where: { id },
      data: updateData,
    })
    return this.toDTO(updated)
  }

  /**
   * 删除模板 (仅非系统模板)
   */
  async deleteTemplate(id: string): Promise<boolean> {
    const template = await prisma.employeeTemplate.findUnique({ where: { id } })
    if (!template || template.isSystem) return false
    await prisma.employeeTemplate.delete({ where: { id } })
    return true
  }

  /**
   * 从模板创建 AI 员工 (核心)
   */
  async createEmployeeFromTemplate(input: CreateEmployeeFromTemplateInput): Promise<{
    employeeId: string
    templateId: string
    name: string
    role: string
    capabilities: string[]
    tools: string[]
    status: 'created'
  } | null> {
    // SPRINT-IDENTITY-REALITY-01: 兼容新模板体系 agent_template（code 匹配）+ 旧体系 employee_template
    let template: any = await prisma.employeeTemplate.findUnique({
      where: { id: input.templateId },
    })
    let templateSource: 'employee' | 'agent' = 'employee'
    if (!template) {
      try {
        template = await prisma.agentTemplate.findUnique({
          where: { id: input.templateId },
        })
        templateSource = 'agent'
      } catch { /* ignore */ }
    }
    if (!template) return null

    const capabilities =
      input.customCapabilities ||
      (templateSource === 'agent'
        ? JSON.parse(template.defaultCapabilities || '[]')
        : JSON.parse(template.capabilities))
    const tools = templateSource === 'agent' ? '[]' : JSON.parse(template.defaultTools)
    const name = input.employeeName || template.name
    const role = templateSource === 'agent' ? template.code : template.role
    const description = template.description
    const agentType = role

    // 创建 Employee Profile
    const employee = await prisma.enterpriseAgentProfile.create({
      data: {
        organizationId: input.organizationId,
        tenantId: input.tenantId || String(input.organizationId),
        name,
        role,
        agentType,
        description,
        capabilities: JSON.stringify(capabilities),
        tools: JSON.stringify(tools),
        permissions: JSON.stringify([]),
        goal: description,
        isDefault: false,
        status: 'active',
        metadata: JSON.stringify({
          templateId: template.id,
          department: templateSource === 'agent' ? 'AI员工' : template.department,
          memoryPolicy: templateSource === 'agent' ? (JSON.parse(template.defaultMemoryPolicy || '{}').namespace || 'business') : template.defaultMemoryPolicy,
          requiredChannels: templateSource === 'agent' ? [] : JSON.parse(template.requiredChannels || '[]'),
        }),
      },
    })

    return {
      employeeId: employee.id,
      templateId: template.id,
      name: employee.name,
      role: employee.role,
      capabilities,
      tools,
      status: 'created',
    }
  }

  /**
   * 初始化系统默认模板
   */
  async seedSystemTemplates(): Promise<number> {
    const systemTemplates = [
      {
        name: '销售增长官',
        department: '增长部门',
        role: 'growth_director',
        description: '负责企业收入增长，分析销售数据，发现增长机会，预测客户行为',
        icon: '🎯',
        capabilities: ['销售分析', '客户预测', '自动报价'],
        defaultTools: ['CRM读写', '客户分析', '方案生成'],
        requiredChannels: ['企业微信', 'CRM'],
        sortOrder: 1,
      },
      {
        name: '市场分析官',
        department: '增长部门',
        role: 'market_analyst',
        description: '研究市场趋势和竞争格局，提供数据驱动的市场洞察',
        icon: '📊',
        capabilities: ['数据分析', '市场研究', '报告生成'],
        defaultTools: ['数据导出', '报告生成'],
        requiredChannels: ['企业微信'],
        sortOrder: 2,
      },
      {
        name: '客户运营官',
        department: '增长部门',
        role: 'customer_ops',
        description: '执行客户触达和互动活动，维护客户关系',
        icon: '💬',
        capabilities: ['客户运营', '客户触达'],
        defaultTools: ['CRM读写', '客户触达'],
        requiredChannels: ['企业微信', 'CRM'],
        sortOrder: 3,
      },
      {
        name: '内容策划官',
        department: '内容部门',
        role: 'content_manager',
        description: '创作营销内容和推广文案，管理多渠道内容发布',
        icon: '✍️',
        capabilities: ['内容创作', '数据分析'],
        defaultTools: ['内容生成', '发布管理'],
        requiredChannels: ['抖音', '小红书', '公众号'],
        sortOrder: 4,
      },
      {
        name: '新媒体运营官',
        department: '内容部门',
        role: 'content_manager',
        description: '管理新媒体账号，发布内容，分析互动数据',
        icon: '📱',
        capabilities: ['内容创作', '数据分析'],
        defaultTools: ['内容生成', '数据分析'],
        requiredChannels: ['抖音', '快手', '小红书'],
        sortOrder: 5,
      },
      {
        name: '客服主管',
        department: '客服部门',
        role: 'customer_ops',
        description: '处理客户咨询，提升客户满意度',
        icon: '🎧',
        capabilities: ['客户运营', '数据分析'],
        defaultTools: ['CRM读写', '客户触达'],
        requiredChannels: ['企业微信'],
        sortOrder: 6,
      },
      {
        name: '数据分析官',
        department: '管理部门',
        role: 'market_analyst',
        description: '执行数据分析和洞察挖掘，生成业务报告',
        icon: '📈',
        capabilities: ['数据分析', '报告生成'],
        defaultTools: ['数据导出', '报告生成', '可视化'],
        requiredChannels: [],
        sortOrder: 7,
      },
      {
        name: '财务分析官',
        department: '管理部门',
        role: 'market_analyst',
        description: '财务数据分析，成本控制和预算管理',
        icon: '💰',
        capabilities: ['财务分析', '数据分析'],
        defaultTools: ['财务分析', '报告生成'],
        requiredChannels: [],
        sortOrder: 8,
      },
      {
        name: '招聘顾问',
        department: '管理部门',
        role: 'sales_assistant',
        description: '协助招聘流程，筛选候选人，生成招聘报告',
        icon: '🤝',
        capabilities: ['数据分析', '报告生成'],
        defaultTools: ['报告生成'],
        requiredChannels: ['企业微信'],
        sortOrder: 9,
      },
    ]

    let count = 0
    for (const tmpl of systemTemplates) {
      const existing = await prisma.employeeTemplate.findFirst({
        where: { role: tmpl.role, name: tmpl.name },
      })
      if (!existing) {
        await prisma.employeeTemplate.create({
          data: {
            ...tmpl,
            capabilities: JSON.stringify(tmpl.capabilities),
            defaultTools: JSON.stringify(tmpl.defaultTools),
            requiredChannels: JSON.stringify(tmpl.requiredChannels),
            defaultMemoryPolicy: 'business',
            isPublic: true,
            isSystem: true,
            metadata: '{}',
          },
        })
        count++
      }
    }

    return count
  }

  // ─── Private ───────────────────────────────────────────

  private toDTO(template: any): EmployeeTemplateDTO {
    return {
      id: template.id,
      name: template.name,
      department: template.department,
      role: template.role,
      description: template.description,
      icon: template.icon,
      capabilities: JSON.parse(template.capabilities || '[]'),
      defaultTools: JSON.parse(template.defaultTools || '[]'),
      defaultMemoryPolicy: template.defaultMemoryPolicy,
      requiredChannels: JSON.parse(template.requiredChannels || '[]'),
      isPublic: template.isPublic,
      isSystem: template.isSystem,
      sortOrder: template.sortOrder,
      createdAt: template.createdAt.toISOString(),
    }
  }
}

export const employeeMarketplaceService = new EmployeeMarketplaceService()
