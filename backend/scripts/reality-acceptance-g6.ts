/**
 * G6 Reality Acceptance — AI 员工第一台数字电脑黄金验收脚本
 *
 * 用法：
 *   npx tsx scripts/reality-acceptance-g6.ts --step 1        # 掌柜扫码登录（交互式）
 *   npx tsx scripts/reality-acceptance-g6.ts --step 2-6      # 剩余自动化步骤
 *   npx tsx scripts/reality-acceptance-g6.ts --all
 *   npx tsx scripts/reality-acceptance-g6.ts --step 2 --platform douyin
 *
 * 六步：1 登录 / 2 数字电脑 / 3 浏览器关闭恢复 / 4 服务重启恢复 / 5 AI员工读取 / 6 Owner View 截图
 * 平台模板：--platform 切换（douyin/kuaishou/xiaohongshu/shipinhao）
 */
import { prisma } from '../src/utils/index.js'
import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'

const BASE = 'http://127.0.0.1:4002'
const FRONT = 'https://aigc.fushtn.com'
const OUT = '/root/shipin-cinematic-studio/docs/reality'
const PLATFORMS: Record<string, string> = { douyin: 'douyin', kuaishou: 'kuaishou', xiaohongshu: 'xiaohongshu', shipinhao: 'shipinhao' }

