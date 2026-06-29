// ============================================================
// Stage 2.2: Project.type Backfill Script
// ============================================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Stage 2.2: Project.type Backfill ===\n');

  // Step 1: Get GEO project IDs
  const geoProjectIds = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id::text FROM kmki_geo_projects
  `;
  const geoSet = new Set(geoProjectIds.map(r => r.id));
  console.log(`GEO projects (kmki_geo_projects): ${geoSet.size}`);

  // Step 2: Get all projects with NULL type
  const projects = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id::text, name FROM "Project" WHERE type IS NULL
  `;
  console.log(`Projects with NULL type: ${projects.length}`);

  // Step 3: Classify and update
  let geo = 0, video = 0, novel = 0, ppt = 0, custom = 0;

  for (const p of projects) {
    let t: string;
    if (geoSet.has(p.id)) {
      t = 'geo';
      geo++;
    } else {
      t = 'video';
      video++;
    }

    await prisma.$executeRaw`
      UPDATE "Project" SET type = ${t} WHERE id = ${p.id}::uuid
    `;
  }

  console.log(`\n=== Classification ===`);
  console.log(`geo:   ${geo}`);
  console.log(`video: ${video}`);
  console.log(`novel: ${novel}`);
  console.log(`ppt:   ${ppt}`);
  console.log(`custom: ${custom}`);

  // Step 4: Verify
  const nullCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "Project" WHERE type IS NULL
  `;
  console.log(`\n=== Gate: NULL type count ===`);
  console.log(`Remaining NULL: ${nullCount[0].count}`);
  console.log(`Target: 0`);
  console.log(`Pass: ${Number(nullCount[0].count) === 0 ? '✅' : '❌'}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
