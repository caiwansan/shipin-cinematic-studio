/**
 * jobs/cos-truth-graph.job.ts
 *
 * R9.1 — COS Asset Truth Index（只读资产图谱）
 *
 * 构建真实资产图：扫描 DB + URL 分类，建立资产可见性视图。
 * 三不原则：不删除、不移动、不修改。
 *
 * 使用方式：
 *   npx tsx src/jobs/cos-truth-graph.job.ts          # 完整模式（含下载+hash）
 *   npx tsx src/jobs/cos-truth-graph.job.ts --sample  # 仅 DB 扫描
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'
import fs from 'node:fs'
import https from 'node:https'
import http from 'node:http'
import path from 'node:path'
import os from 'node:os'

const prisma = new PrismaClient()

interface AssetNode {
  url: string
  existsInDB: boolean
  dbType: 'character_image' | 'scene_image' | 'storyboard_image' | 'prop_image' | null
  dbId: string | null
  size: number | null
  hash: string | null
  tier: 'COS' | 'LOCAL' | 'THIRD_PARTY' | 'UNKNOWN'
  status: 'ACTIVE' | 'HEALTHY' | 'UNREACHABLE' | 'LOCAL_FOUND' | 'LOCAL_MISSING'
  notes: string[]
}

async function downloadToTemp(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http
    const req = protocol.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        resolve(null)
        return
      }
      const chunks: Buffer[] = []
      let totalSize = 0
      res.on('data', (chunk: Buffer) => {
        totalSize += chunk.length
        if (totalSize > 50 * 1024 * 1024) { req.destroy(); resolve(null); return }
        chunks.push(chunk)
      })
      res.on('end', () => {
        if (chunks.length === 0) { resolve(null); return }
        resolve(Buffer.concat(chunks))
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(8000, () => { req.destroy(); resolve(null) })
  })
}

function classifyUrl(url: string): 'COS' | 'LOCAL' | 'THIRD_PARTY' | 'UNKNOWN' {
  if (url.includes('.cos.') || url.includes('.myqcloud.com')) return 'COS'
  if (url.startsWith('/') || url.startsWith('file://')) return 'LOCAL'
  if (url.includes('volces.com') || url.includes('aliyuncs.com')) return 'THIRD_PARTY'
  return 'UNKNOWN'
}

async function main() {
  console.log('='.repeat(70))
  console.log('[R9.1] 🔍 COS Asset Truth Graph — 只读资产图谱构建')
  console.log('='.repeat(70))

  const mode = process.argv.includes('--sample') ? 'SAMPLE' : 'FULL'
  console.log(`Mode: ${mode}\n`)
  const startTime = Date.now()

  // Phase 1: Scan all image tables
  console.log('[Phase 1] Scanning database...')
  const allAssets: AssetNode[] = []

  const ci = await prisma.characterImage.findMany({
    select: { id: true, imageUrl: true, variant: true, createdAt: true },
  })
  for (const img of ci) {
    if (!img.imageUrl || img.imageUrl === '') continue
    allAssets.push({
      url: img.imageUrl,
      existsInDB: true,
      dbType: 'character_image',
      dbId: img.id,
      size: null,
      hash: null,
      tier: classifyUrl(img.imageUrl),
      status: 'ACTIVE',
      notes: [`variant:${img.variant}`, `created:${img.createdAt.toISOString().slice(0,10)}`],
    })
  }
  console.log(`  character_image: ${ci.length}`)

  const si = await prisma.sceneImage.findMany({
    select: { id: true, imageUrl: true, createdAt: true },
    
  })
  for (const img of si) {
    if (!img.imageUrl || img.imageUrl === '') continue
    allAssets.push({
      url: img.imageUrl,
      existsInDB: true,
      dbType: 'scene_image',
      dbId: img.id,
      size: null,
      hash: null,
      tier: classifyUrl(img.imageUrl),
      status: 'ACTIVE',
      notes: [`created:${img.createdAt.toISOString().slice(0,10)}`],
    })
  }
  console.log(`  scene_image: ${si.length}`)

  const sbi = await prisma.storyboardImage.findMany({
    select: { id: true, imageUrl: true, createdAt: true },
    
  })
  for (const img of sbi) {
    if (!img.imageUrl || img.imageUrl === '') continue
    allAssets.push({
      url: img.imageUrl,
      existsInDB: true,
      dbType: 'storyboard_image',
      dbId: img.id,
      size: null,
      hash: null,
      tier: classifyUrl(img.imageUrl),
      status: 'ACTIVE',
      notes: [`created:${img.createdAt.toISOString().slice(0,10)}`],
    })
  }
  console.log(`  storyboard_image: ${si.length}`)

  const pi = await prisma.propImage.findMany({
    select: { id: true, imageUrl: true, createdAt: true },
  })
  const pendingRegen: string[] = []
  for (const img of pi) {
    if (!img.imageUrl || img.imageUrl === 'PENDING_REGEN') {
      if (img.imageUrl === 'PENDING_REGEN') pendingRegen.push(img.id)
      continue
    }
    allAssets.push({
      url: img.imageUrl,
      existsInDB: true,
      dbType: 'prop_image',
      dbId: img.id,
      size: null,
      hash: null,
      tier: classifyUrl(img.imageUrl),
      status: 'ACTIVE',
      notes: [`created:${img.createdAt.toISOString().slice(0,10)}`],
    })
  }
  console.log(`  prop_image: ${pi.length} (${pendingRegen.length} PENDING_REGEN)`)

  console.log(`\n  Total assets: ${allAssets.length}`)

  // Phase 2: URL Classification
  console.log('\n[Phase 2] URL classification...')
  const byTier: Record<string, AssetNode[]> = { COS: [], LOCAL: [], THIRD_PARTY: [], UNKNOWN: [] }
  for (const a of allAssets) {
    byTier[a.tier]?.push(a) || byTier.UNKNOWN.push(a)
  }

  for (const [tier, assets] of Object.entries(byTier)) {
    const deduped = new Set(assets.map(a => a.url))
    console.log(`  ${tier}: ${assets.length} records (${deduped.size} unique URLs)`)
  }

  // Phase 3: Full health check
  if (mode === 'FULL') {
    console.log('\n[Phase 3] Asset health check (download + SHA256)...')

    const cosAssets = byTier.COS
    let healthy = 0
    let failed = 0

    for (let i = 0; i < cosAssets.length; i++) {
      const asset = cosAssets[i]
      const buffer = await downloadToTemp(asset.url)
      if (buffer) {
        asset.hash = crypto.createHash('sha256').update(buffer).digest('hex')
        asset.size = buffer.length
        asset.status = 'HEALTHY'
        healthy++
      } else {
        asset.status = 'UNREACHABLE'
        asset.notes.push('❌ download failed / expired')
        failed++
      }
      if ((i + 1) % 10 === 0 || i === cosAssets.length - 1) {
        process.stdout.write(`\r  Progress: ${i + 1}/${cosAssets.length} (healthy: ${healthy}, failed: ${failed})`)
      }
    }
    console.log()

    // Check local files
    console.log('[Phase 3b] Local file check...')
    let localFound = 0
    let localMissing = 0
    for (const asset of byTier.LOCAL) {
      if (fs.existsSync(asset.url)) {
        const stat = fs.statSync(asset.url)
        asset.size = stat.size
        asset.status = 'LOCAL_FOUND'
        localFound++
      } else {
        asset.status = 'LOCAL_MISSING'
        asset.notes.push('❌ file not found on disk')
        localMissing++
      }
    }
    console.log(`  Found: ${localFound}, Missing: ${localMissing}`)
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '='.repeat(70))
  console.log('[R9.1] 📊 Truth Graph Summary')
  console.log('='.repeat(70))
  console.log(`  Scan time: ${elapsed}s`)
  console.log(`  Total DB assets: ${allAssets.length}`)
  console.log(`  COS URLs:       ${byTier.COS.length}`)
  console.log(`  Local paths:    ${byTier.LOCAL.length}`)
  console.log(`  Third-party:    ${byTier.THIRD_PARTY.length}`)
  console.log(`  Unknown:        ${byTier.UNKNOWN.length}`)
  console.log(`  Prop PENDING_REGEN: ${pendingRegen.length}`)

  if (mode === 'FULL') {
    const healthy = byTier.COS.filter(a => a.status === 'HEALTHY').length
    const unreachable = byTier.COS.filter(a => a.status === 'UNREACHABLE').length
    const localFound = byTier.LOCAL.filter(a => a.status === 'LOCAL_FOUND').length
    const localMissing = byTier.LOCAL.filter(a => a.status === 'LOCAL_MISSING').length
    console.log(`  COS healthy:    ${healthy}`)
    console.log(`  COS unreachable: ${unreachable}`)
    console.log(`  Local on disk:  ${localFound}`)
    console.log(`  Local missing:  ${localMissing}`)
  }

  // Save report
  const reportDir = path.join(__dirname, '../../reports')
  fs.mkdirSync(reportDir, { recursive: true })
  const dateStr = new Date().toISOString().slice(0, 10)
  const reportPath = path.join(reportDir, `truth-graph-${dateStr}.json`)

  // Redact URLs for the report
  const redacted = allAssets.map((a) => ({
    ...a,
    url: a.url.length > 60 ? a.url.slice(0, 35) + '...' + a.url.slice(-20) : a.url,
  }))

  fs.writeFileSync(reportPath, JSON.stringify({
    summary: {
      scannedAt: new Date().toISOString(),
      total: allAssets.length,
      cos: byTier.COS.length,
      local: byTier.LOCAL.length,
      thirdParty: byTier.THIRD_PARTY.length,
      pendingRegen: pendingRegen.length,
      mode,
      elapsed,
    },
    byTier: {
      COS: byTier.COS.length,
      LOCAL: byTier.LOCAL.length,
      THIRD_PARTY: byTier.THIRD_PARTY.length,
      UNKNOWN: byTier.UNKNOWN.length,
    },
    assets: redacted,
  }, null, 2))

  console.log(`\n  Report saved: ${reportPath}`)
  console.log('='.repeat(70))
}

main()
  .catch(e => { console.error('[R9.1] Failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
