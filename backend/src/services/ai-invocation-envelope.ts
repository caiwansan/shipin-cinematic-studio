/**
 * B1-1 AI Invocation Envelope — 每次 AI 调用的审计信封
 *
 * 规则：
 *   - 创建后不可变
 *   - 涉及资产时必绑 AssetVersion
 *   - traceId 必须向下传播
 */

export type AgentType =
  | 'orchestrator'
  | 'character_agent'
  | 'scene_agent'
  | 'storyboard_agent'
  | 'optimization_agent'
  | 'routing_agent'
  | 'lyrics-composer'
  | 'audio-engineer'

export interface AIInvocationEnvelope {
  traceId: string
  parentTraceId?: string

  userId: string
  projectId: string
  assetRegistryId?: string
  assetVersionId?: string

  agentType: AgentType

  model: {
    provider: string
    modelName: string
  }

  input: any
  output?: any

  timestamps: {
    start: number
    end?: number
  }

  status?: 'pending' | 'success' | 'error'
  error?: string
  latencyMs?: number
}

export function createEnvelope(params: {
  userId: string
  projectId: string
  agentType: AgentType
  provider: string
  modelName: string
  input: any
  assetRegistryId?: string
  assetVersionId?: string
  parentTraceId?: string
}): AIInvocationEnvelope {
  return {
    traceId: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    parentTraceId: params.parentTraceId,
    userId: params.userId,
    projectId: params.projectId,
    assetRegistryId: params.assetRegistryId,
    assetVersionId: params.assetVersionId,
    agentType: params.agentType,
    model: {
      provider: params.provider,
      modelName: params.modelName,
    },
    input: params.input,
    timestamps: {
      start: Date.now(),
    },
    status: 'pending',
  }
}

export function completeEnvelope(
  envelope: AIInvocationEnvelope,
  output: any,
): AIInvocationEnvelope {
  return {
    ...envelope,
    output,
    status: 'success',
    timestamps: { ...envelope.timestamps, end: Date.now() },
    latencyMs: Date.now() - envelope.timestamps.start,
  }
}

export function failEnvelope(
  envelope: AIInvocationEnvelope,
  error: string,
): AIInvocationEnvelope {
  return {
    ...envelope,
    error,
    status: 'error',
    timestamps: { ...envelope.timestamps, end: Date.now() },
    latencyMs: Date.now() - envelope.timestamps.start,
  }
}
