/**
 * TASK03.1.5 Reality Test — Persistent Browser Profile Upgrade
 *
 * 验证目标（掌柜验收 6 条）：
 * 1. BrowserRuntimeService 基于 channelAccountId 计算持久化 profile 路径
 * 2. launchPersistentContext(userDataDir) 主路径：真实 Chrome profile 启动
 * 3. 登录态持久化：close 后 profile 目录保留（Cookie/LocalStorage 不丢）
 * 4. 会话复用：同 sessionId 再次获取复用同一实例（不重复启动）
 * 5. ChannelBrowserSession 模型：账号身份与运行环境分离记录（DB 层）
 * 6. cookie restore 仍可用（fallback 兼容）
 */
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'
import { channelBrowserSessionService } from '../src/services/enterprise/channel-browser-session.service.js'
import { prisma } from '../src/utils/index.js'
import fs from 'fs'
import path from 'path'

let pass = 0
let fail = 0
const results: { id: string; name: string; pass: boolean; detail: string }[] = []

function assert(id: string, name: string, cond: boolean, detail: string) {
  if (cond) pass++
  else fail++
  results.push({ id, name, pass: cond, detail })
  console.log(`${cond ? '✅' : '❌'} ${id} ${name} — ${detail}`)
}

async function main() {
  const accountId = `test-account-${Date.now()}`
  const sid = `douyin:${accountId}`

  // ── R1: profile 路径计算（基于 channelAccountId，目录隔离） ──
  const p1 = browserRuntime.getProfilePath('douyin', accountId)
  const p2 = browserRuntime.getProfilePath('douyin', 'another-account')
  const p3 = browserRuntime.getProfilePath('xhs', accountId)
  assert(
    'R1.1', 'profile 路径含 platform + accountId',
    p1.includes('douyin') && p1.includes(accountId),
    `path=${p1}`,
  )
  assert(
    'R1.2', '不同账号目录隔离',
    p1 !== p2 && !p1.includes('another-account'),
    `p1=${p1} p2=${p2}`,
  )
  assert(
    'R1.3', '不同平台目录隔离',
    p1 !== p3,
    `p1=${p1} p3=${p3}`,
  )
  assert(
    'R1.4', '路径不含非法字符（accountId 清洗）',
    !browserRuntime.getProfilePath('douyin', '../evil/../x').includes('..'),
    `cleaned=${browserRuntime.getProfilePath('douyin', '../evil/../x')}`,
  )

  // ── R2: launchPersistentContext 主路径（真实 Chrome profile 启动） ──
  const profilePath = p1
  await browserRuntime.getOrCreatePersistent(sid, profilePath, { headless: true })
  assert(
    'R2.1', '持久化实例已创建',
    browserRuntime.isPersistent(sid),
    `isPersistent=${browserRuntime.isPersistent(sid)}`,
  )
  const profileExists = fs.existsSync(profilePath)
  assert('R2.2', 'profile 目录已创建（user-data-dir 落盘）', profileExists, `path=${profilePath}`)
  const hasChromeData = fs.existsSync(path.join(profilePath, 'Default')) || fs.readdirSync(profilePath).length > 0
  assert('R2.3', 'profile 目录含真实 Chrome 数据', hasChromeData, `entries=${fs.readdirSync(profilePath).slice(0, 5).join(',')}`)

  // 写一个测试 cookie 到持久化 context（模拟登录态；带 expires 才落盘）
  const ctx = (await browserRuntime.getOrCreatePersistent(sid, profilePath, { headless: true })).context
  await ctx.addCookies([{
    name: 'task0315_test_cookie',
    value: 'persisted-value',
    domain: '.douyin.com',
    path: '/',
    expires: Math.floor(Date.now() / 1000) + 86400 * 7,
  }])
  // 访问页面触发 Chromium flush cookie 到 profile
  await ctx.newPage().then(p => p.goto('https://www.douyin.com/', { timeout: 20000 }).catch(() => {}))
  await new Promise(r => setTimeout(r, 2000))
  await browserRuntime.close(sid)
  assert('R2.4', 'close 后实例已清理', !browserRuntime.isPersistent(sid), `isPersistent=${browserRuntime.isPersistent(sid)}`)
  assert('R2.5', 'close 后 profile 目录保留（登录态持久化核心）', fs.existsSync(profilePath), `path=${profilePath}`)

  // ── R3: 会话复用（同 profile 再次启动，cookie 仍在） ──
  await browserRuntime.getOrCreatePersistent(sid, profilePath, { headless: true })
  const cookies = await browserRuntime.getCookies(sid)
  const restored = cookies.find((c: any) => c.name === 'task0315_test_cookie')
  assert('R3.1', '重启后持久化 cookie 仍在（登录态不丢）', !!restored, `cookie=${restored?.value ?? 'MISSING'}`)

  // 复用：不 close 再次获取 → 同一实例
  const instBefore = await browserRuntime.getOrCreatePersistent(sid, profilePath, { headless: true })
  const instAfter = await browserRuntime.getOrCreatePersistent(sid, profilePath, { headless: true })
  assert('R3.2', '同 session 重复获取复用同一实例', instBefore === instAfter, 'same reference')
  await browserRuntime.close(sid)

  // ── R4: ChannelBrowserSession DB 记录（身份与运行环境分离） ──
  // 需要一个真实 enterprise_channel_account 行做 FK（用测试租户账号）
  const tenant = await prisma.tenant.findFirst().catch(() => null)
  const user = await prisma.user.findFirst().catch(() => null)
  const ownerId = user?.id || '00000000-0000-0000-0000-000000000001'
  const created = await prisma.enterpriseChannelAccount.create({
    data: {
      tenantId: tenant?.id || 'test-tenant-0315',
      channelType: 'douyin',
      channelName: `TASK03.1.5测试-${Date.now()}`,
      ownerId,
      connectionStatus: 'PENDING',
      metadata: { test: true },
    },
  })
  const session = await channelBrowserSessionService.getOrCreate(created.id, {
    browserType: 'chromium',
    profilePath,
  })
  assert('R4.1', 'ChannelBrowserSession 创建成功', !!session.id, `id=${session.id}`)
  assert('R4.2', 'session 记录 profilePath', session.profilePath === profilePath, `path=${session.profilePath}`)
  assert('R4.3', '初始状态 IDLE', session.status === 'IDLE', `status=${session.status}`)

  await channelBrowserSessionService.markStarted(session.id)
  const afterStart = await channelBrowserSessionService.findByAccount(created.id)
  assert('R4.4', 'markStarted → RUNNING + lastStartedAt', afterStart?.status === 'RUNNING' && !!afterStart?.lastStartedAt, `status=${afterStart?.status}`)

  await channelBrowserSessionService.markHealthCheck(session.id, { loginState: 'connected' })
  const afterHealth = await channelBrowserSessionService.findByAccount(created.id)
  assert('R4.5', 'markHealthCheck → lastHealthCheckAt 更新', !!afterHealth?.lastHealthCheckAt, `at=${afterHealth?.lastHealthCheckAt}`)

  await channelBrowserSessionService.markError(session.id, 'test error')
  const afterErr = await channelBrowserSessionService.findByAccount(created.id)
  assert('R4.6', 'markError → ERROR + lastError', afterErr?.status === 'ERROR' && afterErr?.lastError === 'test error', `status=${afterErr?.status}`)

  await channelBrowserSessionService.markIdle(session.id)
  const afterIdle = await channelBrowserSessionService.findByAccount(created.id)
  assert('R4.7', 'markIdle → 恢复 IDLE', afterIdle?.status === 'IDLE', `status=${afterIdle?.status}`)

  // R4.8: 唯一约束（同账号同 browserType 不重复建行）
  const sessionAgain = await channelBrowserSessionService.getOrCreate(created.id, { profilePath })
  assert('R4.8', '同账号同类型 upsert（不重复建行）', sessionAgain.id === session.id, `sameId=${sessionAgain.id === session.id}`)

  // 清理测试数据
  await prisma.enterpriseChannelAccount.delete({ where: { id: created.id } })
  fs.rmSync(profilePath, { recursive: true, force: true })

  // ── R5: cookie restore fallback 兼容 ──
  const sid2 = `douyin:test-fallback-${Date.now()}`
  await browserRuntime.getOrCreate(sid2, { headless: true })
  const ok = await browserRuntime.restoreCookies(sid2, [{
    name: 'sessionid',
    value: 'x',
    domain: '.douyin.com',
    path: '/',
  }])
  assert('R5.1', 'restoreCookies fallback 仍可用', ok === true, `ok=${ok}`)
  const ck = await browserRuntime.getCookies(sid2)
  assert('R5.2', 'fallback cookie 注入成功', ck.some((c: any) => c.name === 'sessionid'), `count=${ck.length}`)
  await browserRuntime.close(sid2)

  console.log(`\n===== TASK03.1.5 REALITY RESULT: ${pass} PASS / ${fail} FAIL =====`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error('REALITY TEST ERROR:', e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
