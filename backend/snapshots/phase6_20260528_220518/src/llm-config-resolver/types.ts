// llm-config-resolver/types.ts
// Config Priority DAG — 唯一决策顺序定义

export const CONFIG_PRIORITY_DAG = [
  "REQUEST_OVERRIDE",   // API runtime override（最高）
  "USER_DB_V2",          // UserModelConfigV2（唯一可信DB）
  "ENV_BOOTSTRAP",       // ENV（只作为 fallback）
  "USER_DB_V1_LEGACY",   // deprecated
  "HARDCODE_FALLBACK",   // 最低兜底
] as const

export type ConfigLayer = (typeof CONFIG_PRIORITY_DAG)[number]

export interface ConfigCandidate {
  apiKey: string
  model?: string
  baseUrl?: string
  provider?: string
  source?: ConfigLayer
}

export interface TraceEntry {
  layer: ConfigLayer
  provider: string
  hit: boolean
  hasKey: boolean
  model: string | null
  ts: number
  reason?: string
}

export interface ShadowAlert {
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  detail?: string
}

export interface ResolveResult {
  config: ConfigCandidate | null
  trace: TraceEntry[]
  shadow: {
    hasShadow: boolean
    shadows: ShadowAlert[]
  }
}

export interface ResolveContext {
  provider: string
  runtimeOverride?: Record<string, { apiKey: string; model?: string; baseUrl?: string }>
  dbV2?: Record<string, { apiKey: string; model?: string; baseUrl?: string }>
  dbV1?: Record<string, { apiKey: string; model?: string; baseUrl?: string }>
  env?: Record<string, { apiKey: string; model?: string; baseUrl?: string }>
}
