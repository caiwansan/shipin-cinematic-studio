/**
 * closure/spcl/plan-embedding.ts — SPCL Plan向量化
 *
 * 将 ExecutionPlan 映射到三维语义空间：
 *   intent_vector       — 想做什么
 *   capability_vector   — 用什么能力
 *   execution_shape_vector — 怎么执行
 */

import type { ExecutionPlan } from '../sedp-compiler.js'

export interface PlanEmbedding {
  planId: string
  intent_vector: number[]
  capability_vector: number[]
  execution_shape_vector: number[]
}

/**
 * 从 plan 信息生成嵌入向量
 */
export function embedPlan(plan: ExecutionPlan): PlanEmbedding {
  const intent = encodeIntent(plan)
  const capability = encodeCapability(plan)
  const shape = encodeShape(plan)

  return {
    planId: plan.planId,
    intent_vector: intent,
    capability_vector: capability,
    execution_shape_vector: shape,
  }
}

/**
 * Intent 维度: [llm, image, video, tts, boot, orchestration]
 */
function encodeIntent(plan: ExecutionPlan): number[] {
  const vec = [0, 0, 0, 0, 0, 0]
  const id = plan.planId.toLowerCase()

  if (id.includes('llm')) vec[0] = 1
  if (id.includes('image')) vec[1] = 1
  if (id.includes('video')) vec[2] = 1
  if (id.includes('tts')) vec[3] = 1
  if (id.includes('boot')) vec[4] = 1

  if (vec.slice(0, 4).filter(v => v > 0).length > 1) vec[5] = 1

  return vec
}

/**
 * Capability 维度: [text_gen, image_gen, video_gen, speech_gen, event_sink, arbitration]
 */
function encodeCapability(plan: ExecutionPlan): number[] {
  const vec = [0, 0, 0, 0, 0, 0]
  const labels = plan.steps.map(s => s.label.toLowerCase())

  if (labels.some(l => l.includes('llm') || l.includes('openai') || l.includes('volcengine') || l.includes('aliyun'))) vec[0] = 1
  if (labels.some(l => l.includes('image') || l.includes('qwen') || l.includes('wan') || l.includes('dalle'))) vec[1] = 1
  if (labels.some(l => l.includes('video'))) vec[2] = 1
  if (labels.some(l => l.includes('tts') || l.includes('speech'))) vec[3] = 1
  if (labels.some(l => l.includes('event'))) vec[4] = 1
  if (labels.some(l => l.includes('truth') || l.includes('arbitration'))) vec[5] = 1

  return vec
}

/**
 * Shape 维度: [step_count, has_postprocess, has_event_sink, has_arbitration, is_boot]
 */
function encodeShape(plan: ExecutionPlan): number[] {
  const stepCount = plan.steps.length
  const labels = plan.steps.map(s => s.label.toLowerCase())

  return [
    Math.min(stepCount / 10, 1),        // normalized step count
    labels.some(l => l.includes('post')) ? 1 : 0,
    labels.some(l => l.includes('event')) ? 1 : 0,
    labels.some(l => l.includes('truth') || l.includes('arbitration')) ? 1 : 0,
    plan.planId.includes('boot') ? 1 : 0,
  ]
}

/**
 * 计算两个向量的余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0)
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0))
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0))
  if (magA === 0 || magB === 0) return 0
  return dot / (magA * magB)
}

/**
 * 计算两个 plan 的语义距离（1 - 加权相似度）
 */
export function planDistance(a: PlanEmbedding, b: PlanEmbedding): number {
  const w1 = 0.4, w2 = 0.35, w3 = 0.25
  const sim =
    w1 * cosineSimilarity(a.intent_vector, b.intent_vector) +
    w2 * cosineSimilarity(a.capability_vector, b.capability_vector) +
    w3 * cosineSimilarity(a.execution_shape_vector, b.execution_shape_vector)

  return 1 - sim
}
