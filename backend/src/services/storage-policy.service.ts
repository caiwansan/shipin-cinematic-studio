/**
 * services/storage-policy.service.ts
 *
 * R9.3 — Storage Policy Layer（冷热分层策略引擎）
 *
 * 将 heat score 映射为 COS 存储策略，但不实际移动数据。
 * 核心原则：不删除、不迁移、不改 URL → 只打标 + 报成本。
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ---- Types ----

export type StorageTier = 'COS_STANDARD' | 'COS_STANDARD_IA' | 'COS_ARCHIVE' | 'COS_DEEP_ARCHIVE'

export interface StoragePolicy {
  storageTier: StorageTier
  policyVersion: number
  costPerGBPerMonth: number  // USD
  cosStorageClass: string
  description: string
}

export interface TieredAsset {
  assetId: string
  assetUrl: string
  dbType: string
  heatScore: number
  tier: string
  storageTier: StorageTier
  sizeBytes: number | null
  monthlyCost: number
}

export interface CostReport {
  totalAssets: number
  totalEstimatedMonthlyCost: number
  byTier: {
    [tier: string]: {
      count: number
      totalCost: number
      totalBytes: number
    }
  }
  byStorageTier: {
    [storageTier: string]: {
      count: number
      totalCost: number
      avgHeat: number
    }
  }
  breakEvenAnalysis: {
    coldOnlyCost: number
    allStandardCost: number
    monthlySavings: number
    savingsPercent: number
  }
}

// ---- Storage Tier Definitions ----

const STORAGE_POLICIES: Record<StorageTier, StoragePolicy> = {
  COS_STANDARD: {
    storageTier: 'COS_STANDARD',
    policyVersion: 1,
    costPerGBPerMonth: 0.024,  // ~$0.024/GB/mo
    cosStorageClass: 'STANDARD',
    description: '高频访问 — 标准存储',
  },
  COS_STANDARD_IA: {
    storageTier: 'COS_STANDARD_IA',
    policyVersion: 1,
    costPerGBPerMonth: 0.018,  // ~$0.018/GB/mo
    cosStorageClass: 'STANDARD_IA',
    description: '低频访问 — 低频存储',
  },
  COS_ARCHIVE: {
    storageTier: 'COS_ARCHIVE',
    policyVersion: 1,
    costPerGBPerMonth: 0.004,  // ~$0.004/GB/mo
    cosStorageClass: 'ARCHIVE',
    description: '归档 — 归档存储',
  },
  COS_DEEP_ARCHIVE: {
    storageTier: 'COS_DEEP_ARCHIVE',
    policyVersion: 1,
    costPerGBPerMonth: 0.002,  // ~$0.002/GB/mo
    cosStorageClass: 'DEEP_ARCHIVE',
    description: '深度归档 — 冷存储',
  },
}

// ---- Heat-to-Storage Mapping ----

function mapTierToStorage(tier: string): StorageTier {
  switch (tier) {
    case 'HOT':  return 'COS_STANDARD'
    case 'WARM': return 'COS_STANDARD_IA'
    case 'COLD': return 'COS_ARCHIVE'
    default:     return 'COS_STANDARD_IA'
  }
}

// ---- Cost Estimation ----

function estimateMonthlyCost(tier: StorageTier, sizeBytes: number): number {
  const sizeGB = sizeBytes / (1024 * 1024 * 1024)
  const policy = STORAGE_POLICIES[tier]
  return sizeGB * policy.costPerGBPerMonth
}

// ---- DB Operations ----

async function migrateStorageColumns(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      BEGIN
        ALTER TABLE asset_heat_index ADD COLUMN storage_tier VARCHAR(16) DEFAULT 'COS_STANDARD_IA';
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END;
      BEGIN
        ALTER TABLE asset_heat_index ADD COLUMN storage_policy_version INT DEFAULT 1;
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END;
      BEGIN
        ALTER TABLE asset_heat_index ADD COLUMN estimated_monthly_cost DOUBLE PRECISION DEFAULT 0.0;
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END;
      BEGIN
        ALTER TABLE asset_heat_index ADD COLUMN size_bytes BIGINT DEFAULT 0;
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END;
    END $$;
  `)
  console.log('[R9.3] ✅ Storage columns added to asset_heat_index')
}

async function fetchAllHeatRecords(): Promise<any[]> {
  return await prisma.$queryRawUnsafe(`
    SELECT asset_id, asset_url, db_type, heat_score, tier, COALESCE(size_bytes, 0) as size_bytes
    FROM asset_heat_index
    ORDER BY heat_score DESC
  `) as any[]
}

async function applyStoragePolicies(records: any[]): Promise<number> {
  let updated = 0

  for (const rec of records) {
    const storageTier = mapTierToStorage(rec.tier)
    const monthlyCost = estimateMonthlyCost(storageTier, Number(rec.size_bytes) || 0)

    await prisma.$executeRawUnsafe(
      `UPDATE asset_heat_index
       SET storage_tier = $1, storage_policy_version = 1, estimated_monthly_cost = $2
       WHERE asset_id = $3`,
      storageTier,
      monthlyCost,
      rec.asset_id,
    )
    updated++
  }

  return updated
}

// ---- Lifecycle Simulation ----

interface LifecycleAction {
  days: number
  action: string
  targetStorageClass: string
}

function simulateCOSLifecyclePolicy(): LifecycleAction[] {
  return [
    { days: 7,  action: 'transition', targetStorageClass: 'STANDARD_IA' },
    { days: 30, action: 'transition', targetStorageClass: 'ARCHIVE' },
  ]
}

// ---- Cost Report ----

async function generateCostReport(): Promise<CostReport> {
  const records = await prisma.$queryRawUnsafe(`
    SELECT
      tier,
      storage_tier,
      COUNT(*)::int as count,
      COALESCE(AVG(heat_score), 0)::double precision as avg_heat,
      SUM(COALESCE(estimated_monthly_cost, 0))::double precision as total_cost,
      SUM(COALESCE(size_bytes, 0))::bigint as total_bytes
    FROM asset_heat_index
    GROUP BY tier, storage_tier
    ORDER BY tier
  `) as any[]

  const byTier: CostReport['byTier'] = {}
  const byStorageTier: CostReport['byStorageTier'] = {}
  let totalCost = 0
  let totalAssets = 0

  for (const row of records) {
    const t = row.tier as string
    const st = row.storage_tier as string
    const count = Number(row.count)
    const cost = Number(row.total_cost)
    const bytes = Number(row.total_bytes)
    const avgHeat = Number(row.avg_heat)

    byTier[t] = { count, totalCost: cost, totalBytes: bytes }
    byStorageTier[st] = { count, totalCost: cost, avgHeat }
    totalCost += cost
    totalAssets += count
  }

  // Break-even analysis
  const allStandardCost = totalCost * (0.024 / 0.018) // rough extrapolation
  const coldOnlyCost = totalCost * (0.004 / 0.018)
  const savings = allStandardCost - totalCost
  const savingsPercent = allStandardCost > 0 ? (savings / allStandardCost) * 100 : 0

  return {
    totalAssets,
    totalEstimatedMonthlyCost: totalCost,
    byTier,
    byStorageTier,
    breakEvenAnalysis: {
      coldOnlyCost,
      allStandardCost,
      monthlySavings: savings,
      savingsPercent,
    },
  }
}

// ---- Main ----

export async function applyStoragePolicy(): Promise<CostReport> {
  console.log('='.repeat(70))
  console.log('[R9.3] 🧊 Storage Policy Layer — 冷热分层执行')
  console.log('='.repeat(70))
  const startTime = Date.now()

  // Step 1: Migrate columns
  console.log('\n[Step 1] Ensuring storage columns...')
  await migrateStorageColumns()

  // Step 2: Fetch heat records
  console.log('[Step 2] Fetching asset heat records...')
  const records = await fetchAllHeatRecords()
  console.log(`  Found: ${records.length} records`)

  // Step 3: Apply storage policies
  console.log('[Step 3] Applying storage policies (tier → storage mapping)...')
  const updated = await applyStoragePolicies(records)
  console.log(`  Updated: ${updated} assets`)
  console.log(`  Mapping:`)
  console.log(`    HOT  → COS_STANDARD    ($0.024/GB/mo)`)
  console.log(`    WARM → COS_STANDARD_IA ($0.018/GB/mo)`)
  console.log(`    COLD → COS_ARCHIVE     ($0.004/GB/mo)`)

  // Step 4: Simulate lifecycle policy
  console.log('\n[Step 4] Lifecycle simulation (dry-run):')
  const lifecycle = simulateCOSLifecyclePolicy()
  for (const action of lifecycle) {
    console.log(`  → Day ${action.days}: ${action.action} to ${action.targetStorageClass}`)
  }
  console.log('  ⚠️  NOT applied to COS — mark-only mode')

  // Step 5: Cost report
  console.log('\n[Step 5] Generating cost report...')
  const report = await generateCostReport()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '='.repeat(70))
  console.log('[R9.3] 📊 Cost Report')
  console.log('='.repeat(70))
  console.log(`  Total assets: ${report.totalAssets}`)
  console.log(`  Estimated monthly COS cost: $${report.totalEstimatedMonthlyCost.toFixed(4)}`)
  console.log(`  Elapsed: ${elapsed}s`)
  console.log()

  for (const [tier, data] of Object.entries(report.byTier)) {
    console.log(`  ${tier}: ${data.count} assets, $${data.totalCost.toFixed(4)}/mo`)
  }
  console.log()
  console.log(`  Break-even analysis:`)
  console.log(`    All on STANDARD:    $${report.breakEvenAnalysis.allStandardCost.toFixed(4)}/mo`)
  console.log(`    Current (tiered):   $${report.totalEstimatedMonthlyCost.toFixed(4)}/mo`)
  console.log(`    Savings:            $${report.breakEvenAnalysis.monthlySavings.toFixed(4)}/mo (${report.breakEvenAnalysis.savingsPercent.toFixed(1)}%)`)
  console.log('='.repeat(70))

  return report
}

// CLI
async function main() {
  const report = await applyStoragePolicy()
  console.log('\n[R9.3] ✅ Storage policy complete')
  process.exit(0)
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}
