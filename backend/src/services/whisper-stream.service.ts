// whisper-stream.service.ts — 长尾语种流式 ASR 常驻 worker 管理（RTC-INTERPRETER-04）
// 与 vosk-stream 互补：Vosk 覆盖 18 常用语种（毫秒级），本服务单 worker 单多语言模型覆盖其余 83 语种（含粤语 yue/闽南语 nan）
// 单个 worker（whisper 模型全局共享，多语言）；会话在 worker 内按 session 隔离累积缓冲
// 协议同 vosk_stream_worker.py：stdin JSON 行 {type:init|audio|final|reset|close} → stdout JSON 行 {type:ready|partial|final|error}
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

export interface WhisperSessionHandlers {
  onPartial: (text: string) => void
  onFinal: (text: string) => void
  onError?: (err: string) => void
}

class WhisperStreamManager {
  private static instance: WhisperStreamManager | null = null
  static get(): WhisperStreamManager {
    if (!this.instance) this.instance = new WhisperStreamManager()
    return this.instance
  }

  private worker: ChildProcess | null = null
  private workerReady = false
  private bootWaiters: Array<() => void> = []
  private handlers = new Map<string, WhisperSessionHandlers>() // sessionId -> handlers

  private script = resolve(process.cwd(), 'scripts/whisper_stream_worker.py')

  private ensureWorker(): ChildProcess {
    if (this.worker && !this.worker.killed) return this.worker
    this.worker = spawn('python3', ['-u', this.script], {
      env: { ...process.env, HF_ENDPOINT: process.env.HF_ENDPOINT || 'https://hf-mirror.com' },
      stdio: ['pipe', 'pipe', 'inherit'],
    })
    this.workerReady = false
    const rl = createInterface({ input: this.worker.stdout! })
    rl.on('line', (line) => {
      let m: any
      try { m = JSON.parse(line) } catch { return }
      if (m.type === 'ready') {
        this.workerReady = true
        const q = this.bootWaiters
        this.bootWaiters = []
        q.forEach((cb) => cb())
      } else if (m.type === 'partial' || m.type === 'final') {
        const h = this.handlers.get(m.session)
        if (!h) return
        if (m.type === 'partial') h.onPartial(m.text)
        else h.onFinal(m.text)
      } else if (m.type === 'error') {
        const h = this.handlers.get(m.session)
        if (h?.onError) h.onError(m.text)
      }
    })
    this.worker.on('exit', () => {
      this.worker = null
      this.workerReady = false
    })
    this.worker.on('error', () => { /* 非致命，下次 use 重启 */ })
    return this.worker
  }

  private send(obj: any) {
    const proc = this.ensureWorker()
    proc.stdin!.write(JSON.stringify(obj) + '\n')
  }

  private async whenReady(): Promise<void> {
    if (this.workerReady) return
    return new Promise((resolve) => this.bootWaiters.push(resolve))
  }

  /** 注册会话（懒启动 worker；首个 init 含模型加载 10-60s，后续秒级） */
  async initSession(sessionId: string, lang: string, handlers: WhisperSessionHandlers): Promise<void> {
    this.handlers.set(sessionId, handlers)
    this.send({ type: 'init', session: sessionId, lang })
    await this.whenReady()
  }

  /** 增量喂 PCM（16k s16le mono）；worker 内部节流增量转写 → partial 回调 */
  feed(sessionId: string, lang: string, pcm: Buffer) {
    this.send({ type: 'audio', session: sessionId, lang, data: pcm.toString('base64') })
  }

  /** 句末：整句定稿（回调 onFinal）并清空缓冲 */
  finalize(sessionId: string, lang: string) {
    this.send({ type: 'final', session: sessionId, lang })
  }

  /** 通话结束：释放会话缓冲（保留 worker 与模型） */
  resetSession(sessionId: string) {
    this.handlers.delete(sessionId)
    this.send({ type: 'reset', session: sessionId })
  }

  /** 预热：服务启动时调用，避免首帧冷启动（模型加载 10-60s） */
  async warmup(): Promise<void> {
    try {
      this.send({ type: 'init', session: '__warmup_whisper', lang: 'yue' })
      await this.whenReady()
      this.send({ type: 'reset', session: '__warmup_whisper' })
    } catch { /* 预热失败不影响主流程 */ }
  }
}

export const whisperStream = WhisperStreamManager.get()
