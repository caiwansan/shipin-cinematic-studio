/**
 * metrics.ts — Y.1 Narrative Reader 指标观测层
 *
 * 组合 Drift + EventLog 查询，提供更高层级的分析接口。
 */

export { computeDriftMetrics, persistDriftSnapshot, getDriftTimeline } from './drift.js'
export { writeEventLog, getEventLogByDoc } from '../storage/event_store.js'
