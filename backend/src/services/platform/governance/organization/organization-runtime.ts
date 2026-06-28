// ============================================================
// Organization Runtime — KMKI-PLAT-012
// Hierarchical org management: Organization → Department → Team
// ============================================================

import { govOrganizationRepository } from '../repositories/organization.repository.js'
import { auditRepository } from '../repositories/audit.repository.js'
import type { GovOrganizationDTO } from '../types.js'

export class GovOrgRuntime {
  async createOrg(tenantId: string, name: string, type: string, parentId?: string, userId?: string): Promise<GovOrganizationDTO> {
    const org = await govOrganizationRepository.create({ tenantId, name, type, parentId })
    await auditRepository.log({
      tenantId, userId, action: 'workspaceCreated',
      resource: 'organization', resourceId: org.id,
      details: { name, type },
    })
    return org
  }

  async getOrg(id: string): Promise<GovOrganizationDTO | null> {
    return govOrganizationRepository.findById(id)
  }

  async getOrgTree(orgId: string): Promise<GovOrganizationDTO[]> {
    return govOrganizationRepository.getTree(orgId)
  }

  async updateOrg(id: string, data: Partial<{ name: string; status: string; parentId: string }>): Promise<GovOrganizationDTO> {
    return govOrganizationRepository.update(id, data)
  }

  async deleteOrg(id: string): Promise<void> {
    await govOrganizationRepository.delete(id)
  }
}

export const govOrgRuntime = new GovOrgRuntime()
