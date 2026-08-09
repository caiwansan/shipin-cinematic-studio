import { chromium, devices } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
const BASE = 'https://aigc.fushtn.com'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
p.setDefaultTimeout(8000)
await p.goto(BASE + '/mobile-login', { waitUntil: 'networkidle' })
await p.fill('.ml-input[type="email"]', 'tenant_org_test@audit.local')
await p.fill('.ml-input[type="password"]', 'AuditTest@123')
await p.click('.ml-btn')
await p.waitForTimeout(4000)
await p.click('.tab-item:nth-child(4)')
await p.waitForTimeout(1500)
await p.click('.mine-hero')
await p.waitForTimeout(3000)
const info = await p.evaluate(() => {
  const c = document.querySelector('.mp-container')
  if (!c) return 'no .mp-container'
  const html = c.innerHTML
  return 'container-classes=' + c.className + ' | has-mpage=' + html.includes('mpage') + ' | head=' + (html.match(/mpage-head[\s\S]{0,200}/) || ['none'])[0].slice(0, 180) + ' ||| first300=' + html.replace(/\s+/g, ' ').slice(0, 300)
})
console.log(info)
await browser.close()
