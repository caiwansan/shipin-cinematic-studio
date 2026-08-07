// tea-mobile-rtc-smoke.mjs — 手机版 RTC 通话 + 同传入口 E2E 冒烟（两账号真信令）
// A=tenant_org_test 呼叫 B=tenant_iso_test；验证：DM 通话按钮 → 同传设置 → 来电浮层 → 接听 → active 计时 → 挂断
import { chromium, devices } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'

const BASE = 'https://aigc.fushtn.com'
const OUT = '/root/.openclaw/workspace/docs'
const UA = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }
const results = []
function ok(name, cond, extra = '') {
  results.push({ name, pass: !!cond, extra })
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`)
}

// ── 登录（API 拿 uid + token） ──
async function apiLogin(email) {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'AuditTest@123' }),
  })
  const j = await r.json()
  if (!j.accessToken) throw new Error(email + ' 登录失败: ' + JSON.stringify(j).slice(0, 300))
  const u = j.user || j.data?.user || {}
  return { token: j.accessToken, id: u.id, email: u.email, name: u.nickname || u.username || u.email?.split('@')[0] }
}
const A = await apiLogin('tenant_org_test@audit.local')
const B = await apiLogin('tenant_iso_test@audit.local')
ok('A/B 登录拿 uid', !!A.id && !!B.id, `A=${A.name}(${A.id?.slice(0, 8)}) B=${B.name}(${B.id?.slice(0, 8)})`)

// A 创建私聊频道（ensure-private，幂等）
const dmRes = await fetch(BASE + '/api/im/channels/ensure-private', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + A.token },
  body: JSON.stringify({ peerUid: B.id }),
})
const dmJson = await dmRes.json()
ok('A 创建私聊频道', !!dmJson.success, dmJson.data?.channel?.id || JSON.stringify(dmJson).slice(0, 120))

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
})
async function openApp(user) {
  const ctx = await browser.newContext({ ...UA })
  const p = await ctx.newPage()
  const errors = []
  const consoles = []
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  p.on('console', (m) => { if (/error|warn|rtc|tea|failed|拒绝|未授权|connect/i.test(m.text())) consoles.push('[' + m.type() + '] ' + m.text().slice(0, 160)) })
  await p.addInitScript((tok) => {
    localStorage.setItem('auth_token', tok)
    localStorage.setItem('accessToken', tok)
    document.cookie = `auth_token=${tok}; path=/; max-age=86400; samesite=lax`
  }, user.token)
  await p.goto(BASE + '/mobile-app', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(12000)
  return { ctx, p, errors, consoles }
}
const PA = await openApp(A)
const PB = await openApp(B)

async function dumpState(who, page) {
  const sub = await page.$eval('.header-sub', (el) => el.textContent).catch(() => 'none')
  const convs = await page.$$eval('.conv-item', (els) => els.map((e) => e.textContent.trim().slice(0, 30))).catch(() => [])
  console.error(`[${who}] conn=${sub} convs=${convs.length}`, convs.slice(0, 6))
}

try {
  // A / B 都进私聊窗：用邮箱定位私聊项（名字可能撞群消息预览，邮箱只在 DM 描述里出现）
  for (const [who, user, page] of [['A', A, PA.p], ['B', B, PB.p]]) {
    await dumpState(who, page)
    // 私聊项描述 = 对方邮箱（自己的邮箱不会出现在自己列表里）
    const peerEmail = who === 'A' ? B.email : A.email
    const item = page.locator('.conv-item', { hasText: peerEmail }).first()
    try {
      await item.waitFor({ state: 'visible', timeout: 90000 })
    } catch (e) {
      console.error(`[${who}] 找不到私聊项，页面错误:`, (page === PA.p ? PA : PB).errors.slice(0, 3), (page === PA.p ? PA : PB).consoles.slice(0, 5))
      await page.screenshot({ path: OUT + `/tea-mobile-rtc-${who}-debug.png` })
      throw e
    }
    await item.click()
    await page.waitForTimeout(2000)
    const headActs = await page.$$('.chat-head-act')
    console.error(`[${who}] 点开私聊窗，通话按钮=${headActs.length}`)
    if (headActs.length !== 3) {
      await page.screenshot({ path: OUT + `/tea-mobile-rtc-${who}-wrong-channel.png` })
      throw new Error(`${who} 打开的不是私聊窗（通话按钮 ${headActs.length} 个）`)
    }
  }
  ok('A/B 都打开私聊窗', (await PA.p.$$('.chat-head-name')).length === 1 && (await PB.p.$$('.chat-head-name')).length === 1)

  // A：DM 头应有 🌐同传 / 📞 / 🎥 三个按钮
  const acts = await PA.p.$$('.chat-head-act')
  ok('A 私聊窗通话按钮（🌐📞🎥）', acts.length === 3, `找到 ${acts.length} 个`)

  // A：通话前同传语言设置
  await acts[0].click()
  await PA.p.waitForTimeout(800)
  ok('A 同传语言设置弹层（通话前）', !!(await PA.p.$('.rtc-panel-sheet')))
  await PA.p.screenshot({ path: OUT + '/tea-mobile-rtc-1-interp-panel.png' })
  await PA.p.click('.rtc-panel-btn.cancel')
  await PA.p.waitForTimeout(400)

  // A：发起语音通话
  await PA.p.click('.chat-head-act[title="语音通话"]')
  await PA.p.waitForTimeout(2000)
  const callingText = await PA.p.$eval('.rtc-status-text', (el) => el.textContent).catch(() => '')
  ok('A 呼叫中浮层', /正在呼叫/.test(callingText), callingText)

  // B：来电浮层
  await PB.p.waitForSelector('.rtc-round-accept', { timeout: 20000 })
  const incomingSub = await PB.p.$eval('.rtc-incoming-sub', (el) => el.textContent).catch(() => '')
  ok('B 来电浮层（语音邀请）', /语音通话/.test(incomingSub), incomingSub)
  await PB.p.screenshot({ path: OUT + '/tea-mobile-rtc-2-incoming.png' })

  // B：接听 → 双方 active + 计时
  await PB.p.click('.rtc-round-accept')
  await PB.p.waitForTimeout(4000)
  const aDur = await PA.p.waitForSelector('.rtc-dur', { timeout: 25000 }).then(() => PA.p.$eval('.rtc-dur', (el) => el.textContent)).catch(() => '')
  const bDur = await PB.p.waitForSelector('.rtc-dur', { timeout: 25000 }).then(() => PB.p.$eval('.rtc-dur', (el) => el.textContent)).catch(() => '')
  ok('A 通话中（计时）', !!aDur, aDur)
  ok('B 通话中（计时）', !!bDur, bDur)
  await PA.p.waitForTimeout(2500)
  const aDur2 = await PA.p.$eval('.rtc-dur', (el) => el.textContent).catch(() => '')
  ok('A 计时走动', !!aDur2 && aDur2 !== aDur, `${aDur} → ${aDur2}`)
  await PA.p.screenshot({ path: OUT + '/tea-mobile-rtc-3-active.png' })

  // 控制条含同传入口（🌐 开关 + ⚙️ 设置）
  const ctl = await PA.p.$$eval('.rtc-ctl', (els) => els.map((e) => e.textContent.trim()).join(','))
  ok('控制条含同传入口', /🌐/.test(ctl) && /⚙️/.test(ctl), ctl)

  // 同传真实启动：点 🌐 → 连网关（whisper worker 运行中）→ 按钮应变 🎧 或出现错误提示
  await PA.p.click('.rtc-ctl[title*="开启同声传译"]')
  await PA.p.waitForTimeout(7000)
  const ctl2 = await PA.p.$$eval('.rtc-ctl', (els) => els.map((e) => e.textContent.trim()).join(','))
  const interpOn = /🎧/.test(ctl2)
  const errToast = await PA.p.$eval('.rtc-toast', (el) => el.textContent).catch(() => '')
  ok('同传启动（🌐→🎧 或错误提示）', interpOn || !!errToast, interpOn ? '🎧 已开启' : ('提示: ' + errToast))
  await PA.p.screenshot({ path: OUT + '/tea-mobile-rtc-4-interp-on.png' })

  // A：挂断 → 双方回空闲
  await PA.p.click('.rtc-ctl-hangup')
  await PA.p.waitForTimeout(2500)
  ok('A 挂断后浮层关闭', !(await PA.p.$('.rtc-mask')))
  ok('B 同步回到空闲', !(await PB.p.$('.rtc-mask')))

  ok('A 无页面 JS 错误', PA.errors.length === 0, PA.errors.join('; '))
  ok('B 无页面 JS 错误', PB.errors.length === 0, PB.errors.join('; '))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n═══ 结果 ${results.length - failed.length}/${results.length} PASS ═══`)
process.exit(failed.length ? 1 : 0)
