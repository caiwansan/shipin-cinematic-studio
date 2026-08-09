// reality-check-rtc-interpreter-01.ts — 昆仑茶馆 同声传译网关 阶段一验收
// 链路：A(中文) 音频 PCM → WS 网关 → ASR → DeepSeek 翻译 → 字幕推 B(英文)
// 用 edge-tts 预生成中文语音 PCM 模拟 A 讲话；双 WS 客户端模拟 A/B 通话
import WebSocket from 'ws'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const BASE = process.env.API_BASE || 'http://127.0.0.1:4002'
const WS_BASE = BASE.replace(/^http/, 'ws')
const PASS = { total: 0, fail: 0 }
function ok(name: string, cond: boolean, extra = '') {
  PASS.total++
  if (cond) console.log(`  ✅ ${name}${extra ? ' ' + extra : ''}`)
  else { PASS.fail++; console.log(`  ❌ ${name}${extra ? ' ' + extra : ''}`) }
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json: any = await res.json()
  const token = json?.data?.token || json?.token || json?.data?.accessToken || json?.accessToken
  if (!token) throw new Error(`login ${email} failed: ${JSON.stringify(json).slice(0, 200)}`)
  return token
}

// PCM 切帧：每段 frameMs 毫秒（增量）
function slicePcm(pcm: Buffer, frameMs: number): Buffer[] {
  const bytes = Math.floor((frameMs / 1000) * 16000 * 2)
  const frames: Buffer[] = []
  for (let i = 0; i < pcm.length; i += bytes) frames.push(pcm.subarray(i, i + bytes))
  return frames
}

