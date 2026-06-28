// ============================================================
// Retry Engine — 仅包裹 submit + poll 阶段
//
// 设计原则：
//   - retry 只处理"系统级失败"（网络/超时/服务端 5xx）
//   - retry 不处理"质量失败"（validation 不触发 retry）
//   - 默认 jitter 退避，避免惊群效应
// ============================================================

import type { PipelineStage, ExecutionContext, RetryPolicy, DEFAULT_RETRY } from '../pipeline/types.js'

async function backoff(ms: number, attempt: number): Promise<void> {
  const jitter = Math.random() * 500
  await new Promise(r => setTimeout(r, ms * attempt + jitter))
}

/**
 * 用 retry 包裹一组 stage，仅对 infra 错误生效
 */
export function wrapStagesWithRetry(
  stages: PipelineStage<any, any>[],
  policy: RetryPolicy,
): PipelineStage<any, any> {
  return {
    name: `retry(${stages.map(s => s.name).join('+')})`,
    async execute(input: any, ctx: ExecutionContext): Promise<any> {
      let lastError: Error | undefined

      for (let attempt = 1; attempt <= policy.maxRetries + 1; attempt++) {
        try {
          let current = input
          for (const stage of stages) {
            current = await stage.execute(current, ctx)
          }
          return current
        } catch (err: any) {
          lastError = err
          const isInfraError = isSystemFailure(err)

          if (attempt <= policy.maxRetries && isInfraError) {
            console.warn(
              `[Retry] ${stages.map(s => s.name).join('+')} 第 ${attempt} 次失败 (infra), ` +
              `${policy.maxRetries - attempt} 次剩余: ${err.message}`
            )
            await backoff(policy.backoffMs, attempt)
          } else {
            // 超出重试次数 或 非 infra 错误 → 终止
            if (!isInfraError) {
              console.warn(`[Retry] ${stages.map(s => s.name).join('+')} 非 infra 错误，放弃重试: ${err.message}`)
            }
            throw lastError
          }
        }
      }

      throw lastError
    },
  }
}

/**
 * 判断是否为"系统级失败"（可重试）
 * 应用层错误（4xx、validation fail）不重试
 */
function isSystemFailure(err: Error): boolean {
  const msg = err.message || ''
  // 超时
  if (msg.includes('timeout') || msg.includes('time out') || msg.includes('超时')) return true
  // 服务端 5xx
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true
  // 网络错误
  if (msg.includes('ECONNRESET') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) return true
  if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('network')) return true
  // ai-generate 内部失败（任务状态 failed）
  if (msg.includes('图片生成任务失败')) return true
  // 空 URL（生成成功但返回空）
  if (msg.includes('返回空 URL')) return true
  // 其他未知错误视为不可重试
  return false
}
