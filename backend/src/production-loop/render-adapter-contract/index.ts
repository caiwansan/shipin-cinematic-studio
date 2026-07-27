/**
 * RenderAdapter Contract — Public API
 * 
 * WORKBENCH-HARDENING-01 Phase 2
 * 
 * 使用方应通过 getRenderAdapter() 获取 adapter，
 * 禁止直接 import MockRenderAdapter / LocalMockRenderer。
 */

export type { RenderAdapter, RenderInput, RenderResult } from './render-adapter'
export { MockRenderAdapter } from './mock-render-adapter'
export { StubRenderAdapter } from './stub-render-adapter'
export { getRenderAdapter, __resetRenderAdapter_FOR_TEST_ONLY } from './factory'
export {
  assertProductionSafeUrl,
  assertProductionSafeResult,
  ProductionMockDetectedError,
} from './production-mock-detector'
