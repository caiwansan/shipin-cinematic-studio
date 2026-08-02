/**
 * Task03.2 Phase A v2 — 手机号+验证码登录（真实交互版）
 * 1. type 输入手机号 → 2. 点击「获取验证码」父级 → 3. 确认 send_sms 请求
 * 4. 轮询验证码文件 → 5. 填码 → 6. 点登录 → 7. cookies 导入 browserRuntime → 凭证回写
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

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
  const page = await context.newPage()
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    // @ts-ignore
    window.chrome = window.chrome || { runtime: {} }
  })

  let smsSent = false
  page.on('request', req => {
    if (req.resourceType() === 'xhr' || req.resourceType() === 'fetch') {
      const u = req.url()
      if (/send_sms|send_sms_code|sms_code|verify_code/i.test(u)) {
        smsSent = true
        console.log('SMS_REQ:', req.method(), u.replace('https://creator.douyin.com', '').slice(0, 120), '|', req.postData()?.slice(0, 100) || '')
      }
    }
  })
  page.on('response', async res => {
    if (/send_sms|send_sms_code|sms_code|verify_code/i.test(res.url())) {
      let body = ''
      try { body = (await res.text()).slice(0, 300) } catch {}
      console.log('SMS_RES:', res.status(), body)
    }
  })

  await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(8000)

  // 手机号框：真实点击 + 逐字符输入
  const phoneInput = page.locator('input.yKcGN1NT').first()
  await phoneInput.click({ timeout: 15000 })
  await page.waitForTimeout(500)
  await phoneInput.press('Control+A')
  await phoneInput.type(PHONE, { delay: 60 })
  console.log('PHONE_TYPED')
  await page.waitForTimeout(1200)

  // 获取验证码按钮状态
  const spanCls = await page.evaluate(() => {
    const s = document.querySelector('span.gKXDWaPG')
    return s ? (s.className + '') : 'NOT_FOUND'
  }).catch(() => 'ERR')
  console.log('GETCODE_SPAN_CLS:', spanCls)

  // 点击「获取验证码」——父级 DIV + SPAN 双保险
  const clicked = await page.evaluate(() => {
    const span = document.querySelector('span.gKXDWaPG')
    if (!span) return 'NO_SPAN'
    const parent = span.closest('div')
    const r = parent?.getBoundingClientRect()
    ;(parent as HTMLElement)?.click()
    return parent ? 'PARENT_CLICKED:' + Math.round(r!.x) + ',' + Math.round(r!.y) + ',' + Math.round(r!.width) : 'NO_PARENT'
  }).catch((e: any) => 'EVAL_ERR:' + e.message)
  console.log('CLICK_EVAL:', clicked)

  // 等 8 秒看短信请求
  for (let i = 0; i < 8; i++) {
    await sleep(1000)
    if (smsSent) break
  }
  if (!smsSent) {
    // 补充：playwright 坐标点击父 div 中心
    try {
      const box = await page.locator('div.qnf7kdoT').first().boundingBox()
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        console.log('MOUSE_CLICKED:', Math.round(box.x), Math.round(box.y))
      }
    } catch (e: any) { console.log('MOUSE_CLICK_ERR:', e.message) }
    await sleep(6000)
  }
  console.log('SMS_SENT:', smsSent)

  // 截图 + 页面提示检查
  await page.screenshot({ path: SHOT('v2-after-getcode') })
  const text = await page.evaluate(() => (document.body?.innerText || '').replace(/\n+/g, ' | ')).catch(() => '')
  console.log('PAGE_TEXT:', text.slice(0, 350))
  const frames = page.frames().map(f => f.url().slice(0, 90)).filter(u => /verify|captcha/.test(u))
  console.log('VERIFY_FRAMES:', JSON.stringify(frames))

  if (!smsSent) {
    console.log('SMS_NOT_SENT_FAIL')
    await browser.close()
    process.exit(1)
  }

  // ===== 等掌柜验证码 =====
  if (fs.existsSync(CODE_FILE)) fs.unlinkSync(CODE_FILE)
  console.log('WAITING_SMS_CODE: 短信已发出，请掌柜查收并回复验证码...')
  const deadline = Date.now() + 10 * 60 * 1000
  let code = ''
  while (Date.now() < deadline) {
    if (fs.existsSync(CODE_FILE)) {
      const c = fs.readFileSync(CODE_FILE, 'utf-8').trim()
      if (c.length >= 4) { code = c; break }
    }
    await sleep(3000)
  }
  if (!code) { console.log('SMS_TIMEOUT'); await browser.close(); process.exit(1) }
  console.log('SMS_CODE_RECEIVED:', code)

  // 填验证码
  const codeInput = page.locator('input.tnpNAdqe').first()
  await codeInput.click({ timeout: 10000 })
  await codeInput.type(code, { delay: 80 })
  console.log('CODE_TYPED')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: SHOT('v2-code-filled') })

  // 点登录（DIV 按钮）
  const loginClicked = await page.evaluate(() => {
    const btn = document.querySelector('div.r7j70rK2')
    if (!btn) return 'NO_BTN'
    ;(btn as HTMLElement).click()
    return 'LOGIN_CLICKED'
  }).catch((e: any) => 'EVAL_ERR:' + e.message)
  console.log(loginClicked)
  await page.waitForTimeout(12000)
  await page.screenshot({ path: SHOT('v2-post-login') })

  const url = page.url()
  const text2 = await page.evaluate(() => document.body?.innerText || '').catch(() => '')
  console.log('POST_LOGIN_URL:', url)
  console.log('POST_LOGIN_TEXT:', text2.replace(/\n+/g, ' | ').slice(0, 250))

  const looksLoggedIn = !/扫码登录|验证码登录|获取验证码/.test(text2) && text2.length > 100
  console.log('LOGIN_DETECT:', looksLoggedIn ? 'SUCCESS' : 'UNCERTAIN')

  if (!looksLoggedIn) {
    console.log('LOGIN_FAILED: 仍在登录页（验证码错误/需图形验证/风控）')
    await browser.close()
    process.exit(1)
  }

  // ===== cookies 导出 + 导入 browserRuntime =====
  const cookies = await context.cookies()
  fs.writeFileSync('/tmp/browser-sessions/phase-a-cookies.json', JSON.stringify(cookies))
  console.log('COOKIES_SAVED:', cookies.length)

  const connect = await channelService.connectChannel(account.id)
  console.log('CONNECT_STATUS:', connect.status)
  if (connect.status !== 'waiting_login' || !connect.sessionId) {
    console.log('UNEXPECTED_CONNECT:', JSON.stringify(connect).slice(0, 200))
    await browser.close()
    process.exit(1)
  }
  const sessionId = connect.sessionId
  await sleep(3000)

  const rt = await browserRuntime.getOrCreate(sessionId, { headless: false })
  try { await rt.context.addCookies(cookies) } catch (e: any) { console.log('ADD_COOKIES_WARN:', e.message) }
  console.log('COOKIES_IMPORTED')

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
