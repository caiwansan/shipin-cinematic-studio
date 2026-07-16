/**
 * Channel Customer Mapping Service — Sprint 4.2.5.1
 * 职责: 外部平台客户 → 昆仑镜 Tenant 隔离映射 (Contract 10)
 * CTO 冻结: 外部身份不能污染 Enterprise User
 */
import { prisma } from '../../../utils/index.js'

export interface CreateCustomerMappingInput {
  tenantId: string
  governanceTenantId?: string | null
  organizationId?: string | null
  channelType: string
  channelAccountId: string
  externalCustomerId: string
  externalOpenId?: string | null
  externalName?: string | null
  externalAvatar?: string | null
  internalCustomerId?: string | null
  internalGovUserId?: string | null
}

export class ChannelCustomerMappingService {
  /**
   * 创建或更新客户映射
   * CTO: 同一 Tenant 内同一外部客户唯一
   */
  async upsertMapping(input: CreateCustomerMappingInput) {
    const existing = await prisma.channelCustomerMapping.findUnique({
      where: {
        tenantId_channelType_externalCustomerId: {
          tenantId: input.tenantId,
          channelType: input.channelType,
          externalCustomerId: input.externalCustomerId,
        },
      },
    })

    if (existing) {
      // 更新：互动时间 + 计数
      return prisma.channelCustomerMapping.update({
        where: { id: existing.id },
        data: {
          externalName: input.externalName || existing.externalName,
          externalAvatar: input.externalAvatar || existing.externalAvatar,
          internalCustomerId: input.internalCustomerId || existing.internalCustomerId,
          internalGovUserId: input.internalGovUserId || existing.internalGovUserId,
          lastInteractionAt: new Date(),
          interactionCount: { increment: 1 },
          metadata: input.externalName ? { ...(existing.metadata as Record<string, any>), name: input.externalName } : existing.metadata,
        },
      })
    }

    // 新建映射
    return prisma.channelCustomerMapping.create({
      data: {
        tenantId: input.tenantId,
        governanceTenantId: input.governanceTenantId,
        organizationId: input.organizationId,
        channelType: input.channelType,
        channelAccountId: input.channelAccountId,
        externalCustomerId: input.externalCustomerId,
        externalOpenId: input.externalOpenId,
        externalName: input.externalName,
        externalAvatar: input.externalAvatar,
        internalCustomerId: input.internalCustomerId,
        internalGovUserId: input.internalGovUserId,
        firstInteractionAt: new Date(),
        lastInteractionAt: new Date(),
        interactionCount: 1,
      },
    })
  }

  /**
   * 查询映射（强制 Tenant 隔离）
   */
  async getMapping(tenantId: string, channelType: string, externalCustomerId: string) {
    return prisma.channelCustomerMapping.findUnique({
      where: {
        tenantId_channelType_externalCustomerId: {
          tenantId,
          channelType,
          externalCustomerId,
        },
      },
    })
  }

  /**
   * 查询租户下的所有映射
   */
  async listMappings(tenantId: string, channelType?: string) {
    return prisma.channelCustomerMapping.findMany({
      where: {
        tenantId,
        ...(channelType ? { channelType } : {}),
      },
      orderBy: { lastInteractionAt: 'desc' },
    })
  }

  /**
   * 分配内部负责人
   */
  async assignInternalUser(mappingId: string, govUserId: string) {
    return prisma.channelCustomerMapping.update({
      where: { id: mappingId },
      data: { internalGovUserId: govUserId },
    })
  }
}

export const channelCustomerMappingService = new ChannelCustomerMappingService()
