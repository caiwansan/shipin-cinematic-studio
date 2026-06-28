// ============================================================
// Governance Frontend Types — KMKI-PLAT-012
// ============================================================

// ─── Tenant ───
export interface TenantDTO {
  id: string
  name: string
  type: 'personal' | 'team' | 'enterprise'
  status: 'active' | 'inactive' | 'suspended'
  metadata?: Record<string, any>
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

// ─── Organization ───
export interface GovOrganizationDTO {
  id: string
  tenantId: string
  name: string
  type: string
  parentId?: string
  status: string
  createdAt: string
  updatedAt: string
  children?: GovOrganizationDTO[]
}

// ─── User ───
export interface GovUserDTO {
  id: string
  tenantId: string
  email?: string
  name: string
  role?: string
  status: string
  createdAt: string
  updatedAt: string
}

// ─── Role ───
export interface RoleDTO {
  id: string
  tenantId: string
  code: string
  name: string
  description?: string
  capabilities: string[]
  createdAt: string
  updatedAt: string
}

// ─── Subscription Plan ───
export interface SubscriptionPlanDTO {
  id: string
  code: string
  name: string
  description?: string
  price?: number
  currency: string
  billingCycle: string
  capabilities: Record<string, any>
  status: string
  createdAt: string
  updatedAt: string
}

// ─── Subscription ───
export interface SubscriptionDTO {
  id: string
  tenantId: string
  planId: string
  status: string
  startDate: string
  endDate?: string
  autoRenew: boolean
  plan?: SubscriptionPlanDTO
}

// ─── Quota ───
export interface QuotaDTO {
  id: string
  tenantId: string
  dailyTokens: number
  monthlyTokens: number
  imageCredits: number
  videoMinutes: number
  speechMinutes: number
  concurrentJobs: number
  workflowRuns: number
  agentSessions: number
  storage: number
  workspaceCount: number
  createdAt: string
  updatedAt: string
}

// ─── Usage Record ───
export interface UsageRecordDTO {
  id: string
  tenantId: string
  resourceType: string
  amount: number
  unit: string
  capability?: string
  source: string
  sourceId?: string
  recordedAt: string
}

// ─── Billing ───
export interface BillingRecordDTO {
  id: string
  tenantId: string
  type: string
  amount: number
  currency: string
  description?: string
  source: string
  createdAt: string
}

// ─── Audit Log ───
export interface AuditLogDTO {
  id: string
  tenantId: string
  userId?: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  createdAt: string
}

// ─── Policy ───
export interface PolicyDTO {
  id: string
  tenantId?: string
  code: string
  name: string
  type: string
  rules: Record<string, any>
  enabled: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

// ─── License ───
export interface LicenseDTO {
  id: string
  tenantId: string
  licenseKey: string
  status: string
  seats: number
  modules: string[]
  startDate: string
  endDate?: string
}

// ─── Analytics ───
export interface UsageSummary {
  totalTokens: number
  totalImages: number
  totalVideoMinutes: number
  totalAudioMinutes: number
  totalWorkflowRuns: number
  totalCost: number
}

export interface CostTrendPoint {
  date: string
  cost: number
}

export interface CapabilityUsage {
  capability: string
  count: number
}

// ─── Governance Overview ───
export interface GovernanceOverview {
  tenant?: TenantDTO
  subscription?: SubscriptionDTO
  quota?: QuotaDTO
  usage?: UsageRecordDTO[]
  recentAudit?: AuditLogDTO[]
}

// ─── API Response ───
export interface ApiResponse<T = any> {
  success: boolean
  data: T
  error?: string
}
