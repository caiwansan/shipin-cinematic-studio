/**
 * jobs/populate-asset-sizes.v2.ts
 *
 * R9.3 — 直接从 Truth Graph 的完整资产数据回填 size_bytes
 * 使用未脱敏的数据源（直接从在线扫描获取）
 */

import { PrismaClient } from '@prisma/client'
import https from 'node:https'
import http from 'node:http'

const prisma = new PrismaClient()

interface TempAsset {
  url: string
  dbType: string
  dbId: string
  size: number
  hash: string
}

async function fetchAssetSize(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http
    const req = protocol.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
      const len = res.headers['content-length']
      resolve(len ? parseInt(len, 10) : null)
    })
    req.on('error', () => resolve(null))
    req.setTimeout(5000, () => { req.destroy(); resolve(null) })
    req.end()
  })
}

async function getAssetsWithUrls(): Promise<TempAsset[]> {
  // This is tricky because we need actual URLs. Let's reconstruct from DB.
  const results: TempAsset[] = []

  const ci = await prisma.characterImage.findMany({
    select: { id: true, imageUrl: true },
    where: { imageUrl: { contains: '.cos.' } },
  })
  for (const img of ci) {
    if (!img.imageUrl) continue
    results.push({ url: img.imageUrl, dbType: 'character_image', dbId: img.id, size: 0, hash: '' })
  }

  const si = await prisma.sceneImage.findMany({
    select: { id: true, imageUrl: true },
    where: { imageUrl: { contains: '.cos.' } },
  })
  for (const img of si) {
    if (!img.imageUrl) continue
    results.push({ url: img.imageUrl, dbType: 'scene_image', dbId: img.id, size: 0, hash: '' })
  }

  const sbi = await prisma.storyboardImage.findMany({
    select: { id: true, imageUrl: true },
    where: { imageUrl: { contains: '.cos.' } },
  })
  for (const img of sbi) {
    if (!img.imageUrl) continue
    results.push({ url: img.imageUrl, dbType: 'storyboard_image', dbId: img.id, size: 0, hash: '' })
  }

  return results
}

async function main() {
  console.log('[R9.3] 📏 Populating asset sizes (HEAD requests)...')

  const assets = await getAssetsWithUrls()
  console.log(`  Found ${assets.length} COS assets in DB`)

  let updated = 0
  let failed = 0
  let totalBytes = 0

  // Batch HEAD requests (COS HEAD is fast, allow parallelism)
  const batchSize = 20
  for (let i = 0; i < assets.length; i += batchSize) {
    const batch = assets.slice(i, i + batchSize)
    const promises = batch.map(async (asset) => {
      const size = await fetchAssetSize(asset.url)
      if (size !== null) {
        asset.size = size
        return { id: asset.dbId, size }
      }
      return null
    })

    const results = await Promise.all(promises)
    for (const r of results) {
      if (r) {
        await prisma.$executeRawUnsafe(
          `UPDATE asset_heat_index SET size_bytes = $1 WHERE asset_id = $2`,
          r.size,
          r.id,
        )
        updated++
        totalBytes += r.size
      } else {
        failed++
      }
    }

    if ((i + batchSize) % 40 === 0 || i + batchSize >= assets.length) {
      process.stdout.write(`\r  Progress: ${Math.min(i + batchSize, assets.length)}/${assets.length} (updated: ${updated}, failed: ${failed})`)
    }
  }

  console.log()

  // Recalculate costs
  await prisma.$executeRawUnsafe(`
    UPDATE asset_heat_index
    SET estimated_monthly_cost = 
      CASE 
        WHEN storage_tier = 'COS_STANDARD'    THEN (COALESCE(size_bytes, 0)::float / 1073741824) * 0.024
        WHEN storage_tier = 'COS_STANDARD_IA' THEN (COALESCE(size_bytes, 0)::float / 1073741824) * 0.018
        WHEN storage_tier = 'COS_ARCHIVE'     THEN (COALESCE(size_bytes, 0)::float / 1073741824) * 0.004
        ELSE 0
      END
  `)

  const summary = await prisma.$queryRawUnsafe(`
    SELECT 
      SUM(size_bytes)::bigint as total_bytes,
      SUM(estimated_monthly_cost)::double precision as total_cost,
      COUNT(*)::int as total
    FROM asset_heat_index
  `) as any[]

  const tb = Number(summary[0]?.total_bytes || 0)
  const tc = Number(summary[0]?.total_cost || 0)
  const count = Number(summary[0]?.total || 0)

  const totalGB = tb / (1024 * 1024 * 1024)

  console.log(`\n[R9.3] 📊 Final cost report:`)
  console.log(`  Assets: ${count}`)
  console.log(`  Total bytes: ${tb} (${(tb / (1024*1024)).toFixed(2)} MB, ${totalGB.toFixed(6)} GB)`)
  console.log(`  Estimated monthly COS cost: $${tc.toFixed(6)}`)
  console.log(`  Average cost per asset: $${(tc / count).toFixed(8)}`)
  console.log('[R9.3] ✅ Done')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
