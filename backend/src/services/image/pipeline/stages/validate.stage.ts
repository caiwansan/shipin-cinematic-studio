// ============================================================
// Validate Stage — 生成质量校验（D1 挂载点 + Phase 4.1 AnchorSync）
//
// Retry Scope: 否（validation 不触发 retry）
// 职责：
//   1. 在调用 validators 之前注入 AnchorSync 约束视图
//   2. 对已生成的图片执行质量校验，只做判定不做重试
//
// 设计原则：
//   - AnchorSync 改的是"世界"，不是"裁判"
//   - Validator 不感知 sync 是否存在
//   - 不修改 validator 签名
// ============================================================

import type { PipelineStage, PostProcessOutput, ValidateOutput, ExecutionContext, ValidationHook } from '../types.js'
import { AnchorSyncLayer } from '../../anchor-sync-layer.js'
import { traceConstraintInfluence, computeAnchorDrift } from '../../anchor-sync-trace.js'
import { normalizeConstraints } from '../../constraint-normalization.js'
import { buildBiasField } from '../../constraint-decision-mapping.js'
import { buildD2InputGraph } from '../../decision-engine-injection.js'

function average(scores: number[]): number {
  if (scores.length === 0) return 1
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

/**
 * 注入 AnchorSync 到 ExecutionContext
 * 只在 syncConstraints 尚未注入时执行一次
 */
function injectAnchorSync(ctx: ExecutionContext): void {
  if (ctx.syncConstraints) {
    return // 已注入，跳过
  }

  const { constraints } = AnchorSyncLayer.process(ctx)
  ctx.syncConstraints = constraints
}

export function createValidateStage(
  validators: ValidationHook[],
): PipelineStage<PostProcessOutput, ValidateOutput> {
  return {
    name: 'validate',
    async execute(input: PostProcessOutput, ctx: ExecutionContext): Promise<ValidateOutput> {
      // ── Phase 4.1: AnchorSync Injection ──
      injectAnchorSync(ctx)

      // ── Phase 4.1: Telemetry（非侵入式观测） ──
      if (ctx.syncConstraints) {
        const trace = traceConstraintInfluence(ctx)
        const drift = computeAnchorDrift(ctx)
        const normalized = normalizeConstraints(ctx.syncConstraints)
        // 仅附加到 ctx，不改变执行路径
        if (trace || normalized.length > 0) ctx.telemetry ??= {}
        if (trace) (ctx.telemetry as Record<string, unknown>).anchorSyncTrace = trace
        if (drift) (ctx.telemetry as Record<string, unknown>).anchorSyncDrift = drift
        if (normalized.length > 0) (ctx.telemetry as Record<string, unknown>).normalizedConstraints = normalized
        // 同时注入 normalized 供未来 D2/D3 消费
        ctx.normalizedConstraints = normalized

        // ── Phase 4.1: CDML — 构建决策偏置场 ──
        const biasField = buildBiasField(normalized)
        ctx.decisionBiasField = biasField
        ;(ctx.telemetry as Record<string, unknown>).decisionBiasField = {
          count: biasField.biases.length,
          summary: biasField.summary.split('\n')[0] ?? '',
        }

        // ── Phase 4.1: DEIP — 构建 D2 输入决策图 ──
        const d2Graph = buildD2InputGraph(biasField)
        ctx.d2InputGraph = d2Graph
        ;(ctx.telemetry as Record<string, unknown>).deipActive = true
        ;(ctx.telemetry as Record<string, unknown>).deipGraphStats = {
          nodes: d2Graph.nodes.length,
          edges: d2Graph.edges.length,
          lockedNodes: d2Graph.nodes.filter(n => n.locked).map(n => n.label),
        }
      }

      if (validators.length === 0) {
        return {
          ...input,
          validation: { passed: true, issues: [], score: 1 },
        }
      }

      const results = await Promise.all(
        validators.map(v => v.validate(input.imageUrl, ctx).catch(err => ({
          passed: false,
          score: 0,
          issues: [`${v.name} 执行异常: ${err.message}`],
        } as const))),
      )

      const failed = results.filter(r => !r.passed)
      const score = average(results.map(r => r.score))

      return {
        ...input,
        validation: {
          passed: failed.length === 0,
          issues: failed.flatMap(f => f.issues),
          score,
        },
      }
    },
  }
}
