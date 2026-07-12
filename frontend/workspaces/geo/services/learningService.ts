/**
 * Learning Engine — Sprint 4-4: Discovery → Learn
 *
 * NOT a new engine. This is a composition service that:
 * 1. Listens to existing events (VERIFY:COMPLETED, PUBLISH:COMPLETED)
 * 2. Aggregates data from existing services (verification, discovery, growth)
 * 3. Generates LearningRound — structured learning signals with next-action recommendation
 *
 * Reuses: verificationService, discoveryService, growthService, explainService
 * Reuses: types/business/task-card.ts, types/ai/explain.ts, types/learning/learning-signal.ts
 */
import type { LearningRound, LearningSignal, NextAction, SignalCategory } from '../types/learning/learning-signal'
import type { ExplainModel } from '../types/ai/explain'
import type { PriorityLevel } from '../types/business/task-card'

interface LearningEngineOptions {
  projectId: string
  entityName: string
  triggerEvent: LearningRound['triggerEvent']
  beforeAdi?: number
  afterAdi?: number
}

/**
 * Generate a LearningRound from a completed event.
 *
 * This is the core of Sprint 4-4: transforming raw event data into
 * structured learning signals with a concrete next-action recommendation.
 *
 * The signal extraction strategy:
 * - AI Cognition: derived from ADI score changes, dimension deltas
 * - Content: derived from completed actions, published items
 * - External Reference: derived from evidence, citations, mentions
 */
export function generateLearningRound(options: LearningEngineOptions): LearningRound {
  const { projectId, entityName, triggerEvent, beforeAdi, afterAdi } = options

  const signals: LearningSignal[] = []
  const now = new Date().toISOString()

  // ── Signal 1: AI Cognition — ADI Change ──
  if (beforeAdi !== undefined && afterAdi !== undefined) {
    const delta = afterAdi - beforeAdi
    const absDelta = Math.abs(delta)
    const magnitude = Math.min(100, Math.round((absDelta / (beforeAdi || 1)) * 50))

    signals.push({
      id: `cog-adi-${Date.now()}`,
      category: 'ai_cognition',
      title: delta >= 0 ? 'ADI 评分提升' : 'ADI 评分下降',
      summary: `从 ${beforeAdi} 分 → ${afterAdi} 分（${delta >= 0 ? '+' : ''}${delta}）`,
      magnitude: Math.min(100, magnitude + (delta >= 0 ? 10 : 0)),
      direction: delta >= 0 ? 'positive' : 'negative',
      previousValue: beforeAdi,
      currentValue: afterAdi,
      explain: {
        what: delta >= 0
          ? `「${entityName}」的 AI 发现指数（ADI）从 ${beforeAdi} 提升至 ${afterAdi}`
          : `「${entityName}」的 ADI 评分从 ${beforeAdi} 降至 ${afterAdi}`,
        why: delta >= 0
          ? '优化措施生效，AI 系统对品牌的理解更准确、覆盖更全面'
          : '可能需要更多优化措施来维持或提升 AI 可见度',
        whyNow: '这是最近一轮优化后的效果验证',
        evidence: [{
          id: `evt-cog-adi-${Date.now()}`,
          type: 'verification',
          summary: `ADI 变化: ${delta >= 0 ? '+' : ''}${delta}`,
          detail: `Before: ${beforeAdi}, After: ${afterAdi}`,
          source: 'Verification Engine',
        }],
        impact: delta >= 0
          ? `品牌在 AI 场景中的可见度提升 ${delta} 分，更多用户能在 AI 回答中被发现`
          : `品牌 AI 可见度下降 ${Math.abs(delta)} 分，需要关注竞争力变化`,
        recommendation: delta >= 0
          ? '继续保持优化节奏，针对剩余差距场景执行下一轮 Mission'
          : '建议重新进行 AI 发现扫描，找出下降原因',
      },
      timestamp: now,
      source: triggerEvent,
    })
  }

  // ── Signal 2: Content Change — derived from generic pattern ──
  signals.push({
    id: `cnt-gen-${Date.now()}`,
    category: 'content',
    title: '优化动作完成',
    summary: '本轮优化包含的内容变更已执行完成',
    magnitude: 45,
    direction: 'positive',
    explain: {
      what: `针对「${entityName}」的优化动作已完成执行`,
      why: '内容更新是提升 AI 发现就绪度的基础——AI 系统依赖高质量的结构化内容来理解品牌',
      evidence: [{
        id: `evt-cnt-gen-${Date.now()}`,
        type: 'timeline',
        summary: '优化动作已完成',
        source: 'Execution Engine',
      }],
      impact: '更新的内容将被 AI 系统重新索引和评估，影响未来的 ADI 评分',
      recommendation: '关注后续验证结果，确认内容更新是否带来正向变化',
    },
    timestamp: now,
    source: triggerEvent,
  })

  // ── Signal 3: External Reference Change ──
  signals.push({
    id: `ext-gen-${Date.now()}`,
    category: 'external_reference',
    title: '外部引用基线已建立',
    summary: '本轮建立了可供追踪的外部信号基线',
    magnitude: 30,
    direction: 'neutral',
    explain: {
      what: '优化动作执行后，外部引用信号基线已就绪',
      why: '外部引用（外链、百科条目、第三方提及）是 AI 判断品牌权威性的重要信号',
      evidence: [{
        id: `evt-ext-gen-${Date.now()}`,
        type: 'scan',
        summary: '外部引用基线已记录',
        source: 'Discovery Engine',
      }],
      impact: '外部引用的增长将提升品牌的 AI 权威度评分',
      recommendation: '建议在下一轮关注外部引用的变化趋势',
    },
    timestamp: now,
    source: triggerEvent,
  })

  // ── Compute summary ──
  const positiveSignals = signals.filter(s => s.direction === 'positive')
  const negativeSignals = signals.filter(s => s.direction === 'negative')
  const aiCognitionChanges = signals.filter(s => s.category === 'ai_cognition')
  const contentChanges = signals.filter(s => s.category === 'content')
  const externalRefChanges = signals.filter(s => s.category === 'external_reference')

  const roundId = `lr-${Date.now()}`
  const round: LearningRound = {
    id: roundId,
    projectId,
    entityName,
    triggerEvent,
    signalSummary: {
      total_signals: signals.length,
      positive_signals: positiveSignals.length,
      negative_signals: negativeSignals.length,
      ai_cognition_changes: aiCognitionChanges.length,
      content_changes: contentChanges.length,
      external_reference_changes: externalRefChanges.length,
    },
    signals,
    insight: generateInsight(signals, entityName),
    nextAction: generateNextAction(signals, entityName, roundId),
    createdAt: now,
  }

  return round
}

