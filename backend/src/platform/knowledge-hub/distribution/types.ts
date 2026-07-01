// ════════════════════════════════════════════════════════════
// KH4-T003/T004/T005 — Core Types
// ════════════════════════════════════════════════════════════

export interface DistributionPlan {
  id: string
  packageId: string
  targets: string[]
  createdAt: string
}

export interface DistributionTask {
  id: string
  planId: string
  target: string
  packageId: string
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped'
  artifactUrls: string[]
  error: string | null
  startedAt: string | null
  completedAt: string | null
}

export interface DistributionResult {
  packageId: string
  planId: string
  targets: string[]
  artifacts: { target: string; url: string }[]
  duration: number // ms
  status: 'succeeded' | 'partial' | 'failed'
  errors: { target: string; error: string }[]
}

export type DistributionTargetCapability =
  | 'supports_preview'
  | 'supports_incremental'
  | 'supports_rollback'
  | 'supports_batch'
  | 'supports_verification'

export interface DistributionTarget {
  name: string
  type: string
  capabilities: DistributionTargetCapability[]
  execute(packageId: string, planId: string): Promise<{
    success: boolean
    artifactUrl?: string
    error?: string
  }>
}
