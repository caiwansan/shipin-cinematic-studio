const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18800')
  const ctx = browser.contexts()[0]
  for (const p of ctx.pages()) {
    console.log(`[${ctx.pages().indexOf(p)}] ${p.url().slice(0, 90)}`)
  }
  const page = ctx.pages().find(p => p.url().includes('xiaohongshu'))
  if (!page) { console.log('❌ 未找到小红书页面'); await browser.close(); return }
  console.log('\n监听小红书页面:', page.url())
  const log = []
  const seen = new Set()
  page.on('request', r => {
    const u = r.url()
    if (/qr|login|check|confirm|sns|web\/api|passport|api\/sns/i.test(u) && !seen.has(u)) {
      seen.add(u); log.push(`REQ ${r.method()} ${u.slice(0, 140)}`)
    }
  })
  page.on('response', async r => {
    const u = r.url()
    if (/qr|login|check|confirm|passport|api\/sns/i.test(u) && !seen.has('RES ' + u)) {
      seen.add('RES ' + u)
      let body = ''
      try { body = (await r.text()).slice(0, 200) } catch {}
      log.push(`RES ${r.status()} ${u.slice(0, 120)}\n    ${body.replace(/\s+/g, ' ').slice(0, 120)}`)
    }
  })
  page.on('console', m => { if (m.type() === 'error') log.push(`CONSOLE-ERR ${m.text().slice(0, 150)}`) })
  page.on('pageerror', e => log.push(`PAGEERR ${String(e).slice(0, 150)}`))
  console.log('监听 100s（掌柜请在手机确认登录）...')
  for (let i = 1; i <= 10; i++) {
    await new Promise(r => setTimeout(r, 10000))
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => '')
    const url = page.url()
    const cookies = await ctx.cookies(url)
    console.log(`t=${i * 10}s cookies=${cookies.length} | ${txt.slice(0, 70).replace(/\n/g, ' ')}`)
    if (/创作中心|笔记管理|数据中心|发布/.test(txt) && cookies.length >= 2) {
      console.log('🎉 已登录！')
      break
    }
  }
  console.log('\n=== 网络活动 ===')
  console.log(log.slice(0, 50).join('\n'))
  await browser.close()
})().catch(e => console.error('ERR', e.message))
