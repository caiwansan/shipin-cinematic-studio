#!/usr/bin/env node
// P2-T001 Phase 1B — Brand Foundation Migration
// 通过 Prisma Client 执行，使用 $queryRawUnsafe + 简单参数绑定
// 用法:
//   node scripts/migrations/geo-brand-migration.mjs [--dry-run|--report|--rollback]

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const LOG_FILE = path.join(__dirname, '../../data/migrations/brand-migration.log');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const REPORT_ONLY = args.includes('--report');
const DO_ROLLBACK = args.includes('--rollback');

fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function sql(strings, ...vals) {
  // Simple tagged template: build SQL with $1, $2... params
  let result = '';
  const params = [];
  strings.forEach((str, i) => {
    result += str;
    if (i < vals.length) {
      params.push(vals[i]);
      result += `$${params.length}`;
    }
  });
  return { sql: result, params };
}

// ── Data Quality Report ──
async function report() {
  log('=== Migration Data Quality Report ===\n');

  const total = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "kmki_geo_projects" WHERE "deletedAt" IS NULL');
  log(`Projects (active):       ${Number(total[0].cnt)}`);

  const noWebsite = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "kmki_geo_projects" WHERE ("website" IS NULL OR "website" = \'\') AND "deletedAt" IS NULL');
  log(`  Missing Website:       ${Number(noWebsite[0].cnt)}`);

  const noIndustry = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "kmki_geo_projects" WHERE ("industry" IS NULL OR "industry" = \'\') AND "deletedAt" IS NULL');
  log(`  Missing Industry:      ${Number(noIndustry[0].cnt)}`);

  const dupDomains = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as cnt FROM (
      SELECT "website" FROM "kmki_geo_projects"
      WHERE "website" IS NOT NULL AND "website" != '' AND "deletedAt" IS NULL
      GROUP BY "website" HAVING COUNT(*) > 1
    ) d
  `);
  log(`  Duplicate Domains:     ${Number(dupDomains[0].cnt)}`);

  const brandCount = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "kmki_geo_brands"');
  log(`\nExisting Brands:         ${Number(brandCount[0].cnt)}`);

  const orphan = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "kmki_geo_projects" WHERE "brandId" IS NULL AND "deletedAt" IS NULL');
  log(`Projects without Brand:  ${Number(orphan[0].cnt)}`);

  const ksCount = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "kmki_geo_knowledge_sources"');
  log(`Knowledge Sources:       ${Number(ksCount[0].cnt)}`);

  if (Number(brandCount[0].cnt) > 0 && Number(orphan[0].cnt) === 0) {
    log('\n✅ 所有项目已有 Brand。迁移已完成或无需执行。');
  }
  log(`\nReport saved to: ${LOG_FILE}`);
}

// ── Rollback ──
async function rollback() {
  log('=== Rollback: Brand Migration ===');
  await prisma.$executeRawUnsafe('UPDATE "kmki_geo_projects" SET "brandId" = NULL, "brandVersion" = NULL, "brandSnapshot" = NULL, "trigger" = \'manual\'');
  await prisma.$executeRawUnsafe('DELETE FROM "kmki_geo_knowledge_sources"');
  await prisma.$executeRawUnsafe('DELETE FROM "kmki_geo_brands"');
  log('✅ 回滚完成');
  await report();
}

// ── Main Migration ──
async function runMigration() {
  if (DRY_RUN) {
    log('🟡 DRY RUN 模式 — 仅分析，不写数据库\n');
    await report();
    log('\n🟡 Dry Run 完成。执行完整迁移请不加 --dry-run');
    return;
  }

  log('=== P2-T001 Phase 1B: Brand Foundation Migration ===\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `data/migrations/brand-migration-backup-${timestamp}.sql`;
  log(`[1/6] 备份到 ${backupFile}...`);
  try {
    const dbUrl = process.env.DATABASE_URL;
    // Strip connection_limit for pg_dump
    const cleanUrl = dbUrl.replace(/\?.*$/, '');
    execSync(`pg_dump "${cleanUrl}" --data-only --table=kmki_geo_projects > "${backupFile}"`, { timeout: 30000 });
    log('  ✅ 备份完成');
  } catch {
    log('  ⚠️  pg_dump 备份跳过（非致命）');
  }

  // Fetch all active projects
  log('[2/6] 加载现有项目...');
  const projects = await prisma.$queryRawUnsafe(
    'SELECT id, name, "website", industry, country, language FROM "kmki_geo_projects" WHERE "deletedAt" IS NULL ORDER BY "createdAt" ASC'
  );
  log(`  ✅ 加载 ${projects.length} 个活跃项目`);

  // Group by name for dedup
  log('[3/6] 创建 Brand...');
  const nameGroups = new Map();
  for (const p of projects) {
    if (!nameGroups.has(p.name)) nameGroups.set(p.name, []);
    nameGroups.get(p.name).push(p);
  }

  let brandCreated = 0;
  for (const [name, group] of nameGroups) {
    const first = group[0];
    const website = first.website || '';
    const slug = generateSlug(name);

    // Check if brand with same name already exists
    const existing = await prisma.$queryRawUnsafe(
      'SELECT id FROM "kmki_geo_brands" WHERE "name" = $1', name);

    let brandId;
    if (existing.length > 0) {
      brandId = existing[0].id;
    } else {
      // Create brand
      const result = await prisma.$queryRawUnsafe(`
        INSERT INTO "kmki_geo_brands" ("id", "slug", "name", "primaryDomain", "description", "industry", "region", "primaryLanguage", "status", "version", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, NULL, $4, $5, $6, 'active', 1, NOW(), NOW())
        RETURNING id
      `, slug, name, website, first.industry || null, first.country || null, first.language || 'zh');
      brandId = result[0].id;
      brandCreated++;
    }

    // Backfill all projects with this name
    for (const p of group) {
      await prisma.$executeRawUnsafe(
        'UPDATE "kmki_geo_projects" SET "brandId" = $1, "brandVersion" = 1, "trigger" = \'manual\' WHERE "id" = $2 AND "brandId" IS NULL',
        brandId, p.id
      );
    }
  }
  log(`  ✅ 创建 ${brandCreated} 个 Brand，关联 ${projects.length} 个项目`);

  // Verify
  const orphan = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*) as cnt FROM "kmki_geo_projects" WHERE "brandId" IS NULL AND "deletedAt" IS NULL'
  );
  log(`  Orphan projects: ${Number(orphan[0].cnt)}`);

  // Create KnowledgeSources
  log('[4/6] 从官网创建初始知识源...');
  const brands = await prisma.$queryRawUnsafe(
    'SELECT id, name, "primaryDomain" FROM "kmki_geo_brands" WHERE "primaryDomain" != \'\''
  );
  let ksCreated = 0;
  for (const b of brands) {
    const existing = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*) as cnt FROM "kmki_geo_knowledge_sources" WHERE "brandId" = $1 AND "type" = \'official_site\'',
      b.id
    );
    if (Number(existing[0].cnt) === 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "kmki_geo_knowledge_sources" ("id", "brandId", "type", "url", "label", "crawlStrategy", "status", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, 'official_site', $2, $3, 'manual', 'pending', NOW(), NOW())
      `, b.id, b.primaryDomain, `${b.name} 官网`);
      ksCreated++;
    }
  }
  log(`  ✅ 创建 ${ksCreated} 个知识源`);

  log('\n=== Migration 完成 ===\n');
  await report();
}

function generateSlug(name) {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) slug = 'unnamed';
  return slug;
}

// ── Main ──
async function main() {
  const flag = process.env.GEO_BRAND_MODEL_V2;
  if (flag !== 'true' && !REPORT_ONLY && !DO_ROLLBACK) {
    console.log('⚠️  GEO_BRAND_MODEL_V2 未启用，跳过。\n   设置 export GEO_BRAND_MODEL_V2=true 后重试。');
    process.exit(0);
  }

  try {
    if (REPORT_ONLY) {
      await report();
    } else if (DO_ROLLBACK) {
      await rollback();
    } else {
      await runMigration();
    }
  } catch (err) {
    console.error('[FATAL]', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
