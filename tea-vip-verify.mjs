import { chromium, devices } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
const BASE = 'https://aigc.fushtn.com'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const out = []

// 登录 free 账号（tenant_org_test）→ 我的 tab 应显示「体验版」（修复前显示「普通会员」）
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
await p.goto(BASE + '/mobile-login', { waitUntil: 'networkidle' })
await p.fill('.ml-input[type="email"]', 'tenant_org_test@audit.local')
await p.fill('.ml-input[type="password"]', 'AuditTest@123')
await p.click('.ml-btn')
await p.waitForTimeout(4000)
// 切到「我的」tab
await p.click('.tab-item:nth-child(4)')
await p.waitForTimeout(1500)
const tier = await p.$eval('.mine-tier', el => el.textContent.trim()).catch(() => 'n/a')
out.push('free 账号「我的」→ ' + tier + '（期望：体验版）')
// 会员卡点击跳转
await p.click('.mine-hero')
await p.waitForTimeout(2500)
out.push('点会员卡 → ' + p.url().replace(BASE, ''))
console.log(out.join('\n'))
await browser.close()
