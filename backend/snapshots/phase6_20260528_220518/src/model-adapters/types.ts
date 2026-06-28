/**
 * model-adapters/types.ts — 模型适配器矩阵类型定义
 *
 * Phase 1-C: 所有适配器必须显式接收 RuntimePayload，
 * 禁止偷取 getRuntimeContext() 或 process.env。
 */

import type { RuntimePayload } from '../runtime/runtime-payload.js'

// ── 统一输入参数 ──

export interface ModelAdapterInput {
  /** 模型名，如 wan2.7-i2v, doubao-seedream-4-5, gpt-4o */
  model: string

  /** 用户的 API Key（已解密），从 runtime.apiKey 传入 */
  apiKey?: string

  /** 用户自定义 baseUrl（自定义端点用） */
  baseUrl?: string

  /** 提示词 / 文本 */
  prompt?: string
  /** 系统提示词（LLM 用） */
  systemPrompt?: string
  /** 用户消息（LLM 用） */
  userMessage?: string
  /** 负面提示词 */
  negativePrompt?: string

  /** 图片相关 */
  imageUrl?: string
  imageUrl2?: string
  referenceImages?: string[]
  /** 图生图模式 */
  mode?: string

  /** 视频相关 */
  duration?: number
  ratio?: string
  aspectRatio?: string
  audioUrl?: string
  shotType?: string
  r2vMedia?: Array<{ type: string; url: string; reference_voice?: string }>

  /** TTS 相关 */
  voiceId?: string
  speed?: number
  format?: string
  text?: string

  /** 通用参数 */
  size?: string
  n?: number
  temperature?: number
  maxTokens?: number
  seed?: number

  /** 扩展字段 */
  [key: string]: unknown
}

// ── 统一输出 ──

export interface ModelAdapterResult {
  /** 图片/视频 URL（生成类任务） */
  url?: string
  /** 图片 URL 别名 */
  imageUrl?: string
  /** LLM 文本响应 */
  content?: string
  /** 异步任务 ID（任务需轮询） */
  taskId?: string
  /** 生成 seed */
  seed?: number
  /** 生成耗时（秒） */
  duration?: number
  /** 图片分辨率 */
  resolution?: string
  /** 消耗 Token 数 */
  totalTokens?: number
  /** 修正后的 prompt */
  revised_prompt?: string
  /** 使用的 provider */
  provider?: string
  /** 原生响应全文 */
  raw?: any
  [key: string]: unknown
}

/**
 * 模型适配器组件协议（Phase 1-C）
 * execute(runtime, input) — 显式接收 RuntimePayload
 * 禁止调用 getRuntimeContext() 或读取 process.env
 */
export interface ModelAdapter {
  /** 适配器名称，用于注册和日志 */
  name: string

  /** 支持的模型列表（模型名前缀或完整模型名） */
  supportedModels: string[]

  /** 支持的 taskType */
  taskTypes: ('llm' | 'image' | 'video' | 'tts')[]

  /** 适配的 provider（用于 fallback 兼容） */
  provider: string

  /**
   * 核心调用方法（Phase 1-C）
   * @param runtime 显式 RuntimePayload（userId, apiKey, model, provider...）
   * @param input 业务输入参数
   * @returns 统一输出
   */
  execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult>
}

// ── 注册表条目 ──

export interface AdapterEntry {
  adapter: ModelAdapter
  /** 模型名前缀 → 适配器映射 */
  prefixes: string[]
}
