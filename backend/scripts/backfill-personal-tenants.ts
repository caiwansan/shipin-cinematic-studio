// ============================================================
// Stage 2.1: Personal Tenant Backfill Script
// Creates Personal Tenants for all historical Users
// ============================================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Stage 2.1: Personal Tenant Backfill ===\n');

  // Step 1: Get all users
  const users = await prisma.user.findMany({
    include: { membership: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Total Users: ${users.length}`);

  // Step 2: Identify admins / special accounts
  const adminUser = users.find(u => u.email === 'admin@scs.com');
  const excludeIds = new Set<string>();
  if (adminUser) {
    excludeIds.add(adminUser.id);
    console.log(`[SKIP] Admin: ${adminUser.email} (${adminUser.id})`);
  }

  // Step 3: Check existing governance_users
  const existingGovUsers = await prisma.$queryRaw<Array<{ email: string; tenantId: string }>>`
    SELECT email, "tenantId" FROM governance_user
  `;
  const existingByEmail = new Map(existingGovUsers.map(g => [g.email, g.tenantId]));
  console.log(`Existing governance_users: ${existingGovUsers.length}`);

  // Step 4: For each user, ensure Personal Tenant + governance_user
  let created = 0;
  let skipped = 0;
  let errors: string[] = [];

  for (const user of users) {
    if (excludeIds.has(user.id)) {
      skipped++;
      continue;
    }

    // Check if already has governance_user record
    const existingTenantId = existingByEmail.get(user.email);
    if (existingTenantId) {
      // Already has a governance_user, but does it have a Personal Tenant?
      const tenant = await prisma.$queryRaw<Array<{ id: string; type: string }>>`
        SELECT id, type FROM governance_tenant WHERE id = ${existingTenantId}
      `;
      if (tenant.length > 0 && tenant[0].type !== 'personal') {
        // Update tenant type? No, just note it.
        console.log(`[NOTE] User ${user.email} already has gov record (type=${tenant[0].type}), not a personal tenant`);
      }
      skipped++;
      continue;
    }

    // Create Personal Tenant
    try {
      const tenantId = crypto.randomUUID();
      const now = new Date();

      // Insert tenant
      await prisma.$executeRaw`
        INSERT INTO governance_tenant (id, name, type, status, "schemaVersion", "createdAt", "updatedAt")
        VALUES (${tenantId}, ${user.username || user.email}, 'personal', 'active', 1, ${now}, ${now})
      `;

      // Insert governance_user
      await prisma.$executeRaw`
        INSERT INTO governance_user (id, "tenantId", email, name, role, status, "createdAt", "updatedAt")
        VALUES (${crypto.randomUUID()}, ${tenantId}, ${user.email}, ${user.username || user.email}, 'owner', 'active', ${now}, ${now})
      `;

      created++;
      if (created <= 5 || created % 10 === 0) {
        console.log(`[OK] ${user.email} → Personal tenant: ${tenantId}`);
      }
    } catch (err: any) {
      errors.push(`${user.email}: ${err.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log(`Errors detail:`);
    errors.forEach(e => console.log(`  - ${e}`));
  }

  // Step 5: Verify
  const tenantCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint as count FROM governance_tenant WHERE type = 'personal'
  `;
  const expectedCount = users.length - excludeIds.size;
  console.log(`\n=== Gate: User Count == Personal Tenant Count ===`);
  console.log(`Users (excl. admin): ${expectedCount}`);
  console.log(`Personal Tenants:    ${tenantCount[0].count}`);
  console.log(`Match: ${Number(tenantCount[0].count) === expectedCount ? '✅ PASS' : '❌ FAIL'}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
