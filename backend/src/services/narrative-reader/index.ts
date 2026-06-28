/**
 * index.ts — Narrative Reader Runtime Y.1 入口
 *
 * 提供初始化 + chapter hook 集成。
 * Y.1 pipeline 可独立运行（不依赖此入口）。
 */

export { initY1Pipeline, runY1Pipeline } from './core/pipeline.js'
export { onChapterCompleted } from './integration/onChapterCompleted.js'
export { writeEventLog } from './storage/event_store.js'
export { computeDriftMetrics, persistDriftSnapshot, getDriftTimeline } from './observation/drift.js'
export type { Y1Output, Y1Entity, Y1Event } from './core/schema.js'
