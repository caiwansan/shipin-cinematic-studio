// ============================================================
// Governance Types — KMKI-PLAT-012
// Platform Control Plane type definitions
// ============================================================

import type { PlatformContext } from '@platform/context/platform-context.js'

// ─── Tenant ───

export interface TenantDTO {
  id: string
  name: string
  type: 'personal' | 'team' | 'enterprise'
  status: 'active' | 'inactive' | 'suspended'
  metadata?: Record<string, any>
  schemaVersion: number
  createdAt: Date
  updatedAt: Date
}

export interface CreateTenantInput {
  name: string
  type: 'personal' | 'team' | 'enterprise'
  metadata?: Record<string, any>
}

// ─── Organization ───

export interface GovOrganizationDTO {
  id: string
  tenantId: string
  name: string
  type: 'personal' | 'team' | 'enterprise' | 'department'
  parentId?: string
  status: 'active' | 'inactive'
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  children?: GovOrganizationDTO[]
}

// ─── User ───

export interface GovUserDTO {
  id: string
  tenantId: string
  email?: string
  name: string
  role?: string
  status: 'active' | 'inactive' | 'suspended'
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

// ─── Role ───

export interface RoleDTO {
  id: string
  tenantId: string
  code: string
  name: string
  description?: string
  capabilities: string[] // capability codes
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface CreateRoleInput {
  tenantId: string
  code: string
  name: string
  description?: string
  capabilities: string[]
}

// ─── Subscription Plan ───

export interface SubscriptionPlanDTO {
  id: string
  code: string
  name: string
  description?: string
  price?: number
  currency: string
  billingCycle: 'monthly' | 'yearly' | 'once'
  capabilities: Record<string, any> // granted capabilities and limits
  metadata?: Record<string, any>
  schemaVersion: number
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
}

export interface CreatePlanInput {
  code: string
  name: string
  description?: string
  price?: number
  currency?: string
  billingCycle: 'monthly' | 'yearly' | 'once'
  capabilities: Record<string, any>
}

// ─── Subscription ───

export interface SubscriptionDTO {
  id: string
  tenantId: string
  planId: string
  status: 'active' | 'expired' | 'cancelled' | 'suspended'
  startDate: Date
  endDate?: Date
  autoRenew: boolean
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  plan?: SubscriptionPlanDTO
}

// ─── Capability Grant ───

export interface CapabilityGrantDTO {
  id: string
  planId: string
  capability: string
  limits?: Record<string, any>
  metadata?: Record<string, any>
  createdAt: Date
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
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface QuotaCheckResult {
  allowed: boolean
  current: number
  limit: number
  resourceType: string
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
  metadata?: Record<string, any>
  recordedAt: Date
}

// ─── Billing Record ───

export interface BillingRecordDTO {
  id: string
  tenantId: string
  type: 'subscription' | 'usage' | 'overage' | 'refund'
  amount: number
  currency: string
  description?: string
  source: string
  metadata?: Record<string, any>
  createdAt: Date
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
  userAgent?: string
  metadata?: Record<string, any>
  createdAt: Date
}

export interface AuditQueryFilter {
  tenantId: string
  action?: string
  resource?: string
  userId?: string
  fromDate?: Date
  toDate?: Date
  limit?: number
  offset?: number
}

// ─── Policy ───

export interface PolicyDTO {
  id: string
  tenantId?: string
  code: string
  name: string
  type: 'quota' | 'security' | 'region' | 'rateLimit' | 'approval' | 'compliance' | 'content'
  rules: Record<string, any>
  enabled: boolean
  priority: number
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface PolicyEvaluationResult {
  allowed: boolean
  policyCode: string
  reason?: string
  details?: Record<string, any>
}

// ─── License ───

export interface LicenseDTO {
  id: string
  tenantId: string
  licenseKey: string
  status: 'active' | 'expired' | 'revoked'
  seats: number
  modules: string[]
  startDate: Date
  endDate?: Date
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

// ─── Analytics Daily ───

export interface AnalyticsDailyDTO {
  id: string
  tenantId: string
  date: Date
  metric: string
  value: number
  metadata?: Record<string, any>
  createdAt: Date
}

export interface UsageSummary {
  totalTokens: number
  totalImages: number
  totalVideoMinutes: number
  totalAudioMinutes: number
  totalWorkflowRuns: number
  totalCost: number
}

export interface CostTrend {
  period: string
  data: Array<{ date: string; cost: number }>
}

// ─── Governance Context ───

export interface GovernanceContext {
  tenant?: TenantDTO
  role?: RoleDTO
  capabilities: string[]
  quota?: QuotaDTO
  policies: PolicyDTO[]
  context: PlatformContext
}
