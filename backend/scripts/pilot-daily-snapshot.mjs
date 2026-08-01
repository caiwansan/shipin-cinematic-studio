#!/usr/bin/env node
/**
 * Sprint-07 P1: Pilot 每日观察快照
 * 每天 23:50 由 crontab 触发；也可手动运行（补拍历史日期，如 node scripts/pilot-daily-snapshot.mjs 2026-07-31）
 *
 * 输出: backend/data/pilot-snapshots/<orgId>/<date>.json + index.json
 * 指标: AI员工调用次数 / JD生成 / 面试 / 候选分析 / LLM成本 / ROI / 失败率 / 模型健康
 */
import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data', 'pilot-snapshots')

// 与 agent-activity.service.ts 一致的估算基准（保持口径统一）
const MANUAL_MINUTES = {
  jd_generate: 60, job_analysis: 45, career_activation: 30,
  interview_evaluation: 30, interview_recommendation: 30, interview_questions: 20,
  matching_report: 20, candidate_screening: 15, resume_match: 10,
  profile_extraction: 8, generate_reply: 5,
}
const DEFAULT_MANUAL_MINUTES = 15
const HR_HOURLY_RATE = 50
const manualMin = (t) => MANUAL_MINUTES[t.replace(/^enterprise_agent_/, '')] ?? DEFAULT_MANUAL_MINUTES

const argDate = process.argv[2]
// 参数容错：第一个参数可能是日期或 orgId
let orgId = process.argv[3] || 'a1000000-0000-4000-8000-000000000001' // Pilot 企业（默认昆仑镜科技，Organization.id 是 UUID 列）
let dateArg = argDate
if (argDate && !/^\d{4}-\d{2}-\d{2}$/.test(argDate)) {
  orgId = argDate
  dateArg = undefined
}

// orgId 容错：支持完整 UUID / 组织名（name 为 text 列）/ id 前缀（UUID 列不支持 startsWith，内存过滤）
const p = new PrismaClient()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
let orgName = orgId
if (!UUID_RE.test(orgId)) {
  const byName = await p.organization.findFirst({ where: { name: { contains: orgId } }, select: { id: true, name: true } }).catch(() => null)
  if (byName) { orgId = byName.id; orgName = byName.name }
  else {
    const all = await p.organization.findMany({ select: { id: true, name: true } }).catch(() => [])
    const hit = all.find((o) => o.id.startsWith(orgId))
    if (hit) { orgId = hit.id; orgName = hit.name }
  }
} else {
  const byId = await p.organization.findFirst({ where: { id: orgId }, select: { name: true } }).catch(() => null)
  if (byId) orgName = byId.name
}

const localNow = new Date()
const date = dateArg || `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`
const dayStart = new Date(`${date}T00:00:00+08:00`)
const dayEnd = new Date(dayStart.getTime() + 86400000)

// 归属过滤：先取本组织 AI 员工实例，再按 agentInstanceId（text 列）查任务
const instances = await p.enterpriseAgentInstance.findMany({ where: { organizationId: orgId }, select: { id: true, employeeId: true } }).catch(() => [])
const instanceIds = instances.map((i) => i.id)

// 当天任务
const tasks = instanceIds.length
  ? await p.enterpriseAgentTask.findMany({
      where: { agentInstanceId: { in: instanceIds }, startedAt: { gte: dayStart, lt: dayEnd } },
      select: { taskType: true, status: true, cost: true, tokenInput: true, tokenOutput: true, agentInstanceId: true },
    })
  : []

let succeeded = 0, totalCost = 0, totalTokens = 0, totalSavedMin = 0
const byType = {}, byAgent = {}
for (const t of tasks) {
  const ok = t.status === 'success'
  if (ok) succeeded++
  totalCost += t.cost || 0
  totalTokens += (t.tokenInput || 0) + (t.tokenOutput || 0)
  const sm = ok ? manualMin(t.taskType) : 0
  totalSavedMin += sm
  const type = t.taskType.replace(/^enterprise_agent_/, '')
  byType[type] = byType[type] || { count: 0, ok: 0 }
  byType[type].count++; if (ok) byType[type].ok++
  byAgent[t.agentInstanceId] = byAgent[t.agentInstanceId] || { count: 0, ok: 0 }
  byAgent[t.agentInstanceId].count++; if (ok) byAgent[t.agentInstanceId].ok++
}

