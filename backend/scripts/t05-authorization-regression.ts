/**
 * Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01 T05
 * 企业套餐授权链路回归测试
 * Admin → EnterpriseSubscription → EnterpriseEntitlement → Agent Provision
 *
 * 隔离策略：创建独立测试企业，跑完整链路后清理，不碰真实业务数据。
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE = 'http://127.0.0.1:4002'

let token = ''
let testOrgId = ''
const results: Array<{ case: string; pass: boolean; detail: string }> = []

function check(name: string, cond: boolean, detail = '') {
  results.push({ case: name, pass: !!cond, detail })
  console.log(`${cond ? '✅' : '❌'} ${name} ${detail ? '— ' + detail : ''}`)
}

async function api(path: string, opts: any = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(BASE + path, { ...opts, headers })
  let json: any = null
  try { json = await res.json() } catch { json = null }
  return { status: res.status, json }
}

async function main() {
  // ── 0. 登录 ──
  const login = await api('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  check('T05-0 管理员登录', login.status === 200 && !!login.json?.token, `status=${login.status}`)
  token = login.json?.token || ''

  // ── 1. 创建隔离测试企业 ──
  const testOrg = await prisma.organization.create({
    data: { name: `T05-回归测试-${Date.now()}` },
  })
  testOrgId = testOrg.id
  check('T05-1 测试企业已创建', !!testOrgId, testOrgId)

  // ── 2. 查询套餐（商业商品） ──
  const plans = await api('/api/admin/recruitment/plans')
  const enabledPlans = (plans.json?.data || []).filter((p: any) => p.enabled)
  check('T05-2 套餐列表（商业商品）', plans.status === 200 && enabledPlans.length > 0, `${enabledPlans.length} 个启用套餐`)
  const proPlan = enabledPlans.find((p: any) => p.name === 'professional') || enabledPlans[0]
  const basicPlan = enabledPlans.find((p: any) => p.name === 'basic') || enabledPlans[1]

  // ── 3. Agent 产品定义（T02 新端点） ──
  const product = await api('/api/admin/recruitment/agent-product')
  check('T05-3 Agent 产品定义', product.status === 200 && product.json?.success && !!product.json?.data?.versions?.[0]?.content,
    `${product.json?.data?.base?.displayName || ''} · ${product.json?.data?.capabilities?.length || 0} 能力 · ${product.json?.data?.versions?.length || 0} 版本`)
  const hasModelConfig = JSON.stringify(product.json?.data).includes('apiKey') || JSON.stringify(product.json?.data).includes('provider')
  check('T05-3b 产品定义无模型配置', !hasModelConfig, '不暴露 provider/apiKey')

  // ── 3.5 创建带 employees 配置的临时套餐（验证 Provision 链路） ──
  const testPlan = await prisma.enterprisePlan.create({
    data: {
      name: `t05-plan-${Date.now()}`,
      displayName: 'T05 回归套餐',
      price: 1, yearlyPrice: 1,
      maxEmployees: 2, maxChannels: 1, maxMembers: 5,
      enabled: true,
      capabilityCodes: { employees: [{ role: 'recruiter', displayName: '回归招聘顾问' }], capabilities: ['AI_JD_GENERATE'] } as any,
    },
  })
  check('T05-3c 临时套餐已创建（含 employees 配置）', !!testPlan.id, testPlan.id)

  // ── 4. 授权开通（核心链路：用带 employees 的临时套餐） ──
  const grant = await api('/api/admin/recruitment/authorization/grant', {
    method: 'POST',
    body: JSON.stringify({ organizationId: testOrgId, planId: testPlan.id, cycle: 'monthly', periodDays: 30 }),
  })
  const g = grant.json?.data || {}
  check('T05-4 开通：Subscription 创建', grant.status === 200 && grant.json?.success && !!g.subscriptionId, g.subscriptionId)
  check('T05-4b 开通：Entitlement 生成', !!g.entitlement, JSON.stringify(g.entitlement ? { maxAgents: g.entitlement.maxAgents } : g.entitlement).slice(0, 80))
  check('T05-4c 开通：Agent Provision 执行', typeof g.provision?.provisioned === 'number' && g.provision.provisioned > 0, `新增 ${g.provision?.provisioned ?? 0} / 已存在 ${g.provision?.skipped ?? 0}`)

  // ── 5. 订阅落库验证 ──
  const sub = await prisma.enterpriseSubscription.findUnique({ where: { organizationId: testOrgId }, include: { entitlement: true } })
  check('T05-5 订阅落库（active + 快照）', !!sub && sub.status === 'active' && sub.snapshotName === testPlan.displayName, sub?.snapshotName || 'none')
  check('T05-5b 权益落库（maxAgents 对齐套餐）', !!sub?.entitlement && sub.entitlement.maxAgents === testPlan.maxEmployees, `maxAgents=${sub?.entitlement?.maxAgents}`)
  const provisioned = await prisma.enterpriseAgentProfile.count({ where: { organizationId: testOrgId } })
  check('T05-5c AI 员工已 provision', provisioned > 0, `${provisioned} 个 profile`)
  const provisionedInstances = await prisma.enterpriseAgentInstance.count({ where: { organizationId: testOrgId } })
  check('T05-5d Agent Instance 已创建', provisionedInstances > 0, `${provisionedInstances} 个 instance`)

  // ── 6. 订阅列表可见 ──
  const subs = await api('/api/admin/recruitment/subscriptions?limit=100')
  const inList = (subs.json?.data || []).some((s: any) => s.organizationId === testOrgId)
  check('T05-6 订阅列表可见', subs.status === 200 && inList)

  // ── 7. 授权操作：暂停 → 恢复 → 变更套餐 → 取消 ──
  const pause = await api(`/api/admin/enterprise/subscriptions/${sub.id}/pause`, { method: 'PATCH', body: JSON.stringify({ reason: 'T05 回归' }) })
  check('T05-7 暂停', pause.status === 200 && pause.json?.success)
  const paused = await prisma.enterpriseSubscription.findUnique({ where: { id: sub.id } })
  check('T05-7b 暂停落库', paused?.status === 'paused')

  const resume = await api(`/api/admin/enterprise/subscriptions/${sub.id}/resume`, { method: 'PATCH', body: JSON.stringify({ reason: 'T05 回归' }) })
  check('T05-8 恢复', resume.status === 200 && resume.json?.success)
  const resumed = await prisma.enterpriseSubscription.findUnique({ where: { id: sub.id } })
  check('T05-8b 恢复落库', resumed?.status === 'active')

  const change = await api(`/api/admin/enterprise/subscriptions/${sub.id}/change-plan`, {
    method: 'PATCH',
    body: JSON.stringify({ planId: basicPlan.id, reason: 'T05 回归' }),
  })
  check('T05-9 变更套餐', change.status === 200 && change.json?.success)
  const changed = await prisma.enterpriseSubscription.findUnique({ where: { id: sub.id } })
  check('T05-9b 变更落库（快照更新）', changed?.snapshotName === basicPlan.displayName, changed?.snapshotName || '')

  const cancel = await api(`/api/admin/enterprise/subscriptions/${sub.id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason: 'T05 回归' }) })
  check('T05-10 取消订阅', cancel.status === 200 && cancel.json?.success)
  const cancelled = await prisma.enterpriseSubscription.findUnique({ where: { id: sub.id } })
  check('T05-10b 取消落库', cancelled?.status === 'cancelled')

  // ── 8. 数据罗盘新端点（T04） ──
  const roi = await api('/api/admin/dashboard/roi?days=30')
  check('T04-1 数据罗盘 ROI', roi.status === 200 && roi.json?.code === 0, `summary: ${JSON.stringify(roi.json?.data?.summary || {}).slice(0, 100)}`)
  const quotas = await api('/api/admin/dashboard/quotas')
  check('T04-2 数据罗盘 额度', quotas.status === 200 && quotas.json?.code === 0, `${(quotas.json?.data || []).length} 家企业额度`)
  const daily = await api('/api/admin/dashboard/daily-report')
  check('T04-3 数据罗盘 日报', daily.status === 200 && daily.json?.code === 0, `date=${daily.json?.data?.date || ''} tasks=${daily.json?.data?.summary?.tasks ?? 0}`)

  // ── 9. 清理测试数据 ──
  await prisma.enterpriseAgentProfile.deleteMany({ where: { organizationId: testOrgId } })
  await prisma.enterpriseAgentInstance.deleteMany({ where: { organizationId: testOrgId } })
  await prisma.enterpriseEntitlement.deleteMany({ where: { organizationId: testOrgId } })
  await prisma.enterpriseSubscription.deleteMany({ where: { organizationId: testOrgId } })
  await prisma.enterprisePlan.delete({ where: { id: testPlan.id } })
  await prisma.organization.delete({ where: { id: testOrgId } })
  check('T05-11 测试数据清理', true, testOrgId)

  // ── 汇总 ──
  const passed = results.filter(r => r.pass).length
  const total = results.length
  console.log(`\n════ 汇总：${passed}/${total} PASS ════`)
  if (passed < total) {
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.case} — ${r.detail}`))
    process.exit(1)
  }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) }).finally(() => prisma.$disconnect())
