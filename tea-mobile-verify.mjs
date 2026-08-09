import { chromium, devices } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
const BASE = 'https://aigc.fushtn.com'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
// 登录
const r = await p.request.post(BASE + '/api/auth/login', { data: { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' } })
const j = await r.json()
await p.addInitScript((tok) => {
  localStorage.setItem('auth_token', tok)
  localStorage.setItem('accessToken', tok)
  document.cookie = `auth_token=${tok}; path=/; max-age=86400; samesite=lax`
}, j.accessToken)
await p.goto(BASE + '/mobile-app', { waitUntil: 'networkidle' })
await p.waitForTimeout(4000)
// Tab1 茶馆
await p.screenshot({ path: '/root/.openclaw/workspace/docs/tea-mobile-tab1-chat.png' })
// Tab2 好友
await p.click('.tab-item:nth-child(2)'); await p.waitForTimeout(1500)
await p.screenshot({ path: '/root/.openclaw/workspace/docs/tea-mobile-tab2-contacts.png' })
// Tab3 社区
await p.click('.tab-item:nth-child(3)'); await p.waitForTimeout(2000)
await p.screenshot({ path: '/root/.openclaw/workspace/docs/tea-mobile-tab3-community.png' })
// Tab4 我的
await p.click('.tab-item:nth-child(4)'); await p.waitForTimeout(1500)
await p.screenshot({ path: '/root/.openclaw/workspace/docs/tea-mobile-tab4-mine.png' })
// 回茶馆点第一个会话进聊天窗
await p.click('.tab-item:nth-child(1)'); await p.waitForTimeout(1500)
const conv = await p.$('.conv-item')
if (conv) { await conv.click(); await p.waitForTimeout(2000); await p.screenshot({ path: '/root/.openclaw/workspace/docs/tea-mobile-chat-window.png' }) }
// 收集控制台错误
const errors = []
p.on('pageerror', (e) => errors.push(String(e)))
console.log('PAGE_ERRORS:', errors.length ? errors.slice(0,5).join(' | ') : 'none')
await browser.close()
console.log('DONE')
