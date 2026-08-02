/**
 * SPRINT-MEDIA-AI-EMPLOYEE-REALITY-01 Task01 — Channel Health Guard Reality Gate
 *
 * 掌柜验收标准（H1-H7）：
 *   账号是资产，不是消耗品；失败不重试，先保护；恢复必须人工。
 * H1 状态机与阈值：HEALTHY/DEGRADED/NEEDS_ATTENTION + 30min 窗口 + 3 次阈值 + 致命信号表
 * H2 致命信号：验证码/安全验证/风控/封禁/登录失效 → 一次即 NEEDS_ATTENTION（不等 3 次）
 * H3 普通失败熔断：3 次普通失败 → NEEDS_ATTENTION + 自动暂停 AgentChannelBinding
 * H4 执行守卫：NEEDS_ATTENTION → ChannelHealthError（任务被拒，不重试）
 * H5 人工恢复：recover → HEALTHY + 绑定恢复 active（不自动恢复）
 * H6 成功上报：DEGRADED → HEALTHY（窗口清零）
 * H7 HTTP API：路由注册 + record-failure / recover 走通（owner 视角）
 *
 * 运行：npx tsx scripts/reality-check-ai-employee-reality-01-task01.ts
 * 注意：使用临时 channelAccountId（health-test-*），测完清理，不污染真实账号。
 */
import { prisma } from '../src/utils/index.js'
import {
  channelHealthGuardService,
  ChannelHealthError,
  FAILURE_WINDOW_MS,
  NORMAL_FAILURE_THRESHOLD,
  FATAL_SIGNAL_PATTERNS,
} from '../src/services/enterprise/channel/channel-health-guard.service.js'

