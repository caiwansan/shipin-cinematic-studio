/**
 * 工作台状态类型
 *
 * 用于半成品工作台治理，替代散落的 enabled: false
 */
export type WorkspaceStatus =
  | 'stable'    // 正式版，完整功能
  | 'beta'      // 公测版，功能完整但可能有 bug
  | 'preview'   // 预览版，部分功能未开放
  | 'hidden'    // 隐藏，半成品不展示
  | 'deprecated' // 即将下线

export interface WorkspaceConfig {
  id: string
  name: string
  status: WorkspaceStatus
  visibleOnHome: boolean
  routeAccessible: boolean
  /** 完成度百分比 */
  completion?: number
  /** 备注 */
  note?: string
}
