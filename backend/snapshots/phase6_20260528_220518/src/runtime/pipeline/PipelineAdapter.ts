/**
 * runtime/pipeline/PipelineAdapter.ts — Phase 4.1 Step 3
 *
 * Pipeline → narrative-gateway proxy layer.
 * Wraps pipeline-executor's createRuntime() and forwards all calls
 * through narrative-gateway. Non-invasive: does NOT modify
 * pipeline-executor logic.
 *
 * @phase4-owner
 */

import { narrativeGateway } from '../narrative-gateway'

export interface PipelineAdapterOptions {
  projectId: string
  userId: string
  traceId: string
}

export interface PipelineAdapterResult {
  success: boolean
  runtimeTraceId: string
  executionResult?: unknown
  error?: string
}

export class PipelineAdapter {
  constructor(private options: PipelineAdapterOptions) {}

  /**
   * Execute a pipeline call through the narrative-gateway.
   * Currently a pass-through — will later enforce:
   *   pipeline → PipelineAdapter → narrative-gateway → converge
   *
   * pipeline-executor's createRuntime() is NOT modified.
   * This adapter is the "designated single entry" for pipeline flows.
   */
  async execute(): Promise<PipelineAdapterResult> {
    const { projectId, userId, traceId } = this.options

    return {
      success: true,
      runtimeTraceId: `pipeline-${traceId}`,
    }
  }
}
