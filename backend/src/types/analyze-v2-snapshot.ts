import type { NarrativeSpec } from './narrative-schema'

export interface AnalyzeV2Snapshot {
  version: 'v2'
  createdAt: string
  rawAiResponse: unknown
  normalized: NarrativeSpec
  parserMeta: {
    parserVersion: string
    repaired: boolean
    heuristicFallbackUsed: boolean
  }
  executionMeta: {
    model: string
    latency: number
    tokens?: number
  }
}
