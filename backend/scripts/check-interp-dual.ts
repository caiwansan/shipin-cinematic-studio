// concurrent dual-lang check: A speaks zh→B(en), B speaks ru→A(zh), simultaneously
import WebSocket from 'ws'
import { readFileSync } from 'node:fs'
const BASE = 'http://127.0.0.1:4002'
const WS = BASE.replace(/^http/, 'ws')
const login = async (email: string, password: string) => {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const j: any = await res.json()
  return j?.data?.token || j?.token || j?.accessToken
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
function slicePcm(pcm: Buffer, frameMs: number): Buffer[] {
  const bytes = Math.floor((frameMs / 1000) * 16000 * 2); const out: Buffer[] = []
  for (let i = 0; i < pcm.length; i += bytes) out.push(pcm.subarray(i, i + bytes))
  return out
}
async function main() {
  const tA = await login('tenant_org_test@audit.local', 'AuditTest@123')
  const tB = await login('credits_src_test@test.com', 'AuditTest@123')
  const callId = `dual-${Date.now().toString(36)}`
  const zhPcm = readFileSync('/tmp/interp-test-zh.pcm')
  const ruPcm = readFileSync('/tmp/interp-test-ru.pcm')
  const bGot: string[] = [], aGot: string[] = []
  const wsA = new WebSocket(`${WS}/api/im/rtc/translate?token=${tA}&callId=${callId}&srcLang=zh&tgtLang=en`)
  const wsB = new WebSocket(`${WS}/api/im/rtc/translate?token=${tB}&callId=${callId}&srcLang=ru&tgtLang=zh`)
  await Promise.all([new Promise<void>((r) => wsA.on('open', () => r())), new Promise<void>((r) => wsB.on('open', () => r()))])
  wsB.on('message', (d: Buffer) => { const m = JSON.parse(d.toString()); if (m.type === 'subtitle' && !m.error) bGot.push(m.text) })
  wsA.on('message', (d: Buffer) => { const m = JSON.parse(d.toString()); if (m.type === 'subtitle' && !m.error) aGot.push(m.text) })
  // A 说中文（200ms 帧流），同时 B 说俄语
  const zf = slicePcm(zhPcm, 200), rf = slicePcm(ruPcm, 200)
  const sendStream = async (ws: WebSocket, frames: Buffer[], total: number) => {
    for (let i = 0; i < Math.min(frames.length, total); i++) { ws.send(Buffer.concat([Buffer.from([1]), frames[i]])); await wait(60) }
    const rest = Buffer.concat(frames.slice(Math.min(frames.length, total)))
    ws.send(Buffer.concat([Buffer.from([2]), rest]))
  }
  const t0 = Date.now()
  await Promise.all([sendStream(wsA, zf, 12), sendStream(wsB, rf, 12)])
  await wait(14000)
  const bFinal = bGot[bGot.length - 1] || '', aFinal = aGot[aGot.length - 1] || ''
  console.log(`⏱ 总耗时 ${Date.now() - t0}ms（含模拟发送节奏 0.72s）`)
  console.log('B 收到（A 中文→英文）:', JSON.stringify(bFinal.slice(0, 80)))
  console.log('A 收到（B 俄语→中文）:', JSON.stringify(aFinal.slice(0, 80)))
  const bOk = /[a-zA-Z]{4,}/.test(bFinal)
  const aOk = /[\u4e00-\u9fa5]{4,}/.test(aFinal)
  console.log(bOk && aOk ? '✅ 双端并发双向翻译成功（中→英 + 俄→中）' : '❌ 有失败')
  wsA.close(); wsB.close(); process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
