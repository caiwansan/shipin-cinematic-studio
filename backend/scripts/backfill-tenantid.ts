// ============================================================
// Stage 2.3: tenantId Backfill (Project → Workspace → Profile → Sub-tables)
// ============================================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Stage 2.3: tenantId Backfill ===\n');

  // ── 2.3.1 Project.tenantId ──
  console.log('--- 2.3.1: Project.tenantId ---');

  const users = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
    SELECT id::text, email FROM "User" WHERE email != 'admin@scs.com'
  `;
  console.log(`Non-admin users: ${users.length}`);

  let pUpdated = 0;
  for (const u of users) {
    // Find this user's personal tenant
    const tenants = await prisma.$queryRaw<Array<{ tenantId: string }>>`
      SELECT gu."tenantId" FROM governance_user gu WHERE gu.email = ${u.email}
    `;
    if (tenants.length === 0) continue;
    const tenantId = tenants[0].tenantId;

    const result = await prisma.$executeRaw`
      UPDATE "Project" SET "tenantId" = ${tenantId}::uuid
      WHERE "userId" = ${u.id}::uuid AND "tenantId" IS NULL
    `;
    if (result > 0) pUpdated += result;
  }

  console.log(`Projects tenantId set: ${pUpdated}`);

  // Verify
  const pNull = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "Project" WHERE "tenantId" IS NULL
  `;
  console.log(`Remaining NULL: ${pNull[0].count}`);

  // ── 2.3.2 Workspace.tenantId ──
  console.log('\n--- 2.3.2: Workspace.tenantId ---');

  const wResult = await prisma.$executeRaw`
    UPDATE "Workspace" w
    SET "tenantId" = p."tenantId"
    FROM "Project" p
    WHERE w.id = p.workspace_id AND w."tenantId" IS NULL
  `;
  console.log(`Workspaces tenantId set: ${wResult}`);

  const wNull = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "Workspace" WHERE "tenantId" IS NULL
  `;
  console.log(`Remaining NULL: ${wNull[0].count}`);

  // ── 2.3.3 Other tables that reference Project ──
  // executionResults JSON fields reference projects by ID,
  // but there's no direct FK table to backfill for non-GEO tables in Stage 2.3.
  // GEO sub-tables are handled in 2.5 after Profile creation.

  console.log('\n=== Summary ===');
  console.log(`Project.tenantId NULL remaining: ${pNull[0].count}`);
  console.log(`Workspace.tenantId NULL remaining: ${wNull[0].count}`);
  console.log(`Project gate: ${Number(pNull[0].count) === 0 ? '✅' : '❌'}`);
  console.log(`Workspace gate: ${Number(wNull[0].count) === 0 ? '✅' : '❌'}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
