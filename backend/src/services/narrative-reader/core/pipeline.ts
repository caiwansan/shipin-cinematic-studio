/**
 * pipeline.ts — Y.1 Pipeline Runner（主执行入口）
 *
 * 流程：
 * 1. 文本分块（chunk）
 * 2. 每块调 Gemma 3 270M 提取结构化信息
 * 3. JSON Guard 前置校验
 * 4. 通过校验 → 写入 EventLog + 计算 DriftSnapshot
 * 5. 未通过校验 → 记录错误，继续下一块
 *
 * ⚠️ 这是 Y.1 的核心入口，所有 narrative observation 都经过此 pipeline
 */

import { gemmaNarrativeReader, checkGemmaHealth } from './gemma-reader.js'
import { validateNarrativeJSON } from './validator.js'
import { writeEventLog } from '../storage/event_store.js'
import { computeDriftMetrics, persistDriftSnapshot } from '../observation/drift.js'
import { resolveEntities } from '../layer2/entity_resolver_v0.js'

let enabled = false

/**
 * 初始化（启动时检测 Gemma 服务是否可达）
 */
export async function initY1Pipeline(): Promise<boolean> {
  try {
    const healthy = await checkGemmaHealth()
    enabled = healthy
    if (healthy) {
      console.log('[Y1] Gemma 3 270M 就绪，Narrative Reader pipeline 已激活')
    } else {
      console.warn('[Y1] Gemma 3 270M 不可达，已静默降级')
    }
    return healthy
  } catch {
    enabled = false
    console.warn('[Y1] Gemma 3 270M 初始化失败，已静默降级')
    return false
  }
}

/**
 * 将文本分块（默认每块 800 字，100 字重叠）
 */
export function splitText(text: string, chunkSize = 600, overlap = 80): string[] {
  if (!text || text.length <= chunkSize) return [text || '']
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    start += chunkSize - overlap
  }
  return chunks
}

export interface Y1PipelineResult {
  totalChunks: number
  succeeded: number
  failed: number
  errors: string[]
}

/**
 * 主执行入口：对一段文本运行 Y.1 pipeline
 *
 * @param text — 小说正文
 * @param docId — 文档/项目 ID
 * @param chunkPrefix — chunk ID 前缀（如 "proj-xxx"）
 */
export async function runY1Pipeline(
  text: string,
  docId: string,
  chunkPrefix: string,
): Promise<Y1PipelineResult> {
  if (!enabled) {
    console.warn('[Y1] pipeline disabled (Gemma not available)')
    return { totalChunks: 0, succeeded: 0, failed: 0, errors: ['pipeline disabled'] }
  }

  const chunks = splitText(text)
  const result: Y1PipelineResult = { totalChunks: chunks.length, succeeded: 0, failed: 0, errors: [] }

  for (let i = 0; i < chunks.length; i++) {
    const chunkId = `${chunkPrefix}-p${i}`
    const chunk = chunks[i]

    try {
      // Step 1: 调 Gemma 3 270M
      const rawOutput = await gemmaNarrativeReader(chunk)

      // Step 2: 尝试解析 JSON（从 markdown 代码块提取）
      let parsed: any
      try { parsed = JSON.parse(rawOutput.trim()) } catch {
        const m = rawOutput.match(/```(?:json)?\s*([\s\S]+?)```/)
        if (m) { try { parsed = JSON.parse(m[1].trim()) } catch {} }
      }

      if (!parsed) {
        result.failed++
        result.errors.push(`chunk ${i}: JSON parse failed (raw: ${rawOutput.slice(0, 150)}...)`)
        continue
      }

      // Step 3: JSON Guard 前置校验
      const validation = validateNarrativeJSON(parsed)
      if (!validation.valid || !validation.data) {
        result.failed++
        result.errors.push(`chunk ${i}: validation failed: ${validation.errors.join('; ')}`)
        continue
      }

      // Step 4: 写入 EventLog（唯一 truth layer）
      const metrics = computeDriftMetrics(validation.data)
      const resolved = await resolveEntities(validation.data.events, docId, chunkId)
      await writeEventLog({
        doc_id: docId,
        chunk_id: chunkId,
        entities: validation.data.entities,
        events: validation.data.events,
        relations: validation.data.relations,
        summary_state: validation.data.summary_state,
        resolved_entities: resolved,
        metrics,
      })

      // Step 5: 写入 DriftSnapshot
      await persistDriftSnapshot({ doc_id: docId, chunk_id: chunkId, metrics })

      result.succeeded++
    } catch (e: any) {
      result.failed++
      result.errors.push(`chunk ${i}: ${e?.message || 'unknown error'}`)
    }
  }

  console.log(`[Y1] pipeline done: ${result.succeeded}/${result.totalChunks} chunks OK, ${result.failed} failed`)
  return result
}
