/**
 * Tool Permission Service — KM-AI-JOB-AGENT-06 改造
 * AI Employee Capability → Tool Allow List
 *
 * 职责: 根据 Agent Capabilities 生成 Tool 权限矩阵
 * 架构: 映射层 (不直接控制 Runtime)
 *
 * 改造要点:
 *   - 补全招聘领域 Capability → Tool 映射
 *   - syncToBinding 改为写入 HermesProfileBinding
 *   - generateMatrix 不依赖 Binding 表，从 Profile 读取
 */
import { prisma } from '../../utils/index.js'

// ─── Types ───────────────────────────────────────────────

export interface ToolPermissionMatrix {
  agentId: string
  agentType: string
  capabilities: string[]
  tools: string[]
  toolAllowList: string[]
  disabledToolsets: string[]
  riskLevel: 'low' | 'medium' | 'high'
}

// ─── Service ─────────────────────────────────────────────

export class ToolPermissionService {

  /**
   * 根据 Agent Profile 生成 Tool Permission Matrix
   * 不依赖 Binding 表，直接从 Profile 读取
   */
  async generateMatrix(agentId: string): Promise<ToolPermissionMatrix> {
    const agent = await (prisma as any).enterpriseAgentProfile.findUnique({
      where: { id: agentId },
    })

    if (!agent) {
      throw new Error('AGENT_NOT_FOUND')
    }

    const capabilities = this.parseJSON<string[]>(agent.capabilities, [])
    const tools = this.parseJSON<string[]>(agent.tools, [])

    // Capability → Tool 映射
    const allowList = this.mapCapabilitiesToTools(capabilities, tools, agent.agentType)

    // 确定禁用的 Toolsets
    const disabledToolsets = this.determineDisabledToolsets(capabilities, tools, agent.agentType)

    // 评估风险等级
    const riskLevel = this.assessRiskLevel(tools)

    return {
      agentId: agent.id,
      agentType: agent.agentType,
      capabilities,
      tools,
      toolAllowList: allowList,
      disabledToolsets,
      riskLevel,
    }
  }

