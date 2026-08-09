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
out.push('== TabBar ==')
out.push(await p.$$eval('.tab-item', els => els.map(e => e.textContent.trim()).join(' | ')))
out.push('== Tab1 茶馆 会话列表 ==')
out.push('会话项: ' + (await p.$$eval('.conv-item', els => els.map(e => e.querySelector('.conv-name')?.textContent).join(', '))))
out.push('连接状态: ' + (await p.$eval('.header-sub', e => e.textContent).catch(() => 'n/a')))
// 进聊天窗
const conv = await p.$('.conv-item')
if (conv) { await conv.click(); await p.waitForTimeout(2500) }
out.push('== 聊天窗 ==')
out.push('标题: ' + (await p.$eval('.chat-head-name', e => e.textContent).catch(() => 'n/a')))
out.push('消息数: ' + (await p.$$eval('.msg-row', els => els.length).catch(() => 0)))
out.push('输入框存在: ' + (await p.$('.chat-input') ? 'yes' : 'no'))
await p.click('.chat-back').catch(() => {})
await p.waitForTimeout(500)
// Tab2 好友
await p.click('.tab-item:nth-child(2)'); await p.waitForTimeout(1500)
out.push('== Tab2 好友 ==')
out.push('群聊分组项: ' + (await p.$$eval('.contact-group .contact-item', els => els.map(e => e.querySelector('.contact-name')?.textContent).join(', ')).catch(() => 'n/a')))
// Tab3 社区
await p.click('.tab-item:nth-child(3)'); await p.waitForTimeout(2500)
out.push('== Tab3 社区 ==')
out.push('分类: ' + (await p.$$eval('.community-tab', els => els.map(e => e.textContent).join(', ')).catch(() => 'n/a')))
out.push('帖子数: ' + (await p.$$eval('.post-item', els => els.length).catch(() => 0)))
out.push('发布按钮: ' + (await p.$('.community-fab') ? 'yes' : 'no'))
// Tab4 我的
await p.click('.tab-item:nth-child(4)'); await p.waitForTimeout(1500)
out.push('== Tab4 我的 ==')
out.push('会员名: ' + (await p.$eval('.mine-name', e => e.textContent).catch(() => 'n/a')))
out.push('等级: ' + (await p.$eval('.mine-tier', e => e.textContent).catch(() => 'n/a')))
out.push('资产: ' + (await p.$$eval('.asset-cell', els => els.map(e => e.textContent.trim().replace(/\n/g,'/')).join(' | ')).catch(() => 'n/a')))
out.push('功能入口: ' + (await p.$$eval('.mine-entry-label', els => els.map(e => e.textContent).join(', ')).catch(() => 'n/a')))
console.log(out.join('\n'))
await browser.close()
