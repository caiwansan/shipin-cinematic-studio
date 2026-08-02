/**
 * SPRINT-MEDIA-CHANNEL-01 Task03.2 Phase A — 抖音手机号+验证码登录（长驻进程）
 * 1. 独立 playwright（headful, DISPLAY=:99）打开 creator.douyin.com
 * 2. 切「验证码登录」→ 输入手机号 → 点「获取验证码」（短信发给掌柜）
 * 3. 轮询 /tmp/phase-a-sms-code.txt（掌柜把短信验证码写入）→ 填入 → 登录
 * 4. 登录成功 → cookies 导入 browserRuntime 会话 → connectChannel 检测登录态
 *    → refreshChannelCredential AES 回写 → DB 验证 G1
 */
import { channelService } from '../src/services/enterprise/channel.service.js'
import { DouyinBrowserAdapter } from '../src/enterprise/channel/adapters/douyin-browser.adapter.js'
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'
import { prisma } from '../src/utils/index.js'
import { chromium } from 'playwright'
import * as fs from 'fs'

process.on('unhandledRejection', (e: any) => { console.error('UNHANDLED_REJECTION:', e?.stack || e); process.exit(1) })
process.on('uncaughtException', (e: any) => { console.error('UNCAUGHT:', e?.stack || e); process.exit(1) })

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const PHONE = process.env.PHONE || '19138085989'
const CODE_FILE = '/tmp/phase-a-sms-code.txt'
const SHOT = (name: string) => `/tmp/browser-sessions/phase-a-${name}.png`

