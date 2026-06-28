/**
 * jobs/orphan-scan.job.ts
 *
 * R9.4 — Orphan Mark-Only GC
 *
 * 安全孤儿检测：扫描 COS 资产与 DB 引用的差异。
 * 三不原则深化版：不删除、不迁移、不改 COS object。
 * 只做标记 + 报告。
 */

import { PrismaClient } from '@prisma/client'
import path from 'node:path'
import fs from 'node:fs'

const prisma = new PrismaClient()

// ---- Types ----

export type OrphanStatus = 'ORPHAN_MARKED' | 'HOT_PROTECTED' | 'WARM_DEFERRED' | 'RESOLVED' | 'FALSE_POSITIVE'

export interface OrphanRecord {
  assetId?: string
  url: string
  detectedAt: Date
  reason: string
  status: OrphanStatus
  heatScore?: number
  tier?: string
  scanCount: number
}

export interface OrphanScanReport {
  scannedAt: Date
  totalScanned: number
  orphanDetected: number
  hotProtected: number
  warmDeferred: number
  falsePositive: number
  previouslyResolved: number
  records: OrphanRecord[]
  protectionSummary: {
    hotAssetsSkipped: string[]
    warmAssetsDeferred: string[]
  }
}

// ---- Orphan Registry Table ----

async function ensureOrphanTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS asset_orphan_registry (
      id          SERIAL PRIMARY KEY,
      url         TEXT NOT NULL,
      asset_id    VARCHAR(64),
      detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
      reason      TEXT NOT NULL DEFAULT '',
      status      VARCHAR(32) NOT NULL DEFAULT 'ORPHAN_MARKED',
      heat_score  DOUBLE PRECISION DEFAULT 0,
      tier        VARCHAR(8) DEFAULT 'UNKNOWN',
      scan_count  INTEGER DEFAULT 1,
      UNIQUE(url)
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_orphan_status ON asset_orphan_registry (status)
  `)
  console.log('[R9.4] ✅ asset_orphan_registry table ready')
}

// ---- Core Orphan Detection ----

async function collectDBAssetUrls(): Promise<Set<string>> {
  const urls = new Set<string>()

  const ci = await prisma.characterImage.findMany({ select: { imageUrl: true } })
  for (const r of ci) if (r.imageUrl) urls.add(r.imageUrl)

  const si = await prisma.sceneImage.findMany({ select: { imageUrl: true } })
  for (const r of si) if (r.imageUrl) urls.add(r.imageUrl)

  const sbi = await prisma.storyboardImage.findMany({ select: { imageUrl: true } })
  for (const r of sbi) if (r.imageUrl) urls.add(r.imageUrl)

  const pi = await prisma.propImage.findMany({ select: { imageUrl: true } })
  for (const r of pi) if (r.imageUrl && r.imageUrl !== '' && r.imageUrl !== 'PENDING_REGEN') urls.add(r.imageUrl)

  return urls
}

async function getCOSAssetsFromIndex(): Promise<any[]> {
  return await prisma.$queryRawUnsafe(`
    SELECT asset_id, asset_url, heat_score, tier, size_bytes
    FROM asset_heat_index
    ORDER BY heat_score DESC
  `) as any[]
}

async function getExistingOrphans(): Promise<Map<string, OrphanStatus>> {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT url, status FROM asset_orphan_registry
  `) as any[]

  const map = new Map<string, OrphanStatus>()
  for (const row of rows) {
    map.set(row.url, row.status as OrphanStatus)
  }
  return map
}

// ---- Main ----

