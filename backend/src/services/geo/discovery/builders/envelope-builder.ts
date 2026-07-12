// ============================================================
// EnvelopeBuilder — DiscoveryResult → DiscoveryEnvelope
// Builder 拆成两个：
//   DiscoveryResultBuilder: Context → Result（纯数据）
//   EnvelopeBuilder: Result + 执行信息 → Envelope（API 包装）
// ============================================================

import type { DiscoveryEnvelope, EnvelopeDiagnostics, StageDiagnostics, ExecutionInfo } from '../../domain/discovery-envelope'
import type { DiscoveryResult } from '../../domain/discovery-result'
import type { DiscoveryContext } from '../../domain/discovery-context'

export class EnvelopeBuilder {
  build(
    result: DiscoveryResult,
    ctx: DiscoveryContext,
    executionId: string,
    providerTokens: Record<string, number>,
    providerLatencyMs: Record<string, number>,
    retries: number,
  ): DiscoveryEnvelope {
    const diagnostics = this.buildDiagnostics(ctx)
    const execution = this.buildExecution(ctx, providerTokens, providerLatencyMs)

    return {
      version: result.version,
      executionId,
      result,
      diagnostics,
      execution,
    }
  }

  private buildDiagnostics(ctx: DiscoveryContext): EnvelopeDiagnostics {
    const stages: StageDiagnostics[] = Object.entries(ctx.stageResults).map(
      ([id, sr]) => ({
        id,
        name: sr.stage,
        durationMs: sr.durationMs,
        confidence: sr.confidence,
        evidenceCount: sr.evidenceCount,
        error: sr.error,
      }),
    )

    const totalDurationMs = stages.reduce((sum, s) => sum + s.durationMs, 0)

    return {
      stages,
      totalDurationMs,
      retries: 0,
      errors: ctx.errors.map((e) => `[${e.stage}] ${e.message}`),
    }
  }

  private buildExecution(
    ctx: DiscoveryContext,
    providerTokens: Record<string, number>,
    providerLatencyMs: Record<string, number>,
  ): ExecutionInfo {
    return {
      projectId: ctx.projectId,
      entityId: ctx.entityId,
      startedAt: ctx.startedAt,
      completedAt: new Date().toISOString(),
      providerTokens,
      providerLatencyMs,
    }
  }
}
