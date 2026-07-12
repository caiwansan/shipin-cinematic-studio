// ============================================================
// Discovery Events — EventBus 事件定义
// Event Payload 只包含 executionId，监听者自己拉数据
// ============================================================

export const DiscoveryEvents = {
  DiscoveryCompleted: 'geo.discovery.completed',
  StageCompleted: 'geo.discovery.stage.completed',
  DiscoveryFailed: 'geo.discovery.failed',
} as const

/** Event Payload — 只包含 executionId，监听者通过 Repository 拉取数据 */
export interface DiscoveryCompletedPayload {
  executionId: string
  projectId: string
  entityId: string
  resultId: string
  version: string
}

export interface DiscoveryFailedPayload {
  executionId: string
  projectId: string
  entityId: string
  error: string
  failedStage?: string
}
