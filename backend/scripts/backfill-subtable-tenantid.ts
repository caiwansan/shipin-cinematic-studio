// ============================================================
// Stage 2.5: GEO Sub-table tenantId Backfill
// ============================================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Stage 2.5: GEO Sub-table tenantId Backfill ===\n');

  const tables = [
    { name: 'kmki_geo_entities',           projectCol: 'projectId', idCol: 'id' },
    { name: 'kmki_geo_entity_relations',    projectCol: 'projectId', idCol: 'id' },
    { name: 'kmki_geo_project_versions',    projectCol: 'projectId', idCol: 'id' },
    { name: 'kmki_geo_claims',             projectCol: 'entityId',  idCol: 'id' },
    { name: 'kmki_geo_evidences',          projectCol: 'claimId',   idCol: 'id' },
    { name: 'kmki_geo_citations',          projectCol: 'evidenceId', idCol: 'id' },
    { name: 'kmki_geo_faqs',               projectCol: 'entityId',  idCol: 'id' },
    { name: 'kmki_geo_schema_markups',     projectCol: 'entityId',  idCol: 'id' },
    { name: 'kmki_geo_review_queue',       projectCol: 'projectId', idCol: 'id' },
    { name: 'kmki_geo_quality_scores',     projectCol: 'projectId', idCol: 'id' },
    { name: 'kmki_geo_freshness_records',  projectCol: 'projectId', idCol: 'id' },
    { name: 'kmki_geo_benchmark_records',  projectCol: 'projectId', idCol: 'id' },
    { name: 'kmki_geo_score_snapshots',    projectCol: 'projectId', idCol: 'id' },
    { name: 'kmki_geo_optimization_histories', projectCol: 'projectId', idCol: 'id' },
  ];

  let totalUpdated = 0;

  for (const t of tables) {
    const pc = t.projectCol;

    // Check if there are rows with NULL tenantId
    const nullCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "${t.name}" WHERE "tenantId" IS NULL`
    );
    console.log(`${t.name}: ${nullCount[0].count} NULL tenantId`);

    if (Number(nullCount[0].count) === 0) {
      console.log(`  → SKIP (no NULLs)`);
      continue;
    }

    // Build backfill SQL based on the column type:
    // Some tables reference projectId directly, others need join chains
    let result: number;

    if (['projectId', 'project_id'].includes(pc) || pc === 'projectId') {
      result = await prisma.$executeRawUnsafe(`
        UPDATE "${t.name}" s
        SET "tenantId" = p."tenantId"
        FROM "Project" p
        WHERE s."${pc}"::text = p.id::text AND s."tenantId" IS NULL
      `);
    } else if (pc === 'entityId') {
      // Entity references: entity → project
      result = await prisma.$executeRawUnsafe(`
        UPDATE "${t.name}" s
        SET "tenantId" = p."tenantId"
        FROM kmki_geo_entities e
        JOIN "Project" p ON p.id = e."projectId"::uuid
        WHERE s."${pc}"::text = e.id AND s."tenantId" IS NULL
      `);
    } else if (pc === 'claimId') {
      // Evidence references: evidence → claim → entity → project
      result = await prisma.$executeRawUnsafe(`
        UPDATE "${t.name}" s
        SET "tenantId" = p."tenantId"
        FROM kmki_geo_claims c
        JOIN kmki_geo_entities e ON e.id = c."entityId"
        JOIN "Project" p ON p.id = e."projectId"::uuid
        WHERE s."${pc}"::text = c.id AND s."tenantId" IS NULL
      `);
    } else if (pc === 'evidenceId') {
      // Citation references: citation → evidence → claim → entity → project
      result = await prisma.$executeRawUnsafe(`
        UPDATE "${t.name}" s
        SET "tenantId" = p."tenantId"
        FROM kmki_geo_evidences ev
        JOIN kmki_geo_claims c ON c.id = ev."claimId"
        JOIN kmki_geo_entities e ON e.id = c."entityId"
        JOIN "Project" p ON p.id = e."projectId"::uuid
        WHERE s."${pc}"::text = ev.id AND s."tenantId" IS NULL
      `);
    } else {
      console.log(`  → SKIP (unknown column: ${pc})`);
      continue;
    }

    console.log(`  → Updated: ${result}`);
    totalUpdated += result;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total sub-table tenantId updates: ${totalUpdated}`);

  // Verify: all sub-table tenantId NULLs should be 0
  console.log(`\n=== Final Verification ===`);
  for (const t of tables) {
    const nullCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "${t.name}" WHERE "tenantId" IS NULL`
    );
    const status = Number(nullCount[0].count) === 0 ? '✅' : '❌';
    console.log(`${status} ${t.name}: ${nullCount[0].count} NULL`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
