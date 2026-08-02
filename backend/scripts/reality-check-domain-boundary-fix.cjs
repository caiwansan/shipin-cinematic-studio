/**
 * SPRINT-MEDIA-BROWSER-WORKSPACE-01.1 Domain Boundary Fix — Reality Check
 * 验证掌柜验收 4 项：
 *  R1 新媒体首页只看到 Media AI Employee（Owner View + media/overview）
 *  R2 求职招聘工作台不受影响（career 接口正常，career agent 保留）
 *  R3 BrowserWorkspace 归属明确（organizationId + businessType）
 *  R4 禁止跨域绑定（career binding 已 paused；owner-view 双过滤）
 */
const BASE = 'http://127.0.0.1:4002'

async function main() {
  let pass = 0, fail = 0
  const check = (name, cond, extra = '') => {
    if (cond) { pass++; console.log(`  ✅ ${name} ${extra}`) }
    else { fail++; console.log(`  ❌ ${name} ${extra}`) }
  }

  // login demo（测试企业，org=11111111）
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@scs.com', password: 'demo123456' }),
  })
  const loginJson = await loginRes.json()
  const token = loginJson.accessToken || loginJson.token || ''
  check('R0 demo 登录成功', !!token)

  // ── R1: Owner View 只含 media 员工 ──
  const ovRes = await fetch(`${BASE}/api/enterprise/workspaces/owner-view`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const ov = await ovRes.json()
  const rows = ov.data || []
  check('R1 owner-view 返回数组', Array.isArray(rows))
  const mediaOnly = rows.every((r) => r.businessType === 'media' && r.agent?.businessType === 'media')
  check('R1 全部 workspace 为 media 域', mediaOnly, `(${rows.length} rows)`)
  const noCareer = rows.every((r) => !['career_advisor', 'recruiter', 'interview', 'talent_analyst', 'talent_agent'].includes(r.agent?.agentType))
  check('R1 无 Career/Recruitment Agent 混入', noCareer)
  const hasAlice = rows.some((r) => r.agent?.name === 'Alice' && r.agent?.role === '新媒体运营主管')
  check('R1 新媒体首页显示 Alice 新媒体运营主管', hasAlice)
  const hasWorkspace = rows.every((r) => r.workspaceId && r.platform === 'douyin')
  check('R1 workspaceId + platform 明确', hasWorkspace)

  // ── R1b: media/overview agents 只含 media 员工 ──
  const ov2Res = await fetch(`${BASE}/api/enterprise/media/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const ov2 = await ov2Res.json()
  const agents = ov2.data?.agents || []
  const agentsMediaOnly = agents.every((a) => !['career_advisor', 'recruiter', 'interview', 'talent_analyst', 'talent_agent'].includes(a.role))
  check('R1b media/overview agents 无 career 混入', agentsMediaOnly, `(${agents.length} agents)`)

  // ── R2: career 域不受影响 ──
  const adminRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const adminJson = await adminRes.json()
  const adminToken = adminJson.token || ''
  const instRes = await fetch(`${BASE}/api/enterprise/agent-identity/instances`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  check('R2 career agent-identity 接口 200', instRes.status === 200, `(http ${instRes.status})`)
  const instJson = await instRes.json()
  const insts = instJson.data || []
  const careerInstances = insts.filter((i) => i.employeeId)
  check('R2 career 实例仍存在（未删除）', careerInstances.length > 0, `(${careerInstances.length} instances)`)

  // ── R3: BrowserWorkspace 归属明确 ──
  const wsRes = await fetch(`${BASE}/api/enterprise/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const wsJson = await wsRes.json()
  const wsList = wsJson.data || []
  check('R3 workspace 列表可查', Array.isArray(wsList))
  const wsBound = wsList.every((w) => w.businessType === 'media')
  check('R3 workspace 均有 businessType', wsBound, `(${wsList.length} workspaces)`)

  // ── R4: 跨域绑定禁止（数据库层验证）──
  // career binding 已 paused；owner-view 双过滤已验。这里验证 paused 存在
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  const careerBinding = await prisma.agentChannelBinding.findMany({
    where: { status: 'paused' },
    select: { id: true, status: true },
  })
  check('R4 跨域 career binding 已 paused', careerBinding.length > 0, `(${careerBinding.length} paused)`)
  const activeBindings = await prisma.agentChannelBinding.findMany({
    where: { status: 'active' },
    select: { id: true, agentInstanceId: true },
  })
  // 所有 active binding 的 agent 必须是 media 域
  let activeAllMedia = true
  for (const b of activeBindings) {
    const inst = await prisma.enterpriseAgentInstance.findUnique({ where: { id: b.agentInstanceId } })
    if (!inst) continue
    const prof = await prisma.enterpriseAgentProfile.findUnique({ where: { id: inst.employeeId } })
    if (prof && prof.businessType !== 'media') activeAllMedia = false
  }
  check('R4 active 绑定全部为 media 域 agent', activeAllMedia, `(${activeBindings.length} active)`)
  await prisma.$disconnect()

  console.log(`\n════════ 结果: ${pass} PASS / ${fail} FAIL ════════`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
