// vosk-model.service.ts — Vosk 世界语言池模型保障（RTC-INTERPRETER-03）
// 按需懒下载：语言首次使用 → 检查模型目录 → 缺失则下载 zip + 解压 + 校验
// 下载源 alphacephei.com（200 OK 已验证）；后台预取常用语言（zh/en/es/ru 已就位）
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const execFileAsync = promisify(execFile)

export const VOSK_MODELS: Record<string, string> = {
  zh: 'vosk-model-small-cn-0.22',
  en: 'vosk-model-small-en-us-0.15',
  es: 'vosk-model-small-es-0.42',
  ru: 'vosk-model-small-ru-0.22',
  fr: 'vosk-model-small-fr-0.22',
  de: 'vosk-model-small-de-0.15',
  ja: 'vosk-model-small-ja-0.22',
  ko: 'vosk-model-small-ko-0.22',
  pt: 'vosk-model-small-pt-0.3',
  it: 'vosk-model-small-it-0.22',
  ar: 'vosk-model-small-ar-0.3',
  vi: 'vosk-model-small-vi-0.3',
  tr: 'vosk-model-small-tr-0.3',
  nl: 'vosk-model-small-nl-0.22',
  pl: 'vosk-model-small-pl-0.22',
  hi: 'vosk-model-small-hi-0.22',
  uk: 'vosk-model-small-uk-v3-small',
  fa: 'vosk-model-small-fa-0.5',
}

const MODELS_DIR = resolve(process.cwd(), '../models/vosk')
const BASE_URL = 'https://alphacephei.com/vosk/models'

// 每语言一个下载 Promise（并发去重）
const downloads = new Map<string, Promise<void>>()
const prefetchQueue: string[] = []

function modelDir(lang: string): string {
  return resolve(MODELS_DIR, VOSK_MODELS[lang] || '')
}

export function voskModelReady(lang: string): boolean {
  const dir = modelDir(lang)
  return existsSync(dir) && readdirSyncSafe(dir).length > 0
}

function readdirSyncSafe(dir: string): string[] {
  try { return readdirSync(dir) } catch { return [] }
}

/** 确保某语言模型就位（缺失 → 下载解压） */
export async function ensureVoskModel(lang: string): Promise<void> {
  if (!VOSK_MODELS[lang]) throw new Error(`Vosk 不支持语言: ${lang}`)
  if (voskModelReady(lang)) return
  const existing = downloads.get(lang)
  if (existing) return existing
  const p = downloadModel(lang)
  downloads.set(lang, p)
  try { await p } finally { downloads.delete(lang) }
}

async function downloadModel(lang: string): Promise<void> {
  const model = VOSK_MODELS[lang]
  const dir = modelDir(lang)
  await mkdir(MODELS_DIR, { recursive: true })
  const zipPath = resolve(MODELS_DIR, `${model}.zip`)
  const url = `${BASE_URL}/${model}.zip`
  console.log(`[vosk-model] 下载 ${model} (${lang}) ...`)
  const t0 = Date.now()
  // curl 断点续传 + 失败重试（模型 40-60MB，网络不稳）
  let lastErr: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await execFileAsync('curl', ['-sSL', '-C', '-', '-o', zipPath, url], { timeout: 600_000 })
      lastErr = null
      break
    } catch (e: any) { lastErr = e }
  }
  if (lastErr) {
    rmSync(zipPath, { force: true })
    throw lastErr
  }
  // 解压（zip 内含顶层模型目录）
  await execFileAsync('unzip', ['-q', '-o', zipPath, '-d', MODELS_DIR], { timeout: 300_000 })
  rmSync(zipPath, { force: true })
  // 校验：模型目录含 am/final 等
  const entries = readdirSyncSafe(dir)
  if (!entries.some((e: string) => e === 'am' || e === 'conf') && entries.length === 0) {
    throw new Error(`${model} 解压后目录异常`)
  }
  console.log(`[vosk-model] ${model} 就绪 (${((Date.now() - t0) / 1000).toFixed(1)}s, ${entries.length} 项)`)
}

/** 后台预取（不阻塞启动）：常用语言池逐个下载 */
export function prefetchVoskModels(langs: string[]): void {
  for (const lang of langs) {
    if (voskModelReady(lang)) continue
    if (prefetchQueue.includes(lang)) continue
    prefetchQueue.push(lang)
    ensureVoskModel(lang)
      .then(() => console.log(`[vosk-model] 预取完成: ${lang}`))
      .catch((e: any) => console.warn(`[vosk-model] 预取失败 ${lang}: ${e?.message}`))
  }
}

/** 语言池支持校验（网关用） */
export function voskSupports(lang: string): boolean {
  return !!VOSK_MODELS[lang]
}
