/**
 * Outcome View Types — Frontend-facing DTOs for Outcome Visibility Layer
 * OI-02: 将 OrganizationId 转换为 CEO 可理解的展示对象
 */

// ── Outcome Summary (CEO Dashboard 首屏) ──

export interface OutcomeSummaryView {
  period: 'TODAY' | 'WEEK' | 'MONTH'
  totals: {
    actions: number
    outcomes: number
    impactValue: string
  }
  agents: OutcomeAgentView[]
}

export interface OutcomeAgentView {
  agentId: string
  agentName: string
  actionsCompleted: number
  outcomesGenerated: number
  impactValue: string
  topOutcome?: string
}

// ── Action → Outcome Timeline ──

export interface OutcomeTimelineView {
  actionId: string
  agentName: string
  actionName: string
  status: string
  outcome: {
    type: string
    description: string
  } | null
  impact: {
    metricType: string
    value: string
    unit: string
  } | null
  completedAt: string
}

// ── AI Employee Impact Card ──

export interface AIEmployeeImpactView {
  agentId: string
  agentName: string
  agentType: string
  todayActions: number
  todayOutcomes: number
  impactSummary: {
    metricType: string
    totalValue: string
    unit: string
  } | null
  verifiedOutcomes: number
}

// ── Empty States ──

export interface OutcomeEmptyState {
  hasAnyData: boolean
  message: string
  cta?: string
}

// ── Internal DTO (service layer → route) ≈

export interface OutcomeSummaryDto {
  organizationId: string
  period: string
  totalActions: number
  totalOutcomes: number
  totalImpact: Array<{ metricType: string; value: string; unit: string }>
  agentBreakdown: Array<{
    agentId: string
    agentName: string
    actions: number
    outcomes: number
    topImpact: { metricType: string; value: string; unit: string } | null
    topOutcome: string | null
  }>
}

export interface OutcomeTimelineDto {
  organizationId: string
  items: Array<{
    actionId: string
    agentName: string
    actionName: string
    status: string
    outcomeType: string | null
    outcomeDescription: string | null
    impactMetricType: string | null
    impactValue: string | null
    impactUnit: string | null
    completedAt: string | null
  }>
}
