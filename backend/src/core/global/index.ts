/**
 * P6 — Global 统一导出
 */

export type { Region } from './region.js'
export { createRegion } from './region.js'
export { regionRouter } from './region-router.js'
export type { RoutingDecision, RouteRequest } from './region-router.js'
export { globalScheduler } from './global-scheduler.js'
export { clusterFederation } from './cluster-federation.js'
export { globalStateMesh } from './global-state-mesh.js'
export { latencyRouter } from './latency-router.js'
export { costBasedRouter } from './cost-based-router.js'
