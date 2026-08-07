// useRtcInterpreter.ts — 昆仑茶馆 实时同声传译（字幕同传 MVP，阶段一）
// 链路：本端 mic(原文) → clone → 16k 降采样 → 能量 VAD 切句 → WS 二进制帧 → 网关 ASR+翻译 → 对端字幕
// 对称设计：本端只处理自己声音（srcLang=我说的语言），收到的是「对端语音的译文」（tgtLang=我听的语言）
// 帧协议：1 字节 kind（1=partial 增量 / 2=final 完整句）+ Int16 PCM(16k mono s16le)
// 合规：显式开启（start 才采集上传）；音频仅通话内存流转，网关不落盘
import { ref, readonly } from 'vue'

export interface InterpSubtitle {
  text: string
  partial: boolean
  srcLang: string
  tgtLang: string
  ts: number
  preview: boolean
  error?: string
}

export type InterpState = 'off' | 'connecting' | 'on'

export interface InterpAudioMsg {
  sentenceId: string
  seq: number
  total: number
  text: string
  audio: string // base64 mp3
  mime: string
  tgtLang: string
  ts: number
  done: boolean
}

// ── 世界语言池 101 语种（RTC-INTERPRETER-04，与后端 interp-langs.ts 同步维护）──
// 分组：常用 18（Vosk 流式毫秒级）｜中文方言 2（粤语 yue / 闽南语 nan，Whisper）｜世界语言 81（Whisper）
export interface InterpLangOption {
  value: string
  label: string
}

export const LANG_GROUPS: { label: string; options: InterpLangOption[] }[] = [
  {
    label: '🎯 常用语言（毫秒级）',
    options: [
      { value: 'zh', label: '中文（普通话）' },
      { value: 'en', label: '英语' },
      { value: 'es', label: '西班牙语' },
      { value: 'ru', label: '俄语' },
      { value: 'fr', label: '法语' },
      { value: 'de', label: '德语' },
      { value: 'ja', label: '日语' },
      { value: 'ko', label: '韩语' },
      { value: 'pt', label: '葡萄牙语' },
      { value: 'it', label: '意大利语' },
      { value: 'ar', label: '阿拉伯语' },
      { value: 'vi', label: '越南语' },
      { value: 'tr', label: '土耳其语' },
      { value: 'nl', label: '荷兰语' },
      { value: 'pl', label: '波兰语' },
      { value: 'hi', label: '印地语' },
      { value: 'uk', label: '乌克兰语' },
      { value: 'fa', label: '波斯语' },
    ],
  },
  {
    label: '🗣️ 中文方言',
    options: [
      { value: 'yue', label: '粤语（广东话）' },
      { value: 'nan', label: '闽南语（台语/福建话）' },
    ],
  },
  {
    label: '🌍 世界语言',
    options: [
      { value: 'af', label: '南非荷兰语' },
      { value: 'am', label: '阿姆哈拉语' },
      { value: 'as', label: '阿萨姆语' },
      { value: 'az', label: '阿塞拜疆语' },
      { value: 'ba', label: '巴什基尔语' },
      { value: 'be', label: '白俄罗斯语' },
      { value: 'bg', label: '保加利亚语' },
      { value: 'bn', label: '孟加拉语' },
      { value: 'bo', label: '藏语' },
      { value: 'br', label: '布列塔尼语' },
      { value: 'bs', label: '波斯尼亚语' },
      { value: 'ca', label: '加泰罗尼亚语' },
      { value: 'cs', label: '捷克语' },
      { value: 'cy', label: '威尔士语' },
      { value: 'da', label: '丹麦语' },
      { value: 'el', label: '希腊语' },
      { value: 'et', label: '爱沙尼亚语' },
      { value: 'eu', label: '巴斯克语' },
      { value: 'fi', label: '芬兰语' },
      { value: 'fo', label: '法罗语' },
      { value: 'gl', label: '加利西亚语' },
      { value: 'gu', label: '古吉拉特语' },
      { value: 'ha', label: '豪萨语' },
      { value: 'haw', label: '夏威夷语' },
      { value: 'he', label: '希伯来语' },
      { value: 'hr', label: '克罗地亚语' },
      { value: 'ht', label: '海地克里奥尔语' },
      { value: 'hu', label: '匈牙利语' },
      { value: 'hy', label: '亚美尼亚语' },
      { value: 'id', label: '印度尼西亚语' },
      { value: 'is', label: '冰岛语' },
      { value: 'jw', label: '爪哇语' },
      { value: 'ka', label: '格鲁吉亚语' },
      { value: 'kk', label: '哈萨克语' },
      { value: 'km', label: '高棉语' },
      { value: 'kn', label: '卡纳达语' },
      { value: 'la', label: '拉丁语' },
      { value: 'lb', label: '卢森堡语' },
      { value: 'ln', label: '林加拉语' },
      { value: 'lo', label: '老挝语' },
      { value: 'lt', label: '立陶宛语' },
      { value: 'lv', label: '拉脱维亚语' },
      { value: 'mg', label: '马达加斯加语' },
      { value: 'mi', label: '毛利语' },
      { value: 'mk', label: '马其顿语' },
      { value: 'ml', label: '马拉雅拉姆语' },
      { value: 'mn', label: '蒙古语' },
      { value: 'mr', label: '马拉地语' },
      { value: 'ms', label: '马来语' },
      { value: 'mt', label: '马耳他语' },
      { value: 'my', label: '缅甸语' },
      { value: 'ne', label: '尼泊尔语' },
      { value: 'nn', label: '挪威尼诺斯克语' },
      { value: 'no', label: '挪威语' },
      { value: 'oc', label: '奥克语' },
      { value: 'pa', label: '旁遮普语' },
      { value: 'ps', label: '普什图语' },
      { value: 'ro', label: '罗马尼亚语' },
      { value: 'sa', label: '梵语' },
      { value: 'sd', label: '信德语' },
      { value: 'si', label: '僧伽罗语' },
      { value: 'sk', label: '斯洛伐克语' },
      { value: 'sl', label: '斯洛文尼亚语' },
      { value: 'sn', label: '绍纳语' },
      { value: 'so', label: '索马里语' },
      { value: 'sq', label: '阿尔巴尼亚语' },
      { value: 'sr', label: '塞尔维亚语' },
      { value: 'su', label: '巽他语' },
      { value: 'sv', label: '瑞典语' },
      { value: 'sw', label: '斯瓦希里语' },
      { value: 'ta', label: '泰米尔语' },
      { value: 'te', label: '泰卢固语' },
      { value: 'tg', label: '塔吉克语' },
      { value: 'th', label: '泰语' },
      { value: 'tk', label: '土库曼语' },
      { value: 'tl', label: '他加禄语（菲律宾语）' },
      { value: 'tt', label: '鞑靼语' },
      { value: 'ur', label: '乌尔都语' },
      { value: 'uz', label: '乌兹别克语' },
      { value: 'yi', label: '意第绪语' },
      { value: 'yo', label: '约鲁巴语' },
    ],
  },
]

