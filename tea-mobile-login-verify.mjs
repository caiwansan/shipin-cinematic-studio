import { chromium, devices } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
const BASE = 'https://aigc.fushtn.com'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const out = []

// ── 1. 手机 UA 访问根路径 → /mobile ──
const m1 = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
const p1 = await m1.newPage()
await p1.goto(BASE + '/', { waitUntil: 'networkidle' })
out.push('手机访问 / → ' + p1.url().replace(BASE, ''))
await p1.close(); await m1.close()

// ── 2. 手机 UA 访问 /mobile-app（未登录）→ /mobile-login ──
const m2 = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
const p2 = await m2.newPage()
await p2.goto(BASE + '/mobile-app', { waitUntil: 'networkidle' })
await p2.waitForTimeout(1500)
out.push('手机访问 /mobile-app(未登录) → ' + p2.url().replace(BASE, ''))
// 登录页元素
out.push('登录页: ' + (await p2.$('.ml-btn') ? '手机版登录表单 ✓' : '✗ 无登录表单'))
out.push('登录方式: ' + (await p2.$$eval('.ml-tab', els => els.map(e => e.textContent.trim()).join(' / '))))

// ── 3. 手机登录（账号模式）→ 回跳 /mobile-app ──
await p2.fill('.ml-input[type="email"]', 'tenant_org_test@audit.local')
await p2.fill('.ml-input[type="password"]', 'AuditTest@123')
await p2.click('.ml-btn')
await p2.waitForTimeout(4000)
out.push('登录后 → ' + p2.url().replace(BASE, ''))
out.push('茶馆TabBar: ' + (await p2.$$eval('.tab-item', els => els.map(e => e.textContent.trim()).join(' | ')).catch(() => 'n/a')))

// ── 4. 桌面 UA 访问 / → 首页不变 ──
const d1 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const pd = await d1.newPage()
await pd.goto(BASE + '/', { waitUntil: 'networkidle' })
out.push('桌面访问 / → ' + pd.url().replace(BASE, ''))
await pd.close(); await d1.close()

// ── 5. 手机 UA 访问 /mobile-app（已登录 cookie）→ 放行 ──
const m3 = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
const p3 = await m3.newPage()
const r = await p3.request.post(BASE + '/api/auth/login', { data: { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' } })
const j = await r.json()
await p3.addInitScript((tok) => {
  localStorage.setItem('auth_token', tok)
  document.cookie = `auth_token=${tok}; path=/; max-age=86400; samesite=lax`
}, j.accessToken)
await p3.goto(BASE + '/mobile-app', { waitUntil: 'networkidle' })
await p3.waitForTimeout(3000)
out.push('手机访问 /mobile-app(已登录) → ' + p3.url().replace(BASE, '') + ' | 会话: ' + (await p3.$$eval('.conv-item', els => els.length).catch(() => 0)) + ' 项')
// 手机登录页已登录访问 → 回跳
const m4 = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
const p4 = await m4.newPage()
await p4.addInitScript((tok) => {
  localStorage.setItem('auth_token', tok)
  document.cookie = `auth_token=${tok}; path=/; max-age=86400; samesite=lax`
}, j.accessToken)
await p4.goto(BASE + '/mobile-login', { waitUntil: 'networkidle' })
await p4.waitForTimeout(2000)
out.push('手机访问 /mobile-login(已登录) → ' + p4.url().replace(BASE, ''))
console.log(out.join('\n'))
await browser.close()
