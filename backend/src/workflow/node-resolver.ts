/**
 * workflow/node-resolver.ts — 根据节点类型自动匹配 User Config V2
 *
 * 核心规则：
 *   ❌ Workflow 不选 provider
 *   ✔ Provider 只来自 User Config V2
 *   ✔ LLM 只用于文本转换
 *
 * 映射表：
 *   llm.optimize   → userConfig.llmProvider + llmApiKey + llmModel
 *   image.generate → userConfig.imageProvider + imageApiKey + imageModel
 *   video.generate → userConfig.videoProvider + videoApiKey + videoModel
 *   tts.generate   → userConfig.ttsProvider + ttsApiKey + ttsModel
 */

import type { WorkflowNodeType } from './types.js'

/** User Config V2 的扁平结构 */
export interface UserModelConfigV2Flat {
  llmProvider: string
  llmApiKey: string
  llmModel: string
  imageProvider: string
  imageApiKey: string
  imageModel: string
  videoProvider: string
  videoApiKey: string
  videoModel: string
  ttsProvider: string
  ttsApiKey: string
  ttsModel: string
}

/** 解析结果：适配器执行所需的参数 */
export interface ResolvedExecutionParams {
  provider: string
  apiKey: string
  model: string
  taskType: 'llm' | 'image' | 'video' | 'tts'
}

const TYPE_TO_CONFIG_KEY: Record<WorkflowNodeType, {
  providerKey: keyof UserModelConfigV2Flat
  apiKeyKey: keyof UserModelConfigV2Flat
  modelKey: keyof UserModelConfigV2Flat
  taskType: 'llm' | 'image' | 'video' | 'tts'
}> = {
  'llm.optimize':   { providerKey: 'llmProvider',   apiKeyKey: 'llmApiKey',   modelKey: 'llmModel',   taskType: 'llm' },
  'image.generate': { providerKey: 'imageProvider', apiKeyKey: 'imageApiKey', modelKey: 'imageModel', taskType: 'image' },
  'video.generate': { providerKey: 'videoProvider', apiKeyKey: 'videoApiKey', modelKey: 'videoModel', taskType: 'video' },
  'tts.generate':   { providerKey: 'ttsProvider',   apiKeyKey: 'ttsApiKey',   modelKey: 'ttsModel',   taskType: 'tts' },
  'manual.confirm': null!, // 无 Provider 映射
}

/**
 * 从 User Config V2 中解析出适配器执行所需的参数
 *
 * @throws 如果节点类型不需要 Provider 或配置不完整
 */
export function resolveNodeExecutionParams(
  type: WorkflowNodeType,
  userConfig: UserModelConfigV2Flat,
): ResolvedExecutionParams | null {
  if (type === 'manual.confirm') return null

  const mapping = TYPE_TO_CONFIG_KEY[type]
  if (!mapping) {
    throw new Error(`[Workflow] 未知节点类型: ${type}`)
  }

  const provider = userConfig[mapping.providerKey] as string
  const apiKey = userConfig[mapping.apiKeyKey] as string
  const model = userConfig[mapping.modelKey] as string

  if (!provider || !apiKey) {
    throw new Error(`[Workflow] 节点 ${type} 的 Provider 配置不完整（provider=${provider}, apiKey=${!!apiKey}）`)
  }

  return { provider, apiKey, model: model || '', taskType: mapping.taskType }
}
