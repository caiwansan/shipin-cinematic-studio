/**
 * Sprint-MEDIA-BUSINESS-DASHBOARD-02 — AI 全渠道经营驾驶舱 浏览器生产域实测
 * Gates: BUSINESS-R1 老板第一眼回答「我的生意怎么样？」 / R2 数据来自所有渠道 / R3 AI帮我完成了什么 / R4 不是后台不是设置页 / R5 中国老板不用学习即可理解
 */
import puppeteer from '/root/.npm/_npx/7d92d9a2d2ccc630/node_modules/puppeteer/lib/puppeteer/puppeteer.js'

const BASE = 'https://aigc.fushtn.com'
const OUT = '/root/shipin-cinematic-studio/docs/reality'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1600,2400'],
  executablePath: '/usr/bin/google-chrome',
})

const results = []
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 2400 })

// 登录
await page.goto(`${BASE}/?login=1`, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(2000)
const login = await page.evaluate(async () => {
  const res = await fetch('/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const d = await res.json()
  return { ok: res.ok, token: d.token || '' }
})
if (!login.token) { console.log('❌ LOGIN FAILED'); process.exit(1) }
await page.evaluate((tok) => {
  localStorage.setItem('auth_token', tok)
  localStorage.setItem('token', tok)
}, login.token)
console.log('✅ 登录成功')

await page.goto(`${BASE}/workspace/media/`, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(3500)
const b = await page.$eval('body', el => el.innerText).catch(() => '')

// 第一屏区域（罗盘 + 今日经营总览，用于 BUSINESS-R4 禁止词检测）
const contentText = await page.$eval('.mws-content', el => el.innerText).catch(() => b)

// ── BUSINESS-R1 老板第一眼回答「我的生意怎么样？」 ──
const r1 = {
  '驾驶舱标题': b.includes('AI 全渠道经营驾驶舱'),
  '数据汇聚中心': b.includes('所有新媒体账号、电商店铺、客户渠道的数据汇聚中心'),
  '经营数据罗盘': b.includes('经营数据罗盘'),
  '今日经营速览': b.includes('今日经营速览'),
  '速览三指标': ['内容曝光', '新增客户', '成交金额'].every(t => b.includes(t)),
  '罗盘中心待接入': b.includes('待接入'),
  '空态引导': b.includes('你的经营驾驶舱正在等待数据接入'),
  '空态汇总四维': ['内容表现', '客户增长', '商品销售', '品牌影响力'].every(t => b.includes(t)),
  'AI将持续分析': b.includes('AI 将持续帮你分析经营机会'),
  '我的生意现在怎么样': b.includes('我的生意，现在怎么样'),
}
results.push(`[BUSINESS-R1 我的生意怎么样] ${Object.entries(r1).map(([k, v]) => `${k}:${v ? '✅' : '❌'}`).join(' ')}`)

// ── BUSINESS-R2 知道数据来自所有渠道 ──
const r2 = {
  '数据资产池': b.includes('数据资产池'),
  '我的经营资产': b.includes('我的经营资产'),
  '内容账号': b.includes('内容账号'),
  '店铺': b.includes('店铺'),
  '客户渠道': b.includes('客户渠道'),
  '数据同步': b.includes('数据同步'),
  '最后更新': b.includes('最后更新'),
  'AI全渠道数据汇总': b.includes('AI 全渠道数据汇总'),
  '汇聚链-内容平台': ['抖音', '快手', '小红书', '视频号', '公众号', '微博'].every(t => b.includes(t)),
  '汇聚链-电商平台': ['淘宝', '京东', '拼多多', '抖音商城', '美团'].every(t => b.includes(t)),
  '汇聚链-企业微信': b.includes('企业微信'),
  '经营驾驶舱终点': b.includes('经营驾驶舱'),
}
results.push(`[BUSINESS-R2 数据来自所有渠道] ${Object.entries(r2).map(([k, v]) => `${k}:${v ? '✅' : '❌'}`).join(' ')}`)

// ── BUSINESS-R3 知道 AI 帮我完成了什么 ──
const r3 = {
  'AI正在帮你经营': b.includes('AI 正在帮你经营'),
  '副题今天做了什么': b.includes('今天，AI 已经为你做了这些'),
  'Alice运营策略': b.includes('Alice') && b.includes('运营策略'),
  'Carol内容生产': b.includes('Carol') && b.includes('内容生产'),
  'David客户服务': b.includes('David') && b.includes('客户服务'),
  'Eve经营分析': b.includes('Eve') && b.includes('经营分析'),
  '今日完成清单': b.includes('制定今日内容计划'),
  '工作状态标签': b.includes('已就位') || b.includes('工作中'),
}
results.push(`[BUSINESS-R3 AI帮我完成什么] ${Object.entries(r3).map(([k, v]) => `${k}:${v ? '✅' : '❌'}`).join(' ')}`)

// ── BUSINESS-R4 不是后台/不是设置页（内容区禁止词 + 驾驶舱词汇） ──
const r4 = {
  '第一屏无等待连接': !contentText.includes('等待连接'),
  '第一屏无未连接': !contentText.includes('未连接'),
  '第一屏无去连接': !contentText.includes('去连接'),
  '第一屏无连接账号': !contentText.includes('连接账号'),
  '无0数字空表格': !/今日发布\s*0|\d+\s*次\s*0/.test(contentText) && !contentText.includes('--'),
  '仪表词汇-罗盘': contentText.includes('罗盘'),
  '仪表词汇-速览': contentText.includes('速览'),
  '仪表词汇-资产池': contentText.includes('资产池'),
  '渠道降级为入口': contentText.indexOf('渠道中心') > contentText.indexOf('数据资产池'),
}
results.push(`[BUSINESS-R4 不是后台/设置页] ${Object.entries(r4).map(([k, v]) => `${k}:${v ? '✅' : '❌'}`).join(' ')}`)

// ── BUSINESS-R5 中国老板不用学习即可理解 ──
const r5 = {
  '老板语言-我的生意': b.includes('我的生意'),
  '老板语言-现在怎么样': b.includes('现在怎么样'),
  '全中文区块标题': ['经营数据罗盘', '今日经营总览', 'AI 正在帮你经营', '我的经营资产', '经营趋势', '渠道中心'].every(t => b.includes(t)),
  '无英文科技词堆砌': !b.includes('OMNI') && !b.includes('CHANNEL OPS'),
  '空态人话': contentText.includes('连接你的账号后，这里会自动汇总'),
  '布局顺序': contentText.indexOf('经营数据罗盘') < contentText.indexOf('今日经营总览') && contentText.indexOf('今日经营总览') < contentText.indexOf('AI 正在帮你经营') && contentText.indexOf('AI 正在帮你经营') < contentText.indexOf('我的经营资产') && contentText.indexOf('我的经营资产') < contentText.indexOf('经营趋势') && contentText.indexOf('经营趋势') < contentText.indexOf('渠道中心'),
}
results.push(`[BUSINESS-R5 老板不用学习] ${Object.entries(r5).map(([k, v]) => `${k}:${v ? '✅' : '❌'}`).join(' ')}`)

// 截图（长页：分段）
await page.screenshot({ path: `${OUT}/BUSINESS-DASHBOARD-02-top.png` })
await page.evaluate(() => window.scrollTo(0, 900))
await sleep(500)
await page.screenshot({ path: `${OUT}/BUSINESS-DASHBOARD-02-mid.png` })
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await sleep(500)
await page.screenshot({ path: `${OUT}/BUSINESS-DASHBOARD-02-bottom.png` })

console.log('\n========== 验收结果 ==========')
results.forEach(r => console.log(r))
await browser.close()
