/**
 * Enterprise Context Service — Sprint 4.2.3.1
 * 
 * 把 User.id 与企业 Governance Tenant 解耦。
 * 所有 Enterprise Service 通过此 Service 获取上下文，不再自己推断 tenantId。
 * 
 * CTO 冻结: 禁止 Business Service 自己读取 Governance。
 * 正确: ActionService → EnterpriseContext → PermissionService
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// CTO 冻结: Capability 命名规范
export const CAPABILITIES = {
  ACTION_READ: 'action.read',
  ACTION_CREATE: 'action.create',
  ACTION_APPROVE: 'action.approve',
  ACTION_REJECT: 'action.reject',
  ACTION_EXECUTE: 'action.execute',
  ACTION_VERIFY: 'action.verify',
} as const

export interface EnterpriseContext {
  userId: string
  governanceTenantId: string | null
  govUserId: string | null
  organizationId: string | null
  roles: string[]
  capabilities: string[]
}

export class EnterpriseContextService {
  /**
   * 解析当前用户的完整企业上下文
   * 这是 Enterprise 模块与 Governance 模块的唯一合法桥梁
   */
  async resolve(userId: string): Promise<EnterpriseContext> {
    // 1. 查找 User
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { membership: true },
    })

    if (!user) {
      return this.emptyContext(userId)
    }

    // 2. 查找 GovUser
    const govUser = await prisma.govUser.findFirst({
      where: { email: user.email },
    })

    if (!govUser) {
      return {
        ...this.emptyContext(userId),
        // 降级: 没有 GovUser 时尝试从 Membership 推断
      }
    }

    // 3. 查找 Role
    const role = govUser.roleId
      ? await prisma.role.findUnique({ where: { id: govUser.roleId } })
      : null

    const capabilities = this.parseCapabilities(role?.capabilities)

    return {
      userId,
      governanceTenantId: govUser.tenantId,
      govUserId: govUser.id,
      organizationId: govUser.tenantId,  // TODO: 未来接入 GovOrganization
      roles: role ? [role.code] : [],
      capabilities,
    }
  }

  /**
   * 获取 Governance TenantId（兼容旧接口）
   */
  async getGovernanceTenantId(userId: string): Promise<string | null> {
    const ctx = await this.resolve(userId)
    return ctx.governanceTenantId
  }

  /**
   * 权限校验
   * @param ctx 企业上下文
   * @param capability 需要的 capability
   * @throws PermissionDeniedError
   */
  assertCapability(ctx: EnterpriseContext, capability: string): void {
    if (!ctx.capabilities.includes(capability)) {
      throw new PermissionDeniedError(
        `Required capability: ${capability}. User has: [${ctx.capabilities.join(', ')}]`
      )
    }
  }

  /**
   * 批量校验（任一满足即可）
   */
  assertAnyCapability(ctx: EnterpriseContext, capabilities: string[]): void {
    const has = capabilities.some(c => ctx.capabilities.includes(c))
    if (!has) {
      throw new PermissionDeniedError(
        `Required any of: [${capabilities.join(', ')}]. User has: [${ctx.capabilities.join(', ')}]`
      )
    }
  }

  // ─── Private ───

  private parseCapabilities(raw: string | undefined | null): string[] {
    if (!raw) return []
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  }

  private emptyContext(userId: string): EnterpriseContext {
    return {
      userId,
      governanceTenantId: null,
      govUserId: null,
      organizationId: null,
      roles: [],
      capabilities: [],
    }
  }
}

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermissionDeniedError'
  }
}

export const enterpriseContextService = new EnterpriseContextService()