// 员工名映射（instances 已查，直接复用）
const agentNames = {}
if (instances.length) {
  const empIds = [...new Set(instances.map((i) => i.employeeId))]
  const profs = empIds.length ? await p.enterpriseAgentProfile.findMany({ where: { id: { in: empIds } }, select: { id: true, name: true } }) : []
  const pn = new Map(profs.map((x) => [x.id, x.name]))
  for (const i of instances) agentNames[i.id] = pn.get(i.employeeId) || i.id.slice(0, 10)
}

// 模型健康（全平台异常数 + 本企业）
const health = await p.enterpriseLlmConfig.findMany({ where: { tenantId: orgId }, select: { healthStatus: true } })
const healthCount = { ok: 0, failed: 0, decryptError: 0, disabled: 0, untested: 0 }
for (const h of health) {
  if (h.healthStatus === 'ok') healthCount.ok++
  else if (h.healthStatus === 'failed') healthCount.failed++
  else if (h.healthStatus === 'decrypt_error') healthCount.decryptError++
  else if (h.healthStatus === 'disabled') healthCount.disabled++
  else healthCount.untested++
}

const savedHours = Math.round((totalSavedMin / 60) * 100) / 100
const savedCost = Math.round(savedHours * HR_HOURLY_RATE * 100) / 100
const aiCost = Math.round(totalCost * 10000) / 10000
const roi = aiCost > 0 ? Math.round((savedCost / aiCost) * 100) / 100 : null

const snapshot = {
  date,
  organizationId: orgId,
  orgName: orgName || orgId,
  generatedAt: new Date().toISOString(),
  summary: {
    tasks: tasks.length,
    succeeded,
    failed: tasks.length - succeeded,
    successRate: tasks.length ? Math.round((succeeded / tasks.length) * 1000) / 10 : 0,
    jdGenerate: byType['jd_generate']?.count || 0,
    interviews: (byType['interview_evaluation']?.count || 0) + (byType['interview_recommendation']?.count || 0) + (byType['interview_questions']?.count || 0),
    candidateAnalysis: (byType['candidate_screening']?.count || 0) + (byType['matching_report']?.count || 0) + (byType['resume_match']?.count || 0) + (byType['profile_extraction']?.count || 0),
    aiCost,
    tokens: totalTokens,
    savedHours,
    savedCost,
    roi,
  },
  byType: Object.entries(byType).map(([k, v]) => ({ taskType: k, ...v })),
  byAgent: Object.entries(byAgent).map(([k, v]) => ({ agentId: k, agentName: agentNames[k] || k.slice(0, 10), ...v })),
  modelHealth: healthCount,
}

// 写文件
const orgDir = join(DATA_DIR, orgId)
mkdirSync(orgDir, { recursive: true })
writeFileSync(join(orgDir, `${date}.json`), JSON.stringify(snapshot, null, 2))

// 更新 index
const indexPath = join(DATA_DIR, 'index.json')
const idx = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : { pilotOrg: orgId, orgNames: {}, snapshots: {} }
idx.pilotOrg = orgId
idx.orgNames = idx.orgNames || {}
idx.orgNames[orgId] = orgName
idx.snapshots[orgId] = idx.snapshots[orgId] || []
if (!idx.snapshots[orgId].includes(date)) {
  idx.snapshots[orgId].push(date)
  idx.snapshots[orgId].sort()
}
writeFileSync(indexPath, JSON.stringify(idx, null, 2))

console.log(`✅ 快照 ${orgId} ${date}: ${tasks.length}任务 成功率${snapshot.summary.successRate}% 成本¥${aiCost} 省¥${savedCost} ROI=${roi ?? '∞'}`)
await p.$disconnect()
