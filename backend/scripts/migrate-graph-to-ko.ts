// ============================================================
// KO Migration Tool — migrate kmki_geo_entities → knowledge_objects
// Usage: npx tsx scripts/migrate-graph-to-ko.ts
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface KOReport {
  totalProjects: number
  skippedExisting: number
  migrated: number
  failed: number
  errors: string[]
}

async function main(): Promise<void> {
  console.log('🧠 KO Migration Tool')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Reading kmki_geo_entities...')

  const report: KOReport = {
    totalProjects: 0,
    skippedExisting: 0,
    migrated: 0,
    failed: 0,
    errors: [],
  }

  try {
    // Step 1: Find all projects with entities using Prisma models
    const entities = await prisma.gEOEntity.findMany({
      select: { projectId: true },
      distinct: ['projectId'],
    })
    const projectIds = entities.map(e => e.projectId)
    report.totalProjects = projectIds.length
    console.log(`Found ${projectIds.length} project(s) with entities.`)

    for (const projectId of projectIds) {
      console.log(`\n📁 Project: ${projectId}`)

      try {
        // Step 2: Check if KO already exists for this project via KnowledgeObject model
        const existingKO = await prisma.knowledgeObject.findFirst({
          where: { projectId },
        })

        if (existingKO) {
          console.log(`  ⏭️  Skipped — KO already exists (ID: ${existingKO.id})`)
          report.skippedExisting++
          continue
        }

        // Step 3: Fetch all entities for this project
        const projectEntities = await prisma.gEOEntity.findMany({
          where: { projectId },
          orderBy: { sortOrder: 'asc' },
        })

        // Step 4: Fetch all relations for this project
        const projectRelations = await prisma.gEOEntityRelation.findMany({
          where: { projectId },
        })

        console.log(`  Found ${projectEntities.length} entities, ${projectRelations.length} relations`)

        // Step 5: Build entity snapshots
        const entitySnapshots = projectEntities.map(e => ({
          id: e.id,
          name: e.name,
          type: e.type || 'Concept',
          description: e.description || '',
          metadata: e.metadata || {},
          provenance: e.provenance || {},
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        }))

        const relationSnapshots = projectRelations.map(r => ({
          id: r.id,
          sourceId: r.sourceId,
          targetId: r.targetId,
          type: r.type || 'related_to',
          lineage: r.lineage || {},
          metadata: r.metadata || {},
        }))

        // Determine topic from entity types
        const typeCounts: Record<string, number> = {}
        for (const e of projectEntities) {
          const t = e.type || 'Concept'
          typeCounts[t] = (typeCounts[t] || 0) + 1
        }
        const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'brand'

        // Step 6: Get project name for context
        let projectName = projectId
        try {
          const project = await prisma.gEOProject.findUnique({
            where: { id: projectId },
            select: { name: true },
          })
          if (project) {
            projectName = project.name
          }
        } catch { /* ignore */ }

        const topic = `${projectName} — GEO Graph Export (${dominantType}, ${entitySnapshots.length} entities)`

        // Step 7: Create Knowledge Object
        await prisma.knowledgeObject.create({
          data: {
            projectId,
            topic,
            status: 'DISCOVERED',
            confidence: 0.85,
            provenance: {
              source: 'migration',
              tool: 'migrate-graph-to-ko.ts',
              timestamp: new Date().toISOString(),
              projectName,
            },
            entities: entitySnapshots as any,
            relations: relationSnapshots as any,
            claims: [],
            evidence: [],
            citations: [],
            metadata: {
              migratedAt: new Date().toISOString(),
              entityCount: entitySnapshots.length,
              relationCount: relationSnapshots.length,
            },
          },
        })

        console.log(`  ✅ KO created — topic: "${topic}"`)
        report.migrated++
      } catch (err: any) {
        console.error(`  ❌ Failed: ${err.message}`)
        report.failed++
        report.errors.push(`[${projectId}] ${err.message}`)
      }
    }
  } catch (err: any) {
    console.error(`❌ Fatal error: ${err.message}`)
    report.failed++
    report.errors.push(`[FATAL] ${err.message}`)
  }

  // Print report
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 Migration Report')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Total projects with entities:  ${report.totalProjects}`)
  console.log(`Skipped (KO already exists):  ${report.skippedExisting}`)
  console.log(`Migrated:                     ${report.migrated}`)
  console.log(`Failed:                       ${report.failed}`)
  if (report.errors.length > 0) {
    console.log('\nErrors:')
    for (const err of report.errors) {
      console.log(`  • ${err}`)
    }
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
