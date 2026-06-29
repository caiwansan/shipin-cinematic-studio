// ============================================================
// Stage 2.4: GeoProjectProfile Backfill
// Creates Project rows + GeoProjectProfile for legacy GEO projects
// ============================================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Stage 2.4: GeoProjectProfile Backfill ===\n');

  // Step 1: Get all legacy GEO projects that don't have a Project row yet
  const legacyProjects = await prisma.$queryRaw<Array<{
    id: string; userId: string; name: string; topic: string | null;
    industry: string | null; language: string | null; country: string | null;
    config: any; workspaceId: string;
  }>>`
    SELECT gp.id::text, gp."userId"::text, gp.name, gp.topic,
           gp.industry, gp.language, gp.country, gp.config,
           gp.workspace_id as "workspaceId"
    FROM kmki_geo_projects gp
    WHERE NOT EXISTS (SELECT 1 FROM "Project" p WHERE p.id = gp.id::uuid)
  `;
  console.log(`Legacy GEO projects needing Project rows: ${legacyProjects.length}`);

  // Step 2: Check existing Geo profiles already in new table
  const existingProfiles = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM kmki_geo_project_profiles
  `;
  console.log(`Existing GeoProjectProfiles: ${existingProfiles.length}`);

  // Step 3: For each legacy GEO project, create:
  //   - Project row (type='geo')
  //   - GeoProjectProfile
  let pCreated = 0;
  let pfCreated = 0;
  let skipped = 0;

  for (const gp of legacyProjects) {
    // Find owner
    const username = gp.userId || 'unknown';
    
    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username },
        ],
      },
    });

    if (!user) {
      // Legacy test data: use demo user as fallback
      const demoUser = await prisma.user.findFirst({ where: { email: 'demo@scs.com' } });
      if (!demoUser) {
        console.log(`[SKIP] No demo user fallback for ${username}`);
        skipped++;
        continue;
      }
      // Assign to demo user
      const demoTenants = await prisma.$queryRaw<Array<{ tenantId: string }>>`
        SELECT gu."tenantId" FROM governance_user gu WHERE gu.email = ${demoUser.email}
      `;
      if (demoTenants.length === 0) {
        console.log(`[SKIP] No tenant for demo user`);
        skipped++;
        continue;
      }
      const tenantId = demoTenants[0].tenantId;
      const now = new Date();

      await prisma.$executeRaw`
        INSERT INTO "Project" (id, name, "userId", type, "tenantId", status, version, "resourceCount", "createdAt", "updatedAt")
        VALUES (${gp.id}::uuid, ${gp.name}, ${demoUser.id}::uuid, 'geo', ${tenantId}::uuid, 'draft', 1, 0, ${now}, ${now})
      `;
      pCreated++;

      await prisma.$executeRaw`
        INSERT INTO kmki_geo_project_profiles ("id", "projectId", website, domain, brand, language, country, industry, topic, "geoConfig", "createdAt", "updatedAt")
        VALUES (${crypto.randomUUID()}, ${gp.id}::uuid, ${''}, ${''}, ${gp.name}, ${gp.language || 'zh'}, ${gp.country || ''}, ${gp.industry || ''}, ${gp.topic || ''}, ${JSON.stringify(gp.config || {})}::jsonb, ${now}, ${now})
      `;
      pfCreated++;
      continue;
    }

    // Find the user's personal tenant
    const tenants = await prisma.$queryRaw<Array<{ tenantId: string }>>`
      SELECT gu."tenantId" FROM governance_user gu WHERE gu.email = ${user.email}
    `;
    if (tenants.length === 0) {
      console.log(`[SKIP] No tenant for ${user.email}`);
      skipped++;
      continue;
    }
    const tenantId = tenants[0].tenantId;

    // Create Project row
    const now = new Date();
    try {
      await prisma.$executeRaw`
        INSERT INTO "Project" (id, name, "userId", type, "tenantId", status, version, "resourceCount", "createdAt", "updatedAt")
        VALUES (${gp.id}::uuid, ${gp.name}, ${user.id}::uuid, 'geo', ${tenantId}::uuid, 'draft', 1, 0, ${now}, ${now})
      `;
      pCreated++;
    } catch (err: any) {
      console.log(`[ERROR] Creating Project ${gp.id}: ${err.message}`);
      skipped++;
      continue;
    }

    // Create GeoProjectProfile
    try {
      await prisma.$executeRaw`
        INSERT INTO kmki_geo_project_profiles ("id", "projectId", website, domain, brand, language, country, industry, topic, "geoConfig", "createdAt", "updatedAt")
        VALUES (${crypto.randomUUID()}, ${gp.id}::uuid, ${''}, ${''}, ${gp.name}, ${gp.language || 'zh'}, ${gp.country || ''}, ${gp.industry || ''}, ${gp.topic || ''}, ${JSON.stringify(gp.config || {})}::jsonb, ${now}, ${now})
      `;
      pfCreated++;
    } catch (err: any) {
      console.log(`[ERROR] Creating Profile for ${gp.id}: ${err.message}`);
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Project rows created: ${pCreated}`);
  console.log(`GeoProjectProfiles created: ${pfCreated}`);
  console.log(`Skipped: ${skipped}`);

  // Step 4: Also create GeoProjectProfiles for existing Project that are type='geo'
  // (in case they already had Project rows but no profile)
  const existingGeoProjects = await prisma.$queryRaw<Array<{ id: string; name: string; tenantId: string }>>`
    SELECT p.id::text, p.name, p."tenantId"::text
    FROM "Project" p
    WHERE p.type = 'geo'
    AND NOT EXISTS (SELECT 1 FROM kmki_geo_project_profiles pp WHERE pp."projectId" = p.id)
  `;
  console.log(`\nGeo Projects without profiles: ${existingGeoProjects.length}`);

  for (const p of existingGeoProjects) {
    await prisma.$executeRaw`
      INSERT INTO kmki_geo_project_profiles ("id", "projectId", language, "geoConfig", "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${p.id}::uuid, 'zh', '{}'::jsonb, ${new Date()}, ${new Date()})
    `;
    pfCreated++;
  }

  // Step 5: Verify 1:1 consistency
  const geoProjectsCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "Project" WHERE type = 'geo'
  `;
  const profilesCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM kmki_geo_project_profiles
  `;
  const oneToOne = Number(geoProjectsCount[0].count) === Number(profilesCount[0].count);

  console.log(`\n=== 1:1 Consistency Gate ===`);
  console.log(`Projects (type=geo): ${geoProjectsCount[0].count}`);
  console.log(`GeoProjectProfiles:  ${profilesCount[0].count}`);
  console.log(`1:1 Match: ${oneToOne ? '✅' : '❌'}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
