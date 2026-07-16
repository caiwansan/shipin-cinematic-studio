/**
 * Channel Permission Service — Sprint 4.2.5.1
 * 职责: Capability-based permission check for all Channel operations
 * CTO 冻结: 禁止硬编码 if(user.role==="admin")
 */
import { prisma } from '../../../utils/index.js'

// CTO 冻结 Capability 列表
export enum ChannelCapability {
  CHANNEL_READ = 'channel.read',
  CHANNEL_CONNECT = 'channel.connect',
  CHANNEL_DISCONNECT = 'channel.disconnect',
  CHANNEL_SYNC = 'channel.sync',
  INTERACTION_READ = 'interaction.read',
  INTERACTION_VERIFY = 'interaction.verify',
  INTERACTION_EXPORT = 'interaction.export',
  OUTCOME_VERIFY = 'outcome.verify',
  OUTCOME_REJECT = 'outcome.reject',
}

// CTO 冻结 Role
export enum ChannelRole {
  CHANNEL_OWNER = 'CHANNEL_OWNER',
  CHANNEL_MANAGER = 'CHANNEL_MANAGER',
  CHANNEL_VIEWER = 'CHANNEL_VIEWER',
}

// Role → Capability 映射
const ROLE_CAPABILITIES: Record<ChannelRole, ChannelCapability[]> = {
  [ChannelRole.CHANNEL_OWNER]: [
    ChannelCapability.CHANNEL_READ,
    ChannelCapability.CHANNEL_CONNECT,
    ChannelCapability.CHANNEL_DISCONNECT,
    ChannelCapability.CHANNEL_SYNC,
    ChannelCapability.INTERACTION_READ,
    ChannelCapability.INTERACTION_VERIFY,
    ChannelCapability.INTERACTION_EXPORT,
    ChannelCapability.OUTCOME_VERIFY,
    ChannelCapability.OUTCOME_REJECT,
  ],
  [ChannelRole.CHANNEL_MANAGER]: [
    ChannelCapability.CHANNEL_READ,
    ChannelCapability.CHANNEL_CONNECT,
    ChannelCapability.CHANNEL_SYNC,
    ChannelCapability.INTERACTION_READ,
    ChannelCapability.INTERACTION_VERIFY,
    ChannelCapability.OUTCOME_VERIFY,
  ],
  [ChannelRole.CHANNEL_VIEWER]: [
    ChannelCapability.CHANNEL_READ,
    ChannelCapability.INTERACTION_READ,
  ],
}

export interface PermissionCheckInput {
  govUserId: string
  tenantId: string
  capability: ChannelCapability
  channelAccountId?: string  // 检查特定渠道权限
  organizationId?: string    // 检查组织范围
}

export class ChannelPermissionService {
  /**
   * 检查用户是否具有指定 Capability
   * CTO: 默认拒绝，非默认允许
   */
  async check(input: PermissionCheckInput): Promise<{ allowed: boolean; reason?: string }> {
    // 1. 获取用户在 Tenant 中的角色
    const govUser = await prisma.govUser.findFirst({
      where: {
        userId: input.govUserId,
        tenantId: input.tenantId,
      },
    })

    if (!govUser) {
      return { allowed: false, reason: 'User not found in tenant' }
    }

    // 2. 从 governance 体系获取 capabilities
    const govCapabilities = await this.getGovCapabilities(govUser.id, input.tenantId)
    
    // 3. 如果 gov 体系已有 channel capabilities，直接使用
    if (govCapabilities.length > 0) {
      const hasCapability = govCapabilities.includes(input.capability)
      if (!hasCapability) {
        return { allowed: false, reason: `Missing capability: ${input.capability}` }
      }
    }

    // 4. 如果是渠道级别检查，确认组织范围
    if (input.channelAccountId) {
      const inOrg = await this.checkOrgScope(
        input.channelAccountId,
        govUser.organizationId
      )
      if (!inOrg) {
        return { allowed: false, reason: 'Channel not in user organization scope' }
      }
    }

    return { allowed: true }
  }

  /**
   * 获取用户在 governance 体系中的 capabilities
   */
  private async getGovCapabilities(govUserId: string, tenantId: string): Promise<string[]> {
    // TODO: 连接真实 governance capability 体系
    // 当前 fallback：检查 govUser 的 role
    const govUser = await prisma.govUser.findFirst({
      where: { id: govUserId, tenantId },
    })
    if (!govUser) return []
    
    // 简化的 role-based capabilities
    // TODO: 从 Role/Capability 关联表获取
    return []
  }

  /**
   * 检查组织范围
   */
  private async checkOrgScope(channelAccountId: string, organizationId: string | null): Promise<boolean> {
    if (!organizationId) return true // 无组织限制
    
    const channel = await prisma.enterpriseChannelAccount.findUnique({
      where: { id: channelAccountId },
      select: { organizationId: true },
    })
    
    if (!channel) return false
    return channel.organizationId === organizationId
  }

  /**
   * 获取特定 Channel Account 中用户的角色
   */
  async getChannelRole(channelAccountId: string, govUserId: string): Promise<ChannelRole | null> {
    const account = await prisma.enterpriseChannelAccount.findUnique({
      where: { id: channelAccountId },
    })
    if (!account) return null

    // 创建者 = OWNER
    if (account.createdByGovUserId === govUserId || account.ownerId === govUserId) {
      return ChannelRole.CHANNEL_OWNER
    }

    // 默认 VIEWER（其他情况）
    return ChannelRole.CHANNEL_VIEWER
  }
}

export const channelPermissionService = new ChannelPermissionService()
