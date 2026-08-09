import { chromium, devices } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
const BASE = 'https://aigc.fushtn.com'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const out = []
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
const p = await ctx.newPage()
p.setDefaultTimeout(8000)
p.on('console', (m) => { if (m.type() === 'error') out.push('JS-ERR: ' + m.text().slice(0, 150)) })

async function t(label, fn) {
  try { out.push(label + ': ' + (await fn())) } catch (e) { out.push(label + ': FAIL ' + e.message.slice(0, 100)) }
}

await p.goto(BASE + '/mobile-login', { waitUntil: 'networkidle' })
await p.fill('.ml-input[type="email"]', 'tenant_org_test@audit.local')
await p.fill('.ml-input[type="password"]', 'AuditTest@123')
await p.click('.ml-btn')
await p.waitForTimeout(4000)

await p.click('.tab-item:nth-child(4)')
await p.waitForTimeout(1500)
await t('我的页', async () => (await p.$eval('.mine-name', el => el.textContent.trim())) + ' / ' + (await p.$eval('.mine-tier', el => el.textContent.trim())))

await p.click('.mine-hero')
await p.waitForTimeout(2500)
await t('点头像URL', () => p.url().replace(BASE, ''))
await t('子页标题', () => p.$eval('.mpage-title', el => el.textContent.trim()))

await t('订单子页', async () => { await p.$$eval('.mp-menu-item', els => els[0].click()); await p.waitForTimeout(2500); return p.$eval('.mpage-title', el => el.textContent.trim()) })
await t('返回', async () => { await p.click('.mpage-back'); await p.waitForTimeout(1500); return p.$eval('.mpage-title', el => el.textContent.trim()) })

await t('礼物子页', async () => { await p.$$eval('.mp-menu-item', els => els[2].click()); await p.waitForTimeout(2500); return p.$eval('.mpage-title', el => el.textContent.trim()) })
await t('返回2', async () => { await p.click('.mpage-back'); await p.waitForTimeout(1500); return p.$eval('.mpage-title', el => el.textContent.trim()) })

await t('钻石子页', async () => { await p.$$eval('.mp-asset', els => els[2].click()); await p.waitForTimeout(2500); const n = await p.$eval('.md-num', el => el.textContent.trim()).catch(() => 'n/a'); return (await p.$eval('.mpage-title', el => el.textContent.trim())) + ' 余额=' + n })
await t('返回3', async () => { await p.click('.mpage-back'); await p.waitForTimeout(1500); return p.$eval('.mpage-title', el => el.textContent.trim()) })

await t('社区tab', async () => { await p.click('.tab-item:nth-child(3)'); await p.waitForTimeout(2500); return '帖子数=' + (await p.$$eval('.post-item', els => els.length).catch(() => 0)) })
await t('帖子详情', async () => { await p.click('.post-item'); await p.waitForTimeout(3000); return p.$eval('.mpage-title', el => el.textContent.trim()).catch(() => 'no-title') })
await t('返回4', async () => { await p.click('.mpage-back'); await p.waitForTimeout(1500); return 'ok' })

await t('茶馆tab', async () => { await p.click('.tab-item:nth-child(1)'); await p.waitForTimeout(1500); return '会话数=' + (await p.$$eval('.conv-item', els => els.length).catch(() => 0)) })
await t('打开会话', async () => { await p.click('.conv-item'); await p.waitForTimeout(2500); return p.$eval('.chat-head-name', el => el.textContent.trim()).catch(() => 'no-chat') })
await t('＋面板', async () => { await p.click('.chat-plus'); await p.waitForTimeout(800); return (await p.$$eval('.plus-item', els => els.map(e => e.textContent.trim()))).join(' | ') })
await t('发红包弹窗', async () => { await p.$$eval('.plus-item', els => els[2].click()); await p.waitForTimeout(2000); return p.$eval('.tea-app-modal .modal-title', el => el.textContent.trim()).catch(() => 'no-modal') })
await t('关闭红包', async () => { await p.click('.modal-btn.cancel'); await p.waitForTimeout(600); return 'ok' })
await t('礼物弹窗', async () => { await p.click('.chat-plus'); await p.waitForTimeout(600); await p.$$eval('.plus-item', els => els[3].click()); await p.waitForTimeout(2500); const c = await p.$$eval('.gift-item', els => els.length).catch(() => 0); return (await p.$eval('.tea-app-modal .modal-title', el => el.textContent.trim()).catch(() => 'no-modal')) + ' 礼物数=' + c })

console.log(out.join('\n'))
await browser.close()
