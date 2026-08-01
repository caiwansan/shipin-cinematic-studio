/**
 * scripts/screenshot-providers.mjs — AI Provider Center 浏览器验证截图
 * 前台 /models/providers + 后台 /admin/ai-providers
 */
import puppeteer from 'puppeteer'

const BASE = 'https://aigc.fushtn.com'
const OUT = '/root/shipin-cinematic-studio/docs/reality'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1600,1200'],
  executablePath: '/usr/bin/google-chrome',
})

// ── 前台 AI模型中心 ──
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1200 })
await page.goto(`${BASE}/models/providers`, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(3000)

const title = await page.title().catch(() => '')
const h1 = await page.$eval('h1', el => el.textContent).catch(() => 'N/A')
const cardCount = await page.$$eval('h3', els => els.length).catch(() => 0)
const deepseekCard = await page.$eval('body', () => document.body.innerText.includes('DeepSeek')).catch(() => false)
console.log(`前台: title=${title} | h1=${h1} | 卡片数=${cardCount} | DeepSeek=${deepseekCard}`)
await page.screenshot({ path: `${OUT}/AI-PROVIDER-CENTER-01-front.png`, fullPage: true })
console.log('✅ 前台截图:', `${OUT}/AI-PROVIDER-CENTER-01-front.png`)

// 验证导航「大模型注册」在首页
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(2500)
const navHas = await page.$eval('body', () => document.body.innerText.includes('大模型注册')).catch(() => false)
console.log(`首页导航「大模型注册」: ${navHas}`)
await page.screenshot({ path: `${OUT}/AI-PROVIDER-CENTER-02-nav.png` })
console.log('✅ 导航截图:', `${OUT}/AI-PROVIDER-CENTER-02-nav.png`)
await page.close()

// ── 后台 AI模型供应商管理 ──
const admin = await browser.newPage()
await admin.setViewport({ width: 1600, height: 1200 })
// 登录拿 token
const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
}).then(r => r.json())
if (!login.token) { console.error('❌ admin 登录失败'); process.exit(1) }

await admin.goto(`${BASE}/admin/ai-providers`, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(1500)
// token-cache 读取 auth_token；注入后刷新
await admin.evaluate((tok) => {
  localStorage.setItem('auth_token', tok)
}, login.token)
await admin.reload({ waitUntil: 'networkidle2', timeout: 60000 })
await sleep(2500)

const adminRows = await admin.$$eval('tbody tr', rows => rows.length).catch(() => 0)
const adminHas = await admin.$eval('body', () => document.body.innerText.includes('AI模型供应商管理')).catch(() => false)
console.log(`后台: 标题=${adminHas} | 表格行数=${adminRows}`)
await admin.screenshot({ path: `${OUT}/AI-PROVIDER-CENTER-03-admin.png`, fullPage: false })
console.log('✅ 后台截图:', `${OUT}/AI-PROVIDER-CENTER-03-admin.png`)
await admin.close()

await browser.close()
console.log('🎉 全部截图完成')