let pass = 0, fail = 0
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name} ${extra}`) } else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

async function api(path: string, method = 'GET', body?: any, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

async function login() {
  const r = await api('/api/admin/login', 'POST', { username: 'admin', password: 'admin123' })
  return (r.json as any).token as string
}

async function main() {
  const args = process.argv.slice(2)
  const stepIdx = args.indexOf('--step')
  const stepArgRaw = stepIdx >= 0 ? (args[stepIdx + 1] || 'all') : (args.find(a => a.startsWith('--step=')) || '').split('=')[1] || 'all'
  const platform = (args.find(a => a.startsWith('--platform=')) || '--platform=douyin').split('=')[1]
  if (!PLATFORMS[platform]) { console.error(`未知平台 ${platform}，可选: ${Object.keys(PLATFORMS)}`); process.exit(1) }
  const steps: number[] = stepArgRaw === 'all' ? [1, 2, 3, 4, 5, 6] : stepArgRaw.includes('-') ? (() => { const [a, b] = stepArgRaw.split('-').map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i) })() : [Number(stepArgRaw)]
  const token = await login().catch(() => '')
  console.log(`═══ G6 Reality Acceptance — ${platform} ═══\n`)

  if (steps.includes(1)) await step1(platform)
  if (steps.includes(2)) await step2(platform)
  if (steps.includes(3)) await step3(platform)
  if (steps.includes(4)) await step4(platform)
  if (steps.includes(5)) await step5(platform)
  if (steps.includes(6)) await step6()

  console.log(`\n═══ G6 结果: ${pass} PASS / ${fail} FAIL ═══`)
  process.exit(fail > 0 ? 1 : 0)
}

// ── Step 1 登录：发起连接 → 二维码 → 等掌柜扫码 → 断言真实身份 ──
async function step1(platform: string) {
  console.log('── Step 1 登录（用户扫码）──')
  const channels = await prisma.enterpriseChannelAccount.findMany({ where: { channelType: platform } })
  if (channels.length === 0) { check('S1 找到平台账号', false, `(无 ${platform} 账号)`); return }
  const acc = channels[0]
  const r = await api(`/api/enterprise/channels/${acc.id}/connect`, 'POST', {}, await login())
  console.log(`  连接发起: ${r.status} ${(r.json as any).message || ''}`)
  console.log('  ⏳ 请掌柜用抖音 App 扫码（浏览器已打开二维码页面）...')
  const deadline = Date.now() + 10 * 60 * 1000
  let ok = false
  while (Date.now() < deadline) {
    await new Promise(res => setTimeout(res, 5000))
    const fresh = await prisma.enterpriseChannelAccount.findUnique({ where: { id: acc.id } })
    if (fresh?.connectionStatus === 'CONNECTED' && fresh.externalAccountId) { ok = true; break }
  }
  if (!ok) { check('S1 扫码登录成功', false, '(超时 10min，未检测到 CONNECTED)'); return }
  const final = await prisma.enterpriseChannelAccount.findUnique({ where: { id: acc.id } })
  check('S1 status=CONNECTED', final?.connectionStatus === 'CONNECTED')
  check('S1 accountName 真实', !!final?.accountName && final.accountName !== '未登录', `(${final?.accountName})`)
  check('S1 externalAccountId 真实', !!final?.externalAccountId, `(${final?.externalAccountId})`)
  console.log()
}

// ── Step 2 数字电脑确认 ──
async function step2(platform: string) {
  console.log('── Step 2 数字电脑确认 ──')
  const acc = await prisma.enterpriseChannelAccount.findFirst({ where: { channelType: platform } })
  const ws = await prisma.browserWorkspace.findFirst({ where: { channelAccountId: acc?.id } })
  check('S2 workspace 存在', !!ws)
  if (!ws) return
  check('S2 status=READY', ws.status === 'READY', `(${ws.status})`)
  check('S2 profile 目录存在', existsSync(ws.profilePath), `(${ws.profilePath})`)
  check('S2 绑定同一账号', ws.channelAccountId === acc?.id)
  console.log()
}

// ── Step 3 浏览器关闭恢复 ──
async function step3(platform: string) {
  console.log('── Step 3 浏览器关闭恢复 ──')
  const acc = await prisma.enterpriseChannelAccount.findFirst({ where: { channelType: platform } })
  const ws = await prisma.browserWorkspace.findFirst({ where: { channelAccountId: acc?.id } })
  if (!ws) { check('S3 无 workspace', false); return }
  const profilePath = ws.profilePath
  const extIdBefore = acc?.externalAccountId
  const stBefore = acc?.connectionStatus
  // 关闭浏览器（ps 按 comm 过滤 chrome + args 含 profilePath，避免误杀自身 shell）
  const killed = execSync(`ps -eo pid=,comm=,args= | awk -v p="${profilePath}" '$2 ~ /chrome/ && index($0, p) {print $1}' | xargs -r kill -9 2>/dev/null; echo $?`, { encoding: 'utf8' }).trim()
  console.log(`  浏览器已关闭 (kill exit=${killed})，重启 api-server 触发 RecoveryService...`)
  execSync('cd /root/shipin-cinematic-studio && npx pm2 restart api-server >/dev/null 2>&1')
  await new Promise(res => setTimeout(res, 12000))
  const accAfter = await prisma.enterpriseChannelAccount.findUnique({ where: { id: acc!.id } })
  const wsAfter = await prisma.browserWorkspace.findUnique({ where: { id: ws.id } })
  check('S3 same profile（路径不变）', wsAfter?.profilePath === profilePath)
  check('S3 same identity（externalAccountId 不变）', accAfter?.externalAccountId === extIdBefore, `(${extIdBefore})`)
  check('S3 same account（状态不误降级）', accAfter?.connectionStatus === stBefore, `(${stBefore} → ${accAfter?.connectionStatus})`)
  console.log()
}

// ── Step 4 服务重启恢复 ──
async function step4(platform: string) {
  console.log('── Step 4 服务重启恢复 ──')
  const logs = execSync('npx pm2 logs api-server --lines 500 --nostream 2>/dev/null', { encoding: 'utf8' })
  const scan = logs.match(/BrowserWorkspaceRecovery\] 扫描到 \d+ 个/) || []
  check('S4 RecoveryService 扫描 workspace', scan.length > 0, scan[0] || '')
  const acc = await prisma.enterpriseChannelAccount.findFirst({ where: { channelType: platform } })
  check('S4 CONNECTED 保持', acc?.connectionStatus === 'CONNECTED', `(${acc?.connectionStatus})`)
  check('S4 身份保留', !!acc?.externalAccountId, `(${acc?.externalAccountId})`)
  console.log()
}

// ── Step 5 AI 员工读取 ──
async function step5(platform: string) {
  console.log('── Step 5 AI 员工读取（真实 metrics）──')
  const account = await prisma.enterpriseChannelAccount.findFirst({ where: { channelType: platform } })
  if (!account) { check('S5 找到平台账号', false); return }
  const binding = await prisma.agentChannelBinding.findFirst({ where: { channelAccountId: account.id } })
  if (!binding) { check('S5 找到 AI 员工绑定', false, '(无绑定)'); return }
  const agentId = binding.agentInstanceId
  const accId = binding.channelAccountId
  const { channelMetricsService } = await import('../src/services/enterprise/channel/metrics/channel-metrics.service.js')
  let snapshot: any = null
  try {
    snapshot = await channelMetricsService.collectForAgent(agentId, accId, { tenantId: account.tenantId, organizationId: account.organizationId || undefined })
  } catch (e: any) { console.log(`  collect 异常: ${e.message}`) }
  if (snapshot?.status === 'available') {
    check('S5 真实数据可用', !!snapshot.metrics, `(followers=${snapshot.metrics?.followers} works=${snapshot.metrics?.works})`)
  } else {
    check('S5 无数据 → unavailable + reason（绝不返回 0）', snapshot?.status === 'unavailable' && !!snapshot?.unavailableReason, `(status=${snapshot?.status} reason=${(snapshot?.unavailableReason || '').slice(0, 30)})`)
  }
  check('S5 无 0 冒充', !snapshot?.metrics || Object.values(snapshot.metrics).every((v: any) => v !== 0), '')
  console.log()
}

// ── Step 6 Owner View 截图 ──
async function step6() {
  console.log('── Step 6 Owner View 截图 ──')
  mkdirSync(OUT, { recursive: true })
  const { chromium } = await import('playwright')
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${FRONT}/?login=1`, { waitUntil: 'networkidle', timeout: 60000 })
  const loginResult = await page.evaluate(async () => {
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })
    const d: any = await res.json()
    return { ok: res.ok, token: d.token || '' }
  })
  if (!loginResult.token) { check('S6 前端登录', false); await browser.close(); return }
  await page.evaluate((tok: string) => { localStorage.setItem('auth_token', tok); localStorage.setItem('token', tok) }, loginResult.token)
  await page.goto(`${FRONT}/workspace/media/accounts`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
  const path = `${OUT}/G6-ACCEPTANCE-01-owner-view.png`
  await page.screenshot({ path, fullPage: false })
  await browser.close()
  check('S6 截图完成', existsSync(path), `(${path})`)
  console.log()
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
