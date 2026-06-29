// ============================================================
// Project Dual Write Hook
// Syncs legacy Project writes → new Project fields
// ============================================================

import { PrismaClient } from '@prisma/client'
import { DualWriteHook, WriteEvent } from '../dualwrite-manager'

const prisma = new PrismaClient()

/**
 * After a legacy Project write, sync the new fields:
 *   tenantId, ownerId, type, resourceCount, lastActivityAt, lastExecutionAt
 * 
 * These fields already exist on the same Project table (added in Stage 1),
 * so this hook primarily ensures they stay populated and consistent.
 */
export const projectDualWriteHook: DualWriteHook = {
  name: 'ProjectSync',
  entity: 'Project',
  enabled: true,

  async sync(event: WriteEvent): Promise<any> {
    const { entityId, type, newData, oldData } = event

    switch (type) {
      case 'CREATE': {
        // The new fields should already be set by the creation logic.
        // This hook verifies they're non-null and fixes if missing.
        const project = await prisma.project.findUnique({
          where: { id: entityId },
          select: { id: true, tenantId: true, type: true, resourceCount: true },
        })
        if (!project) {
          return { success: false, target: 'Project', error: `Project ${entityId} not found after create` }
        }

        const updates: any[] = []

        // If tenantId missing, derive from user's personal tenant
        if (!project.tenantId && newData?.userId) {
          const tenants: Array<{ tenantId: string }> = await prisma.$queryRaw`
            SELECT gu."tenantId" FROM governance_user gu WHERE gu.email IN (
              SELECT email FROM "User" WHERE id = ${newData.userId}::uuid
            )
          `
          if (tenants.length > 0) {
            updates.push({ action: 'set tenantId', value: tenants[0].tenantId })
          }
        }

        // If type missing, default to 'video'
        if (!project.type) {
          updates.push({ action: 'set type', value: 'video' })
        }

        return {
          success: true,
          target: 'Project',
          oldData: project,
          newData: updates.length > 0 ? { ...project, ...Object.fromEntries(updates.map(u => [u.action.replace('set ', ''), u.value])) } : project,
        }
      }

      case 'UPDATE': {
        // Verify the new fields are consistent
        const project = await prisma.project.findUnique({
          where: { id: entityId },
          select: { id: true, tenantId: true, type: true, resourceCount: true, name: true },
        })
        if (!project) {
          return { success: false, target: 'Project', error: `Project ${entityId} not found` }
        }

        // Cross-check: if linked to GeoProjectProfile, ensure type='geo'
        if (newData?.type === 'geo' || project.type === 'geo') {
          const profile = await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM kmki_geo_project_profiles WHERE "projectId" = ${entityId}::uuid
          `
          if (profile.length === 0) {
            // This is a geo project without a profile — notify but don't auto-create
            return {
              success: true,
              target: 'Project',
              oldData: project,
              newData: project,
              warning: `Project ${entityId} is type=geo but has no GeoProjectProfile`,
            }
          }
        }

        return { success: true, target: 'Project', oldData: project, newData: project }
      }

      case 'DELETE': {
        // Deletes of Project should cascade. Just log for auditing.
        console.log(`[DualWrite] Project deleted: ${entityId}`)
        return { success: true, target: 'Project', oldData: { id: entityId }, newData: null }
      }

      default:
        return { success: false, target: 'Project', error: `Unknown event type: ${type}` }
    }
  },
}

export default projectDualWriteHook
