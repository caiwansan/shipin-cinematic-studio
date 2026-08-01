/**
 * Sprint-MEDIA-CHANNEL-EXPANSION-05 — 浏览器生产域实测
 * 验证：① 首页全渠道定位 ② 四类渠道资产 ③ 我的线上生意 ④ 账号管理 Tabs ⑤ 商品运营页
 */
import puppeteer from '/root/.npm/_npx/7d92d9a2d2ccc630/node_modules/puppeteer/lib/puppeteer/puppeteer.js'

const BASE = 'https://aigc.fushtn.com'
const OUT = '/root/shipin-cinematic-studio/docs/reality'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1600,1200'],
  executablePath: '/usr/bin/google-chrome',
})

const results = []

async function check(page, url, name, expects) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(2500)
  const body = await page.$eval('body', el => el.innerText).catch(() => '')
  const line = []
  for (const [label, text] of Object.entries(expects)) {
    const ok = body.includes(text)
    line.push(`${label}:${ok ? '✅' : '❌'}`)
  }
  results.push(`[${name}] ${line.join(' ')}`)
  await page.screenshot({ path: `${OUT}/MEDIA-CHANNEL-EXPANSION-05-${name}.png`, fullPage: false })
  console.log(`✅ ${name} 截图完成`)
}

const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1200 })

// ── 登录（同源 fetch 拿 token 注入 localStorage）──
await page.goto(`${BASE}/?login=1`, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(2000)
const loginResult = await page.evaluate(async () => {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    const d = await res.json()
    return { ok: res.ok, token: d.token || '', status: res.status }
  } catch (e) { return { ok: false, error: e.message } }
})
if (!loginResult.token) {
  console.log('❌ LOGIN FAILED:', JSON.stringify(loginResult))
  process.exit(1)
}
await page.evaluate((tok) => {
  localStorage.setItem('auth_token', tok)
  localStorage.setItem('token', tok)
}, loginResult.token)
console.log('✅ 登录成功 token 前 20 位:', loginResult.token.slice(0, 20))

// 1. 首页
await check(page, '/workspace/media', 'home', {
  '全渠道标题': 'AI 全渠道运营中心',
  '副标题': '让 AI 员工帮你运营内容、客户和线上生意',
  '解释': '连接你的内容平台、电商店铺和客户渠道',
  '渠道四类-内容平台': '内容平台',
  '渠道四类-电商店铺': '电商店铺',
  '渠道四类-客户运营': '客户运营',
  '渠道四类-数据渠道': '数据渠道',
  '电商-淘宝': '淘宝店',
  '电商-拼多多': '拼多多店',
  '线上生意': '我的线上生意',
  '生意-等待连接': '等待连接',
  '员工-Alice': 'AI 运营总监',
  '员工-David': 'AI 客户管家',
  '员工-Eve': 'AI 数据分析师',
})

// 2. 账号管理（渠道管理）
await check(page, '/workspace/media/accounts', 'accounts', {
  '标题': '渠道管理',
  '顶部引导': '连接你的线上运营渠道',
  'Tabs-全部': '全部',
  'Tabs-内容平台': '内容平台',
  'Tabs-电商平台': '电商平台',
  'Tabs-客户平台': '客户平台',
  '淘宝卡': '淘宝店',
  '淘宝AI帮助': '辅助制作商品内容',
  '京东AI帮助': '商品运营分析',
  '美团AI帮助': '门店运营分析',
  '即将开放': '即将开放',
})

// 3. Tabs 切换（电商平台）
await page.waitForSelector('.ac-tab', { timeout: 15000 }).catch(() => {})
const tabCount = await page.$$eval('.ac-tab', els => els.length).catch(() => 0)
results.push(`[accounts-tabs] Tab数量(应4):${tabCount === 4 ? '✅' : '❌(' + tabCount + ')'}`)
if (tabCount >= 3) {
  await page.evaluate(() => {
    const tabs = document.querySelectorAll('.ac-tab')
    tabs[2]?.click()
  })
  await sleep(900)
  const cardNames = await page.$$eval('.ac-card .ac-name', els => els.map(e => e.textContent)).catch(() => [])
  const shopTabOk = cardNames.includes('京东店') && !cardNames.includes('微信公众号') && cardNames.length === 6
  results.push(`[accounts-shop-tab] 电商Tab只显6张电商卡(实际${cardNames.length}):${shopTabOk ? '✅' : '❌ ' + JSON.stringify(cardNames)}`)
  await page.screenshot({ path: `${OUT}/MEDIA-CHANNEL-EXPANSION-05-accounts-shop-tab.png` })
}

// 4. 商品运营页
await check(page, '/workspace/media/shop', 'shop', {
  '标题': '商品运营',
  '描述': '分析商品表现、制作商品内容',
  '店铺0已连接': '0 个已连接',
  '等待连接': '等待连接',
  '即将开放': '商品运营即将开放',
  'AI帮助': '分析商品表现',
  '可连店铺': '可连接的电商店铺',
  '连接路径': '渠道连接服务',
})

// 5. 导航（左栏 8 项）
const navText = await page.$eval('nav', el => el.innerText).catch(() => '')
const navChecks = ['首页驾驶舱', 'AI员工团队', '内容生产', '客户运营', '渠道管理', '商品运营', '数据分析', '行业机会']
const navOk = navChecks.every(t => navText.includes(t))
results.push(`[nav] 左栏8项导航:${navOk ? '✅' : '❌'} ${navChecks.filter(t => !navText.includes(t)).join(',')}`)

console.log('\n========== 验收结果 ==========')
results.forEach(r => console.log(r))
await browser.close()
