/**
 * adapters/ppt-adapter.ts — Phase W.1 PPT 工作台 Adapter
 *
 * 将 PPT WorkbenchSnapshot 映射为统一 RuntimeStateV1。
 * 不做结构性迁移，不修改 PPT 现有 schema。
 *
 * 映射关系（仅注释声明，未来实现）：
 *
 *   PPT WorkbenchSnapshot          →  RuntimeStateV1
 *   ─────────────────────────────────────────────
 *   snapshot.id                     →  workbenchId
 *   snapshot.version                →  metadata (schemaVersion)
 *   snapshot.slides[] + layoutSpec  →  entities (pages)
 *   snapshot.slideOrder             →  graph.nodes
 *   snapshot.presentation.theme    →  runtime.theme
 *   snapshot.images[]               →  artifacts.images
 *   snapshot.uiState               →  uiState
 */

import { registerAdapter } from './adapter-registry.js'
import type { RuntimeAdapter, RuntimeStateV1 } from '../persistence/contract.js'

export const PPT_ADAPTER_TYPE = 'ppt'

const pptAdapter: RuntimeAdapter = {
  async serialize(): Promise<RuntimeStateV1> {
    // Phase W.1 占位 — 待 W.2 实现
    throw new Error('[PPTAdapter] serialize not yet implemented (Phase W.2)')
  },

  async deserialize(_state: RuntimeStateV1): Promise<void> {
    // Phase W.1 占位 — 待 W.2 实现
    throw new Error('[PPTAdapter] deserialize not yet implemented (Phase W.2)')
  },
}

// 自动注册（导入即注册）
registerAdapter(PPT_ADAPTER_TYPE, pptAdapter)

export default pptAdapter
