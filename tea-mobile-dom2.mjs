import { chromium, devices } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
const BASE = 'https://aigc.fushtn.com'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
const r = await p.request.post(BASE + '/api/auth/login', { data: { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' } })
const j = await r.json()
await p.addInitScript((tok) => {
  localStorage.setItem('auth_token', tok)
  localStorage.setItem('accessToken', tok)
  document.cookie = `auth_token=${tok}; path=/; max-age=86400; samesite=lax`
}, j.accessToken)
await p.goto(BASE + '/mobile-app', { waitUntil: 'networkidle' })
await p.waitForTimeout(4000)
const out = []
out.push('== 会话列表（不自动进聊天窗）==')
out.push('会话项: ' + (await p.$$eval('.conv-item', els => els.map(e => e.querySelector('.conv-name')?.textContent).join(', '))))
out.push('聊天窗是否打开: ' + (await p.$('.chat-window') ? 'yes(异常)' : 'no(正确)'))
// 发送一条消息验证聊天闭环（大堂）
await p.$$eval('.conv-item', els => els[0]?.click())
await p.waitForTimeout(2500)
await p.fill('.chat-input', '移动端自测 ' + Date.now().toString().slice(-6))
await p.click('.chat-send')
await p.waitForTimeout(2000)
const last = await p.$$eval('.msg-row', els => els.length)
out.push('发送后消息数: ' + last)
const lastText = await p.$$eval('.msg-row .msg-bubble', els => els[els.length-1]?.textContent)
out.push('最后一条: ' + lastText)
out.push('PAGE_ERRORS: ' + (await p.evaluate(() => 'check')))
await p.screenshot({ path: '/root/.openclaw/workspace/docs/tea-mobile-chat-send.png' })
console.log(out.join('\n'))
await browser.close()
