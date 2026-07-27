// ============================================================
// GovOrganization Adapter — M1-A1
// 将 GovUser 身份映射到 GovOrganization
// 支持：User 可能属于多个 Org，需要解析主 Org
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { GovOrganizationDTO } from '../../platform/governance/types.js'

export interface GovOrganizationAdapterResult {
  organization: GovOrganizationDTO
  /** 是否为部门级组织 */
  isDepartment: boolean
  /** 父组织 ID（部门级时有效） */
  parentOrgId?: string
}

export class GovOrganizationAdapter {
  /**
   * 通过 GovUser 的 tenantId 解析主组织
   * 策略：查找该 tenantId 下 type='enterprise' 或 type='department' 的组织
   * 优先返回 enterprise 级别
   */
  async resolveByGovUser(tenantId: string): Promise<GovOrganizationAdapterResult | null> {
    // 查找该 Tenant 下的所有组织
    const orgs = await prisma.govOrganization.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })

    if (orgs.length === 0) return null

    // 优先选择 enterprise 级别
    const enterpriseOrg = orgs.find(o => o.type === 'enterprise')
    const targetOrg = enterpriseOrg || orgs[0]

    const isDepartment = targetOrg.type === 'department'

    return {
      organization: {
        id: targetOrg.id,
        tenantId: targetOrg.tenantId,
        name: targetOrg.name,
        type: targetOrg.type as 'personal' | 'team' | 'enterprise' | 'department',
        parentId: targetOrg.parentId || undefined,
        status: targetOrg.status as 'active' | 'inactive',
        metadata: targetOrg.metadata ? JSON.parse(targetOrg.metadata) : undefined,
        createdAt: targetOrg.createdAt,
        updatedAt: targetOrg.updatedAt,
      },
      isDepartment,
      parentOrgId: targetOrg.parentId || undefined,
    }
  }

  /**
   * 通过组织 ID 直接获取
   */
  async resolveById(orgId: string): Promise<GovOrganizationDTO | null> {
    const org = await prisma.govOrganization.findUnique({
      where: { id: orgId },
    })
    if (!org) return null

    return {
      id: org.id,
      tenantId: org.tenantId,
      name: org.name,
      type: org.type as 'personal' | 'team' | 'enterprise' | 'department',
      parentId: org.parentId || undefined,
      status: org.status as 'active' | 'inactive',
      metadata: org.metadata ? JSON.parse(org.metadata) : undefined,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    }
  }

  /**
   * 获取组织树（含子组织）
   */
  async resolveTree(orgId: string): Promise<GovOrganizationDTO[]> {
    const org = await this.resolveById(orgId)
    if (!org) return []

    const children = await prisma.govOrganization.findMany({
      where: { parentId: orgId },
      orderBy: { createdAt: 'asc' },
    })

    const result: GovOrganizationDTO[] = [org]
    for (const child of children) {
      const subtree = await this.resolveTree(child.id)
      result.push(...subtree)
    }
    return result
  }
}

export const govOrganizationAdapter = new GovOrganizationAdapter()
