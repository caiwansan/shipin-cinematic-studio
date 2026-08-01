/* Phase 2 验证：masterPlan 状态机 draft→confirmed→locked→unlock */
require('dotenv').config()
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 找有 masterPlan 的项目（现有总纲无 status → 视为 draft）
  const project = await prisma.hdzProject.findFirst({
    where: { masterPlan: { not: null } },
    select: { id: true, userId: true, title: true, masterPlan: true, masterPlanVersion: true },
  })
  if (!project) { console.log('⚠️ 无项目有 masterPlan'); return }
  const user = await prisma.user.findUnique({ where: { id: project.userId } })
  const token = jwt.sign({ id: user.id, email: user.email, tokenVersion: user.tokenVersion || 1 }, process.env.JWT_SECRET)
  const BASE = 'http://127.0.0.1:4002'
  const H = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  const pid = project.id
  const status0 = (project.masterPlan as any)?.status || '(无)'
  console.log(`项目「${project.title}」 masterPlan 当前状态: ${status0}, version=${project.masterPlanVersion}`)

  let pass = true
  const check = (name, ok, extra = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name} ${extra}`)
    if (!ok) pass = false
  }

  // 1. confirm
  let r = await fetch(`${BASE}/api/hdz/projects/${pid}/master-plan/confirm`, { method: 'POST', headers: H })
  let j = await r.json()
  const s1 = j?.data?.masterPlan?.status
  check('confirm: draft→confirmed', r.status === 200 && s1 === 'confirmed', `(HTTP ${r.status}, status=${s1})`)

  // 2. lock
  r = await fetch(`${BASE}/api/hdz/projects/${pid}/master-plan/lock`, { method: 'POST', headers: H })
  j = await r.json()
  const s2 = j?.data?.masterPlan?.status
  check('lock: confirmed→locked', r.status === 200 && s2 === 'locked', `(HTTP ${r.status}, status=${s2})`)

  // 3. locked 后再 confirm 应拒绝
  r = await fetch(`${BASE}/api/hdz/projects/${pid}/master-plan/confirm`, { method: 'POST', headers: H })
  check('locked 后 confirm 拒绝', r.status === 400, `(HTTP ${r.status})`)

  // 4. unlock
  r = await fetch(`${BASE}/api/hdz/projects/${pid}/master-plan/unlock`, { method: 'POST', headers: H })
  j = await r.json()
  const s4 = j?.data?.masterPlan?.status
  check('unlock: locked→confirmed', r.status === 200 && s4 === 'confirmed', `(HTTP ${r.status}, status=${s4})`)

  // 5. GET 返回状态
  r = await fetch(`${BASE}/api/hdz/projects/${pid}/master-plan`, { headers: H })
  j = await r.json()
  const s5 = j?.data?.data?.masterPlan?.status || j?.data?.masterPlan?.status
  check('GET 返回 status', s5 === 'confirmed', `(status=${s5})`)

  // 6. 越权：他人 confirm 应 403/404
  const other = await prisma.user.findFirst({ where: { id: { not: user.id } } })
  if (other) {
    const t2 = jwt.sign({ id: other.id, email: other.email, tokenVersion: other.tokenVersion || 1 }, process.env.JWT_SECRET)
    r = await fetch(`${BASE}/api/hdz/projects/${pid}/master-plan/confirm`, { method: 'POST', headers: { 'Authorization': `Bearer ${t2}`, 'Content-Type': 'application/json' } })
    check('越权 confirm 拒绝', r.status === 404 || r.status === 403, `(HTTP ${r.status})`)
  }

  // 还原：不再改动（保持 confirmed 状态，writer 可正常遵循）
  console.log(pass ? '\n✅✅✅ Phase 2 状态机验证通过（最终状态: confirmed）' : '\n❌ 存在问题')
}
main().finally(() => prisma.$disconnect())