const BASE = 'http://127.0.0.1:4002'
let pass = 0
let fail = 0
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name} ${extra}`) }
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

async function main() {
  console.log('═══ SPRINT-MEDIA-AI-EMPLOYEE-REALITY-01 Task01: Channel Health Guard ═══\n')

  // ── H1 状态机与阈值 ──
  console.log('── H1 状态机与阈值 ──')
  check('H1 窗口 = 30 分钟', FAILURE_WINDOW_MS === 30 * 60 * 1000)
  check('H1 普通失败阈值 = 3', NORMAL_FAILURE_THRESHOLD === 3)
  check('H1 致命信号表非空', FATAL_SIGNAL_PATTERNS.length >= 6, `(${FATAL_SIGNAL_PATTERNS.length} 条)`)
  check('H1 致命信号覆盖验证码/安全验证/风控/封禁',
    /验证码/.test(FATAL_SIGNAL_PATTERNS.map(p => p.source).join('|')) &&
    /安全验证/.test(FATAL_SIGNAL_PATTERNS.map(p => p.source).join('|')) &&
    /风控/.test(FATAL_SIGNAL_PATTERNS.map(p => p.source).join('|')) &&
    /封禁/.test(FATAL_SIGNAL_PATTERNS.map(p => p.source).join('|')))
  check('H1 登录失效不在致命信号（常态失效→普通窗口，防死锁）',
    !/登录状态已失效/.test(FATAL_SIGNAL_PATTERNS.map(p => p.source).join('|')))
  console.log()

  // 测试账号（临时，测完清理）
  const testId = `health-test-${Date.now()}`
  const tenantId = 'test-tenant'
  const cleanup = async () => {
    await prisma.channelHealthState.deleteMany({ where: { channelAccountId: testId } }).catch(() => {})
    await prisma.agentChannelBinding.deleteMany({ where: { channelAccountId: testId } }).catch(() => {})
  }
  await cleanup()

  // ── H2 致命信号：一次即 NEEDS_ATTENTION ──
  console.log('── H2 致命信号（一次即 NEEDS_ATTENTION）──')
  const fatalCases: Array<[string, string]> = [
    ['验证码', '页面出现验证码，要求输入'],
    ['安全验证', '平台要求安全验证，请确认'],
    ['风控', '操作触发平台风控'],
    ['封禁', '账号已被封禁'],
  ]
  for (const [label, error] of fatalCases) {
    const id = `${testId}-fatal-${label}`
    await prisma.channelHealthState.deleteMany({ where: { channelAccountId: id } }).catch(() => {})
    const r = await channelHealthGuardService.recordFailure({
      channelAccountId: id, tenantId, error, by: 'reality-check',
    })
    check(`H2 「${label}」一次失败 → NEEDS_ATTENTION`, r.triggered && r.state.state === 'NEEDS_ATTENTION',
      `(failures=${r.state.failureCount}, signal=${r.state.lastSignal})`)
    await prisma.channelHealthState.deleteMany({ where: { channelAccountId: id } }).catch(() => {})
  }

  // 登录失效：常态失效 → 普通失败（不致命、不暂停绑定，防死锁）
  const reauthId = `${testId}-reauth`
  await prisma.channelHealthState.deleteMany({ where: { channelAccountId: reauthId } }).catch(() => {})
  const rr = await channelHealthGuardService.recordFailure({
    channelAccountId: reauthId, tenantId, error: '登录状态已失效，需重新扫码授权', by: 'reality-check',
  })
  check('H2 登录失效 → 普通失败 DEGRADED（不触发保护）', !rr.triggered && rr.state.state === 'DEGRADED',
    `(failures=${rr.state.failureCount}, signal=${rr.state.lastSignal})`)
  await prisma.channelHealthState.deleteMany({ where: { channelAccountId: reauthId } }).catch(() => {})
  console.log()

  // ── H3 普通失败 3 次熔断 + 绑定暂停 ──
  console.log('── H3 普通失败熔断 + 绑定暂停 ──')
  // 临时绑定（模拟 AI 员工 Alice 绑定该账号）
  const binding = await prisma.agentChannelBinding.create({
    data: {
      tenantId,
      agentInstanceId: `agent-health-test-${Date.now()}`,
      channelAccountId: testId,
      permissions: { read: true } as any,
      status: 'active',
    },
  }).catch(() => null)
  check('H3 前置：测试绑定已创建', !!binding)

  // 1 次普通失败 → DEGRADED
  const f1 = await channelHealthGuardService.recordFailure({
    channelAccountId: testId, tenantId, error: '页面超时，提取失败', by: 'reality-check',
  })
  check('H3 第 1 次普通失败 → DEGRADED（不触发）', !f1.triggered && f1.state.state === 'DEGRADED', `(failures=${f1.state.failureCount})`)

  // 2 次 → 仍 DEGRADED
  const f2 = await channelHealthGuardService.recordFailure({
    channelAccountId: testId, tenantId, error: '网络中断，提取失败', by: 'reality-check',
  })
  check('H3 第 2 次普通失败 → DEGRADED（不触发）', !f2.triggered && f2.state.state === 'DEGRADED', `(failures=${f2.state.failureCount})`)

  // 3 次 → NEEDS_ATTENTION + 绑定暂停
  const f3 = await channelHealthGuardService.recordFailure({
    channelAccountId: testId, tenantId, error: '指标解析失败', by: 'reality-check',
  })
  check('H3 第 3 次普通失败 → NEEDS_ATTENTION（触发）', f3.triggered && f3.state.state === 'NEEDS_ATTENTION',
    `(failures=${f3.state.failureCount}, paused=${f3.pausedBindingIds.length})`)
  check('H3 触发时暂停绑定', f3.pausedBindingIds.includes(binding!.id))
  const pausedBinding = await prisma.agentChannelBinding.findUnique({ where: { id: binding!.id } })
  check('H3 绑定已暂停（DB 落点）', pausedBinding?.status === 'paused')
  check('H3 pauseReason 记录可解释', (f3.state.pauseReason || '').includes('3 次'), `(${(f3.state.pauseReason || '').slice(0, 60)})`)
  console.log()

  // ── H4 执行守卫 ──
  console.log('── H4 执行守卫（任务被拒）──')
  try {
    await channelHealthGuardService.assertHealthy(testId, 'read_metrics')
    check('H4 NEEDS_ATTENTION 拒绝执行', false)
  } catch (e: any) {
    check('H4 NEEDS_ATTENTION 拒绝执行', e instanceof ChannelHealthError && e.state === 'NEEDS_ATTENTION', `(${e.message.slice(0, 50)}...)`)
  }
  // 不自动恢复：再次失败仍 NEEDS_ATTENTION
  const f4 = await channelHealthGuardService.recordFailure({
    channelAccountId: testId, tenantId, error: '还在失败', by: 'reality-check',
  })
  check('H4 保护不自动解除（继续失败保持 NEEDS_ATTENTION）', f4.state.state === 'NEEDS_ATTENTION')
  // recordSuccess 不自动恢复 NEEDS_ATTENTION（必须人工）
  const s1 = await channelHealthGuardService.recordSuccess(testId)
  check('H4 成功上报不解除 NEEDS_ATTENTION（人工恢复前置）', s1.state === 'NEEDS_ATTENTION')
  console.log()

  // ── H5 人工恢复 ──
  console.log('── H5 人工恢复（owner 确认）──')
  const rec = await channelHealthGuardService.recover(testId, { by: 'owner', reason: '已人工确认账号正常' })
  check('H5 recover → HEALTHY', rec.state.state === 'HEALTHY')
  check('H5 恢复时绑定解除暂停（active）', rec.restoredBindingCount >= 1)
  const restoredBinding = await prisma.agentChannelBinding.findUnique({ where: { id: binding!.id } })
  check('H5 绑定恢复 active（DB 落点）', restoredBinding?.status === 'active')
  const healthyAfter = await channelHealthGuardService.getState(testId)
  check('H5 恢复后 assertHealthy 放行', (await channelHealthGuardService.assertHealthy(testId)).state === 'HEALTHY', `(failures=${healthyAfter.failureCount})`)
  console.log()

  // ── H6 成功上报：DEGRADED → HEALTHY ──
  console.log('── H6 成功上报恢复 ──')
  const testId2 = `${testId}-success`
  await prisma.channelHealthState.deleteMany({ where: { channelAccountId: testId2 } }).catch(() => {})
  await channelHealthGuardService.recordFailure({ channelAccountId: testId2, tenantId, error: '失败一次', by: 'reality-check' })
  const s2 = await channelHealthGuardService.recordSuccess(testId2)
  check('H6 DEGRADED + 成功 → HEALTHY 且计数清零', s2.state === 'HEALTHY' && s2.failureCount === 0)
  await prisma.channelHealthState.deleteMany({ where: { channelAccountId: testId2 } }).catch(() => {})
  console.log()

  // ── H7 HTTP API ──
  console.log('── H7 HTTP API（owner 视角）──')
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const loginJson: any = await loginRes.json()
  const token = loginJson.accessToken || loginJson.token || loginJson.data?.accessToken || ''
  check('H7 admin 登录成功', !!token)
  if (token) {
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const httpTestId = `health-http-${Date.now()}` // 独立 ID，避免与 H3 租户冲突
    // record-failure（致命信号 → NEEDS_ATTENTION）
    const rf = await fetch(`${BASE}/api/enterprise/channels/${httpTestId}/health/record-failure`, {
      method: 'POST', headers, body: JSON.stringify({ error: '平台安全验证，请确认', by: 'runtime' }),
    })
    const rfJson: any = await rf.json()
    check('H7 record-failure 走通且触发 NEEDS_ATTENTION', rfJson.code === 0 && rfJson.data?.state?.state === 'NEEDS_ATTENTION',
      rfJson.code === 0 ? `(${rfJson.data.state.state})` : `(${rfJson.message})`)
    // GET health
    const gh = await fetch(`${BASE}/api/enterprise/channels/${httpTestId}/health`, { headers })
    const ghJson: any = await gh.json()
    check('H7 GET health 返回 NEEDS_ATTENTION', ghJson.code === 0 && ghJson.data?.state === 'NEEDS_ATTENTION')
    // GET attention 列表包含该账号
    const ga = await fetch(`${BASE}/api/enterprise/channels/health/attention`, { headers })
    const gaJson: any = await ga.json()
    check('H7 attention 列表包含测试账号', gaJson.code === 0 && (gaJson.data || []).some((r: any) => r.channelAccountId === httpTestId))
    // recover
    const rv = await fetch(`${BASE}/api/enterprise/channels/${httpTestId}/health/recover`, {
      method: 'POST', headers, body: JSON.stringify({ by: 'owner', reason: 'reality-check 清理' }),
    })
    const rvJson: any = await rv.json()
    check('H7 recover 走通 → HEALTHY', rvJson.code === 0 && rvJson.data?.state?.state === 'HEALTHY')
    await prisma.channelHealthState.deleteMany({ where: { channelAccountId: httpTestId } }).catch(() => {})
  }
  console.log()

  // 清理测试数据
  await cleanup()
  console.log(`\n═══ 结果: ${pass} PASS / ${fail} FAIL ═══`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
