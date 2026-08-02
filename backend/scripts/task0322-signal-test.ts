/**
 * TASK03.2.2-FIX 探针信号自测 — 模拟扫码成功后的登录态
 * 方案：在运行中的浏览器 context 注入登录 cookie + 导航创作者工作台
 * → 验证探针三信号能否识别（B cookie + A 页面特征）
 */
import { chromium } from 'playwright'
import { execSync } from 'child_process'

const API = 'http://127.0.0.1:4002'
const SESSION = 'douyin:08a0f643-fb0d-48d5-af18-ad87bd9a34fb'

async function main() {
  const token = await fetch(API + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) }).then(r => r.json()).then(j => j.token)
  const h = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }

  // 注入模拟登录 cookie（sessionid/sid_guard/uid_tt → B 信号）
  const inj = await fetch(`${API}/api/enterprise/channels/runtime/browser/${encodeURIComponent(SESSION)}/inject-test-cookies`, { method: 'POST', headers: h, body: JSON.stringify({
    cookies: [
      { name: 'sessionid', value: 'test_session_' + Date.now(), domain: '.douyin.com', path: '/' },
      { name: 'sid_guard', value: 'test_guard_' + Date.now(), domain: '.douyin.com', path: '/' },
      { name: 'uid_tt', value: 'test_uid_' + Date.now(), domain: '.douyin.com', path: '/' },
    ],
  }) }).then(r => r.json()).catch(e => ({ code: 1, message: e.message }))
  console.log('INJECT:', inj.code === 0 ? 'ok' : (inj.message || 'endpoint 不存在'))

  // 导航到创作者工作台（A 信号页面特征）
  const nav = await fetch(`${API}/api/enterprise/channels/runtime/browser/${encodeURIComponent(SESSION)}/navigate`, { method: 'POST', headers: h, body: JSON.stringify({ url: 'https://creator.douyin.com/creator-micro/home' }) }).then(r => r.json()).catch(e => ({ code: 1, message: e.message }))
  console.log('NAV:', nav.code === 0 ? nav.data?.url?.slice(0, 60) : (nav.message || 'endpoint 不存在'))

  // 轮询 status 看探针判定
  for (let i = 1; i <= 4; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const s = await fetch(`${API}/api/enterprise/channels/runtime/browser/${encodeURIComponent(SESSION)}/status`, { headers: h }).then(r => r.json())
    const d = s.data || {}
    console.log(`POLL${i}: url=${(d.url||'').slice(0,50)} | stage=${d.loginStage} | loggedIn=${d.loggedIn} | name=${d.accountName||''} | signals=${JSON.stringify(d.debug?.signals || d.signals || {})}`)
  }
  console.log('DONE')
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
