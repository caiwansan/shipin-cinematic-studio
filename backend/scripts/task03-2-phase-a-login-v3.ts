/**
 * Task03.2 Phase A v3 — 验证码登录（全事件触发版）
 * 1. 填手机号 → 2. 全事件触发「获取验证码」→ 3. 确认倒计时（短信已发）
 * 4. 轮询验证码文件 → 5. 填码 → 6. 全事件触发登录 → 7. cookies → 凭证回写
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

/** 全事件触发点击（pointerdown→mousedown→...→click + touch 系列），绕开只监听部分事件的组件 */
async function fireAllEvents(page: import('playwright').Page, selector: string): Promise<string> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement
    if (!el) return 'NO_EL:' + sel
    const targets: HTMLElement[] = [el]
    const parent = el.closest('div')
    if (parent && parent !== el) targets.push(parent as HTMLElement)
    let fired = 0
    for (const t of targets) {
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'touchstart', 'touchend']) {
        try {
          const ev = type.startsWith('touch')
            ? new TouchEvent(type, { bubbles: true, cancelable: true })
            : new MouseEvent(type, { bubbles: true, cancelable: true, view: window })
          t.dispatchEvent(ev)
          fired++
        } catch {}
      }
    }
    return 'FIRED:' + fired
  }, selector).catch((e: any) => 'ERR:' + e.message)
}

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

  await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(8000)

  // 1) 填手机号（原生 setter + input 事件）
  await page.evaluate((phone) => {
    const input = document.querySelector('input.yKcGN1NT') as HTMLInputElement
    if (!input) return 'NO_INPUT'
    input.focus()
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, phone)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.blur()
    return 'SET:' + input.value
  }, PHONE)
  await page.waitForTimeout(1500)
  const val = await page.evaluate(() => (document.querySelector('input.yKcGN1NT') as HTMLInputElement)?.value || 'EMPTY').catch(() => 'ERR')
  console.log('PHONE_VALUE:', JSON.stringify(val))

  // 2) 全事件触发「获取验证码」
  const fired = await fireAllEvents(page, 'span.gKXDWaPG')
  console.log('GETCODE_FIRE:', fired)

  // 3) 确认倒计时（短信发出）
  let countdown = ''
  for (let i = 0; i < 8; i++) {
    await sleep(1000)
    const st = await page.evaluate(() => {
      const s = document.querySelector('span.gKXDWaPG') as HTMLElement
      return s ? (s.className + '|' + s.textContent) : 'GONE'
    }).catch(() => 'ERR')
    if (/重新发送|重新获取|秒/.test(st)) { countdown = st; break }
  }
  console.log('COUNTDOWN:', countdown)
  if (!/重新发送|重新获取/.test(countdown)) {
    console.log('SMS_NOT_SENT_FAIL')
    await page.screenshot({ path: SHOT('v3-no-sms') })
    await browser.close()
    process.exit(1)
  }
  console.log('SMS_CONFIRMED_SENT')

  // 4) 等掌柜验证码
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

  // 5) 填验证码
  const codeInput = page.locator('input.tnpNAdqe').first()
  await codeInput.click({ timeout: 10000 }).catch(() => {})
  await page.evaluate((c) => {
    const input = document.querySelector('input.tnpNAdqe') as HTMLInputElement
    if (!input) return 'NO_INPUT'
    input.focus()
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, c)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return 'SET:' + input.value
  }, code)
  await page.waitForTimeout(1500)
  const codeVal = await page.evaluate(() => (document.querySelector('input.tnpNAdqe') as HTMLInputElement)?.value || 'EMPTY').catch(() => 'ERR')
  console.log('CODE_VALUE:', JSON.stringify(codeVal))
  await page.screenshot({ path: SHOT('v3-code-filled') })

  // 6) 全事件触发登录
  const loginFired = await fireAllEvents(page, 'div.r7j70rK2')
  console.log('LOGIN_FIRE:', loginFired)
  await page.waitForTimeout(12000)
  await page.screenshot({ path: SHOT('v3-post-login') })

  const url = page.url()
  const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '')
  console.log('POST_LOGIN_URL:', url)
  console.log('POST_LOGIN_TEXT:', text.replace(/\n+/g, ' | ').slice(0, 250))

  const looksLoggedIn = !/扫码登录|验证码登录|获取验证码/.test(text) && text.length > 100
  console.log('LOGIN_DETECT:', looksLoggedIn ? 'SUCCESS' : 'UNCERTAIN')

  if (!looksLoggedIn) {
    console.log('LOGIN_FAILED: 仍在登录页（验证码错误/需图形验证/风控）')
    await browser.close()
    process.exit(1)
  }

  // 7) cookies 导出 + 导入 browserRuntime → 凭证回写
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
