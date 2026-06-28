/**
 * scripts/run-replay.ts
 *
 * 从数据库中读取一个已有项目的小说全文，跑 Y.1.1 Replay Mode。
 * 输出 drift 统计 + 前 20 条 EventLog 摘要。
 *
 * 用法：
 *   npx tsx scripts/run-replay.ts <projectId>
 *   npx tsx scripts/run-replay.ts <projectId> --verbose
 */

import { replayNovelByProject } from '../src/services/narrative-reader/tools/replay-benchmark.js'
import { getEventLogByDoc } from '../src/services/narrative-reader/storage/event_store.js'
import { getDriftTimeline } from '../src/services/narrative-reader/observation/drift.js'

async function main() {
  const projectId = process.argv[2]
  if (!projectId) {
    console.error('用法: npx tsx scripts/run-replay.ts <projectId> [--verbose]')
    process.exit(1)
  }

  const verbose = process.argv.includes('--verbose')

  console.log(`🚀 Replay Mode: project=${projectId}`)
  console.time('replay')

  const result = await replayNovelByProject(projectId)

  console.timeEnd('replay')
  console.log('')

  // --- Result summary ---
  console.log('📊 Replay Result')
  console.log(`   Chunks: ${result.succeeded}/${result.totalChunks} OK, ${result.failed} failed`)
  if (result.errors.length > 0) {
    console.log(`   Errors (first 5): ${result.errors.slice(0, 5).join(' | ')}`)
  }

  console.log('')
  console.log('📈 Drift Summary')
  console.log(`   Entity Stability:  ${(result.summary.entityStability * 100).toFixed(1)}%`)
  console.log(`   Event Overlap:     ${(result.summary.eventOverlap * 100).toFixed(1)}%`)
  console.log(`   Entropy Mean:      ${result.summary.entropyMean}`)
  console.log(`   Entropy Std:       ${result.summary.entropyStd}`)
  console.log(`   Entropy Trend:     ${result.summary.entropyTrend}`)
  console.log(`   Density Mean:      ${result.summary.densityMean}`)

  // --- Detailed timeline ---
  console.log('')
  console.log('📝 Chunk Overview (first 20):')
  const logs = await getEventLogByDoc(projectId)
  for (const log of logs.slice(0, 20)) {
    const entities = (log.entities as any[]) || []
    const names = entities.map((e: any) => e.name).join(', ')
    const events = (log.events as any[]) || []
    console.log(`   ${log.chunkId}: ${entities.length} entities, ${events.length} events [${names}]`)
  }

  if (logs.length > 20) {
    console.log(`   ... and ${logs.length - 20} more chunks`)
  }

  // --- Drift timeline ---
  console.log('')
  console.log('📉 Drift Timeline (last 10):')
  const drift = await getDriftTimeline(projectId)
  const showDrift = drift.length > 10 ? drift.slice(-10) : drift
  for (const d of showDrift) {
    console.log(`   ${d.chunkId}: entities=${d.entityCount}, events=${d.eventCount}, density=${d.relationDensity.toFixed(3)}, entropy=${d.entropyProxy.toFixed(3)}`)
  }
}

main().catch((e) => {
  console.error('Replay failed:', e)
  process.exit(1)
})
