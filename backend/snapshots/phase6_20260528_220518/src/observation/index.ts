/**
 * observation/index.ts — 观测层统一导出
 *
 * 所属层：Observation Layer
 *
 * 导出内容（只读投影，不参与执行）：
 *   - VisualGraph / VisualNode / VisualEdge — 可视化图类型
 *   - buildVisualGraph / buildNodeLayout — 静态图构建
 *   - ExecutionTracker — 执行状态跟踪
 *   - mapExecutionToGraph / mapExecutionToStatusList — 状态注入
 */
export { buildVisualGraph, buildNodeLayout } from './graph-builder.js'
export { ExecutionTracker } from './execution-tracker.js'
export { mapExecutionToGraph, mapExecutionToStatusList } from './state-mapper.js'
export type { VisualNode, VisualEdge, VisualGraph, VisualNodeStatus, ObservationTimelineItem } from './types.js'
export type { ExecutionTrace, TraceStep } from './execution-tracker.js'
