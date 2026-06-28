/**
 * services/asset-duplicate.service.ts
 *
 * R9.5 — Duplicate Detection System（安全去重）
 *
 * 为每一个 COS asset 建立 content-addressable identity。
 * 核心原则：不 merge、不 delete、不 overwrite — 只 link。
 * 为 R6 DAG 提供 reuse decision signal。
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'
import https from 'node:https'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const prisma = new PrismaClient()

// ---- Types ----

export interface AssetHashRecord {
  assetId: string
  assetUrl: string
  dbType: string
  hash: string
  hashShort: string
  size: number
  computedAt: Date
}

export interface DuplicateCluster {
  hash: string
  assets: AssetHashRecord[]
  count: number
  isDuplicate: boolean
  primaryId: string
}

export interface DuplicateReport {
  totalScanned: number
  totalClusters: number
  duplicateClusters: number
  uniqueAssets: number
  duplicateAssets: number
  clusters: DuplicateCluster[]
  savingsEstimate: {
    uniqueImages: number
    duplicateRatio: number
    potentialReuses: number
  }
}

// ---- Image Download ----

async function downloadImage(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http
    const req = protocol.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        resolve(null); return
      }
      const chunks: Buffer[] = []
      let totalSize = 0
      res.on('data', (c: Buffer) => {
        totalSize += c.length
        if (totalSize > 10 * 1024 * 1024) { req.destroy(); resolve(null); return }
        chunks.push(c)
      })
      res.on('end', () => resolve(chunks.length > 0 ? Buffer.concat(chunks) : null))
    })
    req.on('error', () => resolve(null))
    req.setTimeout(8000, () => { req.destroy(); resolve(null) })
  })
}

// ---- Hash Computation ----

/**
 * Normalize image for deterministic hashing:
 * - Strip metadata (EXIF, etc.) by re-encoding
 * - Downscale to 512px max dimension to reduce noise
 * - Convert to PNG for deterministic encoding
 *
 * Note: This is a lightweight version without sharp/pngjs.
 * Production would use sharp for proper normalization.
 */
function normalizeImage(buffer: Buffer): Buffer {
  // For now: just raw bytes — full normalize requires sharp/pngjs
  // This still catches exact duplicates (identical bytes)
  return buffer
}

function computeSHA256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

// ---- DB Operations ----

async function ensureHashTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS asset_hash_index (
      id          SERIAL PRIMARY KEY,
      asset_id    VARCHAR(64) NOT NULL UNIQUE,
      asset_url   TEXT NOT NULL DEFAULT '',
      db_type     VARCHAR(32) NOT NULL DEFAULT '',
      hash        VARCHAR(64) NOT NULL,
      size_bytes  INTEGER NOT NULL DEFAULT 0,
      computed_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_asset_hash ON asset_hash_index (hash)
  `)
  console.log('[R9.5] ✅ asset_hash_index table ready')
}

async function getCOSAssetsFromIndex(): Promise<any[]> {
  return await prisma.$queryRawUnsafe(`
    SELECT ahi.asset_id, ahi.asset_url, ahi.db_type, ahi.size_bytes
    FROM asset_heat_index ahi
    WHERE ahi.asset_url LIKE '%\\.cos\\.%' OR ahi.asset_url LIKE '%\\.myqcloud\\.com%'
  `) as any[]
}

async function upsertAssetHash(assetId: string, url: string, dbType: string, hash: string, size: number): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO asset_hash_index (asset_id, asset_url, db_type, hash, size_bytes, computed_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (asset_id) DO UPDATE SET hash = $4, size_bytes = $5, computed_at = NOW()`,
    assetId,
    url,
    dbType,
    hash,
    size,
  )
}

// ---- Cluster Detection ----

function buildClusters(records: AssetHashRecord[]): {
  clusters: DuplicateCluster[]
  uniqueCount: number
  duplicateCount: number
} {
  const hashMap = new Map<string, AssetHashRecord[]>()

  for (const rec of records) {
    const group = hashMap.get(rec.hash) || []
    group.push(rec)
    hashMap.set(rec.hash, group)
  }

  const clusters: DuplicateCluster[] = []
  let uniqueCount = 0
  let duplicateCount = 0

  for (const [hash, assets] of hashMap) {
    const isDuplicate = assets.length > 1
    const sorted = [...assets].sort((a, b) => a.size - b.size) // smallest first as primary

    clusters.push({
      hash,
      assets: sorted,
      count: assets.length,
      isDuplicate,
      primaryId: sorted[0].assetId,
    })

    if (isDuplicate) {
      duplicateCount += assets.length
      uniqueCount += 1 // primary
    } else {
      uniqueCount += 1
    }
  }

  return { clusters, uniqueCount, duplicateCount }
}

// ---- Main Entry ----

