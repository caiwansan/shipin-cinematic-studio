/**
 * SPRINT-MEDIA-QR-LATENCY-AUDIT-01 — 二维码链路耗时审计（只测时间，不改代码）
 *
 * 测量链路（对齐掌柜定义）：
 *   click connect → API received → browser launch → page created
 *   → login URL loaded → QR DOM found → QR returned frontend
 *
 * 方法：黑盒 POST /connect + CDP 并行观测浏览器事件 + pm2 日志时间戳对齐
 * 用法：npx tsx scripts/qr-latency-audit-01.ts [platform]   （默认 kuaishou）
 */
import { chromium } from 'playwright'

const platform = process.argv[2] || 'kuaishou'
const API = 'http://127.0.0.1:4002'
const CDP = 'http://127.0.0.1:18836'
const ACCOUNT_ID = platform === 'kuaishou' ? '10e0ea29-3a20-4aae-9efc-8557b86daa0c' : ''

const t0 = Date.now()
const events: { t: number; ev: string; d?: string }[] = []
const mark = (ev: string, d?: string) => events.push({ t: Date.now() - t0, ev, d })

async function login() {
  const r = await fetch(API + '/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const j = await r.json() as any
  return 'Bearer ' + (j.data?.token || j.token || '')
}

/** CDP 观测：浏览器启动后连上，记录页面/导航/二维码出现时刻 */
async function observe() {
  let b: any = null
  for (let i = 0; i < 60; i++) { // 最长 30s 等浏览器起来
    try { b = await chromium.connectOverCDP(CDP); break } catch { await new Promise(r => setTimeout(r, 500)) }
  }
  if (!b) { mark('CDP_CONNECT_FAIL'); return }
  mark('BROWSER_READY_CDP')
  const ctx = b.contexts()[0]
  const watch = (p: any) => {
    mark('PAGE_OPEN', p.url().slice(0, 70))
    p.on('framenavigated', (f: any) => mark('NAV', f.url().slice(0, 70)))
    p.on('request', (req: any) => {
      const u = req.url()
      if (/qr|login|passport|kuaishou/i.test(u) && /kuaishou|passport/i.test(u)) mark('REQ', u.slice(0, 90))
    })
  }
  for (const p of ctx.pages()) watch(p)
  ctx.on('page', watch)
  // 轮询二维码 DOM
  const iv = setInterval(async () => {
    for (const p of ctx.pages()) {
      try {
        const qr = await p.evaluate(() => {
          const imgs = [...document.querySelectorAll('img')]
          const q = imgs.find(i => /qr|scan|code/i.test(i.src) && i.naturalWidth > 50)
          return q ? q.src.slice(0, 60) : ''
        }).catch(() => '')
        if (qr) { mark('QR_DOM_FOUND', qr); clearInterval(iv); return }
      } catch {}
    }
  }, 500)
}

async function main() {
  mark('AUDIT_START', `platform=${platform}`)
  const auth = await login()
  const url = API + '/api/enterprise/channels/runtime/' + platform + '/connect'
  const p = observe()
  mark('CONNECT_SENT')
  let resp: any
  try {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' } })
    resp = await r.json()
  } catch (e: any) { resp = { error: e.message } }
  mark('CONNECT_RETURNED', JSON.stringify(resp.data || resp).slice(0, 120))
  await p
  await new Promise(r => setTimeout(r, 1000))

  console.log(`\n═══ QR LATENCY AUDIT — ${platform} ═══`)
  console.log(`connect 总耗时: ${events.find(e => e.ev === 'CONNECT_RETURNED')?.t ?? '?'} ms`)
  for (const e of events) console.log(`  +${String(e.t).padStart(6)}ms  ${e.ev.padEnd(18)} ${e.d || ''}`)
  const key = (ev: string) => events.find(e => e.ev === ev)?.t
  console.log(`\n阶段耗时:`)
  const segs: [string, string, string][] = [
    ['connect API 接收', 'CONNECT_SENT', 'CONNECT_RETURNED'],
    ['浏览器启动(CDP可连)', 'CONNECT_SENT', 'BROWSER_READY_CDP'],
    ['登录页加载(首个NAV)', 'CONNECT_SENT', 'NAV'],
    ['二维码DOM出现', 'CONNECT_SENT', 'QR_DOM_FOUND'],
    ['QR DOM→API返回(等待窗口)', 'QR_DOM_FOUND', 'CONNECT_RETURNED'],
  ]
  for (const [name, a, b] of segs) {
    const ta = key(a), tb = key(b)
    if (ta != null && tb != null) console.log(`  ${name}: ${tb - ta} ms`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