  /**
   * 同步 Tool Allow List 到 HermesProfileBinding
   */
  async syncToBinding(agentInstanceId: string, agentId: string): Promise<ToolPermissionMatrix> {
    const matrix = await this.generateMatrix(agentId)

    // 写入 HermesProfileBinding
    const binding = await (prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId },
    })
    if (binding) {
      await (prisma as any).hermesProfileBinding.update({
        where: { agentInstanceId },
        data: { toolAllowList: JSON.stringify(matrix.toolAllowList) },
      })
    }

    return matrix
  }

  /**
   * 获取 Binding 的 Tool Allow List
   */
  async getBindingTools(agentInstanceId: string): Promise<string[]> {
    const binding = await (prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId },
    })
    if (!binding) return []
    return JSON.parse(binding.toolAllowList || '[]')
  }

  /**
   * 检查 Agent 是否有权限使用某工具
   */
  hasToolPermission(agentInstanceId: string, toolName: string): Promise<boolean> {
    return this.getBindingTools(agentInstanceId).then(allowList => allowList.includes(toolName))
  }

  // ─── Private: Mapping Logic ────────────────────────────

  /**
   * Capabilities + Tools → Tool Allow List
   * 包含招聘领域映射
   */
  private mapCapabilitiesToTools(capabilities: string[], tools: string[], agentType?: string): string[] {
    const toolSet = new Set<string>()

    // ── 招聘领域 Capability Map ──
    const recruitmentMap: Record<string, string[]> = {
      // AI招聘经理
      '招聘分析': ['recruitment.read.pipeline', 'recruitment.read.match', 'recruitment.generate.report'],
      '招聘策略': ['recruitment.read.pipeline', 'recruitment.create.task', 'recruitment.generate.report'],
      '招聘计划': ['recruitment.create.task', 'recruitment.read.pipeline'],
      '团队管理': ['recruitment.read.agent', 'recruitment.read.performance'],
      '预算规划': ['recruitment.read.budget'],
      'Pipeline监控': ['recruitment.read.pipeline', 'recruitment.read.event'],
      '招聘数据分析': ['recruitment.read.analytics', 'recruitment.generate.report'],
      '风险提醒': ['recruitment.read.pipeline', 'recruitment.read.alert'],
      '候选人优先级排序': ['recruitment.read.match', 'recruitment.read.pipeline'],

      // AI招聘官
      '人才扫描': ['candidate.search', 'candidate.read'],
      '候选人排序': ['candidate.read', 'candidate.score'],
      '主动沟通': ['candidate.message', 'candidate.read'],
      '资料收集': ['candidate.read', 'candidate.profile.update'],
      'Candidate Brief': ['candidate.read', 'recruitment.generate.report'],
      '候选人匹配': ['candidate.read', 'recruitment.read.match'],
      '候选人沟通': ['candidate.message', 'candidate.read'],
      '邀约': ['candidate.message', 'interview.create'],
      '跟进': ['candidate.read', 'candidate.note'],

      // AI面试官
      '面试方案': ['interview.create', 'interview.read'],
      '问题生成': ['interview.create', 'interview.question'],
      '面试评价': ['interview.evaluate', 'interview.read'],
      '候选人评估': ['interview.evaluate', 'candidate.read'],
      '评分标准': ['interview.evaluate'],
      '初面': ['interview.create', 'interview.evaluate'],
      '技术面': ['interview.create', 'interview.evaluate', 'interview.question'],
      '英语测试': ['interview.create', 'interview.question'],
      '行为面试': ['interview.create', 'interview.question', 'interview.evaluate'],
      '自动纪要': ['interview.transcribe', 'interview.summarize'],
      '面试报告': ['interview.generate.report'],

      // AI简历分析师
      '简历解析': ['resume.parse', 'resume.read'],
      '技能匹配': ['resume.read', 'candidate.score', 'recruitment.read.match'],
      '候选人评分': ['candidate.score', 'resume.read'],
      '学历验证': ['resume.verify.education'],
      '工作经历分析': ['resume.read', 'candidate.read'],

      // AI猎聘顾问
      '人才搜索': ['candidate.search', 'talent.search'],
      '人才库管理': ['talent.read', 'talent.write'],
      '候选人关系': ['candidate.read', 'candidate.note', 'candidate.message'],
      '被动候选人触达': ['candidate.message', 'talent.search'],
      '人才地图': ['talent.analytics', 'talent.search'],

      // AI招聘宣传官
      '岗位发布': ['job.read', 'job.publish'],
      '社交媒体宣发': ['content.generate', 'social.publish'],
      '社群运营': ['social.read', 'social.reply', 'candidate.collect'],
      '招聘互动': ['social.reply', 'candidate.message'],
      '活动推广': ['content.generate', 'social.publish'],
      '招聘宣传': ['content.generate', 'social.publish'],
      '内容创作': ['content.generate'],
      '品牌推广': ['content.generate', 'social.publish'],
      '候选人互动': ['social.reply', 'candidate.message'],
    }

    for (const cap of capabilities) {
      const mapped = recruitmentMap[cap]
      if (mapped) {
        mapped.forEach(t => toolSet.add(t))
      }
    }

    // 直接工具映射
    for (const tool of tools) {
      toolSet.add(tool.toLowerCase().replace(/\s+/g, '_'))
    }

    // Agent Type 级别默认权限
    const defaultToolsByType: Record<string, string[]> = {
      'recruiter': ['candidate.search', 'candidate.read', 'candidate.message', 'interview.create', 'pipeline.read', 'pipeline.suggest'],
      'career_advisor': ['recruitment.read.pipeline', 'recruitment.read.match', 'recruitment.generate.report', 'recruitment.create.task'],
      'interview': ['interview.create', 'interview.read', 'interview.evaluate', 'interview.question'],
      'interview_agent': ['interview.create', 'interview.read', 'interview.evaluate', 'interview.question'],
      'resume_analyzer': ['resume.read', 'resume.parse', 'candidate.score'],
      'talent_hunter': ['candidate.search', 'talent.search', 'candidate.message'],
      'marketing': ['content.generate', 'social.publish', 'social.reply', 'candidate.collect'],
    }

    if (agentType) {
      const defaults = defaultToolsByType[agentType]
      if (defaults) {
        defaults.forEach(t => toolSet.add(t))
      }
    }

    return Array.from(toolSet)
  }

  /**
   * 确定禁用的 Toolsets
   */
  private determineDisabledToolsets(capabilities: string[], tools: string[], agentType?: string): string[] {
    const disabled = new Set<string>()

    // 始终禁用的（安全红线）
    disabled.add('admin')
    disabled.add('system_config')
    disabled.add('delete_operations')
    disabled.add('user_management')
    disabled.add('permission_management')
    disabled.add('cross_tenant_access')
    disabled.add('salary.modify')
    disabled.add('offer.approve')
    disabled.add('candidate.delete')
    disabled.add('pipeline.force_move')

    // 根据 Agent Type 禁用
    if (agentType === 'recruiter') {
      disabled.add('salary.modify')
      disabled.add('offer.approve')
      disabled.add('pipeline.force_move')
    }
    if (agentType === 'marketing') {
      disabled.add('candidate.delete')
      disabled.add('pipeline.force_move')
      disabled.add('interview.evaluate')
    }

    return Array.from(disabled)
  }

  /**
   * 风险评估
   */
  private assessRiskLevel(tools: string[]): 'low' | 'medium' | 'high' {
    const highRisk = ['delete', 'remove', 'drop', 'truncate', 'admin', '管理', '删除', 'force_move', 'approve']
    const mediumRisk = ['export', 'write', 'update', 'modify', '导出', '写入', 'publish', 'message']

    let score = 0
    for (const tool of tools) {
      if (highRisk.some(r => tool.toLowerCase().includes(r))) score += 2
      if (mediumRisk.some(r => tool.toLowerCase().includes(r))) score += 1
    }

    if (score >= 4) return 'high'
    if (score >= 2) return 'medium'
    return 'low'
  }

  private parseJSON<T>(val: string | null | undefined, fallback: T): T {
    if (!val) return fallback
    if (typeof val === 'object') return val as T
    try { return JSON.parse(val) } catch { return fallback }
  }
}

export const toolPermissionService = new ToolPermissionService()
