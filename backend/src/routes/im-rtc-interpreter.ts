// im-rtc-interpreter.ts — 昆仑茶馆 实时同声传译网关（流式 ASR 版，RTC-INTERPRETER-02）
// 链路：客户端(A) mic → WS 二进制 PCM 帧 → Vosk 流式 ASR（增量识别，毫秒级）→ 增量翻译(DeepSeek SSE) → 字幕推对端(B)
// 对称设计：A 的 WS 上行 A 的音频(zh→en)，下行收 B 的译文(ru→zh)；B 端完全对称
// 会话维度 = 现有 RTC callId：同 callId 两个 uid 各一条 WS，翻译结果投递给对端 WS
// 合规：显式授权开启（前端开关）；音频不落盘（内存帧直接喂流式识别器）；字幕仅通话内存内流转
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { voskStream } from '../services/vosk-stream.service.js'
import { whisperStream } from '../services/whisper-stream.service.js'
import { synthesizeSegments } from '../services/tts.service.js'
import { SUPPORTED_LANGS, LANG_NAMES, asrEngineFor } from '../services/interp-langs.js'

// ── 常量 ──
// 世界语言池 101 语种（掌柜指令：达到100种语言，含粤语/闽南语）：
//   ASR = Vosk 流式(18 常用,毫秒级) + Whisper(83 长尾,含方言)；TTS = edge-tts(74 语种有音色,其余仅字幕)；翻译 = DeepSeek 全语种
const CALLID_RE = /^[A-Za-z0-9-]{8,64}$/
// 会话 90s 无任何帧自动清理（防泄漏）
const SESSION_TTL_MS = 90_000
const MAX_SESSIONS = 300

const KIND_PARTIAL = 1 // 帧首字节：partial 增量（边说边出）
const KIND_FINAL = 2 // 帧首字节：final 完整句（句结束定格）

// ── 会话表：callId → (uid → session) ──
interface InterpSession {
  ws: any
  uid: string
  srcLang: string
  tgtLang: string
  lastFrameAt: number
  ttlTimer: ReturnType<typeof setTimeout> | null
  // 增量翻译状态（Vosk partial 是累积文本，只翻译新词）
  srcTokens: string[] // 已翻译的原文 token
  translatedFull: string // 当前展示的完整译文
  pending: { full: string; inc?: string; base?: string; isFinal: boolean } | null // 等待翻译的最新任务
  translating: boolean // 翻译任务在跑
}
const sessionsByCall = new Map<string, Map<string, InterpSession>>()
let sessionCount = 0

function sessionKey(callId: string, uid: string) {
  return `${callId}:${uid}`
}

