/**
 * services/enterprise/enterprise-outcome-policy.service.ts
 *
 * Sprint-11.0B: Outcome Policy — 判断 Task 是否需要产生 Outcome
 *
 * 核心原则:
 * 1. 不是所有 Task 都需要 Outcome（系统同步、健康检查不产生业务事实）
 * 2. 不同 taskType 对应不同的 outcomeType 和 sourceType
 * 3. HITL/人工审核路径按 taskType 判定是否创建 Outcome
 *
 * 掌柜决策: A+ — 不废弃旧接口，加 Outcome Policy
 */

import { prisma } from '../../utils/index.js'
import { outcomeService } from './intelligence/outcome.service.js'

/**
 * Outcome 策略判定结果
 */
export interface OutcomePolicyDecision {
  /** 是否应该创建 Outcome */
  shouldCreate: boolean
  /** Outcome 的 sourceType: agent | human | system */
  sourceType: string
  /** Outcome 的 outcomeType */
  outcomeType: string
  /** 原因说明 */
  reason: string
}

/**
 * Task 类型 → Outcome 策略配置
 *
 * key: taskType (console 或 route 传入)
 * sourceType: 'agent' | 'human' | 'system'
 * outcomeType: Outcome 类型
 * alwaysCreate: 是否总是创建（true=strong, false=contextual）
 */
const OUTCOME_POLICY_MAP: Record<string, {
  sourceType: string
  outcomeType: string
  alwaysCreate: boolean
  description: string
}> = {
  // ── AI 自动执行（一般由 executeTask 处理）──
  'general': { sourceType: 'agent', outcomeType: 'OPERATIONAL', alwaysCreate: true, description: '通用 AI 任务' },

  // ── 招聘场景 ──
  'career_activation': { sourceType: 'agent', outcomeType: 'BUSINESS_INSIGHT', alwaysCreate: true, description: '招聘 AI 初始化' },
  'resume_analysis': { sourceType: 'agent', outcomeType: 'RECRUITMENT', alwaysCreate: true, description: '简历分析' },
  'candidate_match': { sourceType: 'agent', outcomeType: 'RECRUITMENT', alwaysCreate: true, description: '候选人匹配' },
  'interview_review': { sourceType: 'agent', outcomeType: 'RECRUITMENT', alwaysCreate: true, description: '面试评估' },

  // ── HITL/人工审核（经 recordTask 路径）──
  'manual_task': { sourceType: 'human', outcomeType: 'OPERATIONAL', alwaysCreate: false, description: '通用人工任务' },
  'hiring_decision': { sourceType: 'human', outcomeType: 'HIRING', alwaysCreate: true, description: '招聘录用决策' },
  'candidate_review': { sourceType: 'human', outcomeType: 'RECRUITMENT', alwaysCreate: true, description: '候选人人工复核' },
  'interview_feedback': { sourceType: 'human', outcomeType: 'RECRUITMENT', alwaysCreate: true, description: '面试反馈录入' },
  'offer_decision': { sourceType: 'human', outcomeType: 'HIRING', alwaysCreate: true, description: 'Offer 决策' },
  'manual_assessment': { sourceType: 'human', outcomeType: 'OPERATIONAL', alwaysCreate: true, description: '人工评估' },

  // ── 市场/宣发 ──
  'market_analysis': { sourceType: 'agent', outcomeType: 'BUSINESS_INSIGHT', alwaysCreate: true, description: '市场分析' },
  'content_generation': { sourceType: 'agent', outcomeType: 'CONTENT', alwaysCreate: true, description: '内容生成' },

  // ── 系统任务（不产生 Outcome）──
  'system_sync': { sourceType: 'system', outcomeType: 'OPERATIONAL', alwaysCreate: false, description: '系统同步' },
  'health_check': { sourceType: 'system', outcomeType: 'OPERATIONAL', alwaysCreate: false, description: '健康检查' },
  'heartbeat': { sourceType: 'system', outcomeType: 'OPERATIONAL', alwaysCreate: false, description: '心跳检测' },
}

/**
 * 默认策略（未匹配的 taskType）
 */
const DEFAULT_POLICY = {
  sourceType: 'agent' as const,
  outcomeType: 'OPERATIONAL' as const,
  alwaysCreate: true,
}

export class OutcomePolicyService {

