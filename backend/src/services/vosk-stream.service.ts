// vosk-stream.service.ts — 流式 ASR 常驻 worker 管理（RTC-INTERPRETER-02）
// 每语言一个 python vosk worker（lazy 启动，模型常驻）；会话识别器在 worker 内隔离
// 协议：stdin JSON 行 {type:init|audio|final|reset|close} → stdout JSON 行 {type:ready|partial|final|error}
// ⚠️ 单例模式（与 whisper 一致）：孤儿 worker 由进程生命周期管理，不主动 kill
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { ensureVoskModel } from './vosk-model.service.js'


export interface VoskSessionHandlers {
  onPartial: (text: string) => void
  onFinal: (text: string) => void
  onError?: (err: string) => void
}

class VoskStreamManager {
  private static instance: VoskStreamManager | null = null
  static get(): VoskStreamManager {
    if (!this.instance) this.instance = new VoskStreamManager()
    return this.instance
  }

  private workers = new Map<string, ChildProcess>() // lang -> worker proc
  private ready = new Set<string>() // lang 已 ready
  private bootQueue = new Map<string, Array<() => void>>() // lang -> 等待 ready 的回调
  private handlers = new Map<string, VoskSessionHandlers>() // sessionId -> handlers

  private script = resolve(process.cwd(), 'scripts/vosk_stream_worker.py')

  private ensureWorker(lang: string): ChildProcess {
    let proc = this.workers.get(lang)
    if (proc) return proc
    proc = spawn('python3', ['-u', this.script], { stdio: ['pipe', 'pipe', 'inherit'] })
    this.workers.set(lang, proc)
    this.ready.delete(lang)
    const rl = createInterface({ input: proc.stdout! })
    rl.on('line', (line) => {
      let m: any
      try { m = JSON.parse(line) } catch { return }
      if (m.type === 'ready') {
        this.ready.add(lang)
        const q = this.bootQueue.get(lang) || []
        this.bootQueue.delete(lang)
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
    proc.on('exit', () => {
      this.workers.delete(lang)
      this.ready.delete(lang)
    })
    proc.on('error', () => { /* 非致命，下次 use 重启 */ })
    return proc
  }

  private send(lang: string, obj: any) {
    const proc = this.ensureWorker(lang)
    proc.stdin!.write(JSON.stringify(obj) + '\n')
  }

  private async whenReady(lang: string): Promise<void> {
    if (this.ready.has(lang)) return
    return new Promise((resolve) => {
      const q = this.bootQueue.get(lang) || []
      q.push(resolve)
      this.bootQueue.set(lang, q)
    })
  }

  /** 注册会话（懒启动对应语言 worker；模型缺失则先下载）；返回后即可 feed */
  async initSession(sessionId: string, lang: string, handlers: VoskSessionHandlers): Promise<void> {
    this.handlers.set(sessionId, handlers)
    await ensureVoskModel(lang) // 世界语言池：按需懒下载（幂等，已就位直接返回）
    this.send(lang, { type: 'init', session: sessionId, lang })
    await this.whenReady(lang)
  }

  /** 增量喂 PCM（16k s16le mono），识别结果经 handlers 回调 */
  feed(sessionId: string, lang: string, pcm: Buffer) {
    this.send(lang, { type: 'audio', session: sessionId, data: pcm.toString('base64') })
  }

  /** 句末：强制取最终整句（回调 onFinal） */
  finalize(sessionId: string, lang: string) {
    this.send(lang, { type: 'final', session: sessionId })
  }

  /** 通话结束：释放识别器（保留 worker 进程） */
  resetSession(sessionId: string, lang: string) {
    this.handlers.delete(sessionId)
    this.send(lang, { type: 'reset', session: sessionId })
  }

  /** 预热指定语言 worker（服务启动时调用，避免首帧冷启动） */
  async warmup(lang: string): Promise<void> {
    try {
      this.send(lang, { type: 'init', session: `__warmup_${lang}`, lang })
      await this.whenReady(lang)
      this.send(lang, { type: 'reset', session: `__warmup_${lang}` })
    } catch { /* 预热失败不影响主流程 */ }
  }
}

export const voskStream = VoskStreamManager.get()
