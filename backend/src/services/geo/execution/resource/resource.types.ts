// ============================================================
// RC3-2 — Resource Allocation Types
// ============================================================
// Provider 只是当前的一种资源。未来可能是：
// Crawler / Browser / Human Review / GPU Worker / Background Job /
// Knowledge Index / Publishing Adapter / Webhook

/**
 * ResourceType — 未来可扩展的资源类型
 * Provider 是当前唯一实现，但模型保持抽象
 */
export type ResourceType =
  | 'llm_provider'       // DeepSeek / ChatGPT / Claude
  | 'crawler'            // 网页爬虫
  | 'browser'            // 无头浏览器
  | 'knowledge_index'    // 知识索引
  | 'publishing_adapter' // 发布适配器
  | 'webhook'            // Webhook 回调
  | 'human_review'       // 人工审核
  | 'gpu_worker'         // GPU Worker
  | 'background_job'     // 后台任务
  | 'custom'             // 用户自定义

/**
 * ExecutionAssignment — 分配结果
 * 一个 ExecutionNode 可能被分配多个资源
 */
export interface ExecutionAssignment {
  nodeId: string
  capability: string
  assignedTo: string         // 资源 ID（如 provider name）
  resourceType: ResourceType
  priority: number
  reason: string             // 'fastest' | 'cheapest' | 'balanced' | 'manual' | 'circuit_breaker_preferred'
  costEstimate?: number      // 预估成本（可选，RC3-3 填充）
  durationEstimate?: number  // 预估时间（可选，RC3-3 填充）
}

/**
 * AllocationResult — 分配结果
 */
export interface AllocationResult {
  graphId: string
  requestId: string
  assignments: ExecutionAssignment[]
  strategy: string
  warnings: AllocationWarning[]
  diagnostics: AllocationDiagnostic
  createdAt: string
}

export interface AllocationWarning {
  code: 'CAPABILITY_NOT_FOUND' | 'NO_PROVIDER_AVAILABLE' | 'RESOURCE_HEALTHY' | 'STRATEGY_FALLBACK'
  message: string
  nodeId?: string
}

export interface AllocationDiagnostic {
  totalNodes: number
  allocated: number
  unallocated: number
  strategyUsed: string
  duration: number       // ms
}
