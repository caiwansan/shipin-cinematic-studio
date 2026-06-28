/**
 * Phase B — Shadow Compiler Logger
 *
 * 在旧路由中嵌入 Shadow Mode，编译新 pipeline 但不影响用户输出。
 * 仅记录 diff 供后续比较。
 *
 * Phase 0: 静默运行，只记录
 * Phase 1: 双写（记录 diff）
 * Phase 2: 不计日志（流量已灰度）
 * Phase 3: 删除此文件
 */

import { buildAndInjectShotIR } from './shotir-compiler.js'
import { compileVideo } from './video-compiler.js'
import type { PromptIR, CompileResult } from '../types/promptIR.js'
import * as fs from 'fs'
import * as path from 'path'

export { buildAndInjectShotIR }

const LOG_DIR = path.resolve(process.cwd(), 'logs', 'shadow-compare')

// 确保日志目录存在
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

/**
 * 计算两个输出之间的 diff score (0 = 完全一致, 1 = 完全不同)
 */
function computeDiffScore(
  legacyOutput: any,
  compilerOutput: any
): { diffScore: number; diffFields: string[] } {
  const diffFields: string[] = []

  // 比较 spec.camera
  if (legacyOutput?.spec?.camera?.shot_type !== compilerOutput?.spec?.camera?.shot_type) {
    diffFields.push('camera.shot_type')
  }

  // 比较 prompt 长度
  const lenDiff = Math.abs(
    (legacyOutput?.data?.prompt || '').length - (compilerOutput.prompt || '').length
  )
  if (lenDiff > 50) {
    diffFields.push(`prompt.length_diff=${lenDiff}`)
  }

  const score = diffFields.length === 0 ? 0 : Math.min(diffFields.length / 5, 1)
  return { diffScore: score, diffFields }
}

/**
 * Shadow 模式编译调用。
 * 新 compiler 同时运行，结果仅记录到日志文件，不影响旧系统输出。
 *
 * @param legacyResult — 旧系统输出（将要返回给用户的）
 * @param promptIR — 输入 PromptIR（转发给新 compiler）
 * @returns — 原封返回 legacyResult（不修改）
 */
export async function shadowCompile(
  legacyResult: any,
  promptIR: PromptIR | any
): Promise<any> {
  try {
    const logDir = LOG_DIR
    ensureLogDir()

    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)

    // 运行新 compiler（不抛异常——shadow 失败不应影响旧系统）
    // Phase E1.5: Build ShotIR first, then compile
    const { promptIR: enriched } = await buildAndInjectShotIR(promptIR, { enablePolish: false })
    const compilerResult = compileVideo(enriched)

    // 计算 diff
    const { diffScore, diffFields } = computeDiffScore(legacyResult, compilerResult)

    // 构建日志条目
    const entry = {
      timestamp: now.toISOString(),
      diffScore,
      diffFields,
      promptIR: sanitizeForLog(promptIR),
      legacyOutput: sanitizeForLog(legacyResult),
      compilerOutput: {
        spec: compilerResult.spec,
        prompt: compilerResult.prompt.slice(0, 500),
        shotCount: compilerResult.scores?.shotCount || 0,
        traceId: compilerResult.trace?.traceId,
      },
    }

    // 追加写入日志（JSONL 格式）
    const logPath = path.join(logDir, `${dateStr}.jsonl`)
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf-8')

    // 每 50 条记录一次统计摘要
    const statsPath = path.join(logDir, '_stats.json')
    const currentStats = readStats(statsPath)
    currentStats.totalRuns++
    currentStats.zeroDiffRuns += diffScore === 0 ? 1 : 0
    currentStats.diffScores.push(diffScore)
    // 保留最近 1000 条 diff scores
    if (currentStats.diffScores.length > 1000) {
      currentStats.diffScores = currentStats.diffScores.slice(-1000)
    }
    currentStats.lastRun = now.toISOString()
    fs.writeFileSync(statsPath, JSON.stringify(currentStats, null, 2), 'utf-8')

    if (diffScore > 0.5) {
      console.log(`[shadow-compile] ⚠️ high diff=${diffScore.toFixed(3)} fields=${diffFields.join(',')}`)
    }
  } catch (err: any) {
    console.warn('[shadow-compile] ⚠️ shadow error:', err.message)
    // ▸ Shadow 模式失败不应影响旧系统
  }

  return legacyResult
}

function sanitizeForLog(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  const clone = JSON.parse(JSON.stringify(obj))
  // 清理大字符串（保留前 500 字符）
  if (typeof clone.prompt === 'string' && clone.prompt.length > 500) {
    clone.prompt = clone.prompt.slice(0, 500) + '...'
  }
  return clone
}

function readStats(path: string): any {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf-8'))
  } catch {
    return { totalRuns: 0, zeroDiffRuns: 0, diffScores: [], lastRun: null }
  }
}