export async function runOrphanScan(): Promise<OrphanScanReport> {
  console.log('='.repeat(70))
  console.log('[R9.4] 🧹 Orphan Scan — 安全孤儿检测')
  console.log('='.repeat(70))
  const startTime = Date.now()

  // Step 1: Ensure tables
  console.log('\n[Step 1] Ensuring registry table...')
  await ensureOrphanTable()

  // Step 2: Gather DB reference URLs
  console.log('[Step 2] Gathering DB asset URLs...')
  const dbUrls = await collectDBAssetUrls()
  console.log(`  DB has ${dbUrls.size} unique asset URLs`)

  // Step 3: Gather COS URLs from heat index
  console.log('[Step 3] Gathering COS assets from heat index...')
  const cosAssets = await getCOSAssetsFromIndex()
  console.log(`  Heat index has ${cosAssets.length} COS assets`)

  // Step 4: Cross-reference
  console.log('[Step 4] Cross-referencing COS ↔ DB...')
  const existingOrphans = await getExistingOrphans()

  const report: OrphanScanReport = {
    scannedAt: new Date(),
    totalScanned: cosAssets.length,
    orphanDetected: 0,
    hotProtected: 0,
    warmDeferred: 0,
    falsePositive: 0,
    previouslyResolved: 0,
    records: [],
    protectionSummary: { hotAssetsSkipped: [], warmAssetsDeferred: [] },
  }

  for (const asset of cosAssets) {
    const url: string = asset.asset_url
    const heatScore: number = Number(asset.heat_score || 0)
    const tier: string = asset.tier || 'UNKNOWN'
    const assetId: string = asset.asset_id

    // Check if URL exists in DB
    const inDB = dbUrls.has(url)

    // Check existing orphan status
    const existingStatus = existingOrphans.get(url)

    // If URL exists in DB → not orphan
    if (inDB) {
      if (existingStatus === 'ORPHAN_MARKED') {
        // Previously marked orphan, now resolved
        await prisma.$executeRawUnsafe(
          `UPDATE asset_orphan_registry SET status = 'RESOLVED', scan_count = scan_count + 1 WHERE url = $1`,
          url,
        )
        report.previouslyResolved++
      }
      continue
    }

    // URL not in DB — potential orphan

    // HOT assets are protected
    if (tier === 'HOT' || heatScore > 0.7) {
      report.hotProtected++
      report.protectionSummary.hotAssetsSkipped.push(`${assetId.slice(0, 8)} (heat=${heatScore.toFixed(3)})`)
      continue
    }

    // WARM assets need deferral
    if (tier === 'WARM' || heatScore > 0.3) {
      report.warmDeferred++
      report.protectionSummary.warmAssetsDeferred.push(`${assetId.slice(0, 8)} (heat=${heatScore.toFixed(3)})`)

      // Update existing or mark as WARM_DEFERRED
      if (existingStatus) {
        if (existingStatus !== 'RESOLVED') {
          await prisma.$executeRawUnsafe(
            `UPDATE asset_orphan_registry SET status = 'WARM_DEFERRED', scan_count = scan_count + 1 WHERE url = $1`,
            url,
          )
        }
      }
      continue
    }

    // COLD — can be marked as orphan
    report.orphanDetected++
    const reason = `COS asset without DB reference (tier=${tier}, heat=${heatScore.toFixed(3)})`

    const record: OrphanRecord = {
      url,
      assetId,
      detectedAt: new Date(),
      reason,
      status: 'ORPHAN_MARKED',
      heatScore,
      tier,
      scanCount: existingStatus ? 2 : 1,
    }
    report.records.push(record)

    // Upsert to orphan registry
    if (existingStatus === 'ORPHAN_MARKED') {
      await prisma.$executeRawUnsafe(
        `UPDATE asset_orphan_registry SET scan_count = scan_count + 1, detected_at = $1 WHERE url = $2`,
        new Date(),
        url,
      )
    } else if (existingStatus === 'FALSE_POSITIVE') {
      report.falsePositive++
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO asset_orphan_registry (url, asset_id, reason, status, heat_score, tier, scan_count)
         VALUES ($1, $2, $3, 'ORPHAN_MARKED', $4, $5, 1)
         ON CONFLICT (url) DO NOTHING`,
        url,
        assetId,
        reason,
        heatScore,
        tier,
      )
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // Report
  console.log('\n' + '='.repeat(70))
  console.log('[R9.4] 📊 Orphan Scan Report')
  console.log('='.repeat(70))
  console.log(`  Scan time: ${elapsed}s`)
  console.log(`  Total COS assets scanned: ${report.totalScanned}`)
  console.log(`  Orphan detected (COLD, no DB ref): ${report.orphanDetected}`)
  console.log(`  HOT protected (skipped):           ${report.hotProtected}`)
  console.log(`  WARM deferred (2nd scan needed):   ${report.warmDeferred}`)
  console.log(`  Previously resolved:               ${report.previouslyResolved}`)
  console.log(`  False positives:                   ${report.falsePositive}`)

  if (report.orphanDetected > 0) {
    console.log(`\n  🟡 Orphan assets:`)
    for (const r of report.records.slice(0, 10)) {
      console.log(`    ${r.assetId?.slice(0, 8) || '???'} heat=${r.heatScore?.toFixed(3)} tier=${r.tier}`)
    }
    if (report.records.length > 10) {
      console.log(`    ... and ${report.records.length - 10} more`)
    }
  }

  if (report.hotProtected > 0) {
    console.log(`\n  🔥 Hot protected:`)
    for (const s of report.protectionSummary.hotAssetsSkipped.slice(0, 5)) {
      console.log(`    ${s}`)
    }
  }

  // Save report
  const reportDir = path.join(__dirname, '../../reports')
  fs.mkdirSync(reportDir, { recursive: true })
  const dateStr = new Date().toISOString().slice(0, 10)
  const rpath = path.join(reportDir, `orphan-scan-${dateStr}.json`)
  fs.writeFileSync(rpath, JSON.stringify({
    scannedAt: report.scannedAt,
    totalScanned: report.totalScanned,
    orphanDetected: report.orphanDetected,
    hotProtected: report.hotProtected,
    warmDeferred: report.warmDeferred,
    previouslyResolved: report.previouslyResolved,
    falsePositive: report.falsePositive,
    records: report.records.slice(0, 50), // limit to 50 for report size
    protectionSummary: report.protectionSummary,
    elapsed,
  }, null, 2))

  console.log(`\n  Report saved: ${rpath}`)
  console.log('='.repeat(70))

  return report
}

// CLI
async function main() {
  const report = await runOrphanScan()
  console.log('\n[R9.4] ✅ Orphan scan complete')
  process.exit(0)
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}
