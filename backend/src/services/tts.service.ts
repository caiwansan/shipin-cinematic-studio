// tts.service.ts — 语音同传 TTS 服务（RTC-INTERPRETER-03）
// edge-tts（微软神经语音，免费、100+ 语言）→ mp3；缓存 + 长句分句 + 并发限制
// 失败降级：synthesizeSegments 抛错 → 网关仅推字幕（语音是增强，字幕是底线）
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, unlink, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { ttsVoiceFor as catalogTtsVoice } from './interp-langs.js'

const execFileAsync = promisify(execFile)

// ── 语言 → 音色（edge-tts 神经语音；74 语种，SSOT 在 interp-langs.ts）──
// 无音色语种（27 个，含闽南语）→ ttsVoiceFor 返回 undefined → synthesize 抛错 → 网关降级仅字幕
export function ttsVoiceFor(lang: string): string | undefined {
  return catalogTtsVoice(lang)
}

// 缓存：lang:sha1(text) → mp3 Buffer（LRU，最多 300 条 ≈ 几十 MB）
const CACHE = new Map<string, Buffer>()
const CACHE_MAX = 300
function cacheKey(lang: string, text: string) {
  return `${lang}:${createHash('sha1').update(text).digest('hex')}`
}

// 并发信号量：同时最多 2 个 edge-tts 进程（防打爆微软服务/CPU）
let inflight = 0
const waiters: Array<() => void> = []
async function acquire() {
  if (inflight < 2) { inflight++; return }
  await new Promise<void>((r) => waiters.push(r))
  inflight++
}
function release() {
  inflight--
  waiters.shift()?.()
}

let tmpDir: string | null = null
async function ensureTmp() {
  if (!tmpDir) {
    tmpDir = resolve(process.cwd(), '.tmp-tts')
    await mkdir(tmpDir, { recursive: true })
  }
  return tmpDir
}

/** 单段合成：text → mp3 Buffer（缓存命中直返） */
async function synthesize(text: string, lang: string): Promise<Buffer> {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) throw new Error('empty text')
  const voice = ttsVoiceFor(lang)
  if (!voice) throw new Error(`该语种无 TTS 音色（${lang}），降级仅字幕`)
  const key = cacheKey(lang, clean)
  const hit = CACHE.get(key)
  if (hit) { CACHE.delete(key); CACHE.set(key, hit); return hit } // LRU touch

  await acquire()
  const dir = await ensureTmp()
  const outFile = resolve(dir, `tts-${createHash('sha1').update(`${lang}:${clean}`).digest('hex').slice(0, 16)}.mp3`)
  try {
    await execFileAsync('edge-tts', ['--voice', voice, '--text', clean, '--write-media', outFile], { timeout: 20_000 })
    const buf = await readFile(outFile)
    if (!buf.length) throw new Error('edge-tts 返回空音频')
    if (CACHE.size >= CACHE_MAX) {
      const first = CACHE.keys().next().value
      if (first !== undefined) CACHE.delete(first)
    }
    CACHE.set(key, buf)
    return buf
  } finally {
    release()
    unlink(outFile).catch(() => { /* 已删 */ })
  }
}

/** 长句分句：按标点切 ≤60 字符段（避免合成超长句卡顿，先出的段先播） */
export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const MAX = 60
  const out: string[] = []
  let buf = ''
  const flush = () => {
    const s = buf.trim()
    if (s) out.push(s)
    buf = ''
  }
  for (const ch of clean) {
    buf += ch
    if (buf.length >= MAX || /[。！？；.!?;，,]/.test(ch)) flush()
  }
  flush()
  return out
}

export interface TtsSegment {
  text: string
  audioB64: string
}

/** 整句 → 分句逐段合成（串行，天然有序） */
export async function synthesizeSegments(text: string, lang: string): Promise<TtsSegment[]> {
  const parts = splitSentences(text)
  if (!parts.length) return []
  const segs: TtsSegment[] = []
  for (const p of parts) {
    const buf = await synthesize(p, lang)
    segs.push({ text: p, audioB64: buf.toString('base64') })
  }
  return segs
}

/** 仅 TTS 文本可用性（语言池校验用） */
export function ttsSupports(lang: string): boolean {
  return !!ttsVoiceFor(lang)
}
