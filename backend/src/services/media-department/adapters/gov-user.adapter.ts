// ============================================================
// GovUser Adapter — M1-A1
// 将平台 User.id 映射到 GovUser 身份
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { GovUserDTO } from '../../platform/governance/types.js'

export interface GovUserAdapterResult {
  govUser: GovUserDTO
  /** 平台 User 的原始 email，用于审计 */
  email: string
}

export class GovUserAdapter {
  /**
   * 通过平台 User.id 解析 GovUser 身份
   * 映射逻辑: User → User.email → GovUser.email
   */
  async resolveByUserId(userId: string): Promise<GovUserAdapterResult | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })

    if (!user) return null

    // 通过 email 映射到 GovUser
    const govUser = await prisma.govUser.findFirst({
      where: { email: user.email },
    })

    if (!govUser) return null

    return {
      govUser: {
        id: govUser.id,
        tenantId: govUser.tenantId,
        email: govUser.email || undefined,
        name: govUser.name,
        role: govUser.role || undefined,
        status: govUser.status as 'active' | 'inactive' | 'suspended',
        metadata: govUser.metadata ? JSON.parse(govUser.metadata) : undefined,
        createdAt: govUser.createdAt,
        updatedAt: govUser.updatedAt,
      },
      email: user.email,
    }
  }

  /**
   * 直接通过 GovUser ID 获取
   */
  async resolveByGovId(govUserId: string): Promise<GovUserDTO | null> {
    const govUser = await prisma.govUser.findUnique({
      where: { id: govUserId },
    })
    if (!govUser) return null

    return {
      id: govUser.id,
      tenantId: govUser.tenantId,
      email: govUser.email || undefined,
      name: govUser.name,
      role: govUser.role || undefined,
      status: govUser.status as 'active' | 'inactive' | 'suspended',
      metadata: govUser.metadata ? JSON.parse(govUser.metadata) : undefined,
      createdAt: govUser.createdAt,
      updatedAt: govUser.updatedAt,
    }
  }
}

export const govUserAdapter = new GovUserAdapter()
