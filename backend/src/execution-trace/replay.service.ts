/**
 * execution-trace/replay.service.ts — 回放引擎
 *
 * 职责：根据已记录的 trace 重新执行一次请求。
 *
 * 限制（v1）：
 *   - 只回放 trace 中记录的 provider/model/input
 *   - 不保证输出一致（LLM 有随机性）
 *   - 只保证调用链一致（调了哪个 provider，用了什么参数）
 *
 * 回放模式不写 state（避免污染统计数据）。
 */

import { ExecutionTrace } from './types.js'
import { traceService } from './trace.service.js'

export class ExecutionReplayService {
  /**
   * 回放一次执行（仅日志，不实际调用 provider）
   * 用于审计和调试
   */
  replayDryRun(traceId: string): { trace?: ExecutionTrace; steps: Array<{ step: string; duration: string }> } {
    const trace = traceService.get(traceId)
    if (!trace) {
      return { steps: [{ step: `Trace ${traceId} 未找到`, duration: '-' }] }
    }

    const steps = trace.steps.map((step, i) => {
      const prev = i > 0 ? trace.steps[i - 1] : null
      const gap = prev ? `${step.timestamp - prev.timestamp}ms` : '-'
      return {
        step: `${i + 1}. ${step.name}${step.data ? ` (${JSON.stringify(step.data)})` : ''}`,
        duration: gap,
      }
    })

    return {
      trace,
      steps,
    }
  }

  /**
   * 格式化输出（给管理员看）
   */
  formatTrace(traceId: string): string {
    const trace = traceService.get(traceId)
    if (!trace) return `Trace ${traceId} 未找到`

    const lines: string[] = []
    lines.push(`=== Trace: ${trace.id} ===`)
    lines.push(`用户: ${trace.userId}`)
    lines.push(`请求: ${trace.requestId || '-'}`)
    lines.push(`任务: ${trace.taskType}`)
    lines.push(`Provider: ${trace.provider} / ${trace.model}`)
    lines.push(`状态: ${trace.status}`)
    if (trace.error) lines.push(`错误: ${trace.error}`)
    lines.push(`耗时: ${trace.endTime ? `${trace.endTime - trace.startTime}ms` : '进行中...'}`)
    lines.push(`Input: ${trace.inputSummary.substring(0, 200)}`)
    if (trace.outputSummary) lines.push(`Output: ${trace.outputSummary.substring(0, 200)}`)
    lines.push('')
    lines.push('=== 步骤时间线 ===')
    for (let i = 0; i < trace.steps.length; i++) {
      const s = trace.steps[i]
      const prev = i > 0 ? trace.steps[i - 1] : null
      const gap = prev ? `+${s.timestamp - prev.timestamp}ms` : '0ms'
      const info = s.data ? ` ${JSON.stringify(s.data)}` : ''
      lines.push(`  ${i + 1}. [${gap}] ${s.name}${info}`)
    }
    if (trace.status === 'blocked') {
      lines.push('')
      lines.push('⚠️ 本次请求被 Safety Layer 阻断')
    }

    return lines.join('\n')
  }
}

export const replayService = new ExecutionReplayService()
