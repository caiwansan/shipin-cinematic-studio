/**
 * jobs/populate-asset-sizes.ts
 *
 * R9.3 — 从 Truth Graph 报告回填 asset_heat_index 的 size_bytes
 */

import { PrismaClient } from '@prisma/client'
import path from 'node:path'
import fs from 'node:fs'

const prisma = new PrismaClient()

async function main() {
  console.log('[R9.3] 📏 Populating asset sizes from truth graph...')

  // Find latest truth graph report
  const reportDir = path.join(__dirname, '../../reports')
  const files = fs.readdirSync(reportDir).filter(f => f.startsWith('truth-graph-'))
  if (files.length === 0) {
    console.error('No truth graph report found. Run cos-truth-graph.job.ts first.')
    process.exit(1)
  }
  files.sort().reverse()
  const reportPath = path.join(reportDir, files[0])
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))

  let updated = 0
  let noMatch = 0

  for (const asset of report.assets) {
    if (!asset.size || asset.size === 0) continue
    // Match by truncated URL — use the original URL from the report
    const url = asset.url
    // Try to find by URL pattern matching in DB
    const result = await prisma.$executeRawUnsafe(
      `UPDATE asset_heat_index SET size_bytes = $1 WHERE asset_url LIKE $2`,
      asset.size,
      `%${url.slice(-40)}%`,
    )
    if (result > 0) {
      updated++
    } else {
      noMatch++
    }
  }

  // Calculate and update cost for all records
  await prisma.$executeRawUnsafe(`
    UPDATE asset_heat_index
    SET estimated_monthly_cost = 
      CASE 
        WHEN storage_tier = 'COS_STANDARD'    THEN (COALESCE(size_bytes, 0)::float / (1073741824)) * 0.024
        WHEN storage_tier = 'COS_STANDARD_IA' THEN (COALESCE(size_bytes, 0)::float / (1073741824)) * 0.018
        WHEN storage_tier = 'COS_ARCHIVE'     THEN (COALESCE(size_bytes, 0)::float / (1073741824)) * 0.004
        ELSE 0
      END
  `)

  const totalResult = await prisma.$queryRawUnsafe(`
    SELECT SUM(size_bytes)::bigint as total_bytes, SUM(estimated_monthly_cost)::double precision as total_cost
    FROM asset_heat_index
  `) as any[]

  const totalBytes = Number(totalResult[0]?.total_bytes || 0)
  const totalCost = Number(totalResult[0]?.total_cost || 0)

  console.log(`  Updated sizes: ${updated}`)
  console.log(`  No match (redacted URLs): ${noMatch}`)
  console.log(`  Total bytes: ${totalBytes} (${(totalBytes / (1024*1024)).toFixed(2)} MB)`)
  console.log(`  Total est. monthly cost: $${totalCost.toFixed(6)}`)
  console.log('[R9.3] ✅ Sizes populated')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
