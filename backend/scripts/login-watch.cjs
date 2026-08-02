// 后台登录监控：每 5s 查 account-status，检测到 CONNECTED 立即报警
const BASE = 'https://aigc.fushtn.com'
;(async () => {
  const login = await (await fetch(BASE + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })).json()
  const token = login.accessToken || login.token || login.data?.accessToken
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const t0 = Date.now()
  let lastState = ''
  while (Date.now() - t0 < 6 * 60 * 1000) {
    try {
      const st = await (await fetch(`${BASE}/api/enterprise/channels/runtime/xiaohongshu/account-status`, { headers: H })).json()
      const d = st.data || {}
      const s = `${d.connectionStatus}|${d.connected}`
      if (s !== lastState) {
        console.log(`${new Date().toISOString().slice(11,19)} state=${s} deviceTrusted=${d.deviceTrusted} boundAt=${d.boundAt || '-'}`)
        lastState = s
      }
      if (d.connected === true || d.connectionStatus === 'CONNECTED') {
        console.log('🎉🎉🎉 登录成功！CONNECTED=true')
        process.exit(0)
      }
    } catch {}
    await new Promise(r => setTimeout(r, 5000))
  }
  console.log('监控结束（6 分钟无变化）')
  process.exit(1)
})().catch(e => console.error('ERR', e.message))