async function main() {
  channelService.registerAdapter(new DouyinBrowserAdapter({
    getCredential: (id) => channelService.getCredential(id),
    persistCredential: (id, cred) => channelService.updateCredential(id, cred),
  }))

  // 清理旧测试账号 + 创建新账号
  const stale = await prisma.enterpriseChannelAccount.findMany({ where: { externalAccountId: { startsWith: 'phase-a-' } }, select: { id: true } })
  if (stale.length) await prisma.enterpriseChannelAccount.deleteMany({ where: { id: { in: stale.map(x => x.id) } } })
  const account = await channelService.connectAccount({
    tenantId: 'phase-a',
    platform: 'douyin',
    accountName: 'PhaseA 真实连接测试号',
    externalAccountId: 'phase-a-' + Date.now(),
    credential: { cookieData: '[]' },
  })
  console.log('ACCOUNT_ID:', account.id)

  // ===== 独立浏览器：验证码登录 =====
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized'],
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
  const page = await context.newPage()
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    // @ts-ignore
    window.chrome = window.chrome || { runtime: {} }
  })
  await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(6000)
  await page.screenshot({ path: SHOT('landing') })

  // 切「验证码登录」tab
  let switched = false
  for (const sel of ['text=验证码登录', 'text=验证码登錄', '[data-testid*=code]']) {
    try {
      const tab = page.locator(sel).first()
      await tab.click({ timeout: 6000 })
      switched = true
      console.log('TAB_SWITCHED:', sel)
      break
    } catch {}
  }
  if (!switched) console.log('TAB_SWITCH_WARN: 未找到验证码登录 tab，尝试直接输入')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: SHOT('after-tab') })

  // 输入手机号
  const phoneInput = page.locator('input[placeholder*="手机号"], input[type="tel"], input[placeholder*="请输入手机号"]').first()
  await phoneInput.fill(PHONE, { timeout: 15000 })
  console.log('PHONE_FILLED:', PHONE)
  await page.waitForTimeout(1000)

  // 点「获取验证码」
  let getCodeBtn = page.getByRole('button', { name: '获取验证码' }).first()
  if (!(await getCodeBtn.count())) getCodeBtn = page.getByText('获取验证码', { exact: false }).first()
  await getCodeBtn.click({ timeout: 10000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: SHOT('code-requested') })
  const bodyText = await page.evaluate(() => (document.body?.innerText || '').replace(/\n+/g, ' | ').slice(0, 400)).catch(() => '')
  console.log('AFTER_GETCODE_TEXT:', bodyText.slice(0, 200))

  // 轮询验证码文件（掌柜提供）
  if (fs.existsSync(CODE_FILE)) fs.unlinkSync(CODE_FILE)
  console.log('WAITING_SMS_CODE: 请掌柜查收短信并回复验证码...')
  const deadline = Date.now() + 10 * 60 * 1000
  let code = ''
  while (Date.now() < deadline) {
    if (fs.existsSync(CODE_FILE)) {
      const c = fs.readFileSync(CODE_FILE, 'utf-8').trim()
      if (c.length >= 4) { code = c; break }
    }
    await sleep(3000)
  }
  if (!code) { console.log('SMS_TIMEOUT'); process.exit(1) }
  console.log('SMS_CODE_RECEIVED:', code)

  // 填验证码（可能是单输入框或分段输入框）
  const codeInput = page.locator('input[placeholder*="验证码"], input[placeholder*="请输入验证码"], input[maxlength="6"]').first()
  const codeCount = await page.locator('input[placeholder*="验证码"], input[placeholder*="请输入验证码"], input[maxlength="6"]').count()
  if (codeCount > 0) {
    await codeInput.fill(code)
    console.log('CODE_FILLED_SINGLE')
  } else {
    const segs = page.locator('input[data-index], .captcha-code input, input[maxlength="1"]')
    const n = await segs.count()
    if (n > 0) {
      for (let i = 0; i < code.length && i < n; i++) await segs.nth(i).fill(code[i])
      console.log('CODE_FILLED_SEGMENTS:', n)
    } else {
      console.log('CODE_INPUT_NOT_FOUND')
      await page.screenshot({ path: SHOT('code-input-missing') })
      process.exit(1)
    }
  }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: SHOT('code-filled') })

  // 点登录
  let loginBtn = page.getByRole('button', { name: '登录', exact: false }).last()
  if (!(await loginBtn.count())) loginBtn = page.locator('[type="submit"]').last()
  await loginBtn.click({ timeout: 10000 }).catch((e: any) => console.log('LOGIN_CLICK_WARN:', e.message))
  await page.waitForTimeout(10000)
  await page.screenshot({ path: SHOT('post-login') })

  const url = page.url()
  const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '')
  console.log('POST_LOGIN_URL:', url)
  console.log('POST_LOGIN_TEXT:', text.replace(/\n+/g, ' | ').slice(0, 300))

  const looksLoggedIn = !/扫码登录|验证码登录|获取验证码/.test(text) && text.length > 100
  console.log('LOGIN_DETECT:', looksLoggedIn ? 'SUCCESS' : 'UNCERTAIN')

  if (!looksLoggedIn) {
    console.log('LOGIN_FAILED: 仍在登录页，可能验证码错误或需图形验证')
    process.exit(1)
  }

  // ===== cookies 导出 + 导入 browserRuntime 会话 =====
  const cookies = await context.cookies()
  fs.writeFileSync('/tmp/browser-sessions/phase-a-cookies.json', JSON.stringify(cookies))
  console.log('COOKIES_SAVED:', cookies.length)

  const connect = await channelService.connectChannel(account.id)
  console.log('CONNECT_STATUS:', connect.status)
  if (connect.status !== 'waiting_login' || !connect.sessionId) {
    console.log('UNEXPECTED_CONNECT:', JSON.stringify(connect).slice(0, 200))
    process.exit(1)
  }
  const sessionId = connect.sessionId
  await sleep(3000)

  // 导入 cookies 到 browserRuntime 浏览器实例
  const rt = await browserRuntime.getOrCreate(sessionId, { headless: false })
  try { await rt.context.addCookies(cookies) } catch (e: any) { console.log('ADD_COOKIES_WARN:', e.message) }
  console.log('COOKIES_IMPORTED')

  // 检测登录态 → 已登录则走凭证回写
  const loggedIn = await channelService.waitChannelLogin(account.id, 3 * 60 * 1000)
  console.log('LOGIN_RESULT:', JSON.stringify(loggedIn).slice(0, 150))

  if (loggedIn.status === 'connected') {
    const refresh = await channelService.refreshChannelCredential(account.id)
    console.log('CREDENTIAL_REFRESH:', JSON.stringify(refresh).slice(0, 200))
    const db = await prisma.enterpriseChannelAccount.findUnique({ where: { id: account.id } })
    console.log('DB_STATUS:', db?.connectionStatus, '| connectedAt:', db?.connectedAt, '| hasCredential:', !!db?.credentialEncrypted)
    console.log('PHASE_A_SUCCESS')
  } else {
    console.log('PHASE_A_LOGIN_STUCK')
  }
  await browser.close()
  process.exit(0)
}

main().catch(e => { console.error('TEST_ERROR:', e.message); process.exit(1) })
