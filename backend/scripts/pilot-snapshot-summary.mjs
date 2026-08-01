#!/usr/bin/env node
/**
 * Sprint-07 P1: Pilot 30 天观察汇总（周报/月报）
 * node scripts/pilot-snapshot-summary.mjs [orgId]
 * 读取 data/pilot-snapshots/<orgId>/*.json → 输出 30 天观察表（掌柜指标：调用/JD/面试/候选/成本/ROI/失败率）
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'pilot-snapshots')
let orgId = process.argv[2] || 'a1000000'

// 目录容错：支持完整 UUID / id 前缀 / 组织名（读 index.json 或扫描目录名）
const idxPath = join(DATA_DIR, 'index.json')
let dirName = orgId
if (existsSync(idxPath)) {
  try {
    const idx = JSON.parse(readFileSync(idxPath, 'utf8'))
    const orgIds = Object.keys(idx.snapshots || {})
    const hit = orgIds.find((id) => id === orgId || id.startsWith(orgId))
    if (hit) dirName = hit
    else {
      // 组织名匹配（index.orgNames: orgId → 名称）
      const byName = Object.entries(idx.orgNames || {}).find(([, n]) => n && n.includes(orgId))
      if (byName) dirName = byName[0]
    }
  } catch { /* ignore */ }
}
if (!existsSync(join(DATA_DIR, dirName))) {
  // 扫描目录名做名称匹配
  const allDirs = readdirSync(DATA_DIR).filter((d) => d.endsWith('.json') === false)
  const byName = allDirs.find((d) => d.startsWith(orgId))
  if (byName) dirName = byName
}
const orgDir = join(DATA_DIR, dirName)

if (!existsSync(orgDir)) {
  console.log(`无快照数据: ${orgDir}`)
  process.exit(0)
}

const files = readdirSync(orgDir).filter((f) => f.endsWith('.json')).sort()
const snaps = files.map((f) => JSON.parse(readFileSync(join(orgDir, f), 'utf8')))

const total = {
  tasks: 0, succeeded: 0, jdGenerate: 0, interviews: 0, candidateAnalysis: 0,
  aiCost: 0, tokens: 0, savedHours: 0, savedCost: 0,
}
for (const s of snaps) {
  total.tasks += s.summary.tasks
  total.succeeded += s.summary.succeeded
  total.jdGenerate += s.summary.jdGenerate
  total.interviews += s.summary.interviews
  total.candidateAnalysis += s.summary.candidateAnalysis
  total.aiCost += s.summary.aiCost
  total.tokens += s.summary.tokens
  total.savedHours += s.summary.savedHours
  total.savedCost += s.summary.savedCost
}
const successRate = total.tasks ? Math.round((total.succeeded / total.tasks) * 1000) / 10 : 0
const roi = total.aiCost > 0 ? Math.round((total.savedCost / total.aiCost) * 100) / 100 : null

console.log(`\n═══ Pilot 30 天观察汇总（${orgId} — ${snaps[0]?.orgName || ''}）═══`)
console.log(`观察天数: ${snaps.length} 天（${snaps[0]?.date} → ${snaps[snaps.length - 1]?.date}）\n`)
console.log(`📊 指标总览:`)
console.log(`  AI员工调用次数: ${total.tasks} 次`)
console.log(`  JD生成数量(Alice): ${total.jdGenerate}`)
console.log(`  面试次数(Bob): ${total.interviews}`)
console.log(`  候选分析数量(Carol): ${total.candidateAnalysis}`)
console.log(`  LLM成本: ¥${total.aiCost.toFixed(4)}`)
console.log(`  tokens: ${total.tokens}`)
console.log(`  节省工时: ${Math.round(total.savedHours * 100) / 100}h`)
console.log(`  节省人力价值: ¥${total.savedCost}`)
console.log(`  ROI: ${roi === null ? '∞（零成本）' : roi + '×'}`)
console.log(`  成功率: ${successRate}%（${total.succeeded}/${total.tasks}）`)

console.log(`\n📅 逐日明细:`)
console.log(`  日期         | 任务 | 成功率  | JD | 面试 | 候选 | 成本¥      | 省¥      | 健康(异)`)
for (const s of snaps) {
  const h = s.modelHealth
  const issues = h.failed + h.decryptError
  console.log(
    `  ${s.date} | ${String(s.summary.tasks).padStart(4)} | ${String(s.summary.successRate).padStart(5)}% | ${String(s.summary.jdGenerate).padStart(2)} | ${String(s.summary.interviews).padStart(3)} | ${String(s.summary.candidateAnalysis).padStart(4)} | ${String(s.summary.aiCost).padStart(9)} | ${String(s.summary.savedCost).padStart(7)} | ${issues}`
  )
}

// 连续使用天数（非空天）
const activeDays = snaps.filter((s) => s.summary.tasks > 0).length
console.log(`\n🏆 活跃天数: ${activeDays}/${snaps.length}（连续使用性）`)
const last5 = snaps.slice(-5)
const lastActive = [...last5].reverse().find((s) => s.summary.tasks > 0)
console.log(`  近 5 天最后活跃: ${lastActive ? lastActive.date : '无'}`)