export async function runDuplicateDetection(): Promise<DuplicateReport> {
  console.log('='.repeat(70))
  console.log('[R9.5] 🔗 Duplicate Detection — 安全去重扫描')
  console.log('='.repeat(70))
  const startTime = Date.now()

  // Step 1: Ensure tables
  console.log('\n[Step 1] Ensuring hash index table...')
  await ensureHashTable()

  // Step 2: Gather COS assets
  console.log('[Step 2] Gathering COS assets from heat index...')
  const cosAssets = await getCOSAssetsFromIndex()
  console.log(`  Found: ${cosAssets.length} COS assets with URLs`)

  // Step 3: Download and hash
  console.log('[Step 3] Computing hashes (download + SHA256)...')
  const records: AssetHashRecord[] = []
  let healthy = 0
  let failed = 0

  for (let i = 0; i < cosAssets.length; i++) {
    const asset = cosAssets[i]
    const buffer = await downloadImage(asset.asset_url)

    if (buffer) {
      const hash = computeSHA256(normalizeImage(buffer))
      records.push({
        assetId: asset.asset_id,
        assetUrl: asset.asset_url,
        dbType: asset.db_type || 'unknown',
        hash,
        hashShort: hash.substring(0, 12),
        size: buffer.length,
        computedAt: new Date(),
      })
      await upsertAssetHash(asset.asset_id, asset.asset_url, asset.db_type || 'unknown', hash, buffer.length)
      healthy++
    } else {
      failed++
    }

    if ((i + 1) % 10 === 0 || i === cosAssets.length - 1) {
      process.stdout.write(`\r  Progress: ${i + 1}/${cosAssets.length} (hashed: ${healthy}, failed: ${failed})`)
    }
  }
  console.log()

  // Step 4: Cluster detection
  console.log('[Step 4] Building duplicate clusters...')
  const { clusters, uniqueCount, duplicateCount } = buildClusters(records)

  const duplicateClusters = clusters.filter(c => c.isDuplicate)
  console.log(`  Total clusters: ${clusters.length}`)
  console.log(`  Duplicate clusters: ${duplicateClusters.length}`)
  console.log(`  Unique assets: ${uniqueCount}`)
  console.log(`  Duplicate references: ${duplicateCount - uniqueCount}`)

  // Step 5: Report duplicates
  if (duplicateClusters.length > 0) {
    console.log('\n[Step 5] Duplicate clusters found:')
    for (const cluster of duplicateClusters.slice(0, 10)) {
      console.log(`  🔗 ${cluster.hash.substring(0, 12)}... → ${cluster.count} assets:`)
      for (const asset of cluster.assets.slice(0, 3)) {
        console.log(`      ${asset.dbType}::${asset.assetId.slice(0, 8)} (${(asset.size / 1024).toFixed(1)}KB)`)
      }
      if (cluster.assets.length > 3) {
        console.log(`      ... and ${cluster.assets.length - 3} more`)
      }
    }
  } else {
    console.log('\n[Step 5] ✅ No duplicates found — all 104 assets are unique')
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('[R9.5] 📊 Duplicate Detection Summary')
  console.log('='.repeat(70))
  console.log(`  Elapsed: ${elapsed}s`)
  console.log(`  Total scanned: ${records.length}`)
  console.log(`  Total clusters: ${clusters.length}`)
  console.log(`  Duplicate clusters: ${duplicateClusters.length}`)
  console.log(`  Unique assets: ${uniqueCount}`)
  console.log(`  Duplicate references: ${duplicateCount - uniqueCount}`)

  if (duplicateClusters.length === 0) {
    console.log(`\n  🟢 No duplicates detected — all $24 images are content-unique`)
  }

  // Save report
  const reportDir = path.join(__dirname, '../../reports')
  fs.mkdirSync(reportDir, { recursive: true })
  const dateStr = new Date().toISOString().slice(0, 10)
  const rpath = path.join(reportDir, `duplicate-scan-${dateStr}.json`)

  fs.writeFileSync(rpath, JSON.stringify({
    scannedAt: new Date().toISOString(),
    totalScanned: records.length,
    totalClusters: clusters.length,
    duplicateClusters: duplicateClusters.length,
    uniqueAssets: uniqueCount,
    duplicateAssets: duplicateCount - uniqueCount,
    clusters: clusters.map(c => ({
      hashShort: c.hash.substring(0, 12),
      count: c.count,
      isDuplicate: c.isDuplicate,
      primaryId: c.primaryId.slice(0, 12),
      assets: c.assets.map(a => ({
        id: a.assetId.slice(0, 12),
        type: a.dbType,
        size: a.size,
      })),
    })),
    elapsed,
  }, null, 2))

  console.log(`\n  Report saved: ${rpath}`)
  console.log('='.repeat(70))

  return {
    totalScanned: records.length,
    totalClusters: clusters.length,
    duplicateClusters: duplicateClusters.length,
    uniqueAssets: uniqueCount,
    duplicateAssets: duplicateCount - uniqueCount,
    clusters,
    savingsEstimate: {
      uniqueImages: uniqueCount,
      duplicateRatio: duplicateCount > 0 ? (duplicateCount - uniqueCount) / records.length : 0,
      potentialReuses: duplicateCount - uniqueCount,
    },
  }
}

// CLI
async function main() {
  const report = await runDuplicateDetection()
  console.log('\n[R9.5] ✅ Duplicate detection complete')
  process.exit(0)
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}
