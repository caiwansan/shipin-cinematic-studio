/**
 * RC-W1-D: 全局 EngineStatus 统一
 *
 * 整个 Workspace 共用同一套状态枚举和 UX helper。
 * 后续新增引擎/组件时直接引用，不再各自定义。
 */

/** 统一引擎状态 — 覆盖所有可能 */
export type EngineStatus =
  | 'idle'       // 待机，等待上游触发
  | 'queued'     // 已排队，等待执行
  | 'running'    // 执行中
  | 'completed'  // 执行成功
  | 'warning'    // 有警告（如低置信度）
  | 'failed'     // 执行失败

/** 状态中文标签 */
export const ENGINE_STATUS_LABELS: Record<EngineStatus, string> = {
  idle: '待机',
  queued: '排队中',
  running: '运行中',
  completed: '已完成',
  warning: '有警告',
  failed: '失败',
}

/** 状态颜色（Bootstrap-like, 用于 badge） */
export const ENGINE_STATUS_COLORS: Record<EngineStatus, string> = {
  idle: '#64748b',    // slate-500
  queued: '#f59e0b',  // amber-500
  running: '#10b981', // emerald-500
  completed: '#3b82f6', // blue-500
  warning: '#f97316',  // orange-500
  failed: '#ef4444',   // red-500
}

/** 状态背景色 */
export const ENGINE_STATUS_BG: Record<EngineStatus, string> = {
  idle: '#f1f5f9',
  queued: '#fef3c7',
  running: '#dcfce7',
  completed: '#dbeafe',
  warning: '#ffedd5',
  failed: '#fee2e2',
}

/** 状态 CSS class 后缀（用于 scoped class 拼接） */
export const ENGINE_STATUS_CLASS: Record<EngineStatus, string> = {
  idle: 'idle',
  queued: 'queued',
  running: 'running',
  completed: 'completed',
  warning: 'warning',
  failed: 'failed',
}

/** 状态动画（running 用 pulse，其他静态） */
export function getStatusAnimation(status: EngineStatus): string {
  return status === 'running' ? 'pulse 2s infinite' : 'none'
}

/** 状态图标 */
export const ENGINE_STATUS_ICONS: Record<EngineStatus, string> = {
  idle: '○',
  queued: '⋯',
  running: '◉',
  completed: '✓',
  warning: '⚠',
  failed: '✗',
}

/** 引擎名称 → 显示名 + 图标 */
export const ENGINE_LABELS: Record<string, { label: string; icon: string }> = {
  discovery: { label: 'Discovery', icon: '🔍' },
  knowledge: { label: 'Knowledge', icon: '📚' },
  recommendation: { label: 'Recommendation', icon: '💡' },
  mission: { label: 'Mission', icon: '🎯' },
  verification: { label: 'Verification', icon: '✅' },
  publishing: { label: 'Publishing', icon: '📤' },
  learning: { label: 'Learning', icon: '🧠' },
}

/** 引擎名 → 详情页路由 */
export const ENGINE_ROUTES: Record<string, string> = {
  discovery: '/workspace/geo/discovery',
  knowledge: '/workspace/geo/knowledge',
  recommendation: '/workspace/geo/recommendations',
  mission: '/workspace/geo/mission-center',
  verification: '/workspace/geo/verification',
  publishing: '/workspace/geo/publishing',
  learning: '/workspace/geo/learning',
}

/**
 * 从任意 status 字符串规范化为 EngineStatus
 * 兼容旧版各种命名
 */
export function normalizeStatus(s: string | undefined | null): EngineStatus {
  if (!s) return 'idle'
  const lower = s.toLowerCase()
  if (lower === 'pending' || lower === 'queued') return 'queued'
  if (lower === 'processing' || lower === 'running' || lower === 'scanning') return 'running'
  if (lower === 'success' || lower === 'done' || lower === 'finished') return 'completed'
  if (lower === 'warning' || lower === 'degraded') return 'warning'
  if (lower === 'error' || lower === 'failed') return 'failed'
  if (lower === 'ready') return 'idle'
  return 'idle'
}
