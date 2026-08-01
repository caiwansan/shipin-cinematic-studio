/**
 * Sprint-03 Task 1：Reality Checkpoint — Novel Reality Score 计算
 * 每 100 章跑一次，6 维指标 → 总分（最低分 ≥ 85 为发布门槛）
 *
 * 用法: npx tsx scripts/reality-checkpoint.ts <upToChapter> <checkpointNo>
 */
import { PrismaClient } from '@prisma/client'
import { consistencyVerifier } from '../src/services/hdz/consistency-verifier.service.js'

const prisma = new PrismaClient()
const PROJECT_ID = 'c699d329-a54d-4026-9e29-a4c15339682b'
const upTo = Number(process.argv[2]) || 100
const cpNo = Number(process.argv[3]) || 1

interface ScoreLine { dim: string; weight: number; score: number; detail: string }

async function main() {
  const lines: ScoreLine[] = []

  // ── 维度 1+2：人物/世界一致性（verifyChapterText 全章轻量检查）──
  const chapters = await prisma.hdzChapter.findMany({
    where: { projectId: PROJECT_ID, chapterNo: { lte: upTo }, content: { not: null } },
    select: { chapterNo: true, content: true, wordCount: true },
    orderBy: { chapterNo: 'asc' },
  })
  let sumScore = 0, warnCount = 0, checked = 0
  for (const ch of chapters) {
    const r = await consistencyVerifier.verifyChapterText(PROJECT_ID, ch.chapterNo, ch.content || '')
    sumScore += r.score
    warnCount += r.warnings.length
    checked++
  }
  const charWorldScore = checked ? Math.round(sumScore / checked) : 100
  lines.push({ dim: '人物+世界一致性', weight: 45, score: charWorldScore, detail: `${checked} 章平均分 ${charWorldScore}，共 ${warnCount} 条一致性警告` })

  // ── 维度 3：伏笔状态（总纲伏笔 vs 正文提及）──
  // ★ 修正：应现伏笔只统计正文已覆盖到的章节（大纲先行时正文未写到的章节不算未兑现）
  const proj = await prisma.hdzProject.findUnique({ where: { id: PROJECT_ID }, select: { masterPlan: true } })
  const foreshadows: any[] = (proj?.masterPlan as any)?.foreshadowing || []
  let fsTotal = 0, fsMentioned = 0
  const allText = chapters.map(c => c.content || '').join('\n')
  const maxWritten = chapters.length ? chapters[chapters.length - 1].chapterNo : 0
  for (const fs of foreshadows) {
    if (fs.chapter > maxWritten) continue // 正文未覆盖，不计分
    fsTotal++
    // ★ 5-gram 滑窗匹配：命中正文任一 5 字连续片段即算提及（比前 N 字硬匹配召回率高，比 2 字词误报低）
    const clean = String(fs.event || '').replace(/[，。！？、；：""''（）\s]/g, '')
    let mentionedFs = false
    if (clean.length >= 5) {
      for (let i = 0; i <= clean.length - 5; i++) {
        if (allText.includes(clean.slice(i, i + 5))) { mentionedFs = true; break }
      }
    }
    if (mentionedFs) fsMentioned++
  }
  const fsScore = fsTotal === 0 ? 100 : Math.round((fsMentioned / fsTotal) * 100)
  lines.push({ dim: '伏笔开合', weight: 20, score: fsScore, detail: `应现伏笔 ${fsTotal} 个，正文提及 ${fsMentioned} 个` })

  // ── 维度 4：心理漂移（MENTAL 状态突变且无 recovery 计划）──
  const mental = await prisma.hdzCharacterState.findMany({
    where: { projectId: PROJECT_ID, chapterNo: { lte: upTo }, stateType: 'MENTAL' },
    select: { chapterNo: true, severity: true, recoveryChapter: true, description: true },
  })
  const drift = mental.filter(m => (m.severity === 'high' || m.severity === 'critical') && !m.recoveryChapter)
  const driftScore = mental.length === 0 ? 100 : Math.max(0, 100 - Math.round((drift.length / mental.length) * 100))
  lines.push({ dim: '心理漂移', weight: 15, score: driftScore, detail: `MENTAL 事件 ${mental.length} 个，无恢复计划的高危突变 ${drift.length} 个` })

  // ── 维度 5：质量门（reviewer 合格率 / blocked / needs_rewrite）──
  const reviewers = await prisma.hdzAgentTask.findMany({
    where: { projectId: PROJECT_ID, agentType: 'reviewer', status: { in: ['completed', 'waiting_approval', 'approved', 'rejected'] } },
    select: { status: true },
  })
  const rvTotal = reviewers.length
  const rvPass = reviewers.filter(r => r.status === 'completed' || r.status === 'approved').length
  const blocked = await prisma.hdzAgentTask.count({ where: { projectId: PROJECT_ID, status: 'blocked' } })
  const needRewrite = await prisma.hdzChapter.count({ where: { projectId: PROJECT_ID, status: 'needs_rewrite' } })
  const rvScore = rvTotal === 0 ? 100 : Math.round((rvPass / rvTotal) * 100)
  const qScore = Math.max(0, rvScore - blocked * 5 - needRewrite * 2)
  lines.push({ dim: '质量门', weight: 10, score: qScore, detail: `reviewer 合格 ${rvPass}/${rvTotal}，blocked ${blocked}，needs_rewrite ${needRewrite}` })

  // ── 维度 6：生产稳定性（双指标：全量 Historical + 最近 100 任务稳态 Production）──
  const projCreated = (await prisma.hdzProject.findUnique({ where: { id: PROJECT_ID }, select: { createdAt: true } }))?.createdAt
  const tasks = await prisma.hdzAgentTask.groupBy({ by: ['status'], where: { projectId: PROJECT_ID, createdAt: { gte: projCreated } }, _count: true })
  const tTotal = tasks.reduce((s, t) => s + t._count, 0)
  const tFailed = tasks.find(t => t.status === 'failed')?._count || 0
  const tOk = tTotal - tFailed
  const histScore = tTotal === 0 ? 100 : Math.round((tOk / tTotal) * 100)
  // 稳态指标：最近 100 个任务（排除测试启动期的历史失败噪声）
  const recent = await prisma.hdzAgentTask.findMany({
    where: { projectId: PROJECT_ID, createdAt: { gte: projCreated } },
    select: { status: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const rFailed = recent.filter(t => t.status === 'failed').length
  const rTotal = recent.length
  const prodScore = rTotal === 0 ? 100 : Math.round(((rTotal - rFailed) / rTotal) * 100)
  lines.push({ dim: '生产稳定性(历史)', weight: 5, score: histScore, detail: `全量任务 ${tOk}/${tTotal} 成功（失败 ${tFailed}）` })
  lines.push({ dim: '生产稳定性(稳态)', weight: 5, score: prodScore, detail: `最近 ${rTotal} 任务 ${rTotal - rFailed}/${rTotal} 成功（失败 ${rFailed}）` })

  // ── 成本统计（Usage Ledger）──
  const usageAgg = await prisma.usageLog.aggregate({ where: { projectId: PROJECT_ID }, _sum: { cost: true }, _count: true })
  const chapterCount = chapters.length
  const totalCost = usageAgg._sum.cost || 0
  const avgCostPerChapter = chapterCount ? totalCost / chapterCount : 0
  const totalWords = chapters.reduce((s, c) => s + (c.wordCount || c.content?.length || 0), 0)
  const costPer1kWords = totalWords ? (totalCost / totalWords) * 1000 : 0
  const costNote = `累计 ¥${totalCost.toFixed(4)}（${usageAgg._count} 次调用），均摊 ¥${avgCostPerChapter.toFixed(4)}/章`
  console.log(`\n📊 成本曲线（Usage Ledger）: ${costNote}`)
  console.log(`📈 千字成本: ¥${costPer1kWords.toFixed(4)}/千字（总字数 ${totalWords}）`)
  const totalAfterCost = lines.reduce((s, l) => s + l.score * l.weight, 0) / 100
  console.log(`💎 质量成本比: ${totalAfterCost.toFixed(0)}分 / ¥${totalCost.toFixed(2)} = ${(totalAfterCost / Math.max(totalCost, 0.001)).toFixed(0)} 分/元`)

  // ── 队列压力曲线（queue_depth / worker_busy / avg_wait）──
  const qDepth = await prisma.hdzAgentTask.count({ where: { projectId: PROJECT_ID, status: 'queued' } })
  const qRunning = await prisma.hdzAgentTask.count({ where: { projectId: PROJECT_ID, status: 'running' } })
  const workerBusy = Math.min(100, Math.round((qRunning / 2) * 100)) // concurrency=2
  const waited = await prisma.hdzAgentTask.findMany({
    where: { projectId: PROJECT_ID, status: { in: ['running', 'completed', 'waiting_approval'] }, startedAt: { not: null } },
    select: { createdAt: true, startedAt: true },
    take: 50,
    orderBy: { startedAt: 'desc' },
  })
  const waitMs = waited.map(w => (w.startedAt!.getTime() - w.createdAt!.getTime()) / 1000)
  const avgWait = waitMs.length ? Math.round(waitMs.reduce((s, x) => s + x, 0) / waitMs.length) : 0
  console.log(`📊 队列压力: queued=${qDepth} running=${qRunning}/2（worker ${workerBusy}% 占用），平均等待 ${avgWait}s`)

  // ── Checkpoint-02 专项：ch50 人物/势力/伏笔深度检查 ──
  if (upTo >= 50) {
    const states = await prisma.hdzCharacterState.findMany({
      where: { projectId: PROJECT_ID, chapterNo: { lte: upTo } },
      select: { characterId: true, stateType: true, event: true, chapterNo: true },
      orderBy: { chapterNo: 'asc' },
    })
    const charNames = await prisma.hdzCharacter.findMany({ where: { projectId: PROJECT_ID }, select: { id: true, name: true, role: true } })
    const nameById = new Map(charNames.map(c => [c.id, c]))
    const byChar = new Map<string, any[]>()
    for (const s of states) {
      const key = nameById.get(s.characterId)?.name || s.characterId.slice(0, 8)
      if (!byChar.has(key)) byChar.set(key, [])
      byChar.get(key)!.push(s)
    }
    console.log(`\n🧩 Checkpoint-02 专项（ch50）— 人物状态追踪:`)
    for (const [name, list] of byChar) {
      const mental = list.filter(s => s.stateType === 'MENTAL')
      const rel = list.filter(s => s.stateType === 'RELATIONSHIP')
      const role = nameById.get(list[0]?.characterId)?.role || ''
      console.log(`  • ${name}(${role}): 心理 ${mental.length} 条${mental.length ? '，最近: ' + String(mental[mental.length - 1].event).slice(0, 40) : ''} | 关系 ${rel.length} 条`)
    }
    // 伏笔泄露检查：应现伏笔 vs 提前提及（chapter < fs.chapter - 5 即提前）
    const leakHits = foreshadows.filter(fs => fs.chapter <= upTo).filter(fs => {
      const kw = String(fs.event || '').replace(/[，。！？、；：""''（）\s]/g, '').slice(0, 6)
      const earlyText = chapters.filter(c => c.chapterNo < (fs.chapter || 0) - 5).map(c => c.content || '').join('')
      return kw && earlyText.includes(kw)
    })
    if (leakHits.length) console.log(`  ⚠️ 伏笔疑似提前泄露 ${leakHits.length} 个: ${leakHits.map(l => l.event).join('; ')}`)
    else console.log(`  ✅ 伏笔泄露检查: 无提前泄露（应现 ${foreshadows.filter(fs => fs.chapter <= upTo).length} 个）`)
    const factions = (proj?.masterPlan as any)?.factions || []
    if (factions.length) console.log(`  🏰 势力: ${factions.map((f: any) => f.name).join(' / ')}`)
  }

  // ── 总分：加权平均，取最低维度分兜底 ──
  const total = Math.round(lines.reduce((s, l) => s + l.score * l.weight, 0) / 100)
  const minDim = Math.min(...lines.map(l => l.score))

  console.log(`\n════════ Reality Checkpoint #${cpNo}（至 ch${upTo}）════════`)
  for (const l of lines) console.log(`${l.score >= 85 ? '✅' : l.score >= 70 ? '⚠️' : '❌'} ${l.dim} [权重${l.weight}] ${l.score}/100 — ${l.detail}`)
  console.log(`\n🏆 Novel Reality Score: ${total}/100（最低维度 ${minDim}）${minDim >= 85 ? '✅ 达标' : minDim >= 70 ? '⚠️ 预警' : '❌ 未达标'}`)

  // CSV 追加
  const csv = `cp${cpNo},${upTo},${total},${minDim},${lines.map(l => l.score).join(',')}\n`
  require('fs').appendFileSync('/tmp/novel-reality-scores.csv', csv)
}
main().finally(() => prisma.$disconnect())