async function main() {
  console.log('═══ 同声传译网关 阶段一验收 ═══\n')
  const EMAIL_A = process.env.TEST_A_EMAIL || 'tenant_org_test@audit.local'
  const EMAIL_B = process.env.TEST_B_EMAIL || 'credits_src_test@test.com'
  const PWD = process.env.TEST_PWD || 'AuditTest@123'
  const tokenA = await login(EMAIL_A, PWD)
  const tokenB = await login(EMAIL_B, PWD)
  ok('准备 A/B 双账号登录', !!tokenA && !!tokenB)

  const callId = `itest-${Date.now().toString(36)}`
  const pcm = readFileSync('/tmp/interp-test-zh.pcm')
  ok(`准备 中文测试语音 PCM (${(pcm.length / 32000).toFixed(1)}s)`, pcm.length > 32000)

  // ── 连 A（说中文 → 听英文）与 B（说俄语 → 听中文）──
  const got: { partial: string[]; finals: string[]; errors: string[]; previews: string[] } = { partial: [], finals: [], errors: [], previews: [] }
  const wsA = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenA}&callId=${callId}&srcLang=zh&tgtLang=en`)
  const wsB = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenB}&callId=${callId}&srcLang=ru&tgtLang=zh`)
  const waitOpen = (ws: WebSocket) => new Promise<void>((r) => ws.on('open', () => r()))
  await Promise.all([waitOpen(wsA), waitOpen(wsB)])
  ok('G1 A/B WS 连接成功', wsA.readyState === 1 && wsB.readyState === 1)

  wsB.on('message', (data: Buffer) => {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'subtitle') {
      if (msg.partial) got.partial.push(msg.text)
      else if (msg.error) got.errors.push(msg.error)
      else got.finals.push(msg.text)
      if (msg.preview) got.previews.push(msg.text)
    }
  })
  wsA.on('message', (data: Buffer) => {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'subtitle' && msg.preview) got.previews.push(msg.text)
  })
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // ── G2 未授权 ──
  const badWs = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=bad.token.xxx&callId=${callId}&srcLang=zh&tgtLang=en`)
  const badClosed = await new Promise<number>((r) => { badWs.on('close', (code: number) => r(code)); badWs.on('error', () => {}) })
  ok('G2 无效 token 被拒 (close≠1000)', badClosed !== 1000, `code=${badClosed}`)

  // ── G3 非法 callId ──
  const badWs2 = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenA}&callId=../etc&srcLang=zh&tgtLang=en`)
  const badClosed2 = await new Promise<number>((r) => { badWs2.on('close', (code: number) => r(code)); badWs2.on('error', () => {}) })
  ok('G3 非法 callId 被拒', badClosed2 !== 1000, `code=${badClosed2}`)

  // ── G4 不支持语言 ──
  const badWs3 = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenA}&callId=${callId}&srcLang=xx&tgtLang=en`)
  const badClosed3 = await new Promise<number>((r) => { badWs3.on('close', (code: number) => r(code)); badWs3.on('error', () => {}) })
  ok('G4 不支持语言被拒', badClosed3 !== 1000, `code=${badClosed3}`)

  // ── G5 A 讲话：partial 增量 + final 完整句 → B 收英文字幕 ──
  // 流式节奏：200ms 增量帧（与前端一致），首条 partial 应 <2.5s（Vosk 毫秒级识别 + 增量翻译）
  const frames = slicePcm(pcm, 200)
  const t0 = Date.now()
  let firstPartialAt = 0
  const partialPromise = new Promise<void>((r) => {
    const iv = setInterval(() => { if (got.partial.length > 0) { firstPartialAt = Date.now() - t0; clearInterval(iv); r() } }, 50)
    setTimeout(() => { clearInterval(iv); r() }, 15000)
  })
  for (let i = 0; i < Math.min(frames.length - 1, 12); i++) {
    wsA.send(Buffer.concat([Buffer.from([1]), frames[i]]))
    await wait(60)
  }
  const partialStarted = await partialPromise
  ok('G5 边说边出：B 收到 partial 字幕', got.partial.length > 0, `首条 partial 延迟 ${(firstPartialAt / 1000).toFixed(2)}s: "${got.partial[0]?.slice(0, 40)}"`)
  ok('G5b 首条 partial 延迟 < 2.5s（毫秒级跟读）', firstPartialAt > 0 && firstPartialAt < 2500, `实测 ${firstPartialAt}ms`)

  // final：剩余全部帧合成最后一段增量
  const rest = Buffer.concat(frames.slice(Math.min(frames.length - 1, 12)))
  wsA.send(Buffer.concat([Buffer.from([2]), rest]))
  await wait(10000)
  const finalText = got.finals[got.finals.length - 1] || '' // 字幕定格态 = 最新 final
  ok('G6 说完出 final 字幕', got.finals.length > 0, `: "${finalText.slice(0, 60)}"`)
  ok('G7 final 为英文译文', /[a-zA-Z]{4,}/.test(finalText), `长度=${finalText.length}`)
  ok('G8 译文含语义关键词 (tea/weather/hello 之一)', /(tea|weather|hello|drink|today)/i.test(finalText), finalText.slice(0, 60))
  ok('G9 无错误字幕', got.errors.length === 0)

  // ── G10 对端不在线 → 预览回显 ──
  // 单开一条 A2（新 callId 无对端），发 final，应收到 preview 字幕回显
  const callId2 = `itest2-${Date.now().toString(36)}`
  const wsA2 = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenA}&callId=${callId2}&srcLang=zh&tgtLang=en`)
  await waitOpen(wsA2)
  const a2Got: string[] = []
  wsA2.on('message', (data: Buffer) => { const m = JSON.parse(data.toString()); if (m.type === 'subtitle') a2Got.push(m.text) })
  wsA2.send(Buffer.concat([Buffer.from([2]), pcm]))
  await wait(12000)
  ok('G10 对端未开同传 → 译文回显预览', a2Got.some((t) => t.length > 4), `: "${a2Got[a2Got.length - 1]?.slice(0, 50)}"`)

  // ── 清理 ──
  wsA.close(); wsB.close(); wsA2.close()
  await wait(500)
  console.log(`\n═══ 结果: ${PASS.total - PASS.fail} PASS / ${PASS.fail} FAIL ═══`)
  process.exit(PASS.fail ? 1 : 0)
}

main().catch((e) => { console.error('脚本异常:', e); process.exit(1) })
