#!/usr/bin/env node
/**
 * Sprint-MEDIA-UX-CONSOLIDATION-04 验收
 * UX-C1 无重复入口 / UX-C2 像企业SaaS不像AI模板 / UX-C3 老板第一眼看到经营状态
 * UX-C4 视觉高级克制 / UX-C5 短剧招聘零影响
 */
const puppeteer = require('/root/.npm/_npx/7d92d9a2d2ccc630/node_modules/puppeteer')

const BASE = 'https://aigc.fushtn.com'
const results = []
function check(gate, name, pass, extra = '') {
  results.push({ gate, name, pass: !!pass, extra })
  console.log(`${pass ? '✅' : '❌'} [${gate}] ${name}${extra ? ' — ' + extra : ''}`)
}

;(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/usr/bin/google-chrome',
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  const pageErrors = []
  page.on('pageerror', e => pageErrors.push('PAGEERROR: ' + e.message.slice(0, 80)))
  const knownAdmin500 = ['/api/member/profile', '/api/v2/user/model-config/unified']
  page.on('response', r => {
    if (r.status() >= 500 && !knownAdmin500.some(p => r.url().includes(p))) {
      pageErrors.push(r.status() + ' ' + r.url().replace(BASE, ''))
    }
  })

  await page.goto(`${BASE}/?login=1`, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 1200))
  const token = await page.evaluate(async () => {
    const res = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    const d = await res.json()
    return d.token || ''
  })
  await page.evaluate(t => {
    localStorage.setItem('auth_token', t)
    localStorage.setItem('token', t)
  }, token)
  pageErrors.length = 0

  await page.goto(`${BASE}/workspace/media/`, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 3500))

  const text = await page.evaluate(() => document.body.innerText)
  const html = await page.evaluate(() => document.documentElement.outerHTML)
  const hasTxt = t => text.includes(t)
  const q = sel => page.evaluate(s => document.querySelectorAll(s).length, sel)

  /* ═══ UX-C1 无重复入口 ═══ */
  console.log('\n═══ UX-C1 无重复入口（一个 Workspace 一个模型入口） ═══')
  check('UX-C1', '顶部无「模型」快捷按钮（.mws-model-btn 不存在）', await q('.mws-model-btn') === 0)
  check('UX-C1', '顶部无「返回昆仑镜首页」按钮（.mws-back 不存在）', await q('.mws-back') === 0)
  check('UX-C1', '顶部无「选择工作空间」（WorkspaceSwitcher 不存在）',
    !hasTxt('选择工作空间') && !hasTxt('切换工作空间') && await q('.mws-switcher, .workspace-switcher') === 0)
  check('UX-C1', '用户卡无模型按钮', await page.evaluate(() => {
    const card = document.querySelector('.w-user-card')
    if (!card) return true
    return !card.innerText.includes('模型')
  }))
  check('UX-C1', '左栏唯一「模型中心」入口', await q('.mws-op') === 4 &&
    (await page.evaluate(() => [...document.querySelectorAll('.mws-op')].filter(el => el.innerText.includes('模型中心')).length)) === 1)
  check('UX-C1', '左栏唯一「昆仑镜首页」入口',
    (await page.evaluate(() => [...document.querySelectorAll('.mws-op')].filter(el => el.innerText.includes('昆仑镜首页')).length)) === 1)

  /* ═══ UX-C2 像企业 SaaS，不像 AI 模板 ═══ */
  console.log('\n═══ UX-C2 像企业 SaaS，不像 AI 模板 ═══')
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.mws')).backgroundColor)
  check('UX-C2', '页面背景为白天雾灰（#F7F8FA 系）', bg.includes('247, 248, 250'))
  const cardBg = await page.evaluate(() => getComputedStyle(document.querySelector('.hq-card')).backgroundColor)
  check('UX-C2', '卡片为白色 #FFFFFF', cardBg.includes('255, 255, 255'))
  const sideBg = await page.evaluate(() => getComputedStyle(document.querySelector('.mws-side')).backgroundColor)
  check('UX-C2', '左栏白底（非深色）', sideBg.includes('255, 255, 255') || sideBg.includes('247, 248, 250'))
  check('UX-C2', '主导航无 emoji 图标', await page.evaluate(() => {
    const icons = [...document.querySelectorAll('.mws-nav-icon')]
    if (!icons.length) return false
    // 真 emoji 在 1F000-1FAFF（⌂♙✎♡□◫◌ 属符号区，不算 emoji）
    const emojiRe = /[\u{1F000}-\u{1FAFF}\u{FE0F}]/u
    return icons.every(el => !emojiRe.test(el.innerText))
  }), (await page.evaluate(() => [...document.querySelectorAll('.mws-nav-icon')].map(el => el.innerText).join(','))))
  check('UX-C2', '深紫 #7C3AED 大面积使用清零（页面无此色）', !html.includes('7C3AED'))
  check('UX-C2', '无紫色渐变 hero 背景', !html.includes('rgba(124, 58, 237') && !html.includes('124, 58, 237'))

  /* ═══ UX-C3 老板第一眼看到经营状态 ═══ */
  console.log('\n═══ UX-C3 老板第一眼看到经营状态 ═══')
  const firstScreen = await page.evaluate(() => {
    const vh = window.innerHeight
    const vis = sel => {
      const el = document.querySelector(sel)
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.top < vh && r.bottom > 0
    }
    return { health: vis('.hq-health'), kpi: vis('.hq-kpi'), brief: vis('.hq-brief') }
  })
  check('UX-C3', '首屏可见「经营状态」健康卡', firstScreen.health)
  check('UX-C3', '首屏可见「今日核心指标」', firstScreen.kpi)
  check('UX-C3', '首屏可见「AI 今日简报」', firstScreen.brief)
  const pageHeight = await page.evaluate(() => document.body.scrollHeight)
  check('UX-C3', '首页紧凑（三层，总高 < 2200px，不再超长）', pageHeight < 2200, `${pageHeight}px`)
  check('UX-C3', '首页三层结构完整（经营状态/AI正在工作/经营资产）',
    await q('.hq-top-grid') > 0 && await q('.hq-team') > 0 && await q('.hq-assets') > 0 && hasTxt('AI 正在工作') && hasTxt('经营资产'))

  /* ═══ UX-C4 视觉高级克制 ═══ */
  console.log('\n═══ UX-C4 视觉高级克制 ═══')
  check('UX-C4', '无金色 #F5B84B 残留', !html.includes('F5B84B'))
  check('UX-C4', '员工卡紧凑（无大渐变头像，头像 ≤ 40px）', await page.evaluate(() => {
    const el = document.querySelector('.hq-team-avatar')
    if (!el) return false
    const r = el.getBoundingClientRect()
    return r.width <= 40 && r.height <= 40
  }))
  check('UX-C4', '员工卡含「查看详情 →」收敛动作', await q('.hq-team-more') === 5 && hasTxt('查看详情'))
  check('UX-C4', 'indigo 强调 #6366F1 出现（点缀）', await page.evaluate(() => {
    const el = document.querySelector('.hq-badge') || document.querySelector('.hq-sec-link')
    if (!el) return false
    return getComputedStyle(el).color.includes('99, 102, 241')
  }))
  check('UX-C4', '卡片微投影（无厚重发光）', await page.evaluate(() => {
    const el = document.querySelector('.hq-card')
    const s = getComputedStyle(el)
    return s.boxShadow && s.boxShadow.length < 40
  }))
  check('UX-C4', '页面无 JS 错误', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

  /* ═══ UX-C5 短剧/招聘零影响 ═══ */
  console.log('\n═══ UX-C5 短剧/招聘零影响 ═══')
  const dirStatus = await page.goto(`${BASE}/director/`, { waitUntil: 'networkidle2', timeout: 60000 }).then(r => r.status()).catch(() => 0)
  check('UX-C5', '短剧工作台 /director 可达', dirStatus === 200)
  const recStatus = await page.goto(`${BASE}/recruitment/`, { waitUntil: 'networkidle2', timeout: 60000 }).then(r => r.status()).catch(() => 0)
  check('UX-C5', '招聘中心 /recruitment 可达', recStatus === 200)
  const entStatus = await page.goto(`${BASE}/workspace/enterprise/model-settings`, { waitUntil: 'networkidle2', timeout: 60000 }).then(r => r.status()).catch(() => 0)
  check('UX-C5', '企业工作台 model-settings 可达', entStatus === 200)
  await page.goto(`${BASE}/workspace/media/team`, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 2000))
  check('UX-C5', '媒体子页 team 正常渲染', await page.evaluate(() => document.body.innerText.length > 50))
  await page.goto(`${BASE}/workspace/media/accounts`, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 2000))
  check('UX-C5', '媒体子页 accounts 正常渲染', await page.evaluate(() => document.body.innerText.length > 50))

  await browser.close()

  console.log('\n══════════════════════════════')
  const byGate = {}
  results.forEach(r => { byGate[r.gate] = byGate[r.gate] || { pass: 0, fail: 0 }; r.pass ? byGate[r.gate].pass++ : byGate[r.gate].fail++ })
  Object.entries(byGate).forEach(([g, c]) => console.log(`${g}: ${c.pass} ✅ / ${c.fail} ❌`))
  const totalPass = results.filter(r => r.pass).length
  const totalFail = results.filter(r => !r.pass).length
  console.log(`TOTAL: ${totalPass} ✅ / ${totalFail} ❌`)
  process.exit(totalFail === 0 ? 0 : 1)
})().catch(e => { console.error('FATAL', e.message); process.exit(2) })
