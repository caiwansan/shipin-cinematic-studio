// whisper-stream.service.ts — 长尾语种流式 ASR 常驻 worker 池（多 worker 并发支持多人同时说话）
// 与 vosk-stream 互补：Vosk 覆盖 18 常用语种（毫秒级），本服务多 worker 池化覆盖其余语种
// 每个 worker 独立进程，会话按 least-loaded 路由；多人同时说话时无排队瓶颈
// 协议同 vosk_stream_worker.py：stdin JSON 行 {type:init|audio|final|reset|close} → stdout JSON 行 {type:ready|partial|final|error}
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

export interface WhisperSessionHandlers {
  onPartial: (text: string) => void
  onFinal: (text: string) => void
  onError?: (err: string) => void
}

/** 单个 Python worker 进程，承载若干会话 */
class WhisperWorker {
  private worker: ChildProcess | null = null
  private workerReady = false
  private bootWaiters: Array<() => void> = []
  private handlers = new Map<string, WhisperSessionHandlers>()
  private sending = false
  private sendQueue: string[] = []
  readonly script = resolve(process.cwd(), 'scripts/whisper_stream_worker.py')

  constructor(readonly index: number) {}

  get process(): ChildProcess {
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
        this.drainQueue()
      } else if (m.type === 'error') {
        const h = this.handlers.get(m.session)
        if (h?.onError) h.onError(m.text)
        this.drainQueue()
      }
    })
    this.worker.on('exit', () => {
      this.worker = null
      this.workerReady = false
    })
    this.worker.on('error', () => { /* 非致命，下次 use 重启 */ })
    return this.worker
  }

  /** 入队一条消息，串行写入 stdin（避免消息交叉） */
  send(obj: any) {
    const line = JSON.stringify(obj) + '\n'
    this.sendQueue.push(line)
    this.drainQueue()
  }

  private drainQueue() {
    if (this.sending || this.sendQueue.length === 0) return
    if (!this.worker || this.worker.killed) return
    this.sending = true
    const proc = this.worker
    const batch = this.sendQueue.splice(0, this.sendQueue.length).join('')
    proc.stdin!.write(batch, (err) => {
      this.sending = false
      if (err) {
        console.warn(`[WhisperWorker${this.index}] stdin write error:`, err.message)
      }
      if (this.sendQueue.length > 0) {
        this.drainQueue()
      }
    })
  }

  async whenReady(): Promise<void> {
    if (this.workerReady) return
    return new Promise((resolve) => this.bootWaiters.push(resolve))
  }

  /** 接管一个会话（init 消息发送给 worker） */
  assignSession(sessionId: string, lang: string, handlers: WhisperSessionHandlers): void {
    this.handlers.set(sessionId, handlers)
    this.send({ type: 'init', session: sessionId, lang })
  }

  removeSession(sessionId: string) {
    this.handlers.delete(sessionId)
    this.send({ type: 'reset', session: sessionId })
  }

  get sessionCount(): number {
    // 只计算真实会话（排除预热占位）
    let count = 0
    for (const sid of this.handlers.keys()) {
      if (!sid.startsWith('__warmup')) count++
    }
    return count
  }

  get ready(): boolean {
    return this.workerReady
  }

  destroy() {
    try { this.worker?.kill() } catch {}
    this.worker = null
    this.workerReady = false
    this.handlers.clear()
    this.sendQueue.length = 0
  }
}

class WhisperStreamManager {
  private static instance: WhisperStreamManager | null = null
  static get(): WhisperStreamManager {
    if (!this.instance) this.instance = new WhisperStreamManager()
    return this.instance
  }

  private workers: WhisperWorker[] = []
  private sessionWorker = new Map<string, WhisperWorker>() // sessionId -> worker
  private warmupWorker: WhisperWorker | null = null

  /** 默认 2 worker：可覆盖 2-4 人同时说话不排队；env WHISPER_WORKERS 可覆盖 */
  private get poolSize(): number {
    return Number(process.env.WHISPER_WORKERS || 2)
  }

  private ensureWorkers(): WhisperWorker[] {
    if (this.workers.length > 0) return this.workers
    for (let i = 0; i < this.poolSize; i++) {
      this.workers.push(new WhisperWorker(i))
    }
    return this.workers
  }

  /** 选择 least-loaded worker 并初始化会话 */
  private pickWorker(): WhisperWorker {
    this.ensureWorkers()
    return this.workers.reduce((a, b) => a.sessionCount <= b.sessionCount ? a : b)
  }

  /** 注册会话（懒启动 worker；首个 init 含模型加载 10-60s，后续秒级） */
  async initSession(sessionId: string, lang: string, handlers: WhisperSessionHandlers): Promise<void> {
    const worker = this.pickWorker()
    worker.assignSession(sessionId, lang, handlers)
    this.sessionWorker.set(sessionId, worker)
    await worker.whenReady()
  }

  /** 增量喂 PCM（16k s16le mono） */
  feed(sessionId: string, lang: string, pcm: Buffer) {
    const worker = this.sessionWorker.get(sessionId)
    if (!worker) return
    worker.send({ type: 'audio', session: sessionId, lang, data: pcm.toString('base64') })
  }

  /** 句末：整句定稿（回调 onFinal）并清空缓冲 */
  finalize(sessionId: string, lang: string) {
    const worker = this.sessionWorker.get(sessionId)
    if (!worker) return
    worker.send({ type: 'final', session: sessionId, lang })
  }

  /** 通话结束：释放会话缓冲（保留 worker 与模型） */
  resetSession(sessionId: string) {
    const worker = this.sessionWorker.get(sessionId)
    if (!worker) return
    worker.removeSession(sessionId)
    this.sessionWorker.delete(sessionId)
  }

  /** 预热：服务启动时调用，避免首帧冷启动（模型加载 10-60s） */
  async warmup(): Promise<void> {
    try {
      this.ensureWorkers()
      // 用第一个 worker 预热
      const w = this.workers[0]
      w.assignSession('__warmup_whisper', 'yue', {
        onPartial: () => {},
        onFinal: () => {},
      })
      await w.whenReady()
      w.removeSession('__warmup_whisper')
      // 预热线程池其余 worker
      for (let i = 1; i < this.workers.length; i++) {
        const wi = this.workers[i]
        wi.assignSession(`__warmup_whisper_${i}`, 'yue', {
          onPartial: () => {},
          onFinal: () => {},
        })
        wi.whenReady().then(() => {
          wi.removeSession(`__warmup_whisper_${i}`)
        }).catch(() => {})
      }
    } catch { /* 预热失败不影响主流程 */ }
  }
}

export const whisperStream = WhisperStreamManager.get()