export const LANG_OPTIONS: InterpLangOption[] = LANG_GROUPS.flatMap((g) => g.options)

// VAD 参数
const VAD_THRESHOLD = 0.010 // RMS 活跃阈值
const SILENCE_MS = 1200 // 静音超时 → 切句提交
const MAX_SENTENCE_MS = 10000 // 最长句 → 强制提交
const MIN_SENTENCE_MS = 400 // 最短句（过短丢弃）
const PARTIAL_INTERVAL_MS = 200 // partial 增量帧间隔（流式 ASR 需要持续喂帧，毫秒级跟读）
const TARGET_RATE = 16000
const SOURCE_RATE = 48000

export function useRtcInterpreter() {
  const state = ref<InterpState>('off')
  const subtitle = ref<InterpSubtitle | null>(null)
  const errorMsg = ref('')
  const audioEnabled = ref(true) // 语音同传开关（关 = 仅字幕）
  const speaking = ref(false) // 是否正在播放对端语音

  let ws: WebSocket | null = null
  let audioCtx: AudioContext | null = null
  let processor: ScriptProcessorNode | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let clonedTrack: MediaStreamTrack | null = null
  let stream: MediaStream | null = null
  let alive = false // 会话级开关（stop 后拒绝一切回调）

  // 语音播放：打断式（新句到达 → 停旧句、清队列）；同句分段按序播
  let currentAudio: HTMLAudioElement | null = null
  let curSentenceId = ''
  let pendingSegs: { blob: Blob; text: string }[] = []
  let playingSeg = false

  function stopAudio() {
    try { currentAudio?.pause() } catch { /* noop */ }
    try { if (currentAudio) currentAudio.src = '' } catch { /* noop */ }
    currentAudio = null
    pendingSegs = []
    playingSeg = false
    speaking.value = false
  }

  function playNextSeg() {
    if (!audioEnabled.value || !alive) return
    if (pendingSegs.length === 0) { playingSeg = false; speaking.value = false; return }
    const seg = pendingSegs.shift()!
    const url = URL.createObjectURL(seg.blob)
    const audio = new Audio(url)
    currentAudio = audio
    speaking.value = true
    audio.onended = () => {
      URL.revokeObjectURL(url)
      if (currentAudio === audio) {
        currentAudio = null
        if (pendingSegs.length === 0) { playingSeg = false; speaking.value = false }
        else playNextSeg()
      }
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
      playNextSeg()
    }
    audio.play().catch(() => {
      // 自动播放被浏览器拦截（未交互）：降级仅字幕，不报错
      URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
      playingSeg = false
      speaking.value = false
    })
  }

  function onAudioMsg(msg: InterpAudioMsg) {
    if (!audioEnabled.value || !alive) return
    if (msg.sentenceId !== curSentenceId) {
      // 新句：打断旧句（同传跟读新鲜度优先）
      curSentenceId = msg.sentenceId
      stopAudio()
    }
    try {
      const bin = atob(msg.audio)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      pendingSegs.push({ blob: new Blob([bytes], { type: msg.mime || 'audio/mpeg' }), text: msg.text })
      if (!playingSeg) { playingSeg = true; playNextSeg() }
    } catch { /* 坏帧忽略 */ }
  }

  // 切句状态
  let active = false // 当前是否在说话
  let sentence: Int16Array[] = [] // 当前句全部样本（16k）
  let sentenceSamples = 0
  let sentSamples = 0 // 已通过 partial 发送的样本数
  let silenceStart = 0
  let activeSince = 0
  let lastSentAt = 0
  let totalMs = 0

  function resetSentence() {
    sentence = []
    sentenceSamples = 0
    sentSamples = 0
    active = false
    silenceStart = 0
    activeSince = 0
  }

  function submit(kind: 1 | 2) {
    if (!alive || !ws || ws.readyState !== 1) return
    if (sentenceSamples === 0) return
    const ms = Math.round((sentenceSamples / TARGET_RATE) * 1000)
    if (ms < MIN_SENTENCE_MS) { resetSentence(); return }
    // 未发送部分（final 全量；partial 增量）
    const startIdx = kind === 2 ? 0 : Math.min(sentSamples, sentenceSamples)
    const chunks = sentence
    // 合并样本（从 startIdx 起）
    let offset = startIdx
    const parts: number[] = []
    for (const c of chunks) {
      if (offset >= c.length) { offset -= c.length; continue }
      for (let i = offset; i < c.length; i++) parts.push(c[i])
      offset = 0
    }
    if (!parts.length) return
    const pcm = new Int16Array(parts)
    const pcmBytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
    const frame = new Uint8Array(1 + pcmBytes.length)
    frame[0] = kind
    frame.set(pcmBytes, 1)
    ws.send(frame)
    if (kind === 2) {
      resetSentence()
    } else {
      sentSamples = sentenceSamples
      lastSentAt = Date.now()
    }
  }

  /** 每 85ms 音频回调：降采样 → VAD → 切句 */
  function onAudio(e: AudioProcessingEvent) {
    if (!alive) return
    const input = e.inputBuffer.getChannelData(0)
    // 48k → 16k 降采样（3 点平均防混叠）
    const outLen = Math.floor(input.length / 3)
    const down = new Float32Array(outLen)
    for (let i = 0; i < outLen; i++) {
      down[i] = (input[i * 3] + input[i * 3 + 1] + input[i * 3 + 2]) / 3
    }
    // RMS 能量
    let sum = 0
    for (let i = 0; i < down.length; i++) sum += down[i] * down[i]
    const rms = Math.sqrt(sum / down.length)
    const now = Date.now()
    totalMs = now

    if (rms >= VAD_THRESHOLD) {
      if (!active) {
        active = true
        activeSince = now
        silenceStart = 0
      } else {
        silenceStart = 0
      }
      // 累积 Int16
      const int16 = new Int16Array(down.length)
      for (let i = 0; i < down.length; i++) {
        const s = Math.max(-1, Math.min(1, down[i]))
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      sentence.push(int16)
      sentenceSamples += int16.length
    } else if (active) {
      // 静音中：也累积（保留尾音），计时切句
      const int16 = new Int16Array(down.length)
      for (let i = 0; i < down.length; i++) int16[i] = 0
      sentence.push(int16)
      sentenceSamples += int16.length
      if (!silenceStart) silenceStart = now
      if (now - silenceStart >= SILENCE_MS) {
        submit(2) // 说完：final
        return
      }
    }

    // partial：说超过 1.5s 且距上次发送够久 → 增量提交
    if (active && !silenceStart && now - lastSentAt >= PARTIAL_INTERVAL_MS && sentenceSamples > sentSamples) {
      submit(1)
    }
    // 最长句强制提交
    if (active && now - activeSince >= MAX_SENTENCE_MS) {
      submit(2)
    }
  }

  /** 开启同传：stream=本端 mic 流（含 video 也无妨，只取 audio track） */
  async function start(opts: { stream: MediaStream; callId: string; srcLang: string; tgtLang: string }) {
    stop()
    subtitle.value = null
    errorMsg.value = ''
    const track = opts.stream.getAudioTracks()[0]
    if (!track) { errorMsg.value = '没有可用的麦克风音轨'; return }
    const token = localStorage.getItem('auth_token') || localStorage.getItem('accessToken') || ''
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${location.host}/api/im/rtc/translate?token=${encodeURIComponent(token)}&callId=${encodeURIComponent(opts.callId)}&srcLang=${opts.srcLang}&tgtLang=${opts.tgtLang}`
    state.value = 'connecting'
    ws = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
      if (!ws) return reject(new Error('ws null'))
      const to = setTimeout(() => reject(new Error('同传服务连接超时')), 8000)
      ws.onopen = () => { clearTimeout(to); resolve() }
      ws.onerror = () => { clearTimeout(to); reject(new Error('同传服务连接失败')) }
    })
    ws.onmessage = (ev) => {
      if (!alive) return
      try {
        const msg = JSON.parse(ev.data as string)
        if (msg.type === 'subtitle') {
          subtitle.value = {
            text: msg.text || '',
            partial: !!msg.partial,
            srcLang: msg.srcLang,
            tgtLang: msg.tgtLang,
            ts: msg.ts,
            preview: !!msg.preview,
            error: msg.error,
          }
        } else if (msg.type === 'audio') {
          onAudioMsg(msg)
        }
      } catch { /* 忽略非 JSON */ }
    }
    ws.onclose = () => { if (alive && state.value !== 'off') { state.value = 'off'; errorMsg.value = '同传连接已断开' } }

    // 采集
    alive = true
    clonedTrack = track.clone()
    stream = new MediaStream([clonedTrack])
    audioCtx = new AudioContext()
    sourceNode = audioCtx.createMediaStreamSource(stream)
    processor = audioCtx.createScriptProcessor(4096, 1, 1)
    processor.onaudioprocess = onAudio
    sourceNode.connect(processor)
    processor.connect(audioCtx.destination) // 必须连接（静音输出）否则不触发
    state.value = 'on'
  }

  /** 停止同传（挂断/关闭开关/切换语言） */
  function stop() {
    alive = false
    stopAudio()
    try { processor?.disconnect() } catch { /* noop */ }
    try { sourceNode?.disconnect() } catch { /* noop */ }
    try { audioCtx?.close() } catch { /* noop */ }
    clonedTrack?.stop()
    processor = null
    sourceNode = null
    audioCtx = null
    clonedTrack = null
    stream = null
    if (ws) { try { ws.close(1000, 'stop') } catch { /* noop */ } ws = null }
    resetSentence()
    state.value = 'off'
  }

  return {
    state: readonly(state),
    subtitle: readonly(subtitle),
    errorMsg: readonly(errorMsg),
    audioEnabled,
    speaking: readonly(speaking),
    langOptions: LANG_OPTIONS,
    langGroups: LANG_GROUPS,
    toggleAudio: () => { audioEnabled.value = !audioEnabled.value; if (!audioEnabled.value) stopAudio() },
    start,
    stop,
  }
}
