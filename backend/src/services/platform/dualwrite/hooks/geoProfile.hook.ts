// ============================================================
// GeoProjectProfile Dual Write Hook
// Syncs legacy GEO project writes → GeoProjectProfile table
// ============================================================

import { PrismaClient } from '@prisma/client'
import { DualWriteHook, WriteEvent } from '../dualwrite-manager'

const prisma = new PrismaClient()

/**
 * After a legacy kmki_geo_projects write, sync to GeoProjectProfile.
 * 
 * This is the critical hook — it keeps the new platform table in sync
 * with the legacy kmki_geo_projects table during dual-write phase.
 */
export const geoProfileDualWriteHook: DualWriteHook = {
  name: 'GeoProfileSync',
  entity: 'GeoProjectProfile',
  enabled: true,

  async sync(event: WriteEvent): Promise<any> {
    const { entityId, type, newData } = event

    switch (type) {
      case 'CREATE': {
        // A new GEO project was created in legacy kmki_geo_projects
        // 1. Ensure a Project(type='geo') exists
        // 2. Create the GeoProjectProfile

        // The newData should contain: { id, name, userId, topic, industry, language, country, config }
        if (!newData?.id) {
          return { success: false, target: 'GeoProjectProfile', error: 'No projectId provided' }
        }

        const projectId = newData.id

        // Check if Project row exists
        const existingProject = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id::text FROM "Project" WHERE id = ${projectId}::uuid
        `

        if (existingProject.length === 0) {
          // Project row doesn't exist — need to create one
          return {
            success: false,
            target: 'GeoProjectProfile',
            error: `Project ${projectId} not found — must create Project row first`,
          }
        }

        // Check if profile already exists
        const existingProfile = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM kmki_geo_project_profiles WHERE "projectId" = ${projectId}::uuid
        `

        if (existingProfile.length > 0) {
          // Profile exists — skip (it's already in sync)
          return { success: true, target: 'GeoProjectProfile', oldData: null, newData: existingProfile[0] }
        }

        // Create profile from legacy data
        const profileId = crypto.randomUUID()
        const now = new Date()
        await prisma.$executeRaw`
          INSERT INTO kmki_geo_project_profiles (id, "projectId", website, domain, brand, language, country, industry, topic, "geoConfig", "createdAt", "updatedAt")
          VALUES (${profileId}, ${projectId}::uuid, ${newData.website || ''}, ${newData.domain || ''}, ${newData.name || ''}, ${newData.language || 'zh'}, ${newData.country || ''}, ${newData.industry || ''}, ${newData.topic || ''}, ${JSON.stringify(newData.config || {})}::jsonb, ${now}, ${now})
        `

        return { success: true, target: 'GeoProjectProfile', oldData: null, newData: { id: profileId, projectId } }
      }

      case 'UPDATE': {
        // GEO project updated in legacy — sync profile fields
        const projectId = entityId

        const existingProfile = await prisma.$queryRaw<Array<{ id: string; topic: string }>>`
          SELECT id, topic FROM kmki_geo_project_profiles WHERE "projectId" = ${projectId}::uuid
        `

        if (existingProfile.length === 0) {
          return { success: false, target: 'GeoProjectProfile', error: `No profile for project ${projectId}` }
        }

        if (newData) {
          await prisma.$executeRaw`
            UPDATE kmki_geo_project_profiles
            SET
              brand = ${newData.name || ''},
              topic = ${newData.topic || existingProfile[0].topic},
              industry = ${newData.industry || ''},
              language = ${newData.language || 'zh'},
              country = ${newData.country || ''},
              "geoConfig" = ${JSON.stringify(newData.config || {})}::jsonb,
              "updatedAt" = ${new Date()}
            WHERE "projectId" = ${projectId}::uuid
          `
        }

        return { success: true, target: 'GeoProjectProfile', oldData: existingProfile[0], newData: newData }
      }

      case 'DELETE': {
        // GEO project deleted — remove profile (cascade handles this)
        const projectId = entityId
        await prisma.$executeRaw`
          DELETE FROM kmki_geo_project_profiles WHERE "projectId" = ${projectId}::uuid
        `
        return { success: true, target: 'GeoProjectProfile', oldData: { projectId }, newData: null }
      }

      default:
        return { success: false, target: 'GeoProjectProfile', error: `Unknown event type: ${type}` }
    }
  },
}

export default geoProfileDualWriteHook
