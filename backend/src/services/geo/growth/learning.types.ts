// Signal Provider 接口
export interface SignalProvider {
  name: string
  source: string
  supports(industry?: string, optimizationType?: string): boolean
  collect(projectId: string): Promise<RawSignal[]>
}

// 原始信号（来自各数据源）
export interface RawSignal {
  signalType: string
  originalValue: number
  industry?: string
  optimizationType?: string
  reason?: string
  evidence?: Record<string, any>
  sourceRecordId?: string
}

// 归一化后的学习信号
export interface LearningSignalDTO {
  id: string
  source: string
  signalType: string
  originalValue: number
  normalizedValue: number
  weight: number
  weightedValue: number
  industry?: string
  optimizationType?: string
  reason?: string
  executionId?: string
  generatedAt: Date
}

// 推荐信号（输出给 Recommendation Engine）
export interface RecommendationSignal {
  type: string
  weight: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  reason: string
  evidence: string
  sampleSize: number
  successRate?: number
  averageDelta?: number
  learningVersion: string
}

// Explainability
export interface LearningExplain {
  signalId: string
  signalType: string
  why: string
  evidence: string
  confidence: string
  source: string
  sampleSize: number
  successRate?: number
  signals: LearningSignalDTO[]
  learningVersion: string
  generatedAt: Date
}

// Learning 状态
export const LearningStatus = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const
export type LearningStatus = (typeof LearningStatus)[keyof typeof LearningStatus]
