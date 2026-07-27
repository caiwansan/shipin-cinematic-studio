/**
 * Hermes Profile Service — ER-04-TASK-01 (KM-AI-JOB-AGENT-06 恢复)
 * AI Employee Runtime Binding Layer
 *
 * 职责: 管理 EnterpriseAgentInstance ↔ Hermes 子代理身份 绑定
 * 架构: Identity Binding Layer (不控制 Runtime 执行)
 *
 * 数据来源:
 *   HermesProfileBinding → 绑定关系
 *   EnterpriseAgentProfile → 员工信息
 *   EnterpriseAgentInstance → Runtime 实例
 *
 * 一个 AI 员工 = 一个 Hermes 子代理身份:
 *   EnterpriseAgentInstance → HermesProfileBinding → hermesAgentId
 */
import { prisma } from '../../utils/index.js'

// ─── Types ───────────────────────────────────────────────

export interface HermesBindingDTO {
  id: string
  tenantId: string
  organizationId: string | null
  agentInstanceId: string
  hermesAgentId: string
  soulMdContent: string | null
  toolAllowList: string[]
  memoryNamespace: string
  identityProvider: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface CreateBindingRequest {
  tenantId: string
  organizationId?: string
  agentInstanceId: string
  hermesAgentId?: string       // 自动生成如果未提供
  soulMdContent?: string
  toolAllowList?: string[]
  memoryNamespace?: string     // 自动生成如果未提供
  identityProvider?: string
}

// ─── Service ─────────────────────────────────────────────

export class HermesProfileService {

  /**
   * 创建 Hermes Profile Binding
   * 企业创建 AI 员工时调用
   */
  async createBinding(req: CreateBindingRequest): Promise<HermesBindingDTO> {
    const {
      tenantId,
      organizationId,
      agentInstanceId,
      hermesAgentId,
      soulMdContent,
      toolAllowList = [],
      memoryNamespace,
      identityProvider = 'hermes',
    } = req

    // 生成 Hermes Agent ID (如果未提供)
    const agentId = hermesAgentId || this.generateHermesAgentId(tenantId, agentInstanceId)

    // 生成 Memory Namespace (如果未提供)
    const ns = memoryNamespace || this.buildMemoryNamespace(tenantId, agentInstanceId)

    // 检查是否已存在
    const existing = await (prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId },
    })
    if (existing) {
      throw new Error('BINDING_ALREADY_EXISTS')
    }

    const binding = await (prisma as any).hermesProfileBinding.create({
      data: {
        tenantId,
        organizationId: organizationId || null,
        agentInstanceId,
        hermesAgentId: agentId,
        soulMdContent: soulMdContent || null,
        toolAllowList: JSON.stringify(toolAllowList),
        memoryNamespace: ns,
        identityProvider,
        status: 'active',
      },
    })

    return this.toDTO(binding)
  }

  /**
   * 通过 Agent Instance ID 获取 Binding
   */
  async getBindingByInstance(agentInstanceId: string): Promise<HermesBindingDTO | null> {
    const binding = await (prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId },
    })
    return binding ? this.toDTO(binding) : null
  }

  /**
   * 通过 Tenant ID 获取所有 Bindings
   */
  async listBindingsByTenant(tenantId: string): Promise<HermesBindingDTO[]> {
    const bindings = await (prisma as any).hermesProfileBinding.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return bindings.map(this.toDTO)
  }

  /**
   * 通过 hermesAgentId 获取 Binding
   */
  async getBindingByHermesId(hermesAgentId: string): Promise<HermesBindingDTO | null> {
    const binding = await (prisma as any).hermesProfileBinding.findUnique({
      where: { hermesAgentId },
    })
    return binding ? this.toDTO(binding) : null
  }

  /**
   * 更新 Binding 状态
   * 生命周期: active → paused → active → paused
   */
  async updateStatus(agentInstanceId: string, status: string): Promise<HermesBindingDTO | null> {
    const validTransitions: Record<string, string[]> = {
      'active': ['paused'],
      'paused': ['active'],
    }

    const binding = await (prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId },
    })
    if (!binding) return null

    const allowed = validTransitions[binding.status] || []
    if (!allowed.includes(status)) {
      throw new Error(`INVALID_TRANSITION: ${binding.status} → ${status}`)
    }

    const updated = await (prisma as any).hermesProfileBinding.update({
      where: { agentInstanceId },
      data: { status },
    })
    return this.toDTO(updated)
  }

  /**
   * 获取 Runtime 健康状态
   */
  async getHealth(agentInstanceId: string): Promise<{
    status: string
    hermesAgentId: string
    identityProvider: string
    memoryNamespace: string
    lastUpdated: string
  } | null> {
    const binding = await (prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId },
    })
    if (!binding) return null

    return {
      status: binding.status,
      hermesAgentId: binding.hermesAgentId,
      identityProvider: binding.identityProvider,
      memoryNamespace: binding.memoryNamespace,
      lastUpdated: binding.updatedAt.toISOString(),
    }
  }

  /**
   * 更新 SOUL.md 内容
   */
  async updateSoulContent(agentInstanceId: string, soulMdContent: string): Promise<HermesBindingDTO | null> {
    const binding = await (prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId },
    })
    if (!binding) return null

    const updated = await (prisma as any).hermesProfileBinding.update({
      where: { agentInstanceId },
      data: { soulMdContent },
    })
    return this.toDTO(updated)
  }

  /**
   * 更新工具权限列表
   */
  async updateToolAllowList(agentInstanceId: string, toolAllowList: string[]): Promise<HermesBindingDTO | null> {
    const binding = await (prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId },
    })
    if (!binding) return null

    const updated = await (prisma as any).hermesProfileBinding.update({
      where: { agentInstanceId },
      data: { toolAllowList: JSON.stringify(toolAllowList) },
    })
    return this.toDTO(updated)
  }

  /**
   * 删除 Binding
   */
  async deleteBinding(agentInstanceId: string): Promise<boolean> {
    const binding = await (prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId },
    })
    if (!binding) return false

    await (prisma as any).hermesProfileBinding.delete({
      where: { agentInstanceId },
    })
    return true
  }

  // ─── Private Helpers ───────────────────────────────────

  /**
   * 生成 Hermes Agent ID
   * 格式: hermes_{tenantShort}_{instanceShort}
   */
  private generateHermesAgentId(tenantId: string, agentInstanceId: string): string {
    const tenantShort = tenantId.slice(0, 8)
    const instanceShort = agentInstanceId.slice(0, 8)
    return `hermes_${tenantShort}_${instanceShort}`
  }

  /**
   * 构建 Memory Namespace 路径
   * 格式: tenant/{tenantId}/agent/{agentInstanceId}
   */
  private buildMemoryNamespace(tenantId: string, agentInstanceId: string): string {
    return `tenant/${tenantId}/agent/${agentInstanceId}`
  }

  /**
   * DTO 转换
   */
  private toDTO(binding: any): HermesBindingDTO {
    return {
      id: binding.id,
      tenantId: binding.tenantId,
      organizationId: binding.organizationId,
      agentInstanceId: binding.agentInstanceId,
      hermesAgentId: binding.hermesAgentId,
      soulMdContent: binding.soulMdContent,
      toolAllowList: JSON.parse(binding.toolAllowList || '[]'),
      memoryNamespace: binding.memoryNamespace,
      identityProvider: binding.identityProvider,
      status: binding.status,
      createdAt: binding.createdAt.toISOString(),
      updatedAt: binding.updatedAt.toISOString(),
    }
  }
}

export const hermesProfileService = new HermesProfileService()
