// ============================================================
// Dual Write Module — Stage 3
// ============================================================

export { DualWriteManager } from './dualwrite-manager'
export { createDualWriteManager, registerHooks } from './registry'
export { FeatureFlagService, featureFlagService } from './feature-flag-service'
export { PrismaEventSink } from './prisma-event-sink'
export type { WriteEvent, SyncResult, DualWriteHook, WatcherReport, EventSink } from './dualwrite-manager'
