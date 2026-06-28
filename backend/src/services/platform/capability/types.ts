// ============================================================
// Capability Platform — Type Definitions
// ============================================================

// ─── Capability Category Enum ───

export enum CapabilityCategory {
  Generation = 'Generation',
  Analysis = 'Analysis',
  Extraction = 'Extraction',
  Transformation = 'Transformation',
  Publishing = 'Publishing',
  Reasoning = 'Reasoning',
  Search = 'Search',
  Translation = 'Translation',
  Vision = 'Vision',
  Audio = 'Audio',
  Video = 'Video',
  Workflow = 'Workflow',
  Knowledge = 'Knowledge',
  Utility = 'Utility',
}

// ─── Contract Interface ───

export interface CapabilityContract {
  id: string
  name: string
  displayName: string
  description: string | null
  category: CapabilityCategory | string
  version: string
  inputSchema: string | null       // JSON Schema string
  outputSchema: string | null      // JSON Schema string
  constraints: string | null       // JSON string
  qualityProfile: string | null    // JSON string
  permissionProfile: string | null // JSON string
  tags: string | null              // JSON array string
  status: ContractStatus
  metadata: string | null          // JSON string
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export type ContractStatus = 'active' | 'deprecated' | 'removed'

// ─── Capability Metadata Profiles ───

export interface CostProfile {
  estimatedCostPerCall: number
  costUnit: string
  maxBudgetPerCall: number | null
  currency: string
}

export interface LatencyProfile {
  p50Ms: number
  p95Ms: number
  p99Ms: number
  timeoutMs: number
}

export interface QualityProfile {
  expectedScore: number
  minAcceptableScore: number
  metrics: Record<string, number>
}

export interface SecurityProfile {
  requiresAuth: boolean
  allowedRoles: string[]
  dataClassification: string
  encryptionRequired: boolean
}

export interface AvailabilityProfile {
  sla: number          // percentage
  maintenanceWindows: string | null
  regionRestrictions: string[]
}

export interface RateLimitProfile {
  requestsPerSecond: number
  requestsPerMinute: number
  requestsPerHour: number
  concurrentLimit: number
}

export interface CapabilityMetadata {
  cost: CostProfile | null
  latency: LatencyProfile | null
  quality: QualityProfile | null
  security: SecurityProfile | null
  availability: AvailabilityProfile | null
  rateLimit: RateLimitProfile | null
}

// ─── Routing Strategy ───

export enum RoutingStrategyType {
  QualityFirst = 'QualityFirst',
  CostFirst = 'CostFirst',
  LatencyFirst = 'LatencyFirst',
  Balanced = 'Balanced',
  Custom = 'Custom',
}

// ─── Resolver Interfaces ───

export interface ResolverRequest {
  capabilityName: string
  capabilityVersion?: string
  input: Record<string, unknown>
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

// ─── Validation Interfaces ───

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

// ─── Event Types ───

export type CapabilityEventType =
  | 'Registered'
  | 'Updated'
  | 'Deprecated'
  | 'Removed'
  | 'Validated'
  | 'Resolved'

export interface CapabilityEvent {
  type: CapabilityEventType
  capabilityId: string
  capabilityName: string
  timestamp: string
  payload?: Record<string, unknown>
}

// ─── Contract Builder Interfaces ───

export interface ContractBuilderInput {
  name: string
  displayName: string
  description?: string
  category: CapabilityCategory | string
  version?: string
  inputSchema?: object
  outputSchema?: object
  constraints?: Record<string, unknown>
  qualityProfile?: Record<string, unknown>
  permissionProfile?: Record<string, unknown>
  tags?: string[]
  metadata?: Record<string, unknown>
}

// ─── Contract Migration Interfaces ───

export interface ContractMigration {
  fromVersion: string
  toVersion: string
  changes: MigrationChange[]
  backwardCompatible: boolean
}

export interface MigrationChange {
  type: 'added' | 'removed' | 'modified' | 'renamed'
  path: string
  description: string
}

// ─── Catalog Interfaces ───

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

export type ResolverPlugin = (request: ResolverRequest) => Promise<ResolverResponse>

export interface ResolverPluginRegistry {
  register(plugin: ResolverPlugin): void
  list(): ResolverPlugin[]
}
