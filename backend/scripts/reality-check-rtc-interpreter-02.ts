// reality-check-rtc-interpreter-02.ts — 昆仑茶馆 语音同传 阶段二验收（RTC-INTERPRETER-03）
// 链路：A(中文) PCM → WS → Vosk 流式 ASR → DeepSeek 翻译 → B 收英文字幕 + 英文语音(mp3)
//       对称：B(俄语) → A 收中文字幕 + 中文语音；双端并发双向
// 验证：audio 消息 base64 mp3 可解码（ffprobe 时长 > 0.3s）；无对端 → 字幕预览、无 audio
import WebSocket from 'ws'
import { readFileSync, writeFileSync } from 'node:fs'
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

function slicePcm(pcm: Buffer, frameMs: number): Buffer[] {
  const bytes = Math.floor((frameMs / 1000) * 16000 * 2)
  const frames: Buffer[] = []
  for (let i = 0; i < pcm.length; i += bytes) frames.push(pcm.subarray(i, i + bytes))
  return frames
}

// mp3 解码验证：ffprobe 时长（秒）；失败返回 -1
function mp3Duration(buf: Buffer): number {
  const f = `/tmp/interp-audio-check-${Date.now()}.mp3`
  writeFileSync(f, buf)
  try {
    const out = execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim()
    return parseFloat(out) || -1
  } catch { return -1 } finally {
    try { execFileSync('rm', ['-f', f]) } catch { /* noop */ }
  }
}

