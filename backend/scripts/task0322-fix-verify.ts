/**
 * TASK03.2.2-FIX 验证 — 扫码成功跳转场景
 * 模拟：页面从登录页 SPA 跳转（经过 about:blank 中间态）→ 探针应保持页面不被重建
 */
import { chromium } from 'playwright'
import { execSync } from 'child_process'

const API = 'http://127.0.0.1:4002'
const SESSION = 'douyin:08a0f643-fb0d-48d5-af18-ad87bd9a34fb'

async function main() {
  const token = await fetch(API + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) }).then(r => r.json()).then(j => j.token)

  const h = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }

  // 1. 当前页面状态（登录页 + 二维码）
  let s = await fetch(`${API}/api/enterprise/channels/runtime/browser/${encodeURIComponent(SESSION)}/status`, { headers: h }).then(r => r.json())
  console.log('BEFORE:', s.data?.url?.slice(0, 60), '| stage:', s.data?.loginStage, '| qr:', !!s.data?.qrCodeBase64)

  // 2. 模拟扫码成功 → 页面跳转创作者中心（真实场景：SPA 跳转）
  //    通过 runtime 的页面导航到创作者首页（模拟跳转后的状态）
  const nav = await fetch(`${API}/api/enterprise/channels/runtime/browser/${encodeURIComponent(SESSION)}/navigate`, { method: 'POST', headers: h, body: JSON.stringify({ url: 'https://creator.douyin.com/creator-micro/home' }) }).catch(() => null)
  console.log('NAV:', nav ? (await nav.json()).data?.url?.slice(0, 60) : 'navigate endpoint 不存在（跳过）')

  // 3. 连续 3 次 status（模拟轮询）→ 页面不应被重建回登录页
  for (let i = 1; i <= 3; i++) {
    await new Promise(r => setTimeout(r, 4000))
    s = await fetch(`${API}/api/enterprise/channels/runtime/browser/${encodeURIComponent(SESSION)}/status`, { headers: h }).then(r => r.json())
    const url = s.data?.url || ''
    console.log(`POLL${i}:`, url.slice(0, 60), '| stage:', s.data?.loginStage, '| loggedIn:', s.data?.loggedIn)
  }
  console.log('DONE')
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
