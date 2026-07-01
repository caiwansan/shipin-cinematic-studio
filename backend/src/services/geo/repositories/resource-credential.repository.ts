// ============================================================
// Resource Credential Repository — CRUD for ResourceCredential
// ============================================================

import { prisma } from '../../../utils/index'

function mapPrismaCredential(c: any) {
  return {
    id: c.id,
    name: c.name,
    tenantId: c.tenantId,
    resourceId: c.resourceId,
    endpoint: c.endpoint,
    models: c.models,
    status: c.status,
    lastRotated: c.lastRotated?.toISOString() || null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    resource: c.resource
      ? {
          id: c.resource.id,
          name: c.resource.name,
          vendor: c.resource.vendor,
        }
      : undefined,
  }
}

export const resourceCredentialRepository = {
  async findMany(where: any, options?: { include?: any }): Promise<any[]> {
    const credentials = await prisma.resourceCredential.findMany({
      where,
      ...options,
    })
    return credentials.map(mapPrismaCredential)
  },
}
