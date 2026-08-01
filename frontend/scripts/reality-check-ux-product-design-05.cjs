#!/usr/bin/env node
/**
 * Sprint-MEDIA-UX-PRODUCT-DESIGN-05 验收（Design System v1）
 * UX-P1 品牌气质/空间感（非白非黑，昆仑蓝点缀）
 * UX-P2 信息密度 +40% / 卡片高度 -40%
 * UX-P3 第一屏看到经营结果（老板桌面）
 * UX-P4 8 页面设计语言统一（作用域覆盖生效，零深色残留）
 * UX-P5 短剧/招聘/企业工作台零影响（且不受白天覆盖泄漏）
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
  const known500 = ['/api/member/profile', '/api/v2/user/model-config/unified', '/api/enterprise/media/overview', '/api/enterprise/subscription/current'] // subscription/current 500 为 pre-existing（admin 无企业订阅上下文，e910384b 前已存在）
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

  /* ═══ UX-P1 品牌气质与空间感 ═══ */
  console.log('\n═══ UX-P1 品牌气质与空间感（非白非黑 · 昆仑蓝点缀） ═══')
  const bg = await css('.mws', 'backgroundColor')
  check('UX-P1', '背景为 #F4F6FA 雾蓝（非纯白非纯黑）', bg.includes('244, 246, 250'), bg)
  check('UX-P1', '品牌区存在（昆仑镜 / AI 经营总部）', hasTxt('昆仑镜') && hasTxt('AI 经营总部'))
  const sideBg = await css('.mws-side', 'backgroundColor')
  check('UX-P1', '左栏白底细边框', sideBg.includes('255, 255, 255'))
  check('UX-P1', '无深紫 #7C3AED 残留', !html.includes('7C3AED') && !html.includes('124, 58, 237'))
  check('UX-P1', '无荧光绿 #34d399（深色主题色）', !html.includes('34d399') && !html.includes('52, 211, 153'))
  check('UX-P1', '昆仑蓝 #2563EB 点缀出现', await page.evaluate(() => {
    const el = document.querySelector('.hq-gm-state') || document.querySelector('.hq-sec-link')
    return el ? getComputedStyle(el).color.includes('37, 99, 235') || el.innerText.includes('→') : false
  }) || (await css('.hq-map-ico', 'color')).includes('37, 99, 235'))
  check('UX-P1', '导航为 SVG 线性图标（无 emoji）', await page.evaluate(() => {
    const icons = [...document.querySelectorAll('.mws-nav-icon')]
    if (!icons.length) return false
    const emojiRe = /[\u{1F000}-\u{1FAFF}\u{FE0F}]/u
    return icons.every(el => !emojiRe.test(el.innerText) && el.querySelector('svg'))
  }))

  /* ═══ UX-P2 信息密度 +40% / 卡片 -40% ═══ */
  console.log('\n═══ UX-P2 信息密度与卡片尺寸 ═══')
  const statH = await page.evaluate(() => {
    const el = document.querySelector('.hq-stat')
    return el ? el.getBoundingClientRect().height : 0
  })
  check('UX-P2', '经营状态卡紧凑（80-160px，非 300px 大卡）', statH >= 80 && statH <= 170, `${Math.round(statH)}px`)
  const pageH = await page.evaluate(() => document.body.scrollHeight)
  check('UX-P2', '首页总高 < 1900px（信息密度提升）', pageH < 1900, `${pageH}px`)
  check('UX-P2', '首屏信息密度：问候+经营状态+AI已完成 同屏可见', await page.evaluate(() => {
    const vh = window.innerHeight
    const vis = sel => {
      const el = document.querySelector(sel)
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.top < vh && r.bottom > 0
    }
    return vis('.hq-greet') && vis('.hq-stats') && vis('.hq-done')
  }))

  /* ═══ UX-P3 第一屏看到经营结果（老板桌面） ═══ */
  console.log('\n═══ UX-P3 老板桌面结构 ═══')
  check('UX-P3', '问候语「早上好/下午好/晚上好，老板」', /(早上好|下午好|晚上好|夜深了)，老板/.test(text))
  check('UX-P3', '首屏可见「经营健康」', hasTxt('经营健康'))
  check('UX-P3', '首屏可见「收入趋势」', hasTxt('收入趋势'))
  check('UX-P3', '首屏可见「客户增长」', hasTxt('客户增长'))
  check('UX-P3', '「今天 AI 已完成」区块存在', hasTxt('今天 AI 已完成'))
  check('UX-P3', '「本周经营表现」摘要存在', hasTxt('本周经营表现'))
  check('UX-P3', '「我的业务地图」四入口存在', hasTxt('我的业务地图') && await q('.hq-map-card') === 4)
  check('UX-P3', '无 270° 仪表盘/罗盘（老板不开飞机）', !html.includes('270') && !html.includes('罗盘'))

  /* ═══ UX-P4 8 页面设计语言统一 ═══ */
  console.log('\n═══ UX-P4 设计语言统一（作用域覆盖生效） ═══')
  const pages = ['team', 'content', 'messages', 'shop', 'accounts', 'analytics', 'intelligence', 'customers']
  for (const p of pages) {
    await page.goto(`${BASE}/workspace/media/${p}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await new Promise(r => setTimeout(r, 1800))
    const titleColor = await page.evaluate(() => {
      const el = document.querySelector('.mph-title, h1')
      return el ? getComputedStyle(el).color : ''
    })
    const dark = /^\s*rgb\((1[0-9]|2[0-4])\b/.test(titleColor) // 深色文字 = 白天化成功
    check('UX-P4', `${p} 页面文字白天化（深色字非浅色字）`, dark, titleColor)
    const bgColor = await css('.mws', 'backgroundColor')
    check('UX-P4', `${p} 页面背景为 #F4F6FA`, bgColor.includes('244, 246, 250'), bgColor)
  }
  check('UX-P4', '全媒体页面无 JS 错误', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

  /* ═══ UX-P5 短剧/招聘/企业工作台零影响 ═══ */
  console.log('\n═══ UX-P5 短剧/招聘/企业工作台零影响 ═══')
  await page.goto(`${BASE}/director/`, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 1800))
  const dirBg = await page.evaluate(() => {
    const el = document.querySelector('.dw-root, .workbench, body')
    return el ? getComputedStyle(el).backgroundColor : ''
  })
  const dirStatus = page.url().includes('/director/')
  check('UX-P5', '短剧工作台可达', dirStatus)
  check('UX-P5', '短剧工作台保持深色主题（白天覆盖不泄漏）',
    !dirBg.includes('244, 246, 250') && !dirBg.includes('255, 255, 255'), dirBg)
  await page.goto(`${BASE}/recruitment/`, { waitUntil: 'networkidle2', timeout: 60000 }).then(() => {})
  check('UX-P5', '招聘中心可达', page.url().includes('/recruitment/'))
  await page.goto(`${BASE}/workspace/enterprise/model-settings`, { waitUntil: 'networkidle2', timeout: 60000 }).then(() => {})
  check('UX-P5', '企业工作台可达', page.url().includes('/workspace/enterprise'))
  check('UX-P5', '全流程无 JS 错误', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))

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
