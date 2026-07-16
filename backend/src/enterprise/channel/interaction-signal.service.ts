/**
 * P4.2.5.2-GATE-01.2 — Interaction Signal Bridge
 *
 * 职责: InteractionEvent → Signal → Recommendation
 * 实现 Channel Event 到 Enterprise Intelligence Loop 的接入
 */

import { prisma } from '../../utils/index.js'
import { signalService, SignalType, SignalSeverity } from '../../services/enterprise/intelligence/signal.service.js'
import { decisionService } from '../../services/enterprise/intelligence/decision.service.js'
import { actionLifecycleService } from '../../services/enterprise/intelligence/action-lifecycle.service.js'
import { OwnerType } from '../../services/enterprise/intelligence/action.types.js'

// ─── Types ─────────────────────────────────────────────────

export interface InteractionSignalInput {
  tenantId: string
  interactionId: string
  interactionType: string
  content?: string
  externalId: string
  direction: 'inbound' | 'outbound'
  channel: 'wecom'
}

export interface SignalGenerationResult {
  signalCreated: boolean
  signalId?: string
  signalType?: SignalType
  severity?: SignalSeverity
  recommendationCreated: boolean
  recommendationId?: string
  actionCreated: boolean
  actionId?: string
  reason: string
}

// ─── Intent Keywords (Rule-based Detection) ────────────────

const PURCHASE_INTENT_KEYWORDS = [
  '采购', '购买', '下单', '签合同', '签约', '合作', '方案', '报价',
  '价格', '费用', '多少钱', '预算', '投标', '招标', 'supplier',
]

const SUPPORT_INTENT_KEYWORDS = [
  '问题', '故障', '报错', '不行', '失败', '错误', '无法', '不能',
  '崩溃', 'bug', 'help', '帮助', '怎么办', '为什么',
]

const FEEDBACK_INTENT_KEYWORDS = [
  '反馈', '建议', '意见', '体验', '满意', '不好', '差评', '改进',
]

const URGENT_INDICATORS = [
  '急', '紧急', '尽快', '立刻', '马上', 'ASAP', 'urgent',
]

// ─── Interaction Signal Bridge ──────────────────────────────

export class InteractionSignalBridge {
  /**
   * 主入口：分析 Interaction 并生成 Signal → Recommendation → Action
   */
  async analyzeAndTrigger(input: InteractionSignalInput): Promise<SignalGenerationResult> {
    const content = input.content || ''

    // Step 1: Detect intent patterns
    const intent = this.detectIntent(content)

    // Step 2: If no significant intent, skip signal generation
    if (intent.type === 'general') {
      return {
        signalCreated: false,
        recommendationCreated: false,
        actionCreated: false,
        reason: 'No significant intent detected (general message)',
      }
    }

    // Step 3: Check for duplicate active signal (dedup)
    const existingSignal = await prisma.enterpriseSignal.findFirst({
      where: {
        tenantId: input.tenantId,
        signalType: intent.signalType,
        status: 'active',
      },
    })

    if (existingSignal) {
      // Update existing signal with new evidence
      await prisma.enterpriseSignal.update({
        where: { id: existingSignal.id },
        data: {
          sourceEvents: [...(existingSignal.sourceEvents as any[]), input.interactionId] as any,
          severity: intent.severity,
        },
      })

      return {
        signalCreated: false,
        signalId: existingSignal.id,
        signalType: intent.signalType,
        severity: intent.severity,
        recommendationCreated: false,
        actionCreated: false,
        reason: 'Existing active signal updated with new evidence',
      }
    }

    // Step 4: Create Signal
    const signal = await signalService.createSignal({
      tenantId: input.tenantId,
      signalType: intent.signalType,
      severity: intent.severity,
      description: intent.description,
      suggestedAction: intent.suggestedAction,
      sourceEventIds: [input.interactionId],
    })

    // Step 5: Generate Recommendation from Signal
    const recommendation = await decisionService.generateFromSignal(input.tenantId, signal.id)

    // Step 6: For high-intent signals, auto-create Action
    let actionCreated = false
    let actionId: string | undefined

    if (recommendation && intent.autoCreateAction) {
      const actions = await actionLifecycleService.createActionsFromDecision(
        input.tenantId,
        recommendation.id,
        [{
          title: intent.suggestedAction || intent.description,
          description: `Auto-generated from WeCom interaction signal (${intent.type})`,
          priority: intent.priority,
          ownerType: OwnerType.HUMAN,
          ownerId: input.tenantId,
        }]
      )
      if (actions.length > 0) {
        actionCreated = true
        actionId = actions[0].id
      }
    }

    return {
      signalCreated: true,
      signalId: signal.id,
      signalType: intent.signalType,
      severity: intent.severity,
      recommendationCreated: !!recommendation,
      recommendationId: recommendation?.id,
      actionCreated,
      actionId,
      reason: `Signal pipeline complete: ${intent.type}`,
    }
  }