async function main() {
  console.log('═══ 语音同传 阶段二验收 ═══\n')
  const EMAIL_A = process.env.TEST_A_EMAIL || 'tenant_org_test@audit.local'
  const EMAIL_B = process.env.TEST_B_EMAIL || 'credits_src_test@test.com'
  const PWD = process.env.TEST_PWD || 'AuditTest@123'
  const tokenA = await login(EMAIL_A, PWD)
  const tokenB = await login(EMAIL_B, PWD)
  ok('准备 A/B 双账号登录', !!tokenA && !!tokenB)

  const callId = `itest3-${Date.now().toString(36)}`
  const pcm = readFileSync('/tmp/interp-test-zh.pcm')
  ok(`准备 中文测试语音 PCM (${(pcm.length / 32000).toFixed(1)}s)`, pcm.length > 32000)

  const got: { partial: string[]; finals: string[]; audios: { text: string; dur: number; done: boolean; sentenceId: string }[]; errors: string[] } = { partial: [], finals: [], audios: [], errors: [] }
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
    } else if (msg.type === 'audio') {
      const buf = Buffer.from(msg.audio, 'base64')
      got.audios.push({ text: msg.text, dur: mp3Duration(buf), done: msg.done, sentenceId: msg.sentenceId })
    }
  })
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // ── G2-G4 安全（无效 token / 非法 callId / 不支持语言）──
  const badWs = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=***&callId=${callId}&srcLang=zh&tgtLang=en`)
  const badClosed = await new Promise<number>((r) => { badWs.on('close', (code: number) => r(code)); badWs.on('error', () => {}) })
  ok('G2 无效 token 被拒 (close≠1000)', badClosed !== 1000, `code=${badClosed}`)

  const badWs2 = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenA}&callId=../etc&srcLang=zh&tgtLang=en`)
  const badClosed2 = await new Promise<number>((r) => { badWs2.on('close', (code: number) => r(code)); badWs2.on('error', () => {}) })
  ok('G3 非法 callId 被拒', badClosed2 !== 1000, `code=${badClosed2}`)

  const badWs3 = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenA}&callId=${callId}&srcLang=xx&tgtLang=en`)
  const badClosed3 = await new Promise<number>((r) => { badWs3.on('close', (code: number) => r(code)); badWs3.on('error', () => {}) })
  ok('G4 不支持语言被拒', badClosed3 !== 1000, `code=${badClosed3}`)

  // ── G5 A 讲话（中文）：B 收 partial 字幕 ──
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
  await partialPromise
  ok('G5 边说边出：B 收到 partial 字幕', got.partial.length > 0, `首条 partial ${(firstPartialAt / 1000).toFixed(2)}s: "${got.partial[0]?.slice(0, 40)}"`)

  // final：剩余全部帧 → 整句定稿 → 英文字幕 + 英文语音
  const rest = Buffer.concat(frames.slice(Math.min(frames.length - 1, 12)))
  wsA.send(Buffer.concat([Buffer.from([2]), rest]))
  await wait(15000)
  const finalText = got.finals[got.finals.length - 1] || ''
  ok('G6 final 英文字幕', /[a-zA-Z]{4,}/.test(finalText), `: "${finalText.slice(0, 60)}"`)

  // ── G7 语音：B 收到英文 mp3 音频 ──
  const enAudio = got.audios.filter((a) => a.dur > 0.3)
  ok('G7 B 收到英文语音 (mp3 可解码)', enAudio.length > 0, `段数=${enAudio.length}, 首段时长=${enAudio[0]?.dur?.toFixed(2)}s, 文本="${enAudio[0]?.text?.slice(0, 40)}"`)
  ok('G7b 语音分句完整 (done 标志存在)', got.audios.some((a) => a.done === true))
  ok('G8 无错误字幕', got.errors.length === 0)

  // ── G9 双端并发：A 讲中文同时 B 讲俄语 → A 收中文字幕 + 中文语音 ──
  const aGot: { finals: string[]; audios: { dur: number }[] } = { finals: [], audios: [] }
  wsA.on('message', (data: Buffer) => {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'subtitle' && !msg.partial && !msg.error) aGot.finals.push(msg.text)
    else if (msg.type === 'audio') aGot.audios.push({ dur: mp3Duration(Buffer.from(msg.audio, 'base64')) })
  })
  const ruPcm = readFileSync('/tmp/interp-test-ru.pcm')
  ok(`准备 俄语测试语音 PCM (${(ruPcm.length / 32000).toFixed(1)}s)`, ruPcm.length > 32000)
  const rf = slicePcm(ruPcm, 200)
  for (let i = 0; i < Math.min(rf.length, 12); i++) {
    wsB.send(Buffer.concat([Buffer.from([1]), rf[i]]))
    await wait(50)
  }
  wsB.send(Buffer.concat([Buffer.from([2]), Buffer.concat(rf.slice(Math.min(rf.length, 12)))]))
  await wait(15000)
  const zhFinal = aGot.finals[aGot.finals.length - 1] || ''
  ok('G9 B 讲俄语 → A 收中文字幕', /[\u4e00-\u9fa5]{4,}/.test(zhFinal), `: "${zhFinal.slice(0, 60)}"`)
  ok('G9b B 讲俄语 → A 收中文语音', aGot.audios.some((a) => a.dur > 0.3), `段数=${aGot.audios.length}`)

  // ── G10 对端不在线：字幕预览 + 无语音 ──
  const callId2 = `itest3b-${Date.now().toString(36)}`
  const wsA2 = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenA}&callId=${callId2}&srcLang=zh&tgtLang=en`)
  await waitOpen(wsA2)
  const a2Got: { subs: string[]; audios: number } = { subs: [], audios: 0 }
  wsA2.on('message', (data: Buffer) => {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'subtitle') a2Got.subs.push(msg.text)
    else if (msg.type === 'audio') a2Got.audios++
  })
  wsA2.send(Buffer.concat([Buffer.from([2]), pcm]))
  await wait(15000)
  ok('G10 对端未开同传 → 字幕预览、无语音', a2Got.subs.length > 0 && a2Got.audios === 0, `字幕=${a2Got.subs.length} 语音=${a2Got.audios}`)

  // ── 清理 ──
  wsA.close(); wsB.close(); wsA2.close()
  await wait(500)
  console.log(`\n═══ 结果: ${PASS.total - PASS.fail} PASS / ${PASS.fail} FAIL ═══`)
  process.exit(PASS.fail ? 1 : 0)
}

main().catch((e) => { console.error('脚本异常:', e); process.exit(1) })
