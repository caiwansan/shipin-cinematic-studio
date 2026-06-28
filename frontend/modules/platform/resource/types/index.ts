// ============================================================
// Resource Module — Type Definitions (Frontend)
// KMKI-PLAT-008
// ============================================================

export type ResourceType =
  | 'LLM'
  | 'Embedding'
  | 'Image'
  | 'Video'
  | 'Speech'
  | 'Tool'
  | 'MCP'
  | 'Browser'
  | 'Human'
  | 'Webhook'

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

export interface ResourceContract {
  id: string
  name: string
  type: string
  vendor: string
  description?: string
  capabilities?: string
  models?: string
  endpoints?: string
  authentication?: string
  pricing?: string
  limits?: string
  metadata?: string
  schemaVersion: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface ResourceCredential {
  id: string
  resourceId: string
  tenantId: string
  workspaceId?: string
  name: string
  encryptedKey: string
  endpoint?: string
  models?: string
  status: string
  rotationPolicy?: string
  lastRotated?: string
  expiresAt?: string
  metadata?: string
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface ResourceHealth {
  id: string
  resourceId: string
  credentialId?: string
  status: HealthStatus
  latencyMs?: number
  errorRate?: number
  rateLimitRemaining?: number
  quotaRemaining?: number
  lastSuccessAt?: string
  lastFailureAt?: string
  failureReason?: string
  metadata?: string
  checkedAt: string
}

export interface ResourceCapabilityMatrix {
  id: string
  resourceId: string
  capabilityId: string
  supported: boolean
  qualityScore?: number
  costMultiplier?: number
  metadata?: string
  createdAt: string
  updatedAt: string
}

export interface ResourceUsage {
  id: string
  credentialId: string
  tenantId: string
  workspaceId?: string
  resourceType: string
  model?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  latencyMs?: number
  estimatedCost?: number
  actualCost?: number
  currency: string
  status: string
  executionId?: string
  metadata?: string
  createdAt: string
}

export interface ResourceCost {
  id: string
  resourceId: string
  tenantId: string
  workspaceId?: string
  billingPeriod: string
  totalCost: number
  currency: string
  metadata?: string
  periodStart: string
  periodEnd: string
  createdAt: string
  updatedAt: string
}

export interface ResolveRequest {
  capabilityName: string
  strategy?: string
  tenantId: string
  workspaceId?: string
  options?: {
    maxCost?: number
    maxLatencyMs?: number
    minQuality?: number
    preferredVendors?: string[]
    preferredModels?: string[]
  }
}

export interface ResolveResponse {
  resource: ResourceContract
  credential: ResourceCredential
  resolvedStrategy: string
  resolveTimeMs: number
  confidence: number
  alternatives?: Array<{
    resource: ResourceContract
    reason: string
  }>
}

export interface CatalogItem {
  resource: ResourceContract
  health?: ResourceHealth | null
  capabilityCount: number
}

export interface CatalogGroup {
  type: string
  label: string
  count: number
  items: CatalogItem[]
}

export interface ResolverStrategy {
  name: string
  description: string
}

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  LLM: 'Large Language Model',
  Embedding: 'Embedding Model',
  Image: 'Image Generation',
  Video: 'Video Generation',
  Speech: 'Speech Synthesis',
  Tool: 'Function Tool',
  MCP: 'MCP Server',
  Browser: 'Browser Agent',
  Human: 'Human Review',
  Webhook: 'Webhook Endpoint',
}

export const RESOURCE_TYPE_ICONS: Record<string, string> = {
  LLM: '🧠',
  Embedding: '📊',
  Image: '🎨',
  Video: '🎬',
  Speech: '🎤',
  Tool: '🔧',
  MCP: '🔌',
  Browser: '🌐',
  Human: '👤',
  Webhook: '🔗',
}
