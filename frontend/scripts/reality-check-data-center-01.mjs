/**
 * Sprint-MEDIA-DATA-CENTER-01 — 企业经营数据中心浏览器生产域实测
 * Gates: DATA-R1 老板5秒知道生意数据在哪 / R2 知道可连哪些平台 / R3 AI员工如何帮赚钱 / R4 无连接不造数据不显示0 / R5 短剧招聘零影响
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
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1200 })

// 登录（admin token 注入）
await page.goto(`${BASE}/?login=1`, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(2000)
const loginResult = await page.evaluate(async () => {
  const res = await fetch('/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const d = await res.json()
  return { ok: res.ok, token: d.token || '' }
})
if (!loginResult.token) { console.log('❌ LOGIN FAILED'); process.exit(1) }
await page.evaluate((tok) => {
  localStorage.setItem('auth_token', tok)
  localStorage.setItem('token', tok)
}, loginResult.token)
console.log('✅ 登录成功')

await page.goto(`${BASE}/workspace/media/`, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(3000)
const body = () => page.$eval('body', el => el.innerText).catch(() => '')
const b = await body()

// ── DATA-R1 老板 5 秒知道生意数据在哪里 ──
const r1 = {
  '顶部定位': b.includes('AI 全渠道运营中心'),
  '副标题': b.includes('让 AI 员工帮你运营内容、客户和线上生意'),
  '经营数据中心条': b.includes('经营数据中心'),
  '经营数据中心说明': b.includes('连接你的内容平台、电商店铺和客户渠道后，所有运营数据将在这里统一展示'),
  '今日经营概览': b.includes('今日经营概览'),
  '概览副题': b.includes('你的生意数据，连接渠道后自动统计'),
  '内容表现卡': b.includes('内容表现'),
  '客户运营卡': b.includes('客户运营'),
  '线上销售卡': b.includes('线上销售'),
  '品牌增长卡': b.includes('品牌增长'),
  '概览在员工前': b.indexOf('今日经营概览') < b.indexOf('我的 AI 运营团队'),
}
results.push(`[DATA-R1 生意数据在哪里] ${Object.entries(r1).map(([k, v]) => `${k}:${v ? '✅' : '❌'}`).join(' ')}`)

// ── DATA-R2 知道可以连接哪些平台 ──
const r2 = {
  '全渠道数据地图': b.includes('全渠道数据地图'),
  '我的运营渠道': b.includes('我的运营渠道'),
  '内容渠道标题': b.includes('内容渠道'),
  '电商渠道标题': b.includes('电商渠道'),
  '客户渠道标题': b.includes('客户渠道'),
  '内容8平台': ['抖音', '快手', '小红书', '视频号', '微信公众号', '微博', '百家号', '今日头条'].every(t => b.includes(t)),
  '电商6平台': ['淘宝店', '京东店', '拼多多店', '抖音商城', '美团店铺', '小红书店铺'].every(t => b.includes(t)),
  '客户3渠道': ['企业微信', '微信客户', '客服渠道'].every(t => b.includes(t)),
  '渠道计数-未连接': (b.match(/未连接/g) || []).length >= 10,
  '商品运营入口': b.includes('查看商品运营'),
}
results.push(`[DATA-R2 可连平台] ${Object.entries(r2).map(([k, v]) => `${k}:${v ? '✅' : '❌'}`).join(' ')}`)

// ── DATA-R3 AI 员工如何帮我赚钱 ──
const r3 = {
  '团队标题': b.includes('我的 AI 运营团队'),
  '团队副题': b.includes('5 名 AI 员工，帮你把生意做起来'),
  'Alice': b.includes('Alice') && b.includes('AI 运营总监'),
  'Alice职责': b.includes('制定运营计划、分析每天经营情况'),
  'Bob职责': b.includes('发现热点和营销机会'),
  'Carol职责': b.includes('制作内容和商品素材'),
  'David职责': b.includes('维护客户关系'),
  'Eve职责': b.includes('分析数据提升收益'),
  'AI已为你完成': b.includes('AI 已为你完成'),
}
results.push(`[DATA-R3 AI如何帮赚钱] ${Object.entries(r3).map(([k, v]) => `${k}:${v ? '✅' : '❌'}`).join(' ')}`)

// ── DATA-R4 不造数据不显示 0 ──
const r4 = {
  '经营趋势': b.includes('经营趋势'),
  '近7天': b.includes('近 7 天'),
  '四趋势': ['内容增长', '客户增长', '销售增长', '品牌影响力'].every(t => b.includes(t)),
  '趋势空态': b.includes('连接渠道后生成你的经营趋势'),
  '等待连接渠道提示': b.includes('等待连接渠道'),
  '不显示0-概览': !/今日发布\s*\n\s*0/.test(b),
  '不显示0-数字卡': !/(订单数量|粉丝总量|新增客户)\s*\n\s*0\b/.test(b),
  '无假指标': !b.includes('98%') && !b.includes('10万') && !b.includes('+120%'),
}
results.push(`[DATA-R4 不造数据] ${Object.entries(r4).map(([k, v]) => `${k}:${v ? '✅' : '❌'}`).join(' ')}`)

// 首页截图
await page.screenshot({ path: `${OUT}/MEDIA-DATA-CENTER-01-home-top.png` })
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await sleep(600)
await page.screenshot({ path: `${OUT}/MEDIA-DATA-CENTER-01-home-bottom.png` })

// ── 导航（经营驾驶舱⭐ / 渠道中心） ──
const navText = await page.$eval('nav', el => el.innerText).catch(() => '')
const navChecks = {
  '经营驾驶舱': navText.includes('经营驾驶舱'),
  '星标': navText.includes('⭐'),
  '渠道中心': navText.includes('渠道中心'),
  '商品运营': navText.includes('商品运营'),
  '无首页驾驶舱残留': !navText.includes('首页驾驶舱'),
  '无渠道管理残留': !navText.includes('渠道管理'),
}
results.push(`[NAV 导航] ${Object.entries(navChecks).map(([k, v]) => `${k}:${v ? '✅' : '❌'}`).join(' ')}`)

// 品牌中文化
const brandText = await page.$eval('.mws-brand', el => el.innerText).catch(() => '')
results.push(`[BRAND 品牌] 中文品牌:${brandText.includes('全渠道运营中心') && brandText.includes('AI 经营驾驶舱') ? '✅' : '❌ ' + brandText}`)

// ── 渠道中心页标题 ──
await page.goto(`${BASE}/workspace/media/accounts`, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(2500)
const accBody = await body()
results.push(`[ACCOUNTS 渠道中心] 标题:${accBody.includes('渠道中心') && !accBody.includes('渠道管理') ? '✅' : '❌'}`)
await page.screenshot({ path: `${OUT}/MEDIA-DATA-CENTER-01-accounts.png` })

// ── DATA-R5 短剧/招聘工作台零影响（打开两个工作台首页验证 200 + 关键模块渲染） ──
const r5 = {}
for (const [name, url, key] of [
  ['短剧工作台', '/director/workbench', '导演驾驶舱'],
  ['招聘工作台', '/workspace/enterprise', '招聘'],
]) {
  const resp = await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null)
  await sleep(2500)
  const bb = await body()
  const okStatus = resp && resp.status() < 400
  r5[`${name}-200`] = okStatus
  r5[`${name}-渲染`] = bb.includes(key)
}
results.push(`[DATA-R5 零影响] ${Object.entries(r5).map(([k, v]) => `${k}:${v ? '✅' : '❌'}`).join(' ')}`)

console.log('\n========== 验收结果 ==========')
results.forEach(r => console.log(r))
await browser.close()
