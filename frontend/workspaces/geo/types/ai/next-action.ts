/**
 * AI Presentation Layer — Next Action Types
 *
 * Journey-driven next action, not a button collection.
 * Every page has a single primary next action and optional secondary actions.
 *
 * @file next-action.ts
 */

export interface NextAction {
  id: string
  title: string
  description?: string
  expectedImpact?: string     // "预计 +15 分"
  primary: boolean            // 是否为主要操作
  route?: string              // 目标路由
  action?: () => void         // 直接回调（优先级高于 route）
  disabled?: boolean
  disabledReason?: string
}
