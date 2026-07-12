/**
 * Learning Signal Types — Sprint 4-4: Discovery → Learn
 *
 * Three categories of growth signals that GEO can observe:
 * 1. AI_COSNITION — AI 对品牌的理解变化（如：ADI 分数变化、场景覆盖变化）
 * 2. CONTENT — 内容变化（如：发布新页面、更新 Schema、新增 FAQ）
 * 3. EXTERNAL_REFERENCE — 外部引用变化（如：外链增加、百科条目更新、第三方提及）
 *
 * Reuses existing types/business/task-card.ts (TaskCardModel) and types/ai/explain.ts (ExplainModel)
 * No new engines, no new domain models.
 */
import type { ExplainModel } from '../ai/explain'
import type { TaskCardModel, PriorityLevel } from '../business/task-card'

/** 信号类别 — 三类变化 */
export type SignalCategory = 'ai_cognition' | 'content' | 'external_reference'

/** 单个学习信号 */
export interface LearningSignal {
  id: string
  category: SignalCategory
  title: string
  summary: string
  magnitude: number          // 0-100, 变化幅度
  direction: 'positive' | 'negative' | 'neutral'
  previousValue?: number
  currentValue?: number
  explain: ExplainModel     // 每个信号都可解释（复用 ExplainModel）
  timestamp: string
  source: string            // 信号来源（verification | discovery | publish）
}

/** 学习轮次 — 一次完整的 Learn 事件 */
export interface LearningRound {
  id: string
  projectId: string
  entityName: string
  triggerEvent: 'VERIFY:COMPLETED' | 'PUBLISH:COMPLETED' | 'DISCOVERY:COMPLETED'
  signalSummary: {
    total_signals: number
    positive_signals: number
    negative_signals: number
    ai_cognition_changes: number
    content_changes: number
    external_reference_changes: number
  }
  signals: LearningSignal[]
  insight: string            // GEO 对这个轮次的整体洞察
  nextAction: NextAction     // "下一步应该做什么"
  createdAt: string
}

/** 下一步行动推荐 — 直接复用 TaskCardModel 的设计 */
export interface NextAction {
  taskCard: TaskCardModel    // 复用 TaskCardModel 作为展示
  missionTitle: string       // 可直接转化为 Mission 标题
  missionDescription: string // 可直接转化为 Mission 描述
  why: string                // "为什么这个信号值得关注"
  priority: PriorityLevel
}

/**
 * 从学习信号生成 NextAction 的工具函数
 * 将 LearningRound 转换为可供 Mission 创建使用的数据
 */
export function signalToNextAction(round: LearningRound): NextAction | null {
  const positiveSignals = round.signals.filter(s => s.direction === 'positive')
  if (positiveSignals.length === 0) return null

  // 取幅度最大的正信号作为下一步行动的依据
  const bestSignal = positiveSignals.sort((a, b) => b.magnitude - a.magnitude)[0]

  return {
    taskCard: {
      id: `next-${round.id}`,
      title: round.nextAction.missionTitle,
      summary: round.nextAction.missionDescription,
      priority: round.nextAction.priority,
      status: 'pending',
      explain: bestSignal.explain,
      actions: [
        { id: 'create-mission', label: '创建新 Mission', variant: 'primary' },
        { id: 'dismiss', label: '稍后', variant: 'ghost' },
      ],
      createdAt: round.createdAt,
    },
    missionTitle: round.nextAction.missionTitle,
    missionDescription: round.nextAction.missionDescription,
    why: round.nextAction.why,
    priority: round.nextAction.priority,
  }
}

/** 信号类别的中文标签 */
export const SIGNAL_CATEGORY_LABELS: Record<SignalCategory, string> = {
  ai_cognition: 'AI 认知变化',
  content: '内容变化',
  external_reference: '外部引用变化',
}

/** 信号类别的图标 */
export const SIGNAL_CATEGORY_ICONS: Record<SignalCategory, string> = {
  ai_cognition: '🧠',
  content: '📝',
  external_reference: '🔗',
}
