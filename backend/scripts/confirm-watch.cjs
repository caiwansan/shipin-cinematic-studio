// 确认流程实时监控：CDP 抓包 + API 状态
const { chromium } = require('playwright')
const BASE = 'https://aigc.fushtn.com'
;(async () => {
  // API 状态
  const login = await (await fetch(BASE + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })).json()
  const token = login.accessToken || login.token || login.data?.accessToken
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  let accId = null
  try {
    const acc = await (await fetch(`${BASE}/api/enterprise/channels/runtime/xiaohongshu/ensure-account`, { method: 'POST', headers: H, body: '{}' })).json()
    accId = acc.data?.id
  } catch {}
  // CDP 抓包
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18801').catch(e => { console.log('CDP 连接失败:', e.message.slice(0, 60)); return null })
  let page = null, ctx = null
  if (browser) {
    ctx = browser.contexts()[0]
    page = ctx.pages().find(p => p.url().includes('xiaohongshu'))
    if (page) {
      console.log('🎧 监听页面:', page.url().slice(0, 60))
      page.on('response', async r => {
        const u = r.url()
        if (/qrcode|qr|login|confirm|passport/i.test(u)) {
          let body = ''
          try { body = (await r.text()).slice(0, 300) } catch {}
          console.log(`[RES ${r.status()}] ${u.slice(0, 80)}\n  ${body.replace(/\s+/g, ' ').slice(0, 250)}`)
          const sc = r.headers()['set-cookie']
          if (sc) console.log(`  🍪SET-COOKIE: ${sc.slice(0, 120)}`)
        }
      })
      page.on('pageerror', e => console.log(`[PAGEERR] ${String(e).slice(0, 120)}`))
    } else console.log('⚠️ CDP 里没有小红书页面')
  }
  console.log('监控 90s：掌柜请在手机上点「确认登录」...')
  for (let i = 1; i <= 9; i++) {
    await new Promise(r => setTimeout(r, 10000))
    // CDP 页面状态
    if (page) {
      try {
        const txt = await page.evaluate(() => document.body.innerText.slice(0, 120)).catch(() => '')
        const url = page.url()
        const ck = await ctx.cookies()
        const key = ck.filter(c => ['web_session','webId','gid'].includes(c.name)).map(c => c.name)
        console.log(`t=${i * 10}s url=${url.slice(0, 45)} cookies=${ck.length}[${key.join(',')}] | ${txt.slice(0, 40).replace(/\n/g, ' ')}`)
        if (/创作中心|笔记管理|数据中心|new\/home/.test(txt) || url.includes('creator')) {
          console.log('🎉🎉 登录成功！页面已跳转/进入登录态！')
          const shot = await page.screenshot()
          require('fs').writeFileSync('/tmp/XHS-LOGIN-OK.png', shot)
          console.log('截图: /tmp/XHS-LOGIN-OK.png')
          break
        }
      } catch {}
    }
    // API 状态
    if (accId) {
      try {
        const st = await (await fetch(`${BASE}/api/enterprise/channels/runtime/${accId}/metrics`, { headers: H })).json()
        const d = st.data || {}
        if (d.connected || d.connectionStatus === 'CONNECTED') console.log(`  API: ✅ CONNECTED!`)
      } catch {}
    }
  }
  if (browser) await browser.close()
  console.log('监控结束')
})().catch(e => console.error('ERR', e.message))
