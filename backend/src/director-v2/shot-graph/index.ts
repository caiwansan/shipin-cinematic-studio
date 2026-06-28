/**
 * shot-graph — Director Runtime 导演层核心
 *
 * Shot Graph = 唯一导演输出结构
 * Prompt Compiler = 只负责单镜头转换
 *
 * 使用方式：
 *   const graph = buildShotGraph(narrative)
 *   const results = shotGraphToSpecs(graph)
 *   for (const { spec } of results) {
 *     const { prompt, scores } = compileAndScore(spec)
 *   }
 */

export { buildShotGraph } from './build-shot-graph.js'
export { shotToSpec, shotGraphToSpecs } from './shot-to-spec.js'
export { scoreShotGraph } from './shot-graph-scorer.js'
export { validateShotNode, validateShotGraph } from './shot-graph-schema.js'
export type {
  ShotNode,
  ShotGraph,
  ShotIntent,
  ShotCamera,
  ShotContinuity,
  ValidationIssue,
} from './shot-graph-schema.js'
export type { ShotSpecResult } from './shot-to-spec.js'
export type { ShotGraphScores, ShotScores } from './shot-graph-scorer.js'
