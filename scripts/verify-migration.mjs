#!/usr/bin/env node
/**
 * Project Migration Verifier — Phase 1a
 * 
 * 核心校验工具，用于验证 Project Center 迁移的完整性。
 * 执行所有迁移步骤后运行，输出 PASS/FAIL 报告。
 * 
 * 用法：
 *   node scripts/verify-migration.mjs         # 完整校验
 *   node scripts/verify-migration.mjs --fast   # 仅检查关键指标
 *   node scripts/verify-migration.mjs --tenant-only  # 只查 tenant
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Helpers ───────────────────────────────────────────────

const PASS = '✅ PASS'
const FAIL = '❌ FAIL'
const SKIP = '⏭️ SKIP'
const WARN = '⚠️ WARN'

let allPassed = true
let totalChecks = 0
let passedChecks = 0

function check(name, ok, detail) {
  totalChecks++
  const icon = ok ? PASS : FAIL
  if (!ok) allPassed = false
  if (ok) passedChecks++
  console.log(`  ${icon}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function count(query)  {
  return (await prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM ${query}`)[0].cnt
}

// ─── Checks ────────────────────────────────────────────────

async function verifyTenant() {
  console.log('\n═══════════════════════════════════════')
  console.log('  1. Tenant Integrity')
  console.log('═══════════════════════════════════════')

  // 1.1 Every Project has a tenantId
  const nullTenantProjects = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "Project" WHERE "tenantId" IS NULL
  ` as any[]
  check('Project.tenantId 全非空', nullTenantProjects[0].cnt === 0,
    nullTenantProjects[0].cnt > 0 ? `${nullTenantProjects[0].cnt} projects missing tenantId` : 'OK')

  // 1.2 Every GEO sub-table has tenantId
  const geoTables = [
    'kmki_geo_entities', 'kmki_geo_entity_relations', 'kmki_geo_project_versions',
    'kmki_geo_claims', 'kmki_geo_evidences', 'kmki_geo_citations',
    'kmki_geo_faqs', 'kmki_geo_schema_markups', 'kmki_geo_review_queues',
    'kmki_geo_quality_scores', 'kmki_geo_freshness_records',
    'kmki_geo_benchmark_records', 'kmki_geo_score_snapshots',
    'kmki_geo_optimization_history',
  ]
  for (const table of geoTables) {
    const hasTenantCol = await prisma.$queryRaw`
      SELECT COUNT(*)::int as cnt FROM information_schema.columns
      WHERE table_name = ${table} AND column_name = 'tenantId'
    ` as any[]
    if (hasTenantCol[0].cnt === 0) {
      check(`${table} 有 tenantId 列`, false, '列不存在（SKIP 校验）')
      continue
    }
    const nullTenant = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as cnt FROM "${table}" WHERE "tenantId" IS NULL
    `) as any[]
    check(`${table}.tenantId 全非空`, nullTenant[0].cnt === 0,
      nullTenant[0].cnt > 0 ? `${nullTenant[0].cnt} records missing tenantId` : 'OK')
  }

  // 1.3 PersonalTenant exists for every user (fast mode: sample)
  const usersWithoutTenant = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "User" u
    LEFT JOIN "governance_tenant" t ON t.name = 'Personal: ' || u.id AND t.type = 'personal'
    WHERE t.id IS NULL
  ` as any[]
  check('所有 User 有 Personal Tenant', usersWithoutTenant[0].cnt === 0,
    usersWithoutTenant[0].cnt > 0 ? `${usersWithoutTenant[0].cnt} users without tenant` : 'OK')
}

async function verifyProject() {
  console.log('\n═══════════════════════════════════════')
  console.log('  2. Project Center Integrity')
  console.log('═══════════════════════════════════════')

  // 2.1 Project.type is never null
  const nullTypeProjects = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "Project" WHERE "type" IS NULL
  ` as any[]
  check('Project.type 全非空', nullTypeProjects[0].cnt === 0,
    nullTypeProjects[0].cnt > 0 ? `${nullTypeProjects[0].cnt} projects missing type` : 'OK')

  // 2.2 Project.type values are valid
  const types = await prisma.$queryRaw`
    SELECT DISTINCT "type" FROM "Project"
  ` as any[]
  const validTypes = ['video', 'geo', 'novel', 'ppt', 'custom']
  const invalid = types.filter((t) => !validTypes.includes(t.type))
  check('Project.type 值合法', invalid.length === 0,
    invalid.length > 0 ? `Invalid types: ${invalid.map((t) => t.type).join(', ')}` : `Valid types: ${types.map((t) => t.type).join(', ')}`)

  // 2.3 Every GeoProjectProfile has a matching Project
  const orphanProfiles = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "kmki_geo_project_profiles" pp
    LEFT JOIN "Project" p ON pp."projectId" = p.id
    WHERE p.id IS NULL OR p.type != 'geo'
  ` as any[]
  check('GeoProjectProfile ↔ Project 一一对应', orphanProfiles[0].cnt === 0,
    orphanProfiles[0].cnt > 0 ? `${orphanProfiles[0].cnt} orphan profiles` : 'OK')

  // 2.4 Every GEOProject (non-deleted) has been migrated to Project
  const unmigratedGeo = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "kmki_geo_projects" gp
    WHERE gp."deletedAt" IS NULL
    AND gp.id NOT IN (SELECT id FROM "Project" WHERE type = 'geo')
  ` as any[]
  check('GEOProject 全部迁移', unmigratedGeo[0].cnt === 0,
    unmigratedGeo[0].cnt > 0 ? `${unmigratedGeo[0].cnt} unmigrated GEOProjects` : 'OK')
}

async function verifyConsistency() {
  console.log('\n═══════════════════════════════════════')
  console.log('  3. Referential Consistency')
  console.log('═══════════════════════════════════════')

  // 3.1 No orphan references in GEO sub-tables
  const orphanEntities = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "kmki_geo_entities" e
    LEFT JOIN "Project" p ON p.id = e."projectId"
    WHERE p.id IS NULL
  ` as any[]
  check('GEOEntity.projectId 全部有效', orphanEntities[0].cnt === 0,
    orphanEntities[0].cnt > 0 ? `${orphanEntities[0].cnt} orphan entities` : 'OK')

  const orphanClaims = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "kmki_geo_claims" c
    LEFT JOIN "kmki_geo_entities" e ON e.id = c."entityId"
    WHERE e.id IS NULL
  ` as any[]
  check('GEOClaim.entityId 全部有效', orphanClaims[0].cnt === 0,
    orphanClaims[0].cnt > 0 ? `${orphanClaims[0].cnt} orphan claims` : 'OK')

  // 3.2 GEO sub-table tenantId matches Project tenantId
  const mismatchedEntityTenant = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "kmki_geo_entities" e
    JOIN "Project" p ON p.id = e."projectId"
    WHERE e."tenantId" IS NOT NULL AND e."tenantId" != p."tenantId"
  ` as any[]
  check('GEOEntity.tenantId ↔ Project.tenantId 一致', mismatchedEntityTenant[0].cnt === 0,
    mismatchedEntityTenant[0].cnt > 0 ? `${mismatchedEntityTenant[0].cnt} mismatched` : 'OK')
}

async function verifyGeoProjectRemoved() {
  console.log('\n═══════════════════════════════════════')
  console.log('  4. Legacy Cleanup (Phase 1d)')
  console.log('═══════════════════════════════════════')

  // 4.1 Check if GEOProject table still exists (should be dropped in Phase 1d)
  const tableExists = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM information_schema.tables
    WHERE table_name = 'kmki_geo_projects'
  ` as any[]
  if (tableExists[0].cnt > 0) {
    const count = await prisma.$queryRaw`
      SELECT COUNT(*)::int as cnt FROM "kmki_geo_projects"
    ` as any[]
    check('GEOProject 表状态', true, `表仍然存在，${count[0].cnt} 条记录（等待 Phase 1d 迁移）`)
  } else {
    check('GEOProject 表已清理', true, '表已不存在')
  }
}

async function verifyFeatureFlags() {
  console.log('\n═══════════════════════════════════════')
  console.log('  5. Feature Flag Readiness')
  console.log('═══════════════════════════════════════')

  // Check if the flag file exists and is valid
  const fs = await import('fs')
  const flagFileExists = fs.existsSync('backend/src/config/feature-flags.ts')
  const frontendFlagExists = fs.existsSync('frontend/utils/featureFlags.ts')
  check('后端 Feature Flag 文件', flagFileExists)
  check('前端 Feature Flag 文件', frontendFlagExists)
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const fastMode = args.includes('--fast')
  const tenantOnly = args.includes('--tenant-only')

  console.log('═══════════════════════════════════════')
  console.log('  Project Migration Verifier — Phase 1a')
  console.log('  Mode:', fastMode ? 'FAST' : tenantOnly ? 'TENANT ONLY' : 'FULL')
  console.log('═══════════════════════════════════════')

  await verifyTenant()
  if (!tenantOnly) {
    await verifyProject()
    await verifyConsistency()
    await verifyGeoProjectRemoved()
    await verifyFeatureFlags()
  }

  console.log('\n═══════════════════════════════════════')
  console.log(`  Results: ${passedChecks}/${totalChecks} passed`)
  console.log('═══════════════════════════════════════')

  if (allPassed) {
    console.log('\n🎉 ALL CHECKS PASSED — Migration is complete and consistent.')
    process.exit(0)
  } else {
    console.log(`\n❌ ${totalChecks - passedChecks} checks FAILED. Review above before proceeding.`)
    process.exit(1)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
