/**
 * services/asset-heat.service.ts
 *
 * R9.2 — Asset Heat Model & Tier Classifier
 *
 * 把 104 个 COS 资产从"静态文件"升级为"可演化生命周期对象"。
 * 热度计算基于：访问频率 + 新近度 + 生成引用次数。
 * 三不原则贯穿：不删除、不迁移、不改 URL。
 */

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

// ---- Types ----

export type AssetTier = 'HOT' | 'WARM' | 'COLD'

export interface AssetHeatRecord {
  assetId: string
  assetUrl: string
  dbType: string
  heatScore: number
  tier: AssetTier
  accessCount: number
  daysSinceLastAccess: number
  usedInGeneration: number
  lastAccessedAt: Date | null
  computedAt: Date
}

export interface HeatDistribution {
  HOT: number
  WARM: number
  COLD: number
}

export interface HeatSummary {
  distribution: HeatDistribution
  total: number
  avgHeat: number
  topHot: AssetHeatRecord[]
  oldestCold: AssetHeatRecord[]
}

// ---- Constants ----

const TIER_HOT_THRESHOLD = 0.7
const TIER_WARM_THRESHOLD = 0.3

// ---- Core Heat Function ----

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function computeHeat(
  accessCount: number,
  daysSinceLastAccess: number,
  usedInGeneration: number,
): { raw: number; normalized: number } {
  const accessScore = Math.log(Math.max(accessCount, 0) + 1) // log(0+1) = 0 safe
  const recencyScore = 1 / (1 + daysSinceLastAccess)
  const usageScore = Math.min(usedInGeneration, 1) // 0 or 1

  const raw = accessScore * 0.5 + recencyScore * 0.4 + usageScore * 0.1
  const normalized = sigmoid(raw)

  return { raw, normalized }
}

function classifyTier(heat: number): AssetTier {
  if (heat > TIER_HOT_THRESHOLD) return 'HOT'
  if (heat > TIER_WARM_THRESHOLD) return 'WARM'
  return 'COLD'
}

// ---- Data Gathering ----

