// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 1 — Publish Pipeline Stubs
// ════════════════════════════════════════════════════════════
// Node stubs for the future publish pipeline.
// K4 RC2 only reserves the nodes. Full implementation in K4 RC2.5.
//
// Pipeline: Package → Prepare → Preview → Deliver → Verify → Publish Complete
// ════════════════════════════════════════════════════════════

export enum PublishStage {
  Package = 'package',
  Prepare = 'prepare',
  Preview = 'preview',
  Deliver = 'deliver',
  Verify = 'verify',
  Complete = 'complete',
  Failed = 'failed',
  RolledBack = 'rolled_back',
}

export interface PublishPipelineState {
  jobId: string
  packageIds: string[]
  targetId: string
  currentStage: PublishStage
  stages: Record<PublishStage, {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
    startedAt?: string
    completedAt?: string
    result?: any
    error?: string
  }>
}

export class PublishPipeline {
  /**
   * Create an empty pipeline state for a delivery job.
   * This is a stub — full implementation in K4 RC2.5.
   */
  createState(jobId: string, packageIds: string[], targetId: string): PublishPipelineState {
    const stages: any = {}
    for (const stage of Object.values(PublishStage)) {
      stages[stage] = { status: 'pending' }
    }
    return {
      jobId,
      packageIds,
      targetId,
      currentStage: PublishStage.Package,
      stages,
    }
  }

  /**
   * Stub: will provide a preview URL in RC2.5.
   */
  async getPreviewUrl(packageId: string): Promise<string | null> {
    // K4 RC2: reserved, returns null
    return null
  }
}
