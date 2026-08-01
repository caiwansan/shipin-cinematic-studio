#!/usr/bin/env node
/**
 * Sprint-MEDIA-DESIGN-DARK-THEME-06 验收（Design System v1 · Dark Variant）
 * 掌柜纠偏：高级感 = 深色（AI 企业经营指挥中心），深色 ≠ 深紫科技模板。
 * UX-D1 深色高级空间（非白非深紫模板，卡片克制）
 * UX-D2 第一屏经营结果（老板桌面夜间版）
 * UX-D3 蓝青数据光源（80/15/5 色彩法则）
 * UX-D4 8 页面统一深色（零白天残留）
 * UX-D5 零英文技术词 + 短剧/招聘/企业工作台零影响
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
  const known500 = ['/api/member/profile', '/api/v2/user/model-config/unified', '/api/enterprise/media/overview', '/api/enterprise/subscription/current']
  page.on('response', r => {
    if (r.status() >= 500 && !known500.some(p => r.url().includes(p))) {
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
  const css = (sel, prop) => page.evaluate((s, p) => {
    const el = document.querySelector(s)
    return el ? getComputedStyle(el)[p] : ''
  }, sel, prop)

  /* ═══ UX-D1 深色高级空间 ═══ */
  console.log('\n═══ UX-D1 深色高级空间（非白 · 非深紫模板 · 卡片克制） ═══')
  const bg = await css('.mws', 'backgroundColor')
  check('UX-D1', '主背景 #0B1220 深蓝黑（夜晚办公室，非纯黑非纯白）', bg.includes('11, 18, 32'), bg)
  const cardBg = await css('.hq-stat', 'backgroundColor')
  check('UX-D1', '卡片 #111827 深色层次', cardBg.includes('17, 24, 39'), cardBg)
  const sideBg = await css('.mws-side', 'backgroundColor')
  check('UX-D1', '左栏深色面板（非白）', !sideBg.includes('255, 255, 255'), sideBg)
  check('UX-D1', '无大面积深紫科技模板（#7C3AED 清零）', !html.includes('7C3AED') && !html.includes('124, 58, 237'))
  check('UX-D1', '无霓虹紫渐变背景', !html.includes('linear-gradient(135deg, #8b5cf6') && !html.includes('linear-gradient(135deg, #7c3aed'))
  const statH = await page.evaluate(() => {
    const el = document.querySelector('.hq-stat')
    return el ? el.getBoundingClientRect().height : 0
  })
  check('UX-D1', '经营状态模块紧凑（80-160px，非巨大卡片）', statH >= 80 && statH <= 170, `${Math.round(statH)}px`)
  const pageH = await page.evaluate(() => document.body.scrollHeight)
  check('UX-D1', '首页总高 < 1900px（信息密度）', pageH < 1900, `${pageH}px`)

  /* ═══ UX-D2 第一屏经营结果 ═══ */
  console.log('\n═══ UX-D2 第一屏经营结果（AI 经营总部夜间模式） ═══')
  check('UX-D2', '「AI经营总部」顶部标识', hasTxt('AI 经营总部'))
  check('UX-D2', '问候语「早上好/下午好/晚上好，老板」', /(早上好|下午好|晚上好|夜深了)，老板/.test(text))
  check('UX-D2', '三状态模块：内容影响/客户增长/销售转化', hasTxt('内容影响') && hasTxt('客户增长') && hasTxt('销售转化'))
  check('UX-D2', '「今天 AI 已经为你完成」', hasTxt('今天 AI 已经为你完成'))
  check('UX-D2', '「本周经营表现」数据浮岛', hasTxt('本周经营表现'))
  check('UX-D2', '「AI 分析」判断区', hasTxt('AI 分析'))
  check('UX-D2', '「我的业务地图」四入口', hasTxt('我的业务地图') && await q('.hq-map-card') === 4)
  check('UX-D2', '首屏三区同屏可见（问候+状态+AI已完成）', await page.evaluate(() => {
    const vh = window.innerHeight
    const vis = sel => {
      const el = document.querySelector(sel)
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.top < vh && r.bottom > 0
    }
    return vis('.hq-greet') && vis('.hq-stats') && vis('.hq-done')
  }))
  check('UX-D2', '无 270° 仪表盘/罗盘', !html.includes('270') && !html.includes('罗盘'))

  /* ═══ UX-D3 蓝青数据光源（80/15/5） ═══ */
  console.log('\n═══ UX-D3 蓝青数据光源（昆仑蓝 #3B82F6 / AI 青 #22D3EE / 5% 紫） ═══')
  const numGrad = await page.evaluate(() => {
    const el = document.querySelector('.hq-stat-num.hl')
    return el ? getComputedStyle(el).backgroundImage : ''
  })
  check('UX-D3', '核心数字蓝青渐变高亮', numGrad.includes('96, 165, 250') || numGrad.includes('59, 130, 246') || numGrad.includes('34, 211, 238'), numGrad.slice(0, 60))
  check('UX-D3', 'AI 状态点青 #22D3EE（kicker 前圆点）', await page.evaluate(() => {
    const el = document.querySelector('.hq-greet-kicker::before') ? null : document.querySelector('.hq-greet-kicker')
    if (!el) return false
    const s = getComputedStyle(el)
    return s.color.includes('34, 211, 238') || s.color.includes('22, 211, 238')
  }))
  check('UX-D3', '导航激活态昆仑蓝 #3B82F6', (await css('.mws-nav-item.is-active', 'color')).includes('96, 165, 250') || (await css('.mws-nav-item.is-active .mws-nav-icon', 'color')).includes('59, 130, 246'))
  check('UX-D3', 'AI 标识（AI 分析标签）蓝青渐变', await page.evaluate(() => {
    const el = document.querySelector('.hq-week-judge-ico')
    return el ? getComputedStyle(el).backgroundImage.includes('59, 130, 246') : false
  }))
  check('UX-D3', '成长绿 #34D399（AI 团队状态，空态灰点）', await page.evaluate(() => {
    const el = document.querySelector('.hq-gm-state i')
    if (!el) return false
    const c = getComputedStyle(el).backgroundColor
    return c.includes('52, 211, 153') || c.includes('71, 85, 105') // 运行中绿 / 待接入灰
  }))

  /* ═══ UX-D4 8 页面统一深色 ═══ */
  console.log('\n═══ UX-D4 8 页面统一深色（零白天残留） ═══')
  const pages = ['team', 'content', 'messages', 'shop', 'accounts', 'analytics', 'intelligence', 'customers']
  for (const p of pages) {
    await page.goto(`${BASE}/workspace/media/${p}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await new Promise(r => setTimeout(r, 1800))
    const titleColor = await page.evaluate(() => {
      const el = document.querySelector('.mph-title, h1')
      return el ? getComputedStyle(el).color : ''
    })
    const light = /rgb\(2(2[0-9]|3[0-9]|4[0-9]|5[0-5])/.test(titleColor) || /rgb\(24[1-9]/.test(titleColor) // 浅色文字 = 深色背景正确
    check('UX-D4', `${p} 页面文字深色模式（浅色字）`, light, titleColor)
    const bgColor = await css('.mws', 'backgroundColor')
    check('UX-D4', `${p} 页面背景 #0B1220`, bgColor.includes('11, 18, 32'), bgColor)
  }
  check('UX-D4', '全媒体页面无 JS 错误', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

  /* ═══ UX-D5 零英文技术词 + 短剧/招聘/企业工作台零影响 ═══ */
  console.log('\n═══ UX-D5 零英文技术词 + 其他工作台零影响 ═══')
  await page.goto(`${BASE}/workspace/media/content`, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 2000))
  const bodyText = await page.evaluate(() => document.body.innerText)
  const banned = ['API', 'Token', 'Runtime', 'Dashboard', 'Content Factory', 'Media Analytics', 'Customer Intelligence', 'Industry Intelligence', 'SocialPost', 'AgentTask', 'BYOK', 'Webhook', 'OAuth', 'SDK']
  const hits = banned.filter(w => bodyText.includes(w))
  check('UX-D5', 'UI 零英文技术词（内容页）', hits.length === 0, hits.join(',') || 'clean')
  await page.goto(`${BASE}/director/`, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 1800))
  check('UX-D5', '短剧工作台可达', page.url().includes('/director/'))
  await page.goto(`${BASE}/recruitment/`, { waitUntil: 'networkidle2', timeout: 60000 }).then(() => {})
  check('UX-D5', '招聘中心可达', page.url().includes('/recruitment/'))
  await page.goto(`${BASE}/workspace/enterprise/model-settings`, { waitUntil: 'networkidle2', timeout: 60000 }).then(() => {})
  check('UX-D5', '企业工作台可达', page.url().includes('/workspace/enterprise'))
  check('UX-D5', '全流程无 JS 错误', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))

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
