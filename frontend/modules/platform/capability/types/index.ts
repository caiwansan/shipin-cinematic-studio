// ============================================================
// Capability Module — Type Definitions (Frontend)
// ============================================================

export type CapabilityCategory =
  | 'Generation'
  | 'Analysis'
  | 'Extraction'
  | 'Transformation'
  | 'Publishing'
  | 'Reasoning'
  | 'Search'
  | 'Translation'
  | 'Vision'
  | 'Audio'
  | 'Video'
  | 'Workflow'
  | 'Knowledge'
  | 'Utility'

export type ContractStatus = 'active' | 'deprecated' | 'removed'

export type RoutingStrategyType = 'QualityFirst' | 'CostFirst' | 'LatencyFirst' | 'Balanced' | 'Custom'

export interface CapabilityContract {
  id: string
  name: string
  displayName: string
  description: string | null
  category: CapabilityCategory | string
  version: string
  inputSchema: string | null
  outputSchema: string | null
  constraints: string | null
  qualityProfile: string | null
  permissionProfile: string | null
  tags: string | null
  status: ContractStatus
  metadata: string | null
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface ProviderMapping {
  id: string
  capabilityId: string
  provider: string
  priority: number
  config: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  validatedAt: string
}

export interface ValidationError {
  field: string
  code: string
  message: string
  value?: unknown
}

export interface ValidationWarning {
  field: string
  code: string
  message: string
  value?: unknown
}

export interface ResolverRequest {
  capabilityName: string
  capabilityVersion?: string
  input?: Record<string, unknown>
  context?: {
    userId?: string
    projectId?: string
    workspaceId?: string
    priority?: number
    budgetLimit?: number
    preferredProvider?: string
  }
  metadata?: Record<string, unknown>
}

export interface ResolverResponse {
  success: boolean
  provider: string
  capability: string
  version: string
  result: Record<string, unknown> | null
  error: string | null
  validationResult: ValidationResult | null
  metrics: {
    resolveTimeMs: number
    strategyUsed: RoutingStrategyType
  }
}

export interface CatalogSearchRequest {
  query?: string
  category?: CapabilityCategory | string
  tags?: string[]
  status?: ContractStatus
  version?: string
  limit?: number
  offset?: number
}

export interface CatalogSearchResponse {
  items: CapabilityContract[]
  total: number
  limit: number
  offset: number
}

export interface CapabilityStats {
  totalContracts: number
  activeContracts: number
  deprecatedContracts: number
  categoriesCount: number
  categories: { category: string; count: number }[]
}

export interface CapabilityHealth {
  initialized: boolean
  registeredCount: number
  timestamp: string
}

export const CAPABILITY_CATEGORIES: { value: CapabilityCategory; label: string; icon: string }[] = [
  { value: 'Generation', label: '生成', icon: '✨' },
  { value: 'Analysis', label: '分析', icon: '🔍' },
  { value: 'Extraction', label: '提取', icon: '📥' },
  { value: 'Transformation', label: '转换', icon: '🔄' },
  { value: 'Publishing', label: '发布', icon: '📤' },
  { value: 'Reasoning', label: '推理', icon: '🧠' },
  { value: 'Search', label: '搜索', icon: '🔎' },
  { value: 'Translation', label: '翻译', icon: '🌐' },
  { value: 'Vision', label: '视觉', icon: '👁️' },
  { value: 'Audio', label: '音频', icon: '🎵' },
  { value: 'Video', label: '视频', icon: '🎬' },
  { value: 'Workflow', label: '工作流', icon: '⚙️' },
  { value: 'Knowledge', label: '知识', icon: '📚' },
  { value: 'Utility', label: '工具', icon: '🛠️' },
]

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, { label: string; color: string }> = {
  active: { label: '活跃', color: 'green' },
  deprecated: { label: '已废弃', color: 'orange' },
  removed: { label: '已移除', color: 'red' },
}
