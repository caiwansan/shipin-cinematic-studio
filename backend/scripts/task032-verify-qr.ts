/**
 * TASK03.2 — 验证 adapter.getLoginStatus 返回放大二维码 qrCodeBase64
 * 直接实例化 DouyinBrowserAdapter（mock deps），打开登录页 → 提取二维码
 */
import { DouyinBrowserAdapter } from '../src/enterprise/channel/adapters/douyin-browser.adapter.js'
import fs from 'fs'

const ACCOUNT_ID = '08a0f643-fb0d-48d5-af18-ad87bd9a34fb'

async function main() {
  const adapter = new DouyinBrowserAdapter({
    getCredential: async () => ({}),
    persistCredential: async () => {},
  })

  console.log('1. connect...')
  const conn = await adapter.connect(ACCOUNT_ID)
  console.log('connect status:', conn.status, '| sessionId:', conn.sessionId)

  // 等待登录页渲染
  await new Promise(r => setTimeout(r, 8000))

  console.log('2. getLoginStatus...')
  const st = await adapter.getLoginStatus(conn.sessionId)
  console.log('loggedIn:', st.loggedIn)
  console.log('url:', st.url)
  console.log('screenshotBase64 len:', st.screenshotBase64?.length ?? 0)
  console.log('qrCodeBase64 len:', st.qrCodeBase64?.length ?? 0)

  if (st.qrCodeBase64) {
    const out = '/root/.openclaw/media/qqbot/douyin-api-qr-test.png'
    fs.writeFileSync(out, Buffer.from(st.qrCodeBase64, 'base64'))
    console.log('QR_SAVED:', out)
  }

  // 再等 20s 取第二次，验证轮询下二维码仍可提取（有效期内的稳定性）
  console.log('3. 等 20s 二次提取...')
  await new Promise(r => setTimeout(r, 20000))
  const st2 = await adapter.getLoginStatus(conn.sessionId)
  console.log('qrCodeBase64 len (2nd):', st2.qrCodeBase64?.length ?? 0)
  console.log('DONE')
  process.exit(0)
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
