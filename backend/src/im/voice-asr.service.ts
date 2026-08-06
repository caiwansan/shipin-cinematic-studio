// voice-asr.service.ts — 昆仑茶馆语音转文字（IM-CHA-M10）
// 链路：音频 URL → 下载 → ffmpeg 转 16k 单声道 wav → faster-whisper(small, CPU int8) 转写
// 常驻 Python worker（行协议）：模型启动加载一次，后续任务排队秒级返回
// 合规：音频在服务器本地转写，不出平台（与 R3「谁发布缓存在谁的机器上」理念一致）
import { spawn, ChildProcess } from 'node:child_process'
import { mkdtemp, writeFile, unlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { prisma } from '../utils/index.js'

const execFileP = promisify(execFile)
const ASR_SCRIPT = resolve(process.cwd(), 'scripts/asr_transcribe.py')
const ASR_ENABLED = process.env.ASR_ENABLED !== 'off' // 默认开启；ASR_ENABLED=off 可关

let worker: ChildProcess | null = null
let workerReady = false
const pending = new Map<string, (r: any) => void>() // id -> resolver
let taskSeq = 0

/** 启动常驻 ASR worker（lazy：首次转写时启动） */
function ensureWorker(): ChildProcess {
  if (worker && !worker.killed) return worker
  worker = spawn('python3', [ASR_SCRIPT], {
    env: { ...process.env, HF_ENDPOINT: process.env.HF_ENDPOINT || 'https://hf-mirror.com' },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  workerReady = false
  let buf = ''
  worker.stdout?.on('data', (chunk: Buffer) => {
    buf += chunk.toString()
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let parsed: any = null
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        continue
      }
      const id = parsed?.id
      const resolver = id ? pending.get(id) : undefined
      if (resolver) {
        pending.delete(id)
        resolver(parsed)
      }
    }
  })
  worker.stderr?.on('data', (chunk: Buffer) => {
    const s = chunk.toString().trim()
    if (s.includes('model') && s.includes('loaded')) workerReady = true
  })
  worker.on('exit', () => {
    worker = null
    workerReady = false
    // 未决任务全部失败（worker 重启）
    for (const [, resolver] of pending) resolver({ error: 'asr worker exited' })
    pending.clear()
  })
  return worker
}

/** 转写一个 wav 文件（带 120s 超时） */
function transcribeWav(wavPath: string): Promise<{ text?: string; error?: string }> {
  const w = ensureWorker()
  const id = `t${++taskSeq}`
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      resolvePromise({ error: 'asr timeout' })
    }, 120_000)
    pending.set(id, (r) => {
      clearTimeout(timer)
      resolvePromise(r)
    })
    w.stdin?.write(JSON.stringify({ id, wav_path: wavPath }) + '\n')
  })
}

/** 音频 URL → 16k 单声道 wav 临时文件（ffmpeg） */
async function toWav(audioUrl: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'kl-asr-'))
  const src = join(dir, 'src.bin')
  const wav = join(dir, 'out.wav')
  const res = await fetch(audioUrl)
  if (!res.ok) throw new Error(`下载音频失败: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (!buf.length) throw new Error('音频为空')
  await writeFile(src, buf)
  await execFileP('ffmpeg', ['-y', '-i', src, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], { timeout: 60_000 })
  await unlink(src).catch(() => {})
  return wav
}

export const ASR_AVAILABLE = ASR_ENABLED

/**
 * 语音消息转文字（带缓存：同 messageId 不重复转写）
 * @param messageId 语音消息 ID（WuKongIM message_idstr）
 * @param audioUrl   音频 URL（绝对/相对都行，相对自动补 https://aigc.fushtn.com）
 * @returns 转写文本
 */
export async function transcribeVoice(messageId: string, audioUrl: string): Promise<string> {
  if (!ASR_ENABLED) throw new Error('语音转文字未启用（ASR_ENABLED=off）')
  const cached = await prisma.imVoiceTranscript.findUnique({ where: { messageId } })
  if (cached) return cached.text
  const abs = /^https?:\/\//.test(audioUrl) ? audioUrl : `https://aigc.fushtn.com${audioUrl.startsWith('/') ? audioUrl : '/' + audioUrl}`
  let wav = ''
  try {
    wav = await toWav(abs)
    const result = await transcribeWav(wav)
    if (result.error) throw new Error(result.error)
    const text = (result.text || '').trim()
    if (!text) {
      // 无人声/听不清：返回友好提示并缓存，避免重复转写
      await prisma.imVoiceTranscript.create({ data: { messageId, text: '（未识别到语音内容）' } })
      return '（未识别到语音内容）'
    }
    await prisma.imVoiceTranscript.create({ data: { messageId, text } })
    return text
  } finally {
    if (wav) rm(join(wav, '..'), { recursive: true, force: true }).catch(() => {})
  }
}
