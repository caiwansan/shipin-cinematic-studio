/**
 * director-runtime/index.ts
 *
 * Director Runtime 统一导出入口。
 *
 * Phase 2 Implementation — 可编译骨架系统
 * ❌ 不调 LLM
 * ✔ 纯确定性结构映射
 * ✔ 可测试
 * ✔ 边界守卫集成
 */

export { directorRuntime, logDirectorEvent } from './core.js'
export { generateDirectorPlan } from './plan-generator.js'
export { buildNarrativeGraph } from './narrative-graph.js'
export { compileBlueprint, compilerAPI, compileWithStyle } from './director-to-blueprint-compiler.js'
export { validateDirectorPlan, validateBlueprintCleanliness } from './validator.js'

export type {
  DirectorInput,
  DirectorPlan,
  DirectorConstraints,
  DirectorReference,
  DirectorRuntime,
  NarrativeGraph,
  NarrativeNode,
  NarrativeEdge,
} from './types.js'

export type {
  BlueprintSeed,
  CompilerConfig as BlueprintCompilerConfig,
} from './director-to-blueprint-compiler.js'
