/**
 * scripts/run-contract-compliance.ts
 *
 * Phase X.4 Step 2+3 — EntityContract 合规验证
 *
 * 对已有章节做以下操作：
 * 1. 遍历全部 51 章
 * 2. 每章调用 SceneCompilerV2.compileWithEntityContract() 生成 EntityContract
 * 3. 调用 EntityContractChecker.checkChapter() 验证合规
 * 4. 输出汇总报告
 *
 * 纯只读，不修改任何数据。
 */

import { sceneCompilerV2 } from '../src/services/hdz/scene-compiler.service.js'
import { entityContractChecker } from '../src/services/hdz/entity-contract-checker.service.js'
import { prisma } from '../src/utils/index.js'
import * as fs from 'fs'
import * as path from 'path'

const METRICS_DIR = path.resolve(process.cwd(), 'metrics')

async function main() {
  const projectId = process.argv[2]
  if (!projectId) {
    console.error('用法: npx tsx scripts/run-contract-compliance.ts <projectId>')
    process.exit(1)
  }

  if (!fs.existsSync(METRICS_DIR)) fs.mkdirSync(METRICS_DIR, { recursive: true })

  console.log(`[ContractCompliance] 开始 EntityContract 合规验证`)
  console.log(`  项目: ${projectId}`)
  console.log()

  // 1. 加载全部章节
  const chapters = await prisma.hdzChapter.findMany({
    where: { projectId, content: { not: null } },
    orderBy: { chapterNo: 'asc' },
    select: { chapterNo: true, title: true, content: true },
  })
  console.log(`  章节数: ${chapters.length}`)

  // 2. 逐章生成 EntityContract + 验证
  const allResults: Array<{
    chapterNo: number
    contract: { required: number; optional: number; latent: number; forbidden: number }
    complianceScore: number
    isAcceptable: boolean
    requiredRecall: number
    optionalCoverage: number
    missingRequired: string[]
    forbiddenViolations: number
    diagnostics: string[]
  }> = []

  let totalScore = 0
  let acceptableCount = 0
  let allMissing: string[] = []
  let allForbidden: string[] = []
  let maxMissCh: { chapterNo: number; count: number; names: string[] } | null = null

  for (const ch of chapters) {
    if (!ch.content || ch.content.length < 100) continue

    // 用编译器的 EntityContract 引擎生成 contract
    const compiled = await sceneCompilerV2.compileWithEntityContract({
      projectId,
      chapterNo: ch.chapterNo,
      chapterTitle: ch.title || '',
      sceneNo: 1,
      outline: ch.title || `${ch.chapterNo}章剧情`,
    })

    // 验证合规
    const checkResult = entityContractChecker.checkChapter({
      projectId,
      chapterNo: ch.chapterNo,
      sceneNo: 1,
      text: ch.content,
      contract: compiled.entityContract,
    })

    allResults.push({
      chapterNo: ch.chapterNo,
      contract: {
        required: compiled.entityContract.required.length,
        optional: compiled.entityContract.optional.length,
        latent: compiled.entityContract.latent.length,
        forbidden: compiled.entityContract.forbidden.length,
      },
      complianceScore: checkResult.complianceScore,
      isAcceptable: checkResult.isAcceptable,
      requiredRecall: checkResult.requiredRecall,
      optionalCoverage: checkResult.optionalCoverage,
      missingRequired: checkResult.missingRequired,
      forbiddenViolations: checkResult.forbiddenViolations.length,
      diagnostics: checkResult.diagnostics,
    })

    totalScore += checkResult.complianceScore
    if (checkResult.isAcceptable) acceptableCount++
    allMissing.push(...checkResult.missingRequired)
    allForbidden.push(...checkResult.forbiddenViolations.map(v => v.name))

    // 记录最差的一章
    if (!maxMissCh || checkResult.missingRequired.length > maxMissCh.count) {
      maxMissCh = {
        chapterNo: ch.chapterNo,
        count: checkResult.missingRequired.length,
        names: checkResult.missingRequired,
      }
    }
  }

  const avgScore = totalScore / allResults.length

  // 3. 输出报告
  console.log()
  console.log('╔══════════════════════════════════════════╗')
  console.log('║   EntityContract 合规报告                ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()
  console.log(`📊 总览`)
  console.log(`  验证章节: ${allResults.length}`)
  console.log(`  平均合规评分: ${(avgScore * 100).toFixed(1)}%`)
  console.log(`  合格章节: ${acceptableCount}/${allResults.length} (${(acceptableCount / allResults.length * 100).toFixed(1)}%)`)
  console.log(`  不合格章节: ${allResults.length - acceptableCount}`)
  console.log()
  console.log(`📋 缺失实体统计`)
  console.log(`  缺失总数: ${allMissing.length}`)
  const missingFreq = new Map<string, number>()
  for (const n of allMissing) missingFreq.set(n, (missingFreq.get(n) || 0) + 1)
  const sortedMiss = [...missingFreq.entries()].sort((a, b) => b[1] - a[1])
  console.log(`  最高频缺失角色:`)
  for (const [name, count] of sortedMiss.slice(0, 10)) {
    const bar = '█'.repeat(Math.min(count, 20))
    console.log(`    ${bar} ${name} (缺失 ${count}/${allResults.length} 章 — ${(count / allResults.length * 100).toFixed(0)}%)`)
  }
  console.log()
  console.log(`📋 违规引用统计`)
  const forbiddenFreq = new Map<string, number>()
  for (const n of allForbidden) forbiddenFreq.set(n, (forbiddenFreq.get(n) || 0) + 1)

  if (allForbidden.length > 0) {
    console.log(`  forbidden 违规引用: ${allForbidden.length} 次`)
    for (const [name, count] of [...forbiddenFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`    ❌ ${name} (${count} 次违规)`)
    }
  } else {
    console.log(`  无 forbidden 违规引用 ✅`)
  }

  if (maxMissCh) {
    console.log()
    console.log(`⚠️ 最差章节 ch${maxMissCh.chapterNo}: 缺失 ${maxMissCh.count} 个 required 实体`)
    console.log(`  缺失角色: ${maxMissCh.names.join(', ')}`)
  }

  // 4. 趋势分析（前5章 vs 后5章）
  const front5 = allResults.slice(0, 5)
  const back5 = allResults.slice(-5)
  console.log()
  console.log('📈 趋势对比:')
  if (front5.length > 0) {
    const frontAvg = front5.reduce((a, r) => a + r.complianceScore, 0) / front5.length
    const backAvg = back5.reduce((a, r) => a + r.complianceScore, 0) / back5.length
    console.log(`  前5章平均分: ${(frontAvg * 100).toFixed(1)}%`)
    console.log(`  后5章平均分: ${(backAvg * 100).toFixed(1)}%`)
    console.log(`  趋势: ${backAvg > frontAvg ? '📈 改善中' : backAvg < frontAvg ? '📉 退化中' : '➡️ 持平'}`)
  }

  // 5. 保存 JSON
  const output = {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalChapters: allResults.length,
      avgComplianceScore: avgScore,
      acceptableCount,
      unacceptableCount: allResults.length - acceptableCount,
      acceptableRate: `${(acceptableCount / allResults.length * 100).toFixed(1)}%`,
      totalMissing: allMissing.length,
      topMissing: sortedMiss.slice(0, 10).map(([n, c]) => ({ name: n, missingChapters: c, rate: `${(c / allResults.length * 100).toFixed(0)}%` })),
      worstChapter: maxMissCh ? { chapterNo: maxMissCh.chapterNo, missingCount: maxMissCh.count, missingNames: maxMissCh.names } : null,
      hasForbiddenViolations: allForbidden.length > 0,
      trend: front5.length > 0 ? {
        earlyAvg: (front5.reduce((a, r) => a + r.complianceScore, 0) / front5.length),
        lateAvg: (back5.reduce((a, r) => a + r.complianceScore, 0) / back5.length),
        direction: (back5.reduce((a, r) => a + r.complianceScore, 0) / back5.length) > (front5.reduce((a, r) => a + r.complianceScore, 0) / front5.length) ? 'improving' : 'degrading',
      } : null,
    },
    perChapter: allResults,
  }

  const outPath = path.join(METRICS_DIR, 'contract-compliance-report.json')
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`\n✅ 报告已写入: ${outPath}`)
  console.log()
  console.log('📋 核心结论:')
  console.log(`  - SceneGraph v2 的 EntityContract 机制已经运行`)
  console.log(`  - Contract Alignment Score 代替了旧的全局实体覆盖率`)
  console.log(`  - 缺失的 required 实体 = Writer prompt 在后续章节需要加强的方向`)
  console.log(`  - 违规引用的 forbidden 实体 = WorldState 固化约束需要强制执行的点`)
}

main().catch(err => {
  console.error('[ContractCompliance] FAILED:', err)
  process.exit(1)
})
