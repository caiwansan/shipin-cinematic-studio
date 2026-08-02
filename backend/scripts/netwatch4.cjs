const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18801')
  const ctx = browser.contexts()[0]
  const page = ctx.pages().find(p => p.url().includes('xiaohongshu'))
  if (!page) { console.log('❌ 未找到小红书页面:', ctx.pages().map(p=>p.url().slice(0,60))); await browser.close(); return }
  console.log('监听:', page.url().slice(0, 70))
  const log = []
  const seen = new Set()
  page.on('request', r => {
    const u = r.url()
    if (/qr|login|check|confirm|passport|api\/sns|web\/api/i.test(u) && !seen.has('Q' + u)) {
      seen.add('Q' + u); log.push(`REQ ${r.method()} ${u.slice(0, 130)}`)
    }
  })
  page.on('response', async r => {
    const u = r.url()
    if (/qr|login|check|confirm|passport|api\/sns/i.test(u) && !seen.has('R' + u)) {
      seen.add('R' + u)
      let body = ''
      try { body = (await r.text()).slice(0, 200) } catch {}
      log.push(`RES ${r.status()} ${u.slice(0, 110)}\n    ${body.replace(/\s+/g, ' ').slice(0, 130)}`)
    }
  })
  page.on('pageerror', e => log.push(`PAGEERR ${String(e).slice(0, 150)}`))
  let loggedIn = false
  for (let i = 1; i <= 12; i++) {
    await new Promise(r => setTimeout(r, 10000))
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => '')
    const url = page.url()
    const cookies = await ctx.cookies()
    const keyCookies = cookies.filter(c => ['web_session','customerClientId','gid','webId','a1'].includes(c.name)).map(c => c.name)
    console.log(`t=${i * 10}s url=${url.slice(0, 55)} cookies=${cookies.length}[${keyCookies.join(',')}] | ${txt.slice(0, 55).replace(/\n/g, ' ')}`)
    if (cookies.length >= 3 || /创作中心|笔记管理|数据中心|发布/.test(txt)) {
      console.log('🎉 疑似已登录！')
      loggedIn = true
      break
    }
  }
  console.log('\n=== 网络活动 ===')
  console.log(log.slice(0, 60).join('\n'))
  if (loggedIn) {
    const fs = require('fs')
    const shot = await page.screenshot()
    fs.writeFileSync('/tmp/XHS-LOGIN-SUCCESS.png', shot)
    console.log('\n截图已存 /tmp/XHS-LOGIN-SUCCESS.png')
  }
  await browser.close()
})().catch(e => console.error('ERR', e.message))
