// ============================================================
// C0 Events — GEO 平台统一事件定义
//
// 每个 Consumer 只监听前一个事件，不跨层监听
// 事件链固定为：
//   DiscoveryCompleted
//     → RecommendationsGenerated
//     → MissionQueued
//     → MissionCompleted
//     → VerificationCompleted
//     → PublishingCompleted
//     → LearningUpdated
// ============================================================

/** 所有事件的名称常量 */
export const C0Events = {
  DiscoveryCompleted: 'geo.c0.discovery.completed',
  RecommendationsGenerated: 'geo.c0.recommendations.generated',
  MissionQueued: 'geo.c0.mission.queued',
  MissionCompleted: 'geo.c0.mission.completed',
  VerificationCompleted: 'geo.c0.verification.completed',
  PublishingCompleted: 'geo.c0.publishing.completed',
  LearningUpdated: 'geo.c0.learning.updated',
} as const

/** Base 事件 Payload */
export interface C0EventBase {
  executionId: string
  projectId: string
  entityId: string
  timestamp: string
}

export interface DiscoveryCompletedEvent extends C0EventBase {
  envelopeTraceId: string
  signalsCount: number
  providersCount: number
}

export interface MissionCompletedEvent extends C0EventBase {
  missionId: string
  actionPlanId: string
  completedAt: string
  actionsCompleted: number
  actionsTotal: number
}

export interface VerificationCompletedEvent extends C0EventBase {
  verificationId: string
  missionId: string
  passed: boolean
  score: number
  verifiedAt: string
}

export interface PublishingCompletedEvent extends C0EventBase {
  publishId: string
  verificationId: string
  publishedAt: string
  channels: string[]
}

export interface LearningUpdatedEvent extends C0EventBase {
  signalIds: string[]
  verificationResults: string[]
  updatedAt: string
}