  /**
   * 评估 taskType → Outcome 策略
   *
   * @param taskType Task 类型
   * @param context  判定上下文（可提供额外的判定信息）
   * @returns OutcomePolicyDecision
   */
  evaluate(taskType: string, context?: { isSystem?: boolean; isHuman?: boolean }): OutcomePolicyDecision {
    const policy = OUTCOME_POLICY_MAP[taskType]

    if (!policy) {
      // 未注册的 taskType：根据上下文判定
      if (context?.isSystem) {
        return {
          shouldCreate: false,
          sourceType: 'system',
          outcomeType: 'OPERATIONAL',
          reason: `未注册 taskType "${taskType}"，标记为系统任务，跳过 Outcome`,
        }
      }

      if (context?.isHuman) {
        return {
          shouldCreate: true,
          sourceType: 'human',
          outcomeType: 'OPERATIONAL',
          reason: `未注册 taskType "${taskType}"，标记为人工任务，创建默认 OPERATIONAL Outcome`,
        }
      }

      // 默认：创建 Outcome，agent 源
      return {
        shouldCreate: DEFAULT_POLICY.alwaysCreate,
        sourceType: DEFAULT_POLICY.sourceType,
        outcomeType: DEFAULT_POLICY.outcomeType,
        reason: `未注册 taskType "${taskType}"，应用默认策略，创建 Outcome`,
      }
    }

    // 已注册的 taskType
    if (!policy.alwaysCreate) {
      return {
        shouldCreate: false,
        sourceType: policy.sourceType,
        outcomeType: policy.outcomeType,
        reason: `${policy.description} (${policy.sourceType}): 不强制创建 Outcome`,
      }
    }

    return {
      shouldCreate: true,
      sourceType: policy.sourceType,
      outcomeType: policy.outcomeType,
      reason: `${policy.description} (${policy.sourceType}): 应创建 Outcome`,
    }
  }

  /**
   * 从 Task 和上下文创建 Outcome（如果策略允许）
   *
   * @param params.taskId      EnterpriseAgentTask.id
   * @param params.tenantId    租户 ID
   * @param params.agentInstanceId Agent Instance ID
   * @param params.taskType    Task 类型
   * @param params.outputSummary 输出摘要（作为 Outcome 的 summary）
   * @param params.status      Task 状态（仅 success → Outcome）
   * @param params.context     判定上下文
   * @returns 创建的 Outcome，或 null（未创建）
   */
  async createOutcomeIfNeeded(params: {
    taskId: string
    tenantId: string
    agentInstanceId: string
    taskType: string
    outputSummary?: string
    status?: string
    tokenInput?: number
    tokenOutput?: number
    cost?: number
    durationMs?: number
    context?: { isSystem?: boolean; isHuman?: boolean }
  }): Promise<{ outcome: any | null; decision: OutcomePolicyDecision }> {
    const decision = this.evaluate(params.taskType, params.context)

    if (!decision.shouldCreate) {
      return { outcome: null, decision }
    }

    // 只有成功/完成的任务才创建 Outcome
    const effectiveStatus = params.status || 'completed'
    if (!['completed', 'success', 'fulfilled'].includes(effectiveStatus)) {
      return {
        outcome: null,
        decision: { ...decision, reason: `${decision.reason}，但 Task 状态为 "${effectiveStatus}"，跳过`, shouldCreate: false },
      }
    }

    // 创建 Action (对 recordTask 路径，自动创建一个 action)
    const action = await prisma.enterpriseAction.create({
      data: {
        tenantId: params.tenantId,
        decisionId: `task_${params.taskId.slice(0, 8)}`,
        title: params.taskType,
        description: (params.outputSummary || '').slice(0, 200),
        status: 'completed',
        ownerType: 'agent',
        ownerId: params.agentInstanceId,
      },
    })

    // 创建 Outcome
    const outcome = await outcomeService.createOutcome({
      tenantId: params.tenantId,
      governanceTenantId: params.tenantId,
      actionId: action.id,
      outcomeType: decision.outcomeType,
      sourceType: decision.sourceType,
      status: decision.sourceType === 'human' ? 'PENDING_VERIFY' : 'VERIFIED',
      summary: (params.outputSummary || '').slice(0, 500),
      evidence: [{
        taskId: params.taskId,
        agentInstanceId: params.agentInstanceId,
        taskType: params.taskType,
        tokenInput: params.tokenInput || 0,
        tokenOutput: params.tokenOutput || 0,
        cost: params.cost || 0,
        durationMs: params.durationMs || 0,
        recordedAt: new Date().toISOString(),
      }],
      occurredAt: new Date(),
    })

    return { outcome, decision }
  }
}

export const outcomePolicyService = new OutcomePolicyService()
