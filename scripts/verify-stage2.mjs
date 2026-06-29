#!/usr/bin/env node
/**
 * Stage 2 Verification Script
 * Runs all checks after backfill to validate Phase 1a migration
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PASS = '✅'
const FAIL = '❌'

async function run() {
  console.log('\n========================================')
  console.log('  Phase 1a — Stage 2 Verification')
  console.log('========================================\n')

  // ─── Verify A: Null Checks ───
  console.log('[1] Null Check')
  
  let ok = true

  // Project.tenantId
  const pTenantNull = await prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM "Project" WHERE "tenantId" IS NULL`
  console.log(`  ${pTenantNull[0].cnt === 0 ? PASS : FAIL} Project.tenantId NULL: ${pTenantNull[0].cnt}`)
  if (pTenantNull[0].cnt > 0) ok = false

  // Project.type
  const pTypeNull = await prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM "Project" WHERE type IS NULL`
  console.log(`  ${pTypeNull[0].cnt === 0 ? PASS : FAIL} Project.type NULL: ${pTypeNull[0].cnt}`)
  if (pTypeNull[0].cnt > 0) ok = false

  // Workspace.tenantId
  const wTenantNull = await prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM "Workspace" WHERE "tenantId" IS NULL`
  console.log(`  ${wTenantNull[0].cnt === 0 ? PASS : FAIL} Workspace.tenantId NULL: ${wTenantNull[0].cnt}`)
  if (wTenantNull[0].cnt > 0) ok = false

  // GEO sub-table null checks
  const geoSubTables = [
    'kmki_geo_entities', 'kmki_geo_entity_relations', 'kmki_geo_project_versions',
    'kmki_geo_claims', 'kmki_geo_evidences', 'kmki_geo_citations', 'kmki_geo_faqs',
    'kmki_geo_schema_markups', 'kmki_geo_review_queue', 'kmki_geo_quality_scores',
    'kmki_geo_freshness_records', 'kmki_geo_benchmark_records', 'kmki_geo_score_snapshots',
    'kmki_geo_optimization_histories'
  ]
  let allGeoNullsZero = true
  for (const tbl of geoSubTables) {
    const r = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as cnt FROM "${tbl}" WHERE "tenantId" IS NULL`)
    if (r[0].cnt > 0) {
      allGeoNullsZero = false
      console.log(`  ${FAIL} ${tbl}.tenantId NULL: ${r[0].cnt}`)
    }
  }
  if (allGeoNullsZero) {
    console.log(`  ${PASS} All GEO sub-tables: 0 NULL tenantId`)
  }

  // ─── Verify B: Referential Integrity ───
  console.log('\n[2] Referential Integrity')

  // Project.tenantId → governance_tenant
  const orphanProjects = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "Project" p
    LEFT JOIN governance_tenant t ON t.id = p."tenantId"::text
    WHERE p."tenantId" IS NOT NULL AND t.id IS NULL
  `
  console.log(`  ${orphanProjects[0].cnt === 0 ? PASS : FAIL} Orphan Projects (no Tenant): ${orphanProjects[0].cnt}`)
  if (orphanProjects[0].cnt > 0) ok = false

  // GeoProjectProfile.projectId → Project
  const orphanProfiles = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM kmki_geo_project_profiles pp
    LEFT JOIN "Project" p ON p.id = pp."projectId"
    WHERE p.id IS NULL
  `
  console.log(`  ${orphanProfiles[0].cnt === 0 ? PASS : FAIL} Orphan GeoProjectProfiles (no Project): ${orphanProfiles[0].cnt}`)
  if (orphanProfiles[0].cnt > 0) ok = false

  // ─── 1:1 Consistency Check ───
  console.log('\n[3] GeoProjectProfile 1:1 Consistency')

  const geoProjCount = await prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM "Project" WHERE type = 'geo'`
  const profileCount = await prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM kmki_geo_project_profiles`
  const oneToOne = geoProjCount[0].cnt === profileCount[0].cnt
  console.log(`  ${oneToOne ? PASS : FAIL} Projects(type=geo): ${geoProjCount[0].cnt} = GeoProjectProfiles: ${profileCount[0].cnt}`)
  if (!oneToOne) ok = false

  // ─── Personal Tenant Gate ───
  console.log('\n[4] Personal Tenant Coverage')

  const userCount = await prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM "User" WHERE email != 'admin@scs.com'`
  const personalTenantCount = await prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM governance_tenant WHERE type = 'personal'`
  const tenantMatch = userCount[0].cnt === personalTenantCount[0].cnt
  console.log(`  ${tenantMatch ? PASS : FAIL} Users: ${userCount[0].cnt} = Personal Tenants: ${personalTenantCount[0].cnt}`)
  if (!tenantMatch) ok = false

  // ─── Summary ───
  console.log('\n========================================')
  console.log(`  ${ok ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`)
  console.log('========================================\n')

  await prisma.$disconnect()
  process.exit(ok ? 0 : 1)
}

run()
