/**
 * scripts/hundred-chapter-report.ts — 《九州古印录》百章 Reality Report
 *
 * 技术总监验收要求（2026-07-31）：
 *   混沌珠对外展示能力证明。ch100 时生成，必须包含：
 *   章节数量 / 总字数 / 平均成本 / 失败率 / 人物状态变化 /
 *   心理漂移次数 / 伏笔状态 / 世界状态变化 / Consistency Score 趋势 / Reviewer 通过率
 *
 * 用法: npx tsx scripts/hundred-chapter-report.ts [upTo=100] [out=/tmp/hundred-chapter-report.md]
 */
import { PrismaClient } from '@prisma/client'
import { consistencyVerifier } from '../src/services/hdz/consistency-verifier.service.js'
import * as fs from 'fs'

const prisma = new PrismaClient()
const PROJECT_ID = 'c699d329-a54d-4026-9e29-a4c15339682b'
const upTo = Number(process.argv[2]) || 100
const outPath = process.argv[3] || '/tmp/hundred-chapter-report.md'

async function main() {
  const lines: string[] = []
  const h = (s: string) => lines.push(s)

  h(`# 《九州古印录》百章 Reality Report（ch1-${upTo}）`)
  h(`生成时间: ${new Date().toISOString()}`)
  h('')

  // ── 1. 章节与字数 ──
  const chapters = await prisma.hdzChapter.findMany({
    where: { projectId: PROJECT_ID, chapterNo: { lte: upTo }, content: { not: null } },
    select: { chapterNo: true, content: true, wordCount: true, status: true },
    orderBy: { chapterNo: 'asc' },
  })
  const totalWords = chapters.reduce((s, c) => s + (c.wordCount || c.content?.length || 0), 0)
  const reviewed = chapters.filter(c => c.status === 'reviewed').length
  const needsRewrite = chapters.filter(c => c.status === 'needs_rewrite').length
  h(`## 1. 章节统计`)
  h(`- 已生成正文: **${chapters.length} / ${upTo}** 章`)
  h(`- 总字数: **${totalWords.toLocaleString()}** 字`)
  h(`- 平均单章字数: ${chapters.length ? Math.round(totalWords / chapters.length) : 0} 字`)
  h(`- 已审核通过(reviewed): ${reviewed} 章 | needs_rewrite: ${needsRewrite} 章`)
  h('')

  // ── 2. 成本 ──
  const usage = await prisma.usageLog.aggregate({ where: { projectId: PROJECT_ID }, _sum: { cost: true }, _count: true })
  const totalCost = usage._sum.cost || 0
  h(`## 2. 生产成本`)
  h(`- 累计调用: **${usage._count}** 次`)
  h(`- 累计成本: **¥${totalCost.toFixed(4)}**`)
  h(`- 单章均摊: ¥${chapters.length ? (totalCost / chapters.length).toFixed(4) : 0}/章`)
  h(`- 千字成本: ¥${totalWords ? ((totalCost / totalWords) * 1000).toFixed(4) : 0}/千字`)
  h('')

  // ── 3. 任务与失败率 ──
  const proj = await prisma.hdzProject.findUnique({ where: { id: PROJECT_ID }, select: { createdAt: true } })
  const tasks = await prisma.hdzAgentTask.groupBy({ by: ['status'], where: { projectId: PROJECT_ID, createdAt: { gte: proj?.createdAt } }, _count: true })
  const tTotal = tasks.reduce((s, t) => s + t._count, 0)
  const tFailed = tasks.find(t => t.status === 'failed')?._count || 0
  const byType = await prisma.hdzAgentTask.groupBy({ by: ['agentType', 'status'], where: { projectId: PROJECT_ID, createdAt: { gte: proj?.createdAt } }, _count: true })
  h(`## 3. 生产任务与失败率`)
  h(`- 任务总数: ${tTotal} | 失败: **${tFailed}** | 失败率: ${tTotal ? ((tFailed / tTotal) * 100).toFixed(1) : 0}%`)
  h(`- 按类型: ${byType.map(t => `${t.agentType}=${t.status}:${t._count}`).join(', ')}`)
  h('')

  // ── 4. 人物状态变化 ──
  const states = await prisma.hdzCharacterState.findMany({
    where: { projectId: PROJECT_ID, chapterNo: { lte: upTo } },
    select: { characterId: true, stateType: true, event: true, chapterNo: true, severity: true, recoveryChapter: true },
    orderBy: { chapterNo: 'asc' },
  })
  const charNames = await prisma.hdzCharacter.findMany({ where: { projectId: PROJECT_ID }, select: { id: true, name: true } })
  const nameById = new Map(charNames.map(c => [c.id, c.name]))
  const byChar = new Map<string, any[]>()
  for (const c of states) {
    const key = nameById.get(c.characterId) || c.characterId.slice(0, 8)
    if (!byChar.has(key)) byChar.set(key, [])
    byChar.get(key)!.push(c)
  }
  h(`## 4. 人物状态变化（${byChar.size} 人追踪）`)
  for (const [name, list] of byChar) {
    const first = list[0]
    const last = list[list.length - 1]
    h(`- **${name}**: 首现 ch${first.chapterNo}「${String(first.event).slice(0, 30)}」→ ch${last.chapterNo}「${String(last.event).slice(0, 30)}」（${list.length} 条状态记录）`)
  }
  h('')

  // ── 5. 心理漂移 ──
  const mental = states.filter(c => c.stateType === 'MENTAL')
  const highDrift = mental.filter(m => (m.severity === 'high' || m.severity === 'critical') && !m.recoveryChapter)
  h(`## 5. 心理漂移`)
  h(`- MENTAL 事件: ${mental.length} 次 | 无恢复计划的高危突变: **${highDrift.length}** 次`)
  h('')

  // ── 6. 伏笔状态（按正文实际覆盖范围统计）──
  const master = proj && (await prisma.hdzProject.findUnique({ where: { id: PROJECT_ID }, select: { masterPlan: true } }))
  const foreshadows: any[] = (master?.masterPlan as any)?.foreshadowing || []
  const maxWritten = chapters.length ? chapters[chapters.length - 1].chapterNo : 0
  const due = foreshadows.filter(f => f.chapter <= maxWritten)
  const allText = chapters.map(c => c.content || '').join('')
  const mentioned = due.filter(fs => {
    const clean = String(fs.event || '').replace(/[，。！？、；：""''（）\s]/g, '')
    if (clean.length < 5) return false
    for (let i = 0; i <= clean.length - 5; i++) {
      if (allText.includes(clean.slice(i, i + 5))) return true
    }
    return false
  }).length
  h(`## 6. 伏笔状态`)
  h(`- 总伏笔: ${foreshadows.length} | 正文已覆盖至 ch${maxWritten}，其中应现: ${due.length} | 正文已提及: ${mentioned} | 兑现率: ${due.length ? Math.round((mentioned / due.length) * 100) : 100}%`)
  h('')

  // ── 7. 世界状态变化 ──
  const world = await prisma.hdzCharacterState.findMany({
    where: { projectId: PROJECT_ID, chapterNo: { lte: upTo }, stateType: 'WORLD' },
    select: { chapterNo: true, event: true },
    orderBy: { chapterNo: 'asc' },
  })
  h(`## 7. 世界状态变化（${world.length} 次记录）`)
  for (const w of world.slice(0, 20)) h(`- ch${w.chapterNo}: ${String(w.event).slice(0, 60)}`)
  if (world.length > 20) h(`- ...（共 ${world.length} 次）`)
  h('')

  // ── 8. Consistency Score 趋势 ──
  h(`## 8. Consistency Score 趋势（每 10 章采样）`)
  let sample = 0
  for (const ch of chapters) {
    if (ch.chapterNo >= sample + 10) {
      const r = await consistencyVerifier.verifyChapterText(PROJECT_ID, ch.chapterNo, ch.content || '')
      h(`- ch${ch.chapterNo}: ${r.score}/100（${r.warnings.length} 警告）`)
      sample = ch.chapterNo
    }
  }
  h('')

  // ── 9. Reviewer 通过率 ──
  const reviewers = await prisma.hdzAgentTask.findMany({
    where: { projectId: PROJECT_ID, agentType: 'reviewer', status: { in: ['completed', 'waiting_approval', 'approved', 'rejected'] } },
    select: { status: true },
  })
  const rvPass = reviewers.filter(r => r.status === 'completed' || r.status === 'approved').length
  h(`## 9. Reviewer 质量门`)
  h(`- 审核任务: ${reviewers.length} | 通过: **${rvPass}** | 通过率: ${reviewers.length ? Math.round((rvPass / reviewers.length) * 100) : 100}%`)
  h('')
  h(`---`)
  h(`*Generated by 昆仑镜 · 混沌珠小说引擎 — 百章 Reality Report*`)

  fs.writeFileSync(outPath, lines.join('\n'))
  console.log(`✅ 百章 Reality Report 已生成: ${outPath}（${lines.length} 行）`)
}

main().finally(() => prisma.$disconnect())