function daysSince(date: Date | null): number {
  if (!date) return 9999
  const ms = Date.now() - date.getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

async function gatherCOSAssets(): Promise<{
  assetId: string
  assetUrl: string
  dbType: string
  accessCount: number
  daysSinceLastAccess: number
  lastAccessedAt: Date | null
  usedInGeneration: number
}[]> {
  const results: any[] = []

  // character_image
  const ci = await prisma.characterImage.findMany({
    select: { id: true, imageUrl: true, createdAt: true, variant: true },
  })
  for (const img of ci) {
    if (!img.imageUrl || !img.imageUrl.includes('.cos.')) continue
    results.push({
      assetId: img.id,
      assetUrl: img.imageUrl,
      dbType: 'character_image',
      accessCount: 0,   // no access_count column yet, will add in migration
      daysSinceLastAccess: daysSince(img.createdAt),
      lastAccessedAt: img.createdAt,
      usedInGeneration: img.variant === 'generated' ? 1 : 0,
    })
  }

  // scene_image
  const si = await prisma.sceneImage.findMany({
    select: { id: true, imageUrl: true, createdAt: true },
  })
  for (const img of si) {
    if (!img.imageUrl || !img.imageUrl.includes('.cos.')) continue
    results.push({
      assetId: img.id,
      assetUrl: img.imageUrl,
      dbType: 'scene_image',
      accessCount: 0,
      daysSinceLastAccess: daysSince(img.createdAt),
      lastAccessedAt: img.createdAt,
      usedInGeneration: 0,
    })
  }

  // storyboard_image
  const sbi = await prisma.storyboardImage.findMany({
    select: { id: true, imageUrl: true, createdAt: true },
  })
  for (const img of sbi) {
    if (!img.imageUrl || !img.imageUrl.includes('.cos.')) continue
    results.push({
      assetId: img.id,
      assetUrl: img.imageUrl,
      dbType: 'storyboard_image',
      accessCount: 0,
      daysSinceLastAccess: daysSince(img.createdAt),
      lastAccessedAt: img.createdAt,
      usedInGeneration: 0,
    })
  }

  return results
}

// ---- Asset Heat Index Persistence ----

async function upsertHeatIndex(records: AssetHeatRecord[]): Promise<number> {
  let upserted = 0

  for (const rec of records) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO asset_heat_index (asset_id, asset_url, db_type, heat_score, tier, access_count, days_since_last_access, used_in_generation, last_accessed_at, computed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (asset_id) DO UPDATE SET
         heat_score = EXCLUDED.heat_score,
         tier = EXCLUDED.tier,
         access_count = EXCLUDED.access_count,
         days_since_last_access = EXCLUDED.days_since_last_access,
         used_in_generation = EXCLUDED.used_in_generation,
         last_accessed_at = EXCLUDED.last_accessed_at,
         computed_at = EXCLUDED.computed_at`,
      rec.assetId,
      rec.assetUrl,
      rec.dbType,
      rec.heatScore,
      rec.tier,
      rec.accessCount,
      rec.daysSinceLastAccess,
      rec.usedInGeneration,
      rec.lastAccessedAt,
      rec.computedAt,
    )
    upserted++
  }

  return upserted
}

// ---- Main Entry Point ----

export async function computeAssetHeat(): Promise<HeatSummary> {
  console.log('='.repeat(70))
  console.log('[R9.2] 🔥 Asset Heat Model — 资产热度计算')
  console.log('='.repeat(70))
  const startTime = Date.now()

  // Step 1: Gather COS assets
  console.log('\n[Step 1] Gathering COS assets...')
  const cosAssets = await gatherCOSAssets()
  console.log(`  Found: ${cosAssets.length} COS assets`)

  // Step 2: Compute heat for each
  console.log('[Step 2] Computing heat scores...')
  const records: AssetHeatRecord[] = []
  for (const asset of cosAssets) {
    const heat = computeHeat(asset.accessCount, asset.daysSinceLastAccess, asset.usedInGeneration)
    records.push({
      assetId: asset.assetId,
      assetUrl: asset.assetUrl,
      dbType: asset.dbType,
      heatScore: heat.normalized,
      tier: classifyTier(heat.normalized),
      accessCount: asset.accessCount,
      daysSinceLastAccess: asset.daysSinceLastAccess,
      usedInGeneration: asset.usedInGeneration,
      lastAccessedAt: asset.lastAccessedAt,
      computedAt: new Date(),
    })
  }

  // Step 3: Distribution
  console.log('[Step 3] Tier distribution...')
  const distribution: HeatDistribution = { HOT: 0, WARM: 0, COLD: 0 }
  let totalHeat = 0
  for (const rec of records) {
    distribution[rec.tier]++
    totalHeat += rec.heatScore
  }
  console.log(`  HOT:  ${distribution.HOT}`)
  console.log(`  WARM: ${distribution.WARM}`)
  console.log(`  COLD: ${distribution.COLD}`)
  console.log(`  Avg heat: ${(totalHeat / records.length).toFixed(4)}`)

  // Step 4: Persist to asset_heat_index
  console.log('\n[Step 4] Persisting to asset_heat_index...')
  try {
    const upserted = await upsertHeatIndex(records)
    console.log(`  Upserted: ${upserted} records`)
  } catch (e) {
    console.warn(`  ⚠️  asset_heat_index table may not exist yet. Creating migration hint:`)
    console.warn(`     -> Run: src/jobs/migrate-asset-heat-index.ts`)
    console.warn(`  Error: ${(e as Error).message}`)
  }

  // Step 5: Top HOT and oldest COLD
  const sorted = [...records].sort((a, b) => b.heatScore - a.heatScore)
  const topHot = sorted.filter(r => r.tier === 'HOT').slice(0, 5)
  const oldestCold = [...records]
    .filter(r => r.tier === 'COLD')
    .sort((a, b) => b.daysSinceLastAccess - a.daysSinceLastAccess)
    .slice(0, 5)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('[R9.2] 📊 Heat Model Summary')
  console.log('='.repeat(70))
  console.log(`  Elapsed: ${elapsed}s`)
  console.log(`  Total assets scored: ${records.length}`)
  console.log(`  Distribution: HOT=${distribution.HOT} WARM=${distribution.WARM} COLD=${distribution.COLD}`)
  console.log(`  Avg heat: ${(totalHeat / records.length).toFixed(4)}`)

  if (topHot.length > 0) {
    console.log(`\n  🔥 Top HOT assets:`)
    for (const r of topHot) {
      console.log(`    ${r.dbType}::${r.assetId.slice(0,8)} heat=${r.heatScore.toFixed(4)}`)
    }
  }

  if (oldestCold.length > 0) {
    console.log(`\n  🧊 Oldest COLD assets:`)
    for (const r of oldestCold) {
      console.log(`    ${r.dbType}::${r.assetId.slice(0,8)} lastAccess=${r.daysSinceLastAccess}d ago heat=${r.heatScore.toFixed(4)}`)
    }
  }

  console.log('\n' + '='.repeat(70))

  return {
    distribution,
    total: records.length,
    avgHeat: totalHeat / records.length,
    topHot,
    oldestCold,
  }
}

// CLI entry
async function main() {
  const result = await computeAssetHeat()
  console.log('\n[R9.2] ✅ Heat computation complete')
  process.exit(0)
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}
