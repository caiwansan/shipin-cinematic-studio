// ============================================================
// Pipeline Runner — 核心执行引擎
//
// 职责：
//   1. 顺序执行 stages
//   2. 每个 stage 独立 try/catch，失败即停止并报告
//   3. 链路追踪（traceId 贯穿所有 stage）
// ============================================================

import type { PipelineStage, ExecutionContext, PipelineError } from './types.js'

export async function runPipeline<I, O>(
  stages: PipelineStage<any, any>[],
  input: I,
  ctx: ExecutionContext,
): Promise<O> {
  let current: any = input

  for (const stage of stages) {
    try {
      current = await stage.execute(current, ctx)
    } catch (err: any) {
      const pipelineErr: PipelineError = {
        stage: stage.name,
        error: err,
        traceId: ctx.traceId,
      }
      console.error(`[Pipeline] stage "${stage.name}" 失败 (traceId=${ctx.traceId}): ${err.message}`)
      throw pipelineErr
    }
  }

  return current as O
}