  // ─── Intent Detection Engine ─────────────────────────────

  private detectIntent(content: string): {
    type: string
    signalType: SignalType
    severity: SignalSeverity
    description: string
    suggestedAction: string
    autoCreateAction: boolean
    priority: 'P1' | 'P2' | 'P3'
  } {
    const lowerContent = content.toLowerCase()
    const hasUrgent = URGENT_INDICATORS.some(k => lowerContent.includes(k))

    // Priority 1: Purchase Intent
    const purchaseMatch = PURCHASE_INTENT_KEYWORDS.filter(k => lowerContent.includes(k))
    if (purchaseMatch.length >= 2 || (purchaseMatch.length >= 1 && hasUrgent)) {
      return {
        type: 'purchase_intent',
        signalType: SignalType.SALES,
        severity: hasUrgent ? SignalSeverity.CRITICAL : SignalSeverity.WARNING,
        description: `客户采购意向检测: 关键词 [${purchaseMatch.join(', ')}]`,
        suggestedAction: '跟进客户采购需求，安排销售联系',
        autoCreateAction: true,
        priority: hasUrgent ? 'P1' : 'P2',
      }
    }

    // Single keyword → info level
    if (purchaseMatch.length === 1) {
      return {
        type: 'purchase_signal',
        signalType: SignalType.SALES,
        severity: SignalSeverity.INFO,
        description: `客户提及: ${purchaseMatch[0]}`,
        suggestedAction: '关注客户后续互动',
        autoCreateAction: false,
        priority: 'P3',
      }
    }

    // Priority 2: Support Issue
    const supportMatch = SUPPORT_INTENT_KEYWORDS.filter(k => lowerContent.includes(k))
    if (supportMatch.length >= 1) {
      return {
        type: 'support_issue',
        signalType: SignalType.OPERATION,
        severity: hasUrgent ? SignalSeverity.CRITICAL : SignalSeverity.WARNING,
        description: `客户反馈问题: [${supportMatch.join(', ')}]`,
        suggestedAction: '安排技术支持响应',
        autoCreateAction: hasUrgent,
        priority: hasUrgent ? 'P1' : 'P2',
      }
    }

    // Priority 3: Feedback
    const feedbackMatch = FEEDBACK_INTENT_KEYWORDS.filter(k => lowerContent.includes(k))
    if (feedbackMatch.length >= 1) {
      return {
        type: 'customer_feedback',
        signalType: SignalType.CUSTOMER,
        severity: SignalSeverity.INFO,
        description: `客户反馈: [${feedbackMatch.join(', ')}]`,
        suggestedAction: '记录客户反馈，纳入产品改进',
        autoCreateAction: false,
        priority: 'P3',
      }
    }

    // Fallback: General message (no signal)
    return {
      type: 'general',
      signalType: SignalType.CUSTOMER,
      severity: SignalSeverity.INFO,
      description: '',
      suggestedAction: '',
      autoCreateAction: false,
      priority: 'P3',
    }
  }
}

export const interactionSignalBridge = new InteractionSignalBridge()
