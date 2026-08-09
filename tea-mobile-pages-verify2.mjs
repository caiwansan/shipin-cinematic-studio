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

// 社区 → 帖子详情 → 返回
await p.click('.tab-item:nth-child(3)')
await p.waitForTimeout(2500)
await t('社区帖子数', () => p.$$eval('.post-item', els => els.length))
await t('打开帖子', async () => { await p.click('.post-item'); await p.waitForTimeout(3000); return await p.$eval('.mpage-title', el => el.textContent.trim()) })
await t('帖子评论框', () => p.$eval('.mpd-input', el => '有评论框').catch(() => '无'))
await t('帖子返回', async () => { await p.click('.mpage-back'); await p.waitForTimeout(1500); return (await p.$('.mp-container')) ? '未关闭' : '已关闭回社区' })

// 我的 → 头像 → 钻石 → 返回 → 余额
await p.click('.tab-item:nth-child(4)')
await p.waitForTimeout(1500)
await p.click('.mine-hero')
await p.waitForTimeout(2000)
await t('钻石子页', async () => { await p.$$eval('.mp-asset', els => els[2].click()); await p.waitForTimeout(2500); return await p.$eval('.mpage-title', el => el.textContent.trim()) + ' 余额=' + (await p.$eval('.md-num', el => el.textContent.trim()).catch(() => 'n/a')) })
await t('钻石返回', async () => { await p.click('.mpage-back'); await p.waitForTimeout(1500); return (await p.$('.mp-container')) ? '未关闭' : '已关闭回个人主页' })
await t('设置子页', async () => { await p.$$eval('.mp-menu-item', els => els[6].click()); await p.waitForTimeout(2500); return await p.$eval('.mpage-title', el => el.textContent.trim()) })

console.log(out.join('\n'))
await browser.close()
