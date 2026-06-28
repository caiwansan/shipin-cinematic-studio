/**
 * jobs/migrate-asset-heat-index.ts
 *
 * R9.2 — 创建 asset_heat_index 表（纯 SQL 迁移）
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('[R9.2] 🗂️  Creating asset_heat_index table...')

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS asset_heat_index (
      id                    SERIAL PRIMARY KEY,
      asset_id              VARCHAR(64) NOT NULL UNIQUE,
      asset_url             TEXT NOT NULL DEFAULT '',
      db_type               VARCHAR(32) NOT NULL DEFAULT '',
      heat_score            DOUBLE PRECISION NOT NULL DEFAULT 0.0,
      tier                  VARCHAR(8) NOT NULL DEFAULT 'COLD',
      access_count          INTEGER NOT NULL DEFAULT 0,
      days_since_last_access INTEGER NOT NULL DEFAULT 9999,
      used_in_generation    INTEGER NOT NULL DEFAULT 0,
      last_accessed_at      TIMESTAMP,
      computed_at           TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_asset_heat_tier ON asset_heat_index (tier)
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_asset_heat_score ON asset_heat_index (heat_score DESC)
  `)

  console.log('[R9.2] ✅ asset_heat_index table created')
}

main()
  .catch(e => { console.error('Migration failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
