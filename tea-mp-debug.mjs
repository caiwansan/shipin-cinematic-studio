import { chromium, devices } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
const BASE = 'https://aigc.fushtn.com'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
p.setDefaultTimeout(8000)
const errs = []
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
p.on('pageerror', (e) => errs.push('PAGE-ERR: ' + String(e).slice(0, 200)))

await p.goto(BASE + '/mobile-login', { waitUntil: 'networkidle' })
await p.fill('.ml-input[type="email"]', 'tenant_org_test@audit.local')
await p.fill('.ml-input[type="password"]', 'AuditTest@123')
await p.click('.ml-btn')
await p.waitForTimeout(4000)
await p.click('.tab-item:nth-child(4)')
await p.waitForTimeout(1500)
await p.click('.mine-hero')
await p.waitForTimeout(3000)
const bodyText = (await p.$eval('body', el => el.innerText)).slice(0, 600)
console.log('BODY: ' + bodyText.replace(/\n+/g, ' | '))
console.log('ERRS: ' + (errs.join(' ;; ') || 'none'))
await p.screenshot({ path: '/tmp/mp-debug.png' })
await browser.close()