// ── 流式翻译（DeepSeek SSE；产出增量 token）──
async function* translateStream(text: string, srcLang: string, tgtLang: string): AsyncGenerator<string> {
  if (!text) return
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '')
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.deepseek_api_key || process.env.DEEPSEEK_DEV_API_KEY
  const model = process.env.DEEPSEEK_LLM_MODEL || 'deepseek-v4-flash'
  if (!apiKey) throw new Error('LLM API Key 未配置')
  const prompt =
    `你是专业的实时同声传译引擎。把下面这段${LANG_NAMES[srcLang] || srcLang}口语翻译成${LANG_NAMES[tgtLang] || tgtLang}。` +
    `规则：只输出译文本身，不要任何解释/引号/前后缀；说话人的话可能是残句或连续语音的增量片段，按最自然的语义直接翻译；保持口语化、简洁。`
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.3,
      max_tokens: 512,
      thinking: { type: 'disabled' }, // v4-flash 默认带推理，翻译场景关闭以毫秒级出字
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text },
      ],
    }),
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`翻译 API ${resp.status}: ${body.slice(0, 160)}`)
  }
  if (!resp.body) return
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') return
        try {
          const json = JSON.parse(payload)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch { /* 忽略坏帧 */ }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ── 字幕投递：推对端 WS；对端未开同传 → 推回自己（本地预览）──
function deliverSubtitle(callId: string, fromUid: string, msg: Record<string, unknown>) {
  const call = sessionsByCall.get(callId)
  if (!call) return
  const peerEntry = [...call.entries()].find(([uid]) => uid !== fromUid)
  const target = peerEntry ? peerEntry[1] : call.get(fromUid)
  if (!target) return
  try {
    target.ws.send(JSON.stringify({ type: 'subtitle', ...msg, preview: !peerEntry }))
  } catch { /* 对端 ws 已死，忽略 */ }
}

// ── 语音投递：final 译文 → 分句 TTS → audio 消息推对端（对端未开同传则不推）──
// 每段携带 sentenceId（前端打断式播放依据）；失败降级仅字幕
let sentenceSeq = 0
async function deliverAudio(callId: string, fromUid: string, session: InterpSession, text: string) {
  const sid = `s${++sentenceSeq}`
  try {
    const segs = await synthesizeSegments(text, session.tgtLang)
    if (!segs.length) return
    const call = sessionsByCall.get(callId)
    if (!call) return
    const peerEntry = [...call.entries()].find(([uid]) => uid !== fromUid)
    if (!peerEntry) return // 对端未开同传：不推语音（字幕预览照旧）
    const peer = peerEntry[1]
    for (let i = 0; i < segs.length; i++) {
      try {
        peer.ws.send(JSON.stringify({
          type: 'audio',
          sentenceId: sid,
          seq: i,
          total: segs.length,
          text: segs[i].text,
          audio: segs[i].audioB64,
          mime: 'audio/mpeg',
          tgtLang: session.tgtLang,
          ts: Date.now(),
          done: i === segs.length - 1,
        }))
      } catch { return }
    }
  } catch (e: any) {
    console.warn(`[interp] tts failed (降级仅字幕): ${e?.message}`)
  }
}

// ── 翻译循环（latest-wins：只译最新任务，旧任务被覆盖）──
async function translateLoop(callId: string, session: InterpSession) {
  if (session.translating) return
  session.translating = true
  try {
    while (session.pending) {
      const task = session.pending
      session.pending = null
      const { full, base, isFinal } = task
      const text = full
      try {
        let translated = base || ''
        let lastPushAt = 0
        let gotAny = false
        for await (const token of translateStream(text, session.srcLang, session.tgtLang)) {
          gotAny = true
          translated += token
          const now = Date.now()
          if (now - lastPushAt >= 80) {
            lastPushAt = now
            deliverSubtitle(callId, session.uid, {
              partial: !isFinal,
              text: translated,
              srcLang: session.srcLang,
              tgtLang: session.tgtLang,
              ts: now,
            })
          }
        }
        if (!gotAny && !translated) continue
        session.translatedFull = translated
        deliverSubtitle(callId, session.uid, {
          partial: false,
          text: translated,
          srcLang: session.srcLang,
          tgtLang: session.tgtLang,
          ts: Date.now(),
        })
        // 语音同传：final 译文异步合成为对端语言语音（不阻塞字幕循环）
        if (isFinal && translated.trim().length > 0) {
          deliverAudio(callId, session.uid, session, translated)
        }
      } catch (e: any) {
        console.warn('[interp] translate failed:', e?.message)
        deliverSubtitle(callId, session.uid, {
          partial: false,
          text: session.translatedFull,
          error: e?.message || '翻译失败',
          srcLang: session.srcLang,
          tgtLang: session.tgtLang,
          ts: Date.now(),
        })
      }
    }
  } finally {
    session.translating = false
    if (session.pending) translateLoop(callId, session) // 竞态兜底
  }
}

/** Vosk partial 累积文本 → 增量翻译任务（只译新词） */
function onVoskPartial(callId: string, session: InterpSession, voskText: string) {
  const tokens = voskText.split(/\s+/).filter(Boolean)
  if (!tokens.length) return
  const prev = session.srcTokens
  let common = 0
  while (common < prev.length && common < tokens.length && prev[common] === tokens[common]) common++
  if (common < prev.length) {
    // Vosk 修正了已译前缀 → 全文重译（覆盖式字幕，罕见）
    session.srcTokens = tokens
    session.translatedFull = ''
    session.pending = { full: voskText, isFinal: false }
  } else {
    const incTokens = tokens.slice(common)
    if (!incTokens.length) return // 无新词，忽略
    session.srcTokens = tokens
    const sep = session.tgtLang === 'zh' ? '' : ' '
    const base = session.translatedFull ? session.translatedFull + sep : ''
    session.pending = { full: incTokens.join(' '), base, isFinal: false }
  }
  translateLoop(callId, session)
}

/** Vosk final 整句 → 全文精译覆盖（定格字幕） */
function onVoskFinal(callId: string, session: InterpSession, voskText: string) {
  const tokens = voskText.split(/\s+/).filter(Boolean)
  session.srcTokens = tokens
  session.pending = { full: voskText, isFinal: true }
  translateLoop(callId, session)
}

// ── WS 处理 ──
function handleBinary(socket: any, session: InterpSession, callId: string, data: Buffer) {
  if (!data.length) return
  const kind = data[0]
  const pcm = data.subarray(1)
  if (!pcm.length) return
  if (kind !== KIND_PARTIAL && kind !== KIND_FINAL) return
  session.lastFrameAt = Date.now()
  const sid = sessionKey(callId, session.uid)
  // 引擎路由：常用语种 → Vosk 流式（毫秒级）；长尾/方言 → Whisper 多语言 worker
  if (asrEngineFor(session.srcLang) === 'vosk') {
    voskStream.feed(sid, session.srcLang, pcm)
    if (kind === KIND_FINAL) voskStream.finalize(sid, session.srcLang)
  } else {
    whisperStream.feed(sid, session.srcLang, pcm)
    if (kind === KIND_FINAL) whisperStream.finalize(sid, session.srcLang)
  }
}

function cleanupSession(callId: string, uid: string) {
  const call = sessionsByCall.get(callId)
  if (!call) return
  const s = call.get(uid)
  if (s) {
    if (s.ttlTimer) clearTimeout(s.ttlTimer)
    if (asrEngineFor(s.srcLang) === 'vosk') voskStream.resetSession(sessionKey(callId, uid), s.srcLang)
    else whisperStream.resetSession(sessionKey(callId, uid))
  }
  call.delete(uid)
  if (call.size === 0) {
    sessionsByCall.delete(callId)
    sessionCount = Math.max(0, sessionCount - 1)
  }
}

export default async function imRtcInterpreterRoutes(fastify: FastifyInstance): Promise<void> {
  // 预热：Whisper 长尾 worker 后台加载模型（冷启动 10-60s，避免首帧方言会话干等）
  whisperStream.warmup().catch(() => {})
  fastify.get('/api/im/rtc/translate', { websocket: true }, (socket: any, request: FastifyRequest) => {
    const q = request.query as Record<string, string>
    // ── 认证：query token（WebSocket 握手无法带 header，与 read-tracking 同模式）──
    let payload: any
    try {
      payload = (fastify as any).jwt.verify(q?.token || '')
    } catch {
      socket.close(4401, 'unauthorized')
      return
    }
    const uid = String(payload?.id || '')
    if (!uid) {
      socket.close(4401, 'unauthorized')
      return
    }
    const callId = String(q?.callId || '')
    if (!CALLID_RE.test(callId)) {
      socket.close(4400, 'bad callId')
      return
    }
    const srcLang = String(q?.srcLang || 'zh')
    const tgtLang = String(q?.tgtLang || 'en')
    if (!SUPPORTED_LANGS.has(srcLang) || !SUPPORTED_LANGS.has(tgtLang)) {
      socket.close(4400, 'unsupported lang')
      return
    }
    if (sessionCount >= MAX_SESSIONS) {
      socket.close(4429, 'too many sessions')
      return
    }

    let call = sessionsByCall.get(callId)
    if (!call) {
      call = new Map()
      sessionsByCall.set(callId, call)
      sessionCount++
    }
    // 同 uid 重连：先清旧会话
    const old = call.get(uid)
    if (old) {
      try { old.ws.close(4000, 'replaced') } catch { /* noop */ }
      cleanupSession(callId, uid)
    }
    const session: InterpSession = {
      ws: socket,
      uid,
      srcLang,
      tgtLang,
      lastFrameAt: Date.now(),
      ttlTimer: null,
      srcTokens: [],
      translatedFull: '',
      pending: null,
      translating: false,
    }
    call.set(uid, session)

    // 流式 ASR 会话（引擎路由：Vosk 常用 / Whisper 长尾；识别结果 → 增量翻译）
    const initAsr = asrEngineFor(srcLang) === 'vosk'
      ? voskStream.initSession(sessionKey(callId, uid), srcLang, {
          onPartial: (text) => onVoskPartial(callId, session, text),
          onFinal: (text) => onVoskFinal(callId, session, text),
          onError: (err) => console.warn(`[interp] vosk ${uid}: ${err}`),
        })
      : whisperStream.initSession(sessionKey(callId, uid), srcLang, {
          onPartial: (text) => onVoskPartial(callId, session, text),
          onFinal: (text) => onVoskFinal(callId, session, text),
          onError: (err) => console.warn(`[interp] whisper ${uid}: ${err}`),
        })
    initAsr.catch((e: any) => console.warn('[interp] asr init failed:', e?.message))

    const refreshTtl = () => {
      if (session.ttlTimer) clearTimeout(session.ttlTimer)
      session.ttlTimer = setTimeout(() => {
        try { socket.close(4000, 'idle timeout') } catch { /* noop */ }
        cleanupSession(callId, uid)
      }, SESSION_TTL_MS)
    }
    refreshTtl()

    socket.on('message', (data: Buffer, isBinary: boolean) => {
      refreshTtl()
      if (isBinary && Buffer.isBuffer(data)) {
        handleBinary(socket, session, callId, data)
      } else {
        // 文本：心跳 ping
        const raw = Buffer.isBuffer(data) ? data.toString() : String(data || '')
        if (raw.includes('ping')) {
          try { socket.send(JSON.stringify({ type: 'pong', ts: Date.now() })) } catch { /* noop */ }
        }
      }
    })
    socket.on('close', () => cleanupSession(callId, uid))
    socket.on('error', () => cleanupSession(callId, uid))
    socket.send(JSON.stringify({ type: 'ready', callId, uid, srcLang, tgtLang, ts: Date.now() }))
  })
}
