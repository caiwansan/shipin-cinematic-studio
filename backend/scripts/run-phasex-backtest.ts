/**
 * scripts/run-phasex-backtest.ts
 *
 * Phase X.3.6 — 离线回放 Baseline 生成器
 * 读取已有章节 → 跑 alignment backtest → 输出 JSON 报告
 *
 * 用法：npx tsx scripts/run-phasex-backtest.ts <projectId>
 */

import { alignmentBacktestService } from '../src/services/hdz/alignment-backtest.service.js'
import * as fs from 'fs'
import * as path from 'path'

const projectId = process.argv[2]
if (!projectId) {
  console.error('用法: npx tsx scripts/run-phasex-backtest.ts <projectId>')
  process.exit(1)
}

const METRICS_DIR = path.resolve(process.cwd(), 'metrics')
if (!fs.existsSync(METRICS_DIR)) fs.mkdirSync(METRICS_DIR, { recursive: true })

async function main() {
  console.log(`[Backtest Runner] 开始回放: project=${projectId}`)
  const startTime = Date.now()

  const result = await alignmentBacktestService.runBacktest(projectId, 1, 100)

  const duration = Date.now() - startTime
  console.log(`\n=== Phase X.3.6 Baseline Report ===`)
  console.log(`处理章节: ${result.processedChapters}/${result.totalChapters}`)
  console.log(`平均对齐评分: ${(result.avgAlignmentScore * 100).toFixed(1)}%`)
  console.log(`耗时: ${duration}ms`)
  console.log(`\n评分分布:`)
  console.log(`  优秀 (≥0.8): ${result.scoreDistribution.excellent}`)
  console.log(`  良好 (0.6-0.79): ${result.scoreDistribution.good}`)
  console.log(`  一般 (0.4-0.59): ${result.scoreDistribution.fair}`)
  console.log(`  较差 (<0.4): ${result.scoreDistribution.poor}`)
  console.log(`\n实体漂移热点: ${result.entityDriftHotspots.length}`)
  console.log(`转换失败聚类: ${result.transitionFailureClusters.length}`)

  // Save reports
  const baselinePath = path.join(METRICS_DIR, 'baseline-report-v1.json')
  fs.writeFileSync(baselinePath, JSON.stringify({
    projectId: result.projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalChapters: result.totalChapters,
      processedChapters: result.processedChapters,
      avgAlignmentScore: result.avgAlignmentScore,
      scoreDistribution: result.scoreDistribution,
      entityDriftCount: result.entityDriftHotspots.length,
      transitionFailureCount: result.transitionFailureClusters.length,
      runDurationMs: result.runDurationMs,
    },
    details: {
      chapterScores: result.chapterScores.map(s => ({
        ch: s.chapterNo,
        score: s.overallScore,
        coverage: s.entityCoverage,
        transition: s.transitionCorrectness,
        recall: s.entityRecall,
        entities: s.entityCount,
        deltas: s.deltaCount,
      })),
      driftHotspots: result.entityDriftHotspots,
      transitionFailures: result.transitionFailureClusters,
    },
  }, null, 2))
  console.log(`\n✅ baseline 报告已写入: ${baselinePath}`)

  // Generate drift map
  const driftMapPath = path.join(METRICS_DIR, 'drift-map-v1.json')
  fs.writeFileSync(driftMapPath, JSON.stringify({
    projectId: result.projectId,
    generatedAt: new Date().toISOString(),
    drift_events: result.entityDriftHotspots.map(h => ({
      entityId: h.entityId,
      entityName: h.entityName,
      severity: h.severity,
      pattern: h.description,
      affectedChapters: h.affectedChapters,
    })),
    transition_failures: result.transitionFailureClusters.map(f => ({
      entityName: f.entityName,
      chapterNo: f.chapterNo,
      failureType: f.failureType,
      description: f.description,
    })),
  }, null, 2))
  console.log(`✅ drift map 已写入: ${driftMapPath}`)

  // Generate failure taxonomy
  const failures = result.chapterScores.filter(s => s.overallScore < 0.4)
  const failureTaxonomyPath = path.join(METRICS_DIR, 'failure-taxonomy-v1.json')
  fs.writeFileSync(failureTaxonomyPath, JSON.stringify({
    projectId: result.projectId,
    totalFailures: failures.length,
    failureRate: result.chapterScores.length > 0
      ? Math.round((failures.length / result.chapterScores.length) * 10000) / 100 + '%'
      : '0%',
    failureChapters: failures.map(f => ({
      chapterNo: f.chapterNo,
      score: f.overallScore,
      lowIn: f.entityCoverage < 0.3 ? 'entity_coverage' :
             f.transitionCorrectness < 0.3 ? 'transition_correctness' : 'entity_recall',
    })),
    failureClusters: result.transitionFailureClusters,
  }, null, 2))
  console.log(`✅ failure taxonomy 已写入: ${failureTaxonomyPath}`)

  // Print summary to stdout
  console.log('\n' + JSON.stringify({
    type: 'baseline',
    avgScore: result.avgAlignmentScore,
    distribution: result.scoreDistribution,
    driftCount: result.entityDriftHotspots.length,
    failureCount: failures.length,
    topDrifts: result.entityDriftHotspots.slice(0, 3).map(h => ({
      entity: h.entityName,
      severity: h.severity,
      gap: h.description,
    })),
  }, null, 2))
}

main().catch(err => {
  console.error('[Backtest Runner] FAILED:', err)
  process.exit(1)
})
