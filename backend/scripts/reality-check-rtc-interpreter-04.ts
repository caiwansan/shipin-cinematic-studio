// reality-check-rtc-interpreter-04.ts — 实时同声传译 世界语言池 100+ 语种验收（RTC-INTERPRETER-04，掌柜指令「达到100种语言，包括粤语和闽南语」）
// 验证链：101 语种目录（含粤语 yue/闽南语 nan）→ ASR 双引擎路由 → Whisper worker 粤语真声转写（单元）
//        → 网关 WS 粤语全链路（A 说粤语 B 收中文+语音 / B 说中文 A 收粤语+粤语真声）→ 闽南语放行 + 无音色降级仅字幕
import WebSocket from 'ws'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { INTERP_LANGS, SUPPORTED_LANGS, LANG_NAMES, asrEngineFor, ttsVoiceFor, whisperCodeFor, interpLangStats } from '../src/services/interp-langs.js'

const BASE = process.env.API_BASE || 'http://127.0.0.1:4002'
const WS_BASE = BASE.replace(/^http/, 'ws')
const PASS = { total: 0, fail: 0 }
function ok(name: string, cond: boolean, extra = '') {
  PASS.total++
  if (cond) console.log(`  ✅ ${name}${extra ? ' ' + extra : ''}`)
  else { PASS.fail++; console.log(`  ❌ ${name}${extra ? ' ' + extra : ''}`) }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

/** edge-tts 合成语音 → 16k mono s16le PCM 文件 */
function synthPcm(voice: string, text: string, outPcm: string): boolean {
  const mp3 = `/tmp/synth-${Date.now()}.mp3`
  try {
    execFileSync('edge-tts', ['--voice', voice, '--text', text, '--write-media', mp3], { timeout: 30_000 })
    execFileSync('ffmpeg', ['-y', '-i', mp3, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-f', 's16le', outPcm], { timeout: 30_000 })
    return true
  } catch (e: any) {
    console.warn('  ⚠️ synthPcm failed:', e?.message?.slice(0, 120))
    return false
  } finally {
    try { execFileSync('rm', ['-f', mp3]) } catch { /* noop */ }
  }
}

// ── 单元：直接驱动 whisper_stream_worker.py ──
interface WorkerResult { ready: boolean; partials: string[]; finals: string[]; errors: string[] }
function runWhisperWorker(session: string, lang: string, pcm: Buffer): Promise<WorkerResult> {
  return new Promise((resolvePromise) => {
    const proc: ChildProcess = spawn('python3', ['-u', 'scripts/whisper_stream_worker.py'], {
      env: { ...process.env, HF_ENDPOINT: process.env.HF_ENDPOINT || 'https://hf-mirror.com' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const res: WorkerResult = { ready: false, partials: [], finals: [], errors: [] }
    const rl = createInterface({ input: proc.stdout! })
    rl.on('line', (line) => {
      let m: any
      try { m = JSON.parse(line) } catch { return }
      if (m.session !== session) return
      if (m.type === 'ready') res.ready = true
      else if (m.type === 'partial') res.partials.push(m.text)
      else if (m.type === 'final') res.finals.push(m.text)
      else if (m.type === 'error') res.errors.push(m.text)
    })
    let stderrBuf = ''
    proc.stderr?.on('data', (c: Buffer) => { stderrBuf += c.toString() })
    const send = (o: any) => proc.stdin!.write(JSON.stringify(o) + '\n')
    send({ type: 'init', session, lang })
    // 按 200ms 帧喂（模拟流式）
    const frames = slicePcm(pcm, 200)
    let i = 0
    const iv = setInterval(() => {
      if (i < frames.length) { send({ type: 'audio', session, lang, data: frames[i].toString('base64') }); i++ }
      else {
        clearInterval(iv)
        send({ type: 'final', session, lang })
      }
    }, 80)
    // 长尾转写在负载高时可达 1-2 分钟：等到 final/error 或 300s 超时
    const t0 = Date.now()
    const check = setInterval(() => {
      const done = res.finals.length > 0 || res.errors.length > 0
      if (done || Date.now() - t0 > 300_000) {
        clearInterval(check)
        try { proc.kill() } catch { /* noop */ }
        if (!done && !res.ready) console.warn(`  ⚠️ worker ${session}: 超时未出 final (stderr: ${stderrBuf.slice(-200)})`)
        resolvePromise(res)
      }
    }, 2000)
    setTimeout(() => { clearInterval(iv); clearInterval(check); try { proc.kill() } catch { /* noop */ } resolvePromise(res) }, 320_000)
  })
}

async function main() {
  console.log('═══ 同声传译 世界语言池 100+ 语种验收（RTC-INTERPRETER-04）═══\n')

  // ── G1 语言池：≥100 语种，含粤语/闽南语，引擎路由正确 ──
  const stats = interpLangStats()
  ok('G1 语言池 ≥100 语种', stats.total >= 100, `共 ${stats.total}（vosk ${stats.vosk} 流式 + whisper ${stats.whisper} 长尾）`)
  ok('G1b 含粤语 yue + 闽南语 nan', SUPPORTED_LANGS.has('yue') && SUPPORTED_LANGS.has('nan'),
    `粤语=${LANG_NAMES['yue']} 闽南语=${LANG_NAMES['nan']}`)
  ok('G1c 引擎路由：zh→vosk / yue→whisper / nan→whisper',
    asrEngineFor('zh') === 'vosk' && asrEngineFor('yue') === 'whisper' && asrEngineFor('nan') === 'whisper')
  const voskCount = INTERP_LANGS.filter((l) => l.engine === 'vosk').length
  const whisperCount = INTERP_LANGS.filter((l) => l.engine === 'whisper').length
  ok('G1d 引擎分布：18 常用 Vosk + 83 长尾 Whisper', voskCount === 18 && whisperCount === 83, `${voskCount}/${whisperCount}`)
  const dup = INTERP_LANGS.length !== new Set(INTERP_LANGS.map((l) => l.code)).size
  ok('G1e 无重复语言码', !dup)

  // ── G2 TTS 音色：粤语有真声、闽南语无音色（降级仅字幕）──
  ok('G2 粤语 TTS = zh-HK 粤语真声', ttsVoiceFor('yue') === 'zh-HK-HiuMaanNeural', ttsVoiceFor('yue') || '')
  ok('G2b 闽南语无 TTS 音色 → 降级仅字幕', ttsVoiceFor('nan') === undefined)
  ok('G2c 有音色语种 ≥70', stats.voiced >= 70, `共 ${stats.voiced} 语种有音色 / ${stats.subtitleOnly} 仅字幕`)
  const allVoicesValid = INTERP_LANGS.every((l) => !l.voice || /^[a-z]{2,3}-[A-Z]{2,3}-[A-Za-z]+Neural$/.test(l.voice))
  ok('G2d 音色命名合法', allVoicesValid)
  ok('G2e 闽南语 whisper 兜底 = zh', whisperCodeFor('nan') === 'zh' && whisperCodeFor('yue') === 'yue')

  // ── G3 Whisper worker 单元：粤语真声转写（edge-tts 粤语合成 → whisper yue）──
  const yuePcm = '/tmp/interp-test-yue.pcm'
  const synthOk = synthPcm('zh-HK-HiuMaanNeural', '你好，我係廣州人，今日天氣好好，我哋一齊去飲茶啦。', yuePcm)
  ok('G3 准备粤语真声 PCM', synthOk, yuePcm)
  let wres: WorkerResult = { ready: false, partials: [], finals: [], errors: [] }
  if (synthOk) {
    const pcm = readFileSync(yuePcm)
    ok(`G3b 粤语 PCM 有效 (${(pcm.length / 32000).toFixed(1)}s)`, pcm.length > 32000)
    wres = await runWhisperWorker('utest-yue', 'yue', pcm)
    ok('G3c whisper(yue) ready + 无错误', wres.ready && wres.errors.length === 0, wres.errors[0] || '')
    const wText = (wres.finals[wres.finals.length - 1] || wres.partials[wres.partials.length - 1] || '')
    ok('G3d whisper(yue) 转写产出文本（small 模型方言 best-effort）', wText.trim().length > 0,
      `final="${wText.slice(0, 40)}" partials=${wres.partials.length}`)
  } else {
    ok('G3c whisper(yue) ready', false, '跳过（合成失败）')
    ok('G3d whisper(yue) 转写产出', false, '跳过')
  }

  // ── G4 Whisper worker 单元：闽南语 nan → zh 兜底（不崩、协议完整）──
  const nanPcm = '/tmp/interp-test-nan.pcm'
  if (synthOk) {
    // 无闽南语 TTS，用粤语音频验证 nan 路由健壮性（zh 模型 best-effort 转写，重点是协议不崩）
    const wresNan = await runWhisperWorker('utest-nan', 'nan', readFileSync(yuePcm))
    ok('G4 闽南语 nan 会话：ready + 无错误（zh 兜底）', wresNan.ready && wresNan.errors.length === 0, wresNan.errors[0] || '')
  } else {
    ok('G4 闽南语 nan 会话', false, '跳过（合成失败）')
  }

  // ── G5 网关 WS 全链路：粤语说话人 → 对方收中文字幕 + 中文语音；中文说话人 → 粤语字幕 + 粤语真声 ──
  const EMAIL_A = process.env.TEST_A_EMAIL || 'tenant_org_test@audit.local'
  const EMAIL_B = process.env.TEST_B_EMAIL || 'credits_src_test@test.com'
  const PWD = process.env.TEST_PWD || 'AuditTest@123'
  const tokenA = await login(EMAIL_A, PWD)
  const tokenB = await login(EMAIL_B, PWD)
  ok('G5 准备 A/B 双账号', !!tokenA && !!tokenB)

  const callId = `i100-${Date.now().toString(36)}`
  const wsA = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenA}&callId=${callId}&srcLang=yue&tgtLang=zh`)
  const wsB = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenB}&callId=${callId}&srcLang=zh&tgtLang=yue`)
  const waitOpen = (ws: WebSocket) => new Promise<void>((r, j) => { ws.on('open', () => r()); ws.on('error', (e: any) => j(e)) })
  await Promise.all([waitOpen(wsA), waitOpen(wsB)])
  ok('G5b A(说粤语)/B(说中文) WS 连接成功', wsA.readyState === 1 && wsB.readyState === 1)

  const bGot: { partials: string[]; finals: string[]; audios: { text: string; dur: number }[]; errors: string[] } = { partials: [], finals: [], audios: [], errors: [] }
  wsB.on('message', (data: Buffer) => {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'subtitle') {
      if (msg.partial) bGot.partials.push(msg.text)
      else if (msg.error) bGot.errors.push(msg.error)
      else bGot.finals.push(msg.text)
    } else if (msg.type === 'audio') bGot.audios.push({ text: msg.text, dur: mp3Duration(Buffer.from(msg.audio, 'base64')) })
  })
  const aGot: { finals: string[]; audios: { dur: number }[] } = { finals: [], audios: [] }
  wsA.on('message', (data: Buffer) => {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'subtitle' && !msg.partial && !msg.error) aGot.finals.push(msg.text)
    else if (msg.type === 'audio') aGot.audios.push({ dur: mp3Duration(Buffer.from(msg.audio, 'base64')) })
  })
  // 长尾转写等待可达 2-4 分钟 → 30s 心跳保活（防 90s 会话 TTL 误杀；真实通话中帧流不断不触发）
  const ka = setInterval(() => {
    try { wsA.send('ping') } catch { /* noop */ }
    try { wsB.send('ping') } catch { /* noop */ }
  }, 30_000)

  if (synthOk) {
    const pcm = readFileSync(yuePcm)
    const frames = slicePcm(pcm, 200)
    for (let i = 0; i < Math.min(frames.length, 14); i++) { wsA.send(Buffer.concat([Buffer.from([1]), frames[i]])); await wait(80) }
    wsA.send(Buffer.concat([Buffer.from([2]), Buffer.concat(frames.slice(Math.min(frames.length, 14)))]))
    // 长尾 whisper 转写在负载高时 1-2 分钟 → 宽等待
    await wait(220_000)
    const zhFinal = bGot.finals[bGot.finals.length - 1] || ''
    ok('G5c A 说粤语 → B 收中文字幕', /[\u4e00-\u9fa5]{4,}/.test(zhFinal), `: "${zhFinal.slice(0, 50)}"`)
    ok('G5d A 说粤语 → B 收中文语音', bGot.audios.some((a) => a.dur > 0.3), `段数=${bGot.audios.length}`)

    // B 说中文 → A 收粤语字幕 + 粤语真声（zh-HK 音色）
    const zhPcm = readFileSync('/tmp/interp-test-zh.pcm')
    const zf = slicePcm(zhPcm, 200)
    for (let i = 0; i < Math.min(zf.length, 14); i++) { wsB.send(Buffer.concat([Buffer.from([1]), zf[i]])); await wait(60) }
    wsB.send(Buffer.concat([Buffer.from([2]), Buffer.concat(zf.slice(Math.min(zf.length, 14)))]))
    await wait(25_000)
    const yueFinal = aGot.finals[aGot.finals.length - 1] || ''
    ok('G5e B 说中文 → A 收粤语字幕', /[\u4e00-\u9fa5]{4,}/.test(yueFinal), `: "${yueFinal.slice(0, 50)}"`)
    ok('G5f B 说中文 → A 收粤语真声语音', aGot.audios.some((a) => a.dur > 0.3), `段数=${aGot.audios.length}`)
  } else {
    ok('G5c-g 网关粤语全链路', false, '跳过（粤语合成失败）')
  }
  clearInterval(ka)
  wsA.close(); wsB.close()
  await wait(800)

  // ── G6 网关放行：101 语种全部接受 + 非法码 4400 ──
  const results: { code: string; ok: boolean; closeCode: number }[] = []
  const accepted = await Promise.all([...SUPPORTED_LANGS].map(async (code) => {
    const cid = `l100-${code}-${Date.now().toString(36)}`
    return new Promise<{ code: string; ok: boolean; closeCode: number }>((r) => {
      const ws = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenA}&callId=${cid}&srcLang=${code}&tgtLang=en`)
      let gotReady = false
      const done = (closeCode: number) => r({ code, ok: gotReady, closeCode })
      ws.on('message', (d: Buffer) => {
        const m = JSON.parse(d.toString())
        if (m.type === 'ready') { gotReady = true; try { ws.close(1000, 'done') } catch { /* noop */ } }
      })
      ws.on('close', (c: number) => done(c))
      ws.on('error', () => {})
      setTimeout(() => { try { ws.close(1000, 'timeout') } catch { /* noop */ } }, 10_000)
    })
  }))
  const rejected = accepted.filter((a) => !a.ok)
  ok('G6 全部 101 语种网关放行', rejected.length === 0, rejected.length ? `拒绝 ${rejected.map((r) => r.code).join(',')}` : `101/101 ready`)
  const badWs = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenA}&callId=l100-bad-${Date.now()}&srcLang=xx&tgtLang=en`)
  const badClosed = await new Promise<number>((r) => { badWs.on('close', (c: number) => r(c)); badWs.on('error', () => {}) })
  ok('G6b 非法语言码仍被拒 (4400)', badClosed === 4400, `code=${badClosed}`)

  // ── G7 闽南语目标端：无音色 → 字幕照常 + 零语音（降级仅字幕）──
  const callId2 = `i100b-${Date.now().toString(36)}`
  const wsA2 = new WebSocket(`${WS_BASE}/api/im/rtc/translate?token=${tokenA}&callId=${callId2}&srcLang=zh&tgtLang=nan`)
  await waitOpen(wsA2)
  const a2Got: { finals: string[]; audios: number } = { finals: [], audios: 0 }
  wsA2.on('message', (data: Buffer) => {
    const msg = JSON.parse(data.toString())
    if (msg.type === 'subtitle' && !msg.partial && !msg.error) a2Got.finals.push(msg.text)
    else if (msg.type === 'audio') a2Got.audios++
  })
  wsA2.send(Buffer.concat([Buffer.from([2]), readFileSync('/tmp/interp-test-zh.pcm')]))
  await wait(25_000)
  ok('G7 目标=闽南语：字幕照常', a2Got.finals.length > 0, `: "${(a2Got.finals[a2Got.finals.length - 1] || '').slice(0, 40)}"`)
  ok('G7b 目标=闽南语：无语音（自动降级仅字幕）', a2Got.audios === 0, `语音=${a2Got.audios}`)
  wsA2.close()

  await wait(500)
  console.log(`\n═══ 结果: ${PASS.total - PASS.fail} PASS / ${PASS.fail} FAIL ═══`)
  process.exit(PASS.fail ? 1 : 0)
}

main().catch((e) => { console.error('脚本异常:', e); process.exit(1) })
