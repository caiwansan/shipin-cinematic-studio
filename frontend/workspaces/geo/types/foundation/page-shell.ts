/**
 * PageShell Component Contract — Foundation Types
 *
 * These types define the public API for all Foundation components.
 * No Vue imports, no business logic, no references to GEO domain concepts.
 *
 * @file page-shell.ts
 */

/**
 * Breadcrumb 面包屑
 * 页面结构化定位，"你现在在哪"
 */
export interface Breadcrumb {
  /** 显示名称 */
  label: string
  /** 路由路径（最后一项无 path，表示当前位置） */
  path?: string
  /** 是否可点击 */
  disabled?: boolean
}

/**
 * ErrorState 错误状态
 * 所有 Foundation 组件公开的错误接口
 */
export interface ErrorState {
  /** 错误标题 — 用户语言 */
  title: string
  /** 错误原因 — 可选，为用户解释为什么发生 */
  reason?: string
  /** 建议操作 — 用户下一步可以做什么 */
  suggestion?: string
  /** 重试回调 — 可选，提供重试操作 */
  onRetry?: () => void | Promise<void>
}

/**
 * EmptyState 空状态类型
 * 区分不同的空值场景，每种对应不同的引导文案
 */
export type EmptyStateType =
  | 'new-user'       // 新用户，还没有创建品牌
  | 'no-results'     // AI 分析未返回结果
  | 'no-history'     // 无历史记录
  | 'no-brand'       // 尚未创建品牌
  | 'no-connection'  // 尚未连接发布渠道
  | 'no-selection'   // 未选择项目
  | 'custom'         // 自定义空状态（需提供 title/description）

/**
 * EmptyState 配置
 */
export interface EmptyStateConfig {
  /** 空状态类型 */
  type?: EmptyStateType
  /** 自定义标题（priority over type） */
  title?: string
  /** 自定义描述（priority over type） */
  description?: string
  /** 自定义操作按钮文案 */
  actionLabel?: string
  /** 操作按钮点击回调 */
  onAction?: () => void
}

/**
 * LoadingState 加载状态
 */
export interface LoadingState {
  /** 是否正在加载 */
  active: boolean
  /** 加载描述文案（可选，如"AI 正在分析..."） */
  text?: string
}

/**
 * Status priority chain — 状态优先级
 *
 * loading > error > empty > default
 *
 * 任何组件/页面都不得自行改变这个优先级。
 * 当 loading=true 时，不关心 error/empty/content。
 * 当 error 存在时，不关心 empty/content。
 * 当 empty 存在时，不关心 content。
 * 全部为 false 时，展示 default（content slot）。
 */
export type StatusPriority = 'loading' | 'error' | 'empty' | 'content'
