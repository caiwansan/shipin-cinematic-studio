// 通过 CDP 连接现有小红书浏览器，监听登录确认后的轮询 XHR
const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
  const ctxs = browser.contexts()
  const ctx = ctxs[0]
  const pages = ctx.pages()
  console.log('页面数:', pages.length)
  const page = pages[0]
  console.log('URL:', page.url())
  const log = []
  const seen = new Set()
  page.on('request', r => {
    const u = r.url()
    if (/qr|login|check|confirm|sns|web\/api|passport/i.test(u) && !seen.has(u)) {
      seen.add(u); log.push(`REQ ${r.method()} ${u.slice(0, 130)}`)
    }
  })
  page.on('response', async r => {
    const u = r.url()
    if (/qr|login|check|confirm|passport/i.test(u) && !seen.has('RES ' + u)) {
      seen.add('RES ' + u)
      let body = ''
      try { body = (await r.text()).slice(0, 150) } catch {}
      log.push(`RES ${r.status()} ${u.slice(0, 110)} ${body.replace(/\s+/g, ' ').slice(0, 80)}`)
    }
  })
  page.on('console', m => { if (m.type() === 'error') log.push(`CONSOLE-ERR ${m.text().slice(0, 150)}`) })
  page.on('pageerror', e => log.push(`PAGEERR ${String(e).slice(0, 150)}`))
  console.log('开始监听 100s（掌柜请在手机确认登录）...')
  for (let i = 1; i <= 10; i++) {
    await new Promise(r => setTimeout(r, 10000))
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 150)).catch(() => '')
    const url = page.url()
    const cookies = await ctx.cookies()
    console.log(`t=${i * 10}s url=${url.slice(0, 55)} cookies=${cookies.length} | ${txt.slice(0, 60).replace(/\n/g, ' ')}`)
    if (/创作中心|笔记管理|发布|数据中心/.test(txt) && cookies.length > 0) {
      console.log('🎉 已登录！')
      break
    }
  }
  console.log('\n=== 网络活动(前40条) ===')
  console.log(log.slice(0, 40).join('\n'))
  await browser.close()
})().catch(e => console.error('ERR', e.message))
