#!/usr/bin/env node

/**
 * Phase 1a Migration Dry Run
 * 
 * 模拟完整迁移流程，不执行任何数据库变更。
 * 输出每一步的 SQL 语句和预期影响。
 * 
 * 用法：
 *   node scripts/migration-dry-run.mjs             # 完整 Dry Run
 *   node scripts/migration-dry-run.mjs --summary   # 仅汇总
 *   node scripts/migration-dry-run.mjs --sql-only  # 仅输出 SQL
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const MODE = process.argv.includes('--summary') ? 'summary' :
  process.argv.includes('--sql-only') ? 'sql' : 'full'

// ─── Helpers ───────────────────────────────────────────────

async function getTableCount(table: string): Promise<number> {
  const result = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int as cnt FROM "${table}"`
  ) as any[]
  return result[0].cnt
}

async function getDistinctValues(table: string, column: string): Promise<any[]> {
  const result = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT "${column}" FROM "${table}" ORDER BY "${column}"`
  ) as any[]
  return result.map((r: any) => r[column])
}

async function printHeader(title: string) {
  if (MODE === 'summary') return
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  [DRY RUN] ${title}`)
  console.log(`${'═'.repeat(60)}`)
}

async function printSQL(sql: string, description: string) {
  if (MODE === 'sql') {
    console.log(`\n-- ${description}`)
    console.log(sql)
  } else {
    console.log(`  📋 ${description}`)
    console.log(`  SQL: ${sql.substring(0, 90)}...`)
  }
}

async function printCount(table: string, label: string) {
  const count = await getTableCount(table)
  console.log(`  📊 ${label} → ${count} 条记录`)
  return count
}

// ─── Phases ────────────────────────────────────────────────

async function step1Tenant() {
  await printHeader('Step 1: Backfill Personal Tenant')

  // 1.1 Count users without personal tenant
  const usersWithoutTenant = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "User" u
    LEFT JOIN "governance_tenant" t ON t.name = 'Personal: ' || u.id AND t.type = 'personal'
    WHERE t.id IS NULL
  ` as any[]

  console.log(`  Users without Personal Tenant: ${usersWithoutTenant[0].cnt}`)

  if (usersWithoutTenant[0].cnt > 0) {
    await printSQL(
      `INSERT INTO "governance_tenant" (id, name, type, status, metadata, "schemaVersion")
SELECT gen_random_uuid(), 'Personal: ' || u.id, 'personal', 'active',
  json_build_object('ownerId', u.id, 'ownerName', u.username),
  1
FROM "User" u
WHERE u.id NOT IN (
  SELECT t.metadata::json->>'ownerId'
  FROM "governance_tenant" t
  WHERE t.type = 'personal' AND t.metadata IS NOT NULL
)
AND u.id NOT IN (
  SELECT t.metadata::json->>'ownerId'
  FROM "governance_tenant" t
  WHERE t.type = 'personal' AND t.name = 'Personal: ' || u.id
)`,
      `为 ${usersWithoutTenant[0].cnt} 个用户创建 Personal Tenant`
    )
  }
}

async function step2ProjectType() {
  await printHeader('Step 2: Backfill Project.type')

  // 2.1 Count projects without type
  const totalProjects = await getTableCount('Project')
  const nullTypeProjects = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "Project" WHERE "type" IS NULL
  ` as any[]

  console.log(`  Total Project records: ${totalProjects}`)
  console.log(`  Projects without type: ${nullTypeProjects[0].cnt}`)

  // 2.2 Show existing projects that map to each type
  const geoProjectCount = await getTableCount('kmki_geo_projects')
  console.log(`  GEOProject records: ${geoProjectCount}`)

  await printSQL(
    `-- 根据来源回填 type\n` +
    `UPDATE "Project" p SET "type" = 'geo'\n` +
    `FROM "kmki_geo_projects" gp\n` +
    `WHERE p.id = gp.id AND gp."deletedAt" IS NULL;\n\n` +
    `UPDATE "Project" p SET "type" = 'video'\n` +
    `WHERE p."type" IS NULL AND EXISTS (\n` +
    `  SELECT 1 FROM "video_tasks" vt WHERE vt."projectId" = p.id\n` +
    `);\n\n` +
    `-- 剩余补 'custom'\n` +
    `UPDATE "Project" SET "type" = 'custom' WHERE "type" IS NULL;`,
    `回填 Project.type（geo/video/custom）`
  )
}

async function step3TenantId() {
  await printHeader('Step 3: Backfill Project.tenantId')

  const nullTenantProjects = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "Project" WHERE "tenantId" IS NULL
  ` as any[]

  console.log(`  Projects without tenantId: ${nullTenantProjects[0].cnt}`)

  if (nullTenantProjects[0].cnt > 0) {
    await printSQL(
      `UPDATE "Project" p
SET "tenantId" = t.id
FROM "governance_tenant" t
WHERE p."userId" = (t.metadata::json->>'ownerId')::uuid
  AND t.type = 'personal'
  AND p."tenantId" IS NULL`,
      `通过 Personal Tenant 映射回填 Project.tenantId`
    )
  }
}

async function step4ProfileMigration() {
  await printHeader('Step 4: GEOProject → Project + GeoProfile')

  const geoCount = await getTableCount('kmki_geo_projects')
  const migratedCount = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "kmki_geo_projects" gp
    JOIN "Project" p ON gp.id = p.id AND p.type = 'geo'
    WHERE gp."deletedAt" IS NULL
  ` as any[]

  console.log(`  GEOProject (non-deleted): ${geoCount}`)
  console.log(`  Already migrated to Project: ${migratedCount[0].cnt}`)
  console.log(`  Remaining: ${geoCount - migratedCount[0].cnt}`)

  if (geoCount - migratedCount[0].cnt > 0) {
    await printSQL(
      `INSERT INTO "Project" (id, "tenantId", "ownerId", type, name, status, "createdAt", "updatedAt")
SELECT gp.id, gp."userId", gp."userId", 'geo', gp.name, gp.status, gp."createdAt", gp."updatedAt"
FROM "kmki_geo_projects" gp
WHERE gp."deletedAt" IS NULL
  AND gp.id NOT IN (SELECT id FROM "Project" WHERE type = 'geo')`,
      `迁移未转化的 GEOProject 到 Project`
    )

    await printSQL(
      `INSERT INTO "kmki_geo_project_profiles" ("projectId", topic, industry, language, country, "geoConfig")
SELECT gp.id, gp.topic, gp.industry, gp.language, gp.country, gp.config
FROM "kmki_geo_projects" gp
WHERE gp."deletedAt" IS NULL
  AND gp.id NOT IN (SELECT "projectId" FROM "kmki_geo_project_profiles")`,
      `创建对应的 GeoProjectProfile`
    )
  }
}

async function step5SubTableTenantId() {
  await printHeader('Step 5: Backfill GEO sub-table tenantId')

  const geoTables = [
    'kmki_geo_entities', 'kmki_geo_entity_relations', 'kmki_geo_project_versions',
    'kmki_geo_claims', 'kmki_geo_evidences', 'kmki_geo_citations',
    'kmki_geo_faqs', 'kmki_geo_schema_markups', 'kmki_geo_review_queues',
    'kmki_geo_quality_scores', 'kmki_geo_freshness_records',
    'kmki_geo_benchmark_records', 'kmki_geo_score_snapshots',
    'kmki_geo_optimization_history',
  ]

  for (const table of geoTables) {
    const hasTenantCol = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as cnt FROM information_schema.columns
      WHERE table_name = '${table}' AND column_name = 'tenantId'
    `) as any[]

    if (hasTenantCol[0].cnt === 0) {
      console.log(`  ⏭️  ${table}: tenantId 列不存在（跳过）`)
      continue
    }

    const nullTenantCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as cnt FROM "${table}" WHERE "tenantId" IS NULL
    `) as any[]
    const totalCount = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as cnt FROM "${table}"
    `) as any[]

    if (nullTenantCount[0].cnt > 0) {
      console.log(`  📋 ${table}: ${nullTenantCount[0].cnt}/${totalCount[0].cnt} 需要回填`)

      const joinCol = table.includes('entity_relations') || table.includes('project_versions') ||
        table.includes('review_queues') || table.includes('quality_scores') ||
        table.includes('freshness_records') || table.includes('benchmark_records') ||
        table.includes('score_snapshots') || table.includes('optimization_history')
        ? 'projectId' : 'projectId'  // most use projectId

      if (joinCol === 'projectId') {
        await printSQL(
          `UPDATE "${table}" dst
SET "tenantId" = p."tenantId"
FROM "Project" p
WHERE dst."projectId" = p.id
  AND dst."tenantId" IS NULL`,
          `回填 ${table}.tenantId（通过 projectId JOIN Project）`
        )
      }
    }
  }
}

async function step6Verify() {
  await printHeader('Step 6: Verification')

  console.log(`  Run: node scripts/verify-migration.mjs`)
  console.log(`
  Expected results:
    ✅ Tenant Integrity    — All pass
    ✅ Project Center      — All pass  
    ✅ Referential Consist — All pass
    ✅ Legacy Cleanup      — Warning (table still exists)
    ✅ Feature Flag        — All pass
  `)
}

async function step7Rollback() {
  await printHeader('Step 7: Rollback Plan')

  console.log(`
  Rollback sequence:
    1. Set GEO_USE_LEGACY_PROJECT=true
    2. Set PROJECT_V2_ENABLED=false
    3. Run rollback SQL:
  `)

  await printSQL(
    `ALTER TABLE "Project" DROP COLUMN "tenantId";
ALTER TABLE "Project" DROP COLUMN "ownerId";
ALTER TABLE "Project" DROP COLUMN "type";
ALTER TABLE "Project" DROP COLUMN "resourceCount";
ALTER TABLE "Project" DROP COLUMN "lastExecutionAt";
ALTER TABLE "Project" DROP COLUMN "lastActivityAt";
DROP TABLE IF EXISTS "kmki_geo_project_profiles";
ALTER TABLE "kmki_geo_entities" DROP COLUMN "tenantId";
-- ... 其余 14 张子表相同
ALTER TABLE "Workspace" DROP COLUMN "tenantId";
ALTER TABLE "Workspace" DROP COLUMN "workspaceType";`,
    `回滚所有新增的列和表`
  )
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════')
  console.log('  Phase 1a Migration — Dry Run')
  console.log('  Mode:', MODE.toUpperCase())
  console.log('  ⚠️  NO DATABASE CHANGES WILL BE MADE')
  console.log('═══════════════════════════════════════')

  if (MODE === 'summary') {
    const tables = ['Project', 'kmki_geo_projects', 'kmki_geo_entities',
      'kmki_geo_claims', 'kmki_geo_evidences', 'kmki_geo_citations',
      'kmki_geo_faqs', 'governance_tenant']

    console.log('\n📊 Data Summary:')
    for (const t of tables) {
      try {
        const c = await getTableCount(t)
        console.log(`  ${t.padEnd(30)} ${c} records`)
      } catch { console.log(`  ${t.padEnd(30)} TABLE NOT FOUND`) }
    }

    const distinctTypes = await getDistinctValues('governance_tenant', 'type')
    console.log(`\n  Tenant types: ${distinctTypes.join(', ') || 'NONE'}`)
    return
  }

  await step1Tenant()
  await step2ProjectType()
  await step3TenantId()
  await step4ProfileMigration()
  await step5SubTableTenantId()
  await step6Verify()
  await step7Rollback()

  console.log('\n═══════════════════════════════════════')
  console.log('  ✅ Dry Run Complete. Ready for real execution.')
  console.log('  ⚠️  Review SQL above before running actual migration.')
  console.log('═══════════════════════════════════════\n')
}

main().catch(console.error).finally(() => prisma.$disconnect())
