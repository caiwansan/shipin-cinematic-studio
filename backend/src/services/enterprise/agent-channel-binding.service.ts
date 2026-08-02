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
  // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 05 — AI 员工绑定升级：
  // AI员工 → BrowserWorkspace（工作电脑）→ ChannelAccount（身份）
  browserWorkspaceId?: string
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
  browserWorkspaceId?: string
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
        browserWorkspaceId: b.browserWorkspaceId || undefined,
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

    // SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 05 — 自动关联 BrowserWorkspace（未指定时创建）
    // Alice 拥有「宏图抖音工作空间」：binding.browserWorkspaceId → workspace → profile
    let browserWorkspaceId = dto.browserWorkspaceId
    if (!browserWorkspaceId) {
      try {
        const { browserWorkspaceService } = await import('./browser-workspace.service.js')
        const orgId = channel.organizationId || dto.tenantId
        const ws = await browserWorkspaceService.getOrCreate(dto.tenantId, orgId, channel.id)
        browserWorkspaceId = ws.id
      } catch (e: any) {
        console.warn(`[AgentChannelBinding] workspace 自动创建失败（不影响绑定）: ${e.message}`)
      }
    }

    return prisma.agentChannelBinding.create({
      data: {
        tenantId: dto.tenantId,
        agentInstanceId: dto.agentInstanceId,
        channelAccountId: dto.channelAccountId,
        browserWorkspaceId,
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
  /**
   * SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase D — 权限检查（AI 员工 → 渠道操作隔离）
   * 规则：binding 不存在 → binding_not_found；binding 非 active → binding_paused；
   * permissions[permission] !== true → permission_denied
   */
  async authorize(
    agentInstanceId: string,
    channelAccountId: string,
    permission: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const binding = await prisma.agentChannelBinding.findUnique({
      where: {
        agentInstanceId_channelAccountId: { agentInstanceId, channelAccountId },
      },
    })
    if (!binding) return { allowed: false, reason: 'binding_not_found' }
    if (binding.status !== 'active') return { allowed: false, reason: 'binding_paused' }
    const perms = (binding.permissions as Record<string, boolean>) || {}
    if (perms[permission] !== true) return { allowed: false, reason: 'permission_denied' }
    return { allowed: true }
  }

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