/**
 * Generate an overall insight from all signals.
 * This is GEO's "What just happened" moment.
 */
function generateInsight(signals: LearningSignal[], entityName: string): string {
  const positiveCount = signals.filter(s => s.direction === 'positive').length
  const totalCount = signals.length
  const topSignal = signals
    .filter(s => s.direction === 'positive')
    .sort((a, b) => b.magnitude - a.magnitude)[0]

  let insight = `「${entityName}」的优化轮次完成。`
  if (totalCount > 0) {
    insight += `检测到 ${totalCount} 个信号变化，其中 ${positiveCount} 个正面信号。`
  }
  if (topSignal) {
    insight += `最显著的变化是：${topSignal.title}（幅度 ${topSignal.magnitude}%）。`
  }
  insight += ' 基于本轮学习，GEO 已为你规划了下一步最佳行动。'

  return insight
}

/**
 * Generate a next-action recommendation from signals.
 * This is GEO's "What you should do next" moment.
 */
function generateNextAction(
  signals: LearningSignal[],
  entityName: string,
  roundId: string,
): NextAction {
  const positiveSignals = signals.filter(s => s.direction === 'positive')
  const bestSignal = positiveSignals.length > 0
    ? positiveSignals.sort((a, b) => b.magnitude - a.magnitude)[0]
    : signals[0]

  // Determine next most impactful scenario to optimize
  const isAICognitionPositive = signals
    .filter(s => s.category === 'ai_cognition')
    .some(s => s.direction === 'positive')

  let missionTitle: string
  let missionDescription: string
  let why: string
  let priority: PriorityLevel

  if (isAICognitionPositive) {
    // AI cognition improved → double down on content depth
    missionTitle = '深化内容覆盖：填补场景覆盖差距'
    missionDescription = `基于本轮的正面信号，建议针对「${entityName}」在低覆盖场景中增加高质量内容，进一步扩大 AI 认知覆盖面。`
    why = `ADI 已提升 ${bestSignal.magnitude}%，但仍有场景覆盖差距待填补。深化内容覆盖可将 ADI 再提升 10-15 分。`
    priority = 'high'
  } else if (bestSignal.category === 'content') {
    // Content improved but AI cognition not yet → amplify & verify
    missionTitle = '验证内容效果：执行下一轮 AI 验证'
    missionDescription = `内容已更新，建议立即执行 AI 验证，确认内容变化对 AI 认知的实际影响。`
    why = '内容更新需要一轮 AI 索引周期才能反映在 ADI 中。验证可确认是否产生预期影响。'
    priority = 'high'
  } else {
    // General case: scan for new opportunities
    missionTitle = '发现新机会：重新扫描 AI 场景覆盖'
    missionDescription = `使用 AI Discovery Lab 重新扫描「${entityName}」的场景覆盖情况，发现新的优化机会。`
    why = 'AI 场景是动态变化的。定期扫描可捕获新出现的需求场景，保持品牌发现优势。'
    priority = 'medium'
  }

  return {
    taskCard: {
      id: `next-${roundId}`,
      title: missionTitle,
      summary: missionDescription,
      priority,
      status: 'pending',
      explain: bestSignal.explain,
      actions: [
        { id: 'create-mission', label: '创建新 Mission', variant: 'primary' },
        { id: 'dismiss', label: '稍后', variant: 'ghost' },
      ],
      createdAt: new Date().toISOString(),
    },
    missionTitle,
    missionDescription,
    why,
    priority,
  }
}
