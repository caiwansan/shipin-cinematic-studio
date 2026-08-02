/**
 * SPRINT-MEDIA-WECHAT-VIDEO-G6-DEBUG-01 Task03 — 视频号真实扫码登录链调试
 * 用法: npx tsx scripts/wechat-video-login-debug.ts
 *
 * 流程: login → connect(channels_wechat) → 扫码前快照 → 持续轮询 status
 *       → 掌柜真机扫码 → 观察 URL/cookies/探针信号/状态机推进 → 输出 timeline
 * 后端 LOGIN-TIMELINE 日志（pm2 logs api-server）提供 cookie 明细/身份提取明细。
 */
const API = 'http://localhost:4002'
const ACCOUNT_ID = 'c4a1b25f-902e-4c17-9846-c5ad9bab6be0' // channels_wechat

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const ts = () => new Date().toISOString().slice(11, 19)

async function api(path: string, opts: any = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const j = await res.json().catch(() => ({ code: 1, message: 'non-json' }))
  return { status: res.status, j }
}

async function main() {
  console.log(`[${ts()}] ═══ 视频号真实扫码登录链调试 ═══`)
  // 1. 登录
  const login = await api('/api/admin/login', { method: 'POST', body: { username: 'admin', password: 'admin123' } })
  const token = login.j?.data?.token || login.j?.token
  if (!token) { console.log('❌ 登录失败', login.j); return }
  console.log(`[${ts()}] ✅ admin token 获取`)

  // 2. 账号现状
  const acc = await api(`/api/enterprise/channels/runtime/channels_wechat/account-status`, { token })
  console.log(`[${ts()}] 账号现状: ${JSON.stringify(acc.j?.data || acc.j)}`)

  // 3. connect（打开浏览器）
  console.log(`[${ts()}] ▶ connect ...`)
  const conn = await api(`/api/enterprise/channels/runtime/${ACCOUNT_ID}/connect`, { token, method: 'POST', body: {} })
  const sessionId = conn.j?.data?.sessionId || conn.j?.data?.sid
  console.log(`[${ts()}] connect 返回: ${JSON.stringify(conn.j?.data || conn.j).slice(0, 200)}`)
  if (!sessionId) { console.log('❌ 未拿到 sessionId'); return }

  // 4. 扫码前快照（iframe 加载失败时点「点击重试」）
  console.log(`\n[${ts()}] ── 扫码前快照 ──`)
  await sleep(8000) // 等浏览器打开 + 二维码渲染
  for (let retry = 0; retry < 4; retry++) {
    snap = await api(`/api/enterprise/channels/runtime/browser/${encodeURIComponent(sessionId)}/status`, { token })
    const d0 = snap.j?.data || {}
    const txt = (d0.debug?.pageTextSample || '')
    if (!d0.qrCodeBase64 || /加载失败|点击重试/.test(txt)) {
      console.log(`[${ts()}] iframe 未就绪（frames=${d0.debug?.frames}），等待重试 ${retry + 1}/4 ...`)
      await sleep(8000)
    } else { console.log(`[${ts()}] iframe 就绪（frames=${d0.debug?.frames}）`); break }
  }
  snap = await api(`/api/enterprise/channels/runtime/browser/${encodeURIComponent(sessionId)}/status`, { token })
  const d = snap.j?.data || {}
  console.log(`[${ts()}] url=${d.url?.slice(0, 90)}`)
  console.log(`[${ts()}] state=${d.state} loginStage=${d.loginStage} loggedIn=${d.loggedIn} qrSource=${d.qrSource} frames=${d.debug?.frames}`)
  console.log(`[${ts()}] probeSignals=${JSON.stringify(d.debug?.probeSignals || {})}`)
  console.log(`[${ts()}] pageTextSample=${(d.debug?.pageTextSample || '').slice(0, 200).replace(/\n+/g, ' | ')}`)
  const qrOk = !!d.qrCodeBase64
  console.log(`[${ts()}] 二维码: ${qrOk ? '✅ 已生成（等待掌柜扫码）' : '❌ 无二维码！'}`)
  // 二维码就绪 → 存图（供掌柜扫码）
  if (d.qrCodeBase64) {
    require('fs').writeFileSync('/tmp/wx-video-qr.png', Buffer.from(d.qrCodeBase64, 'base64'))
    console.log(`[${ts()}] 📷 二维码已存 /tmp/wx-video-qr.png`)
  } else if (d.screenshotBase64) {
    require('fs').writeFileSync('/tmp/wx-video-qr.png', Buffer.from(d.screenshotBase64, 'base64'))
    console.log(`[${ts()}] 📷 整页截图已存 /tmp/wx-video-qr.png`)
  }

  // 5. 持续轮询 timeline（等掌柜扫码 + 手机确认）
  console.log(`\n[${ts()}] ── 持续观测（请掌柜用微信扫码并手机确认）──`)
  const t0 = Date.now()
  let lastState = '', lastUrl = '', lastSignals = '', lastLoggedIn = false
  while (Date.now() - t0 < 360000) {
    await sleep(3000)
    const r = await api(`/api/enterprise/channels/runtime/browser/${encodeURIComponent(sessionId)}/status`, { token }).catch(() => null)
    if (!r) continue
    const dd = r.j?.data || {}
    const sig = JSON.stringify(dd.debug?.probeSignals || {})
    const changed =
      dd.state !== lastState || dd.url?.slice(0, 80) !== lastUrl || sig !== lastSignals || dd.loggedIn !== lastLoggedIn
    if (changed) {
      console.log(
        `[${ts()}] state=${dd.state} legacy=${dd.loginStage} loggedIn=${dd.loggedIn} | url=${(dd.url || '').slice(0, 80)} | ` +
        `signals=${sig} | name=${dd.accountName || '-'} id=${dd.externalAccountId || '-'}`
      )
      lastState = dd.state; lastUrl = dd.url?.slice(0, 80); lastSignals = sig; lastLoggedIn = dd.loggedIn
    }
    if (dd.loggedIn) {
      console.log(`\n[${ts()}] 🎉 探针检测到登录！account=${dd.accountName}/${dd.externalAccountId}`)
      // 触发 wait-for-login 完成闭环（与前端 finishConnect 同路径）
      console.log(`[${ts()}] ▶ wait-for-login ...`)
      const wf = await api(`/api/enterprise/channels/runtime/${ACCOUNT_ID}/wait-for-login`, { token, method: 'POST', body: {} })
      console.log(`[${ts()}] wait-for-login: ${JSON.stringify(wf.j?.data || wf.j).slice(0, 300)}`)
      // 最终账号状态
      const fin = await api(`/api/enterprise/channels/runtime/channels_wechat/account-status`, { token })
      console.log(`[${ts()}] 最终账号状态: ${JSON.stringify(fin.j?.data || fin.j)}`)
      return
    }
  }
  console.log(`\n[${ts()}] ⏰ 360s 超时，探针始终未认证。请查看 pm2 logs api-server 的 [LOGIN-TIMELINE] 明细。`)
}

main().catch(e => { console.error('脚本异常:', e); process.exit(1) })
