// ============================================================
// FallbackGraph — RC2-3b
// 不继承 RFC2 FallbackRouter（只保留作为接口锚点）
// 而是作为独立的 graph transformation layer
// ============================================================

export interface FallbackNode {
  id: string
  originalNodeId: string      // 原始节点 ID
  provider: string            // fallback provider
  capability: string          // fallback capability
  fallbackLevel: number       // 降级层级（1=主备, 2=次备...）
  priority: number            // fallback 链内优先级
}

export interface FallbackGraph {
  id: string
  originalNodeId: string      // 触发 fallback 的原始节点
  fallbackNodes: FallbackNode[]  // 降级节点链
  selectedNodeId: string | null    // 最终选中的 fallback node id
  status: 'pending' | 'active' | 'completed' | 'exhausted'
  createdAt: string
}

export interface FallbackConfig {
  maxFallbackLevel: number      // 最大降级层数（默认 2）
  requireCircuitCheck: boolean  // 是否检查 CB 状态（默认 true）
}
