// ============================================================
// submit-task.ts — 短剧工作制片厂执行内核
//
// 职责：所有 AI 图片生成的唯一外部入口
// 内部通过 Pipeline Runner 编排 4 个 stage
//
// 支持：
//   D1 Validation — 通过 validators 参数注入
//   D2 Retry — 自动包裹 submit+poll
//   D3 Policy — 通过 PolicyProvider 获取全局策略
//   D4 Identity Lock — 通过 ExecutionContext 传递
// ============================================================

import { runPipeline } from './pipeline/runner.js'
import { createSubmitStage } from './pipeline/stages/submit.stage.js'
import { createPollStage } from './pipeline/stages/poll.stage.js'
import { createPostProcessStage } from './pipeline/stages/postprocess.stage.js'
import { createValidateStage } from './pipeline/stages/validate.stage.js'
import { createDecisionStage } from './pipeline/stages/decision.stage.js'
import { DecisionEngine } from './pipeline/decision/decision-engine.js'
import { wrapStagesWithRetry } from './retry/retry-engine.js'
import { getEffectivePolicy } from './policy/policy-provider.js'
import type {
  ImageTaskInput,
  ExecutionContext,
  PipelineOutput,
  PipelineStage,
  PostProcessOutput,
  ValidationHook,
} from './pipeline/types.js'
import type { QualityDomain } from './pipeline/validators/core/baseline-registry.js'

// ─── 旧版 retry policy 保留向后兼容 ────────────────────

const DEFAULT_RETRY_POLICY = { maxRetries: 2, backoffMs: 3000 }

// ─── executeImageTask（核心入口）────────────────────────

export interface ExecuteOptions {
  /** D1: 质量校验器列表 */
  validators?: ValidationHook[]
  /** [已弃用] 改用 PolicyProvider — 保留向后兼容 */
  retryPolicy?: { maxRetries: number; backoffMs: number }
  /** [已弃用] 改用 PolicyProvider — 保留向后兼容 */
  enableDecision?: boolean
  /** D3: 当前 domain（用于从 PolicyProvider 获取策略） */
  domain?: string
  /** [已弃用] 改用 PolicyProvider — 保留向后兼容 */
  retryCount?: number
  /** [已弃用] 改用 PolicyProvider — 保留向后兼容 */
  maxRetries?: number
  /** 内部使用：baseUrl / authHeader（由 routes 传入） */
  baseUrl: string
  authHeader: string
  /** 用于 COS 上传的 userId */
  userId?: string
}

export async function executeImageTask(
  input: ImageTaskInput,
  ctx: ExecutionContext,
  options: ExecuteOptions,
): Promise<PipelineOutput> {
  const {
    validators = [],
    retryPolicy,
    enableDecision: legacyEnableDecision,
    domain = ctx.stage,
    retryCount: legacyRetryCount,
    maxRetries: legacyMaxRetries,
    baseUrl,
    authHeader,
    userId = ctx.projectId,
  } = options

  // ── D3: 从 PolicyProvider 获取策略 ──
  const effectivePolicy = getEffectivePolicy(domain as QualityDomain)

  // 决策引擎启用策略：优先兼容旧版传参，否则取 policy 层
  const useDecision = legacyEnableDecision ?? effectivePolicy.enableDecision
  const effectiveRetryCount = legacyRetryCount ?? 0
  const effectiveMaxRetries = legacyMaxRetries ?? effectivePolicy.retry.maxQualityRetries

  // retry policy：优先兼容旧版传参，否则取 policy 层
  const infraRetryPolicy = retryPolicy ?? {
    maxRetries: effectivePolicy.retry.maxInfraRetries,
    backoffMs: effectivePolicy.retry.backoffMs,
  }

  // 1. 创建各 stage
  const submitStage = createSubmitStage(baseUrl, authHeader)
  const pollStage = createPollStage(baseUrl, authHeader)
  const postProcessStage = createPostProcessStage(userId)
  const validateStage = createValidateStage(validators)

  // 2. Retry scope = [submitStage, pollStage] — 只包 infra 失败
  const retryWrapper = wrapStagesWithRetry(
    [submitStage, pollStage],
    infraRetryPolicy,
  )

  // 3. 编排 pipeline
  let stages: PipelineStage<any, any>[] = [
    retryWrapper,        // D2: 自动重试 submit+poll
    postProcessStage,    // COS 上传
    validateStage,       // D1: 质量校验
  ]

  // D2 / D3: 决策 stage — 挂在 validate 之后，用 policy 层配置
  if (useDecision) {
    const decisionEngine = new DecisionEngine({
      regenerateThreshold: effectivePolicy.scoring.hardRejectThreshold,
      retryThreshold: effectivePolicy.scoring.acceptThreshold,
    })
    const decisionStage = createDecisionStage(
      decisionEngine,
      domain as QualityDomain,
      effectiveRetryCount,
      effectiveMaxRetries,
    )
    stages = [...stages, decisionStage]
  }

  const result = await runPipeline<ImageTaskInput, any>(stages, input, ctx)

  // 4. 返回标准化输出
  return {
    imageUrl: result.imageUrl,
    taskId: result.taskId,
    validation: result.validation ?? { passed: true, issues: [], score: 1 },
    decision: result.decision,
    traceId: ctx.traceId,
  }
}
