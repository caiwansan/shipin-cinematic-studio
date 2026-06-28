/**
 * config-runtime/types.ts
 *
 * Config Sovereignty Layer — 单一配置主权系统
 * 所有配置类型定义集中在此
 */

export interface SystemConfigSnapshot {
  cryptoEncryptionKey: string
  envSource: 'ecosystem' | 'shell' | 'runtime_freeze'
  createdAt: string
  frozen: boolean
}

export interface UserLLMConfig {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  source: 'V2_DB' | 'V2_FALLBACK' | 'ENV_FALLBACK'
}

export interface RuntimeConfigContext {
  system: SystemConfigSnapshot
  user?: UserLLMConfig
  requestId: string
}

/**
 * V2 DB 行结构（UserModelConfigV2 表的实际字段映射）
 * 仅用于内部 resolver，不 export
 */
export interface V2DbRecord {
  userId: string
  llmProvider: string | null
  llmApiKey: string | null  // 加密状态
  llmModel: string | null
  llmEnabled: boolean | null
  imageProvider: string | null
  imageApiKey: string | null
  imageModel: string | null
  imageEnabled: boolean | null
  videoProvider: string | null
  videoApiKey: string | null
  videoModel: string | null
  videoEnabled: boolean | null
  ttsProvider: string | null
  ttsApiKey: string | null
  ttsModel: string | null
  ttsEnabled: boolean | null
  baseUrl: string | null
}
