// ⭐ Agent Output Snapshot — 每个 Agent 的完整审计快照

import { AGENT_SCHEMA_VERSIONS } from './registry'

export interface AgentOutputSnapshot {
  agentName: string
  phase: number
  schemaVersion: string
  rawPrompt: string
  rawOutput: string
  parsedOutput: any
  normalizedOutput: any
  validationErrors: string[]
  schemaMode: 'warn' | 'fail'
  latencyMs: number
  retries: number
  timestamp: string
}

export interface SnapshotParams {
  agentName: string
  phase: number
  rawPrompt: string
  rawOutput: string
  parsedOutput: any
  normalizedOutput: any
  validationErrors: string[]
  schemaMode: 'warn' | 'fail'
  latencyMs: number
  retries: number
}

export function captureSnapshot(params: SnapshotParams): AgentOutputSnapshot {
  return {
    ...params,
    schemaVersion: AGENT_SCHEMA_VERSIONS[params.agentName] || '0.0',
    timestamp: new Date().toISOString(),
  }
}
