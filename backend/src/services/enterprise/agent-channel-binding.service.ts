/**
 * agent-channel-binding.service.ts — AI 员工渠道绑定服务
 * Sprint 4.2.9 Phase 4
 *
 * 原则：Channel 是企业资源，AI员工通过 Binding 获得使用权限
 */
import { prisma } from '../../utils/index.js'

export interface CreateBindingDTO {
  tenantId: string
  agentInstanceId: string
  channelAccountId: string
  permissions?: {
    read?: boolean
    reply?: boolean
    createTask?: boolean
    execute?: boolean
    delete?: boolean
  }
}

export interface UpdateBindingDTO {
  permissions?: {
    read?: boolean
    reply?: boolean
    createTask?: boolean
    execute?: boolean
    delete?: boolean
  }
  status?: 'active' | 'paused'
}

export interface ChannelBindingView {
  id: string
  tenantId: string
  agentInstanceId: string
  channelAccountId: string
  channelName: string
  channelType: string
  permissions: Record<string, boolean>
  status: string
  createdAt: string
  interactionCount?: number
}

export class AgentChannelBindingService {

  /**
   * 获取员工所有渠道绑定
   */
  async getBindingsByAgent(tenantId: string, agentInstanceId: string): Promise<ChannelBindingView[]> {
    const bindings = await prisma.agentChannelBinding.findMany({
      where: { tenantId, agentInstanceId },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch channel accounts to enrich data
    const channelIds = bindings.map(b => b.channelAccountId)
    const channelAccounts = channelIds.length > 0
      ? await prisma.enterpriseChannelAccount.findMany({
          where: { id: { in: channelIds } },
          select: { id: true, channelName: true, channelType: true },
        })
      : []

    const channelMap = new Map(channelAccounts.map(c => [c.id, c]))

    return bindings.map(b => {
      const channel = channelMap.get(b.channelAccountId)
      return {
        id: b.id,
        tenantId: b.tenantId,
        agentInstanceId: b.agentInstanceId,
        channelAccountId: b.channelAccountId,
        channelName: channel?.channelName || '未知渠道',
        channelType: channel?.channelType || 'unknown',
        permissions: (b.permissions as Record<string, boolean>) || {},
        status: b.status,
        createdAt: b.createdAt.toISOString(),
      }
    })
  }

  /**
   * 绑定渠道
   */
  async createBinding(dto: CreateBindingDTO) {
    // Check if binding already exists
    const existing = await prisma.agentChannelBinding.findFirst({
      where: {
        tenantId: dto.tenantId,
        agentInstanceId: dto.agentInstanceId,
        channelAccountId: dto.channelAccountId,
      },
    })

    if (existing) {
      throw new Error('该渠道已绑定，请勿重复添加')
    }

    // Verify agent instance exists
    const agent = await prisma.enterpriseAgentInstance.findFirst({
      where: { id: dto.agentInstanceId, tenantId: dto.tenantId },
    })
    if (!agent) {
      throw new Error('AI 员工不存在')
    }

    // Verify channel account exists
    const channel = await prisma.enterpriseChannelAccount.findFirst({
      where: { id: dto.channelAccountId, tenantId: dto.tenantId },
    })
    if (!channel) {
      throw new Error('渠道账号不存在')
    }

    return prisma.agentChannelBinding.create({
      data: {
        tenantId: dto.tenantId,
        agentInstanceId: dto.agentInstanceId,
        channelAccountId: dto.channelAccountId,
        permissions: dto.permissions || { read: true, reply: true },
        status: 'active',
      },
    })
  }

  /**
   * 更新绑定（权限/状态）
   */
  async updateBinding(tenantId: string, bindingId: string, dto: UpdateBindingDTO) {
    const binding = await prisma.agentChannelBinding.findFirst({
      where: { id: bindingId, tenantId },
    })
    if (!binding) {
      throw new Error('绑定不存在')
    }

    const data: any = {}
    if (dto.permissions) data.permissions = dto.permissions
    if (dto.status) data.status = dto.status

    return prisma.agentChannelBinding.update({
      where: { id: bindingId },
      data,
    })
  }

  /**
   * 移除绑定
   */
  async removeBinding(tenantId: string, bindingId: string) {
    const binding = await prisma.agentChannelBinding.findFirst({
      where: { id: bindingId, tenantId },
    })
    if (!binding) {
      throw new Error('绑定不存在')
    }

    await prisma.agentChannelBinding.delete({
      where: { id: bindingId },
    })
    return { success: true }
  }

  /**
   * 获取企业中可绑定的渠道列表
   */
  async getAvailableChannels(tenantId: string): Promise<any[]> {
    return prisma.enterpriseChannelAccount.findMany({
      where: { tenantId },
      select: {
        id: true,
        channelName: true,
        channelType: true,
        connectionStatus: true,
        connectedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}

export const agentChannelBindingService = new AgentChannelBindingService()
