import { chromium, devices } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
const BASE = 'https://aigc.fushtn.com'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const out = []
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
p.setDefaultTimeout(8000)
async function t(label, fn) {
  try { out.push(label + ': ' + (await fn())) } catch (e) { out.push(label + ': FAIL ' + e.message.slice(0, 90)) }
}
await p.goto(BASE + '/mobile-login', { waitUntil: 'networkidle' })
await p.fill('.ml-input[type="email"]', 'tenant_org_test@audit.local')
await p.fill('.ml-input[type="password"]', 'AuditTest@123')
await p.click('.ml-btn')
await p.waitForTimeout(4000)

// 个人主页 → 钻石 → 返回应回个人主页（栈式）
await p.click('.tab-item:nth-child(4)')
await p.waitForTimeout(1500)
await p.click('.mine-hero')
await p.waitForTimeout(2000)
await p.$$eval('.mp-asset', els => els[2].click())
await p.waitForTimeout(2500)
await t('钻石子页', () => p.$eval('.mpage-title', el => el.textContent.trim()))
await p.click('.mpage-back')
await p.waitForTimeout(1500)
await t('栈返回→个人主页', () => p.$eval('.mpage-title', el => el.textContent.trim()))
await t('设置子页', async () => { await p.$$eval('.mp-menu-item', els => els[6].click()); await p.waitForTimeout(2500); return p.$eval('.mpage-title', el => el.textContent.trim()) })
await p.click('.mpage-back')
await p.waitForTimeout(1500)
await t('设置返回→个人主页', () => p.$eval('.mpage-title', el => el.textContent.trim()))
await p.click('.mpage-back')
await p.waitForTimeout(1500)
await t('个人主页返回→我的tab', async () => (await p.$('.mp-container')) ? '未关闭' : '已关闭')
await t('退出按钮仍在', () => p.$eval('.mine-logout', el => '✓').catch(() => '✗'))

// 订单内容
await p.click('.mine-hero')
await p.waitForTimeout(2000)
await p.$$eval('.mp-menu-item', els => els[0].click())
await p.waitForTimeout(2500)
await t('订单页渲染', async () => { const empty = await p.$('.mo-empty'); return empty ? (await empty.textContent()).trim() : '有订单列表' })

console.log(out.join('\n'))
await browser.close()
