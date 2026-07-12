/**
 * TaskCard — Workspace Activity Contract 统一模型
 *
 * 不绑定任何业务领域：Recommendation、Mission、Verification、Publishing 全部复用此结构。
 * ExplainModel 直接引用 AI Presentation Layer 的 ExplainModel，不多包一层。
 * 此类型为冻结 Contract，不可修改。
 *
 * @see {@link ExplainModel} from '../ai/explain'
 * @see {@link ScoreCardModel} from './score-card'
 */

import type { ExplainModel } from '../ai/explain'
import type { ScoreCardModel } from './score-card'

// ── 统一优先级协议 ──────────────────────────────────────
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'

// ── 统一语义状态 ─────────────────────────────────────────
export type TaskStatus = 'pending' | 'running' | 'success' | 'warning' | 'error' | 'disabled'

// ── 动作模型（纯展示层，不含业务语义） ───────────────────
export interface TaskAction {
  id: string
  label: string
  variant: 'primary' | 'secondary' | 'ghost' | 'danger'
  disabled?: boolean
  loading?: boolean
}

// ── Workspace Activity Contract 统一模型 ─────────────────
export interface TaskCardModel {
  id: string
  title: string
  summary: string
  priority: PriorityLevel
  status: TaskStatus
  score?: ScoreCardModel            // 可选的评分展示
  explain?: ExplainModel            // Explain Block 数据，直接引用 AI Layer 类型
  actions: TaskAction[]             // 可用操作（纯展示，emit id 由父组件绑定）
  metadata?: Record<string, unknown> // 卡片自定义额外数据
  createdAt?: string
  updatedAt?: string
}

// ── 优先级颜色映射 ──────────────────────────────────────
export const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#6b7280',
}

// ── 优先级中文标签 ──────────────────────────────────────
export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
  info: '信息',
}

// ── 状态颜色映射 ──────────────────────────────────────
export const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#9ca3af',
  running: '#3b82f6',
  success: '#22c55e',
  warning: '#f97316',
  error: '#ef4444',
  disabled: '#d1d5db',
}

// ── 状态中文标签 ──────────────────────────────────────
export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '待处理',
  running: '进行中',
  success: '已完成',
  warning: '待确认',
  error: '失败',
  disabled: '已禁用',
}
