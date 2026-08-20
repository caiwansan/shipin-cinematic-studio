/**
 * useAiSecretary.ts — AI 秘书前端 Composable
 * 
 * 功能：
 * 1. 实时音频采集（麦克风 + 系统音频/视频音频）
 * 2. WebSocket 发送到服务端进行 Whisper 转写
 * 3. 接收转写结果并显示
 * 4. 管理录音（屏幕共享/在线视频）
 * 5. 生成和显示 AI 纪要
 */

import { ref, computed, onUnmounted } from 'vue'

export interface TranscriptItem {
  id: string
  userUid: string
  speakerName: string
  content: string
  language: string
  confidence: number
  isFinal: boolean
  createdAt: string
  sortOrder: number
}

export interface SecretaryStatus {
  active: boolean
  stats: {
    isRecording: boolean
    duration: number
    transcriptCount: number
    recordingCount: number
    speakerCount: number
  } | null
  config: any
}

export interface MeetingMinutes {
  id: string
  meetingId: string
  summary: string
  content: any
  generatedAt: string
  modelUsed: string
}

export function useAiSecretary(meetingId: string, userUid: string) {
  const active = ref(false)
  const connecting = ref(false)
  const error = ref('')
  const isVip = ref(false)
  const needUpgrade = ref(false)
  const transcripts = ref<TranscriptItem[]>([])
  const minutes = ref<MeetingMinutes | null>(null)
  const recordings = ref<any[]>([])
  const duration = ref(0)
  const language = ref('zh')

  let ws: WebSocket | null = null
  let audioCtx: AudioContext | null = null
  let mediaStream: MediaStream | null = null
  let workletNode: AudioWorkletNode | null = null
  let timerInterval: any = null
  let pollInterval: any = null
  let startTime = 0

  const token = () => localStorage.getItem('auth_token') || localStorage.getItem('accessToken') || ''

  // 检查 VIP 状态
  async function checkVip(): Promise<boolean> {
    try {
      const r = await fetch('/api/user/llm-config', {
        headers: { 'Authorization': `Bearer ${token()}` }
      })
      const j = await r.json()
      // VIP 检查需要从用户信息获取
      const userResp = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token()}` }
      })
      const userJson = await userResp.json()
      const tier = userJson?.data?.memberTier || userJson?.user?.memberTier || 'free'
      isVip.value = tier === 'vip' || tier === 'pro'
      return isVip.value
    } catch {
      isVip.value = false
      return false
    }
  }

  // 启动 AI 秘书
  async function start(lang = 'zh') {
    connecting.value = true
    error.value = ''
    language.value = lang

    try {
      // 先检查 VIP
      const vip = await checkVip()
      if (!vip) {
        needUpgrade.value = true
        error.value = 'AI 秘书为 VIP 专属功能'
        connecting.value = false
        return false
      }

      // 调用后端启动
      const r = await fetch('/api/meeting/ai-secretary/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token()}`
        },
        body: JSON.stringify({ meetingId, language: lang })
      })
      const j = await r.json()
      if (!j.success) {
        if (j.needUpgrade) {
          needUpgrade.value = true
          error.value = 'AI 秘书为 VIP 专属功能，请先升级会员'
        } else {
          error.value = j.error || '启动失败'
        }
        connecting.value = false
        return false
      }

      active.value = true
      startTime = Date.now()

      // 启动音频采集
      await startAudioCapture()

      // 连接 WebSocket
      connectWebSocket()

      // 计时器
      timerInterval = setInterval(() => {
        duration.value = Math.floor((Date.now() - startTime) / 1000)
      }, 1000)

      // 轮询转写结果
      pollInterval = setInterval(pollTranscripts, 3000)

      return true
    } catch (e: any) {
      error.value = e.message || '启动失败'
      connecting.value = false
      return false
    }
  }

  // 停止 AI 秘书
  async function stop() {
    try {
      // 停止音频采集
      stopAudioCapture()

      // 关闭 WebSocket
      if (ws) {
        try { ws.close() } catch {}
        ws = null
      }

      // 清除计时器
      if (timerInterval) clearInterval(timerInterval)
      if (pollInterval) clearInterval(pollInterval)

      // 调用后端停止
      await fetch('/api/meeting/ai-secretary/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token()}`
        },
        body: JSON.stringify({ meetingId })
      })

      active.value = false

      // 获取最终纪要
      await loadMinutes()
    } catch (e: any) {
      error.value = e.message || '停止失败'
    }
  }

  // 启动音频采集（麦克风）
  async function startAudioCapture() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1
        }
      })

      audioCtx = new AudioContext({ sampleRate: 16000 })

      // 使用 AudioWorklet 处理 PCM 数据
      await audioCtx.audioWorklet.addModule(URL.createObjectURL(new Blob([`
        class PcmProcessor extends AudioWorkletProcessor {
          constructor() { super(); this.buffer = []; this.frameSize = 4800; }
          process(inputs) {
            const input = inputs[0];
            if (!input || !input[0]) return true;
            const samples = input[0];
            // Float32 → Int16
            const int16 = new Int16Array(samples.length);
            for (let i = 0; i < samples.length; i++) {
              const s = Math.max(-1, Math.min(1, samples[i]));
              int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            this.buffer.push(...int16);
            // 每 300ms (4800 samples @ 16kHz) 发送一帧
            while (this.buffer.length >= this.frameSize) {
              const frame = this.buffer.splice(0, this.frameSize);
              this.port.postMessage({ pcm: frame });
            }
            return true;
          }
        }
        registerProcessor('pcm-processor', PcmProcessor);
      `], { type: 'application/javascript' })))

      const source = audioCtx.createMediaStreamSource(mediaStream)
      workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor')

      workletNode.port.onmessage = (event) => {
        if (event.data.pcm && ws?.readyState === WebSocket.OPEN) {
          // Int16Array → base64
          const pcm = new Uint8Array(event.data.pcm.buffer)
          let binary = ''
          for (let i = 0; i < pcm.length; i++) {
            binary += String.fromCharCode(pcm[i])
          }
          ws.send(JSON.stringify({
            type: 'audio',
            pcm: btoa(binary),
            lang: language.value
          }))
        }
      }

      source.connect(workletNode)
      console.log('[AI秘书] 音频采集已启动')
    } catch (e: any) {
      console.warn('[AI秘书] 音频采集失败:', e.message)
      // 降级：尝试仅音频
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // 简化处理
      } catch {}
    }
  }

  // 停止音频采集
  function stopAudioCapture() {
    try {
      workletNode?.disconnect()
      mediaStream?.getTracks().forEach(t => t.stop())
      audioCtx?.close()
    } catch {}
    workletNode = null
    mediaStream = null
    audioCtx = null
  }

  // 连接 WebSocket
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    ws = new WebSocket(
      `${protocol}//${host}/ws/ai-secretary/audio?uid=${encodeURIComponent(userUid)}&meetingId=${encodeURIComponent(meetingId)}&token=${encodeURIComponent(userUid)}`
    )

    ws.onopen = () => {
      console.log('[AI秘书] WebSocket 已连接')
      // 发送发言人姓名
      try {
        const user = JSON.parse(localStorage.getItem('auth_user') || '{}')
        const name = user.nickname || user.username || userUid.slice(0, 6)
        ws?.send(JSON.stringify({ type: 'speaker-name', name }))
      } catch {}
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'partial') {
          // 中间结果
        } else if (msg.type === 'final') {
          // 最终结果
          pollTranscripts()
        }
      } catch {}
    }

    ws.onerror = (e) => {
      console.warn('[AI秘书] WebSocket 错误:', e)
    }

    ws.onclose = () => {
      console.log('[AI秘书] WebSocket 已关闭')
    }
  }

  // 轮询转写结果
  async function pollTranscripts() {
    if (!active.value) return
    try {
      const r = await fetch(
        `/api/meeting/ai-secretary/transcripts?meetingId=${encodeURIComponent(meetingId)}&limit=200`,
        { headers: { 'Authorization': `Bearer ${token()}` } }
      )
      const j = await r.json()
      if (j.success && j.data.transcripts) {
        transcripts.value = j.data.transcripts
      }
    } catch {}
  }

  // 开始录音（屏幕共享/在线视频时调用）
  async function startRecording(type: 'screen' | 'video') {
    try {
      const r = await fetch('/api/meeting/ai-secretary/recording/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token()}`
        },
        body: JSON.stringify({ meetingId, recordingType: type })
      })
      const j = await r.json()
      return j.data?.recordingId || null
    } catch {
      return null
    }
  }

  // 结束录音
  async function stopRecording(recordingId: string) {
    try {
      await fetch('/api/meeting/ai-secretary/recording/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token()}`
        },
        body: JSON.stringify({ meetingId, recordingId })
      })
      await loadRecordings()
    } catch {}
  }

  // 加载录音列表
  async function loadRecordings() {
    try {
      const r = await fetch(
        `/api/meeting/ai-secretary/recordings?meetingId=${encodeURIComponent(meetingId)}`,
        { headers: { 'Authorization': `Bearer ${token()}` } }
      )
      const j = await r.json()
      if (j.success) recordings.value = j.data.recordings
    } catch {}
  }

  // 生成纪要
  async function generateMinutes() {
    try {
      const r = await fetch('/api/meeting/ai-secretary/minutes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token()}`
        },
        body: JSON.stringify({ meetingId })
      })
      const j = await r.json()
      if (j.success) {
        minutes.value = j.data
        return j.data
      }
      return null
    } catch {
      return null
    }
  }

  // 加载纪要
  async function loadMinutes() {
    try {
      const r = await fetch(
        `/api/meeting/ai-secretary/minutes?meetingId=${encodeURIComponent(meetingId)}`,
        { headers: { 'Authorization': `Bearer ${token()}` } }
      )
      const j = await r.json()
      if (j.success && j.data) {
        minutes.value = j.data
      }
    } catch {}
  }

  // 添加外部转写（在线视频音频）
  async function addExternalTranscript(label: string, text: string, lang = 'zh') {
    try {
      await fetch('/api/meeting/ai-secretary/transcripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token()}`
        },
        body: JSON.stringify({ meetingId, content: text, speakerName: label, language: lang })
      })
      await pollTranscripts()
    } catch {}
  }

  // 格式化时长
  const formattedDuration = computed(() => {
    const h = Math.floor(duration.value / 3600)
    const m = Math.floor((duration.value % 3600) / 60)
    const s = duration.value % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  })

  // 清理
  onUnmounted(() => {
    if (active.value) stop()
  })

  return {
    active,
    connecting,
    error,
    isVip,
    needUpgrade,
    transcripts,
    minutes,
    recordings,
    duration,
    formattedDuration,
    language,
    start,
    stop,
    startRecording,
    stopRecording,
    loadRecordings,
    generateMinutes,
    loadMinutes,
    pollTranscripts,
    addExternalTranscript,
    checkVip
  }
}
