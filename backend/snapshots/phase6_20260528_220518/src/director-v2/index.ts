/**
 * Director V2 — Index
 *
 * === Phase 6A: API Surface Minimization ===
 *
 * 收束后只暴露 4 个生产入口：
 *   1. generate — 剧本→生成
 *   2. preview — 只读视图
 *   3. refine — 安全写
 *   4. status — 健康检查
 *
 * 所有 runtime / norm / memory / telemetry / schema 模块
 * 标记为 internal，不允许外部 import。
 */

// API Surface（唯一外部入口）
export { directorApi, DirectorApiError, ApiErrorCode } from './runtime/api-surface.js'
export type {
  GenerateInput,
  GenerateOutput,
  PreviewInput,
  PreviewOutput,
  RefineInput,
  RefineOutput,
  StatusOutput,
  SceneSummary,
  ShotSummary,
  IntentSummary,
  ProductionStatus,
} from './runtime/api-surface.js'

// ============================================================
// 🚫 Internal — 以下 export 已移除
//
// 移除项（对应 Phase 6A 收束）：
//   - StoryConstitution — 外部不应直接访问 schema
//   - constitutionCompiler — internal runtime
//   - directorBridge — internal bridge
//   - llmNormalizer — internal normalizer
//   - schemaValidator — internal validator
//   - semanticRepairEngine — internal repair
//   - defaultFallbackPolicy — internal fallback
//   - calculateConstitutionFingerprint — internal fingerprint
//   - constitutionStore — internal persistence
//   - directorMemoryStore — internal memory
//   - constitutionEventLogger — internal telemetry
//   - semanticDriftDetector — internal telemetry
//   - 所有 runtime 模块 — internal cognitive graph
// ============================================================

console.log('[DirectorV2] API Surface v1 loaded — 4 endpoints exposed')

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-api",
  "mode": "OBSERVE"
};

