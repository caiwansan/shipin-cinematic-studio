// 完整抓包：小红书扫码确认全流程（不截断响应）
const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:18801')
  const ctx = browser.contexts()[0]
  const page = ctx.pages().find(p => p.url().includes('xiaohongshu'))
  if (!page) { console.log('❌ 未找到小红书页面'); await browser.close(); return }
  console.log('监听:', page.url().slice(0, 70))
  const log = []
  page.on('request', r => {
    const u = r.url()
    if (/qrcode|qr|login|confirm|passport|check/i.test(u)) {
      log.push(`\n[REQ ${new Date().toISOString().slice(11,19)}] ${r.method()} ${u}`)
    }
  })
  page.on('response', async r => {
    const u = r.url()
    if (/qrcode|qr|login|confirm|passport|check/i.test(u)) {
      let body = ''
      try { body = (await r.text()).slice(0, 600) } catch {}
      log.push(`[RES ${r.status()}] ${u}\n  ${body.replace(/\s+/g, ' ').slice(0, 500)}`)
      // 记录 Set-Cookie
      const sc = r.headers()['set-cookie']
      if (sc) log.push(`  SET-COOKIE: ${sc.slice(0, 200)}`)
    }
  })
  page.on('pageerror', e => log.push(`\n[PAGEERR] ${String(e).slice(0, 200)}`))
  page.on('console', m => { if (m.type() === 'error') log.push(`[CONSOLE-ERR] ${m.text().slice(0, 150)}`) })
  console.log('抓包 150s（掌柜请扫码并在手机确认）...')
  for (let i = 1; i <= 15; i++) {
    await new Promise(r => setTimeout(r, 10000))
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 150)).catch(() => '')
    const url = page.url()
    const ck = await ctx.cookies()
    console.log(`t=${i * 10}s ${url.slice(0, 50)} cookies=${ck.length} | ${txt.slice(0, 50).replace(/\n/g, ' ')}`)
    if (/创作中心|笔记管理|数据中心/.test(txt)) { console.log('🎉 页面已进入登录态！'); break }
  }
  console.log('\n========== 抓包结果 ==========')
  console.log(log.join('\n').slice(0, 4000))
  const fs = require('fs')
  fs.writeFileSync('/tmp/xhs-capture.log', log.join('\n'))
  await browser.close()
})().catch(e => console.error('ERR', e.message))
