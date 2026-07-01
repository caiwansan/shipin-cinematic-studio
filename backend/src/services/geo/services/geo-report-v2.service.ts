/**
 * GEO Report V2 Generator Service
 *
 * P1-C: Deliverable Center
 *
 * Receives a projectId, fetches the latest:
 *   - DiscoveryReport (with Opportunities)
 *   - ActionPlan
 *   - VerificationReport
 *
 * Assembles them into a DeliverableReport and returns it.
 */

import { v4 as uuidv4 } from 'uuid'
import { geoPersistenceService } from './geo-persistence.service'
import type {
  DeliverableReport,
  ExecutiveSummary,
  Findings,
  Opportunities,
  Actions,
  Verification,
  RecommendationItem,
  OpportunityItem,
  ActionItem,
  ScenarioScore,
  BreakdownItem,
  RemainingIssue,
} from '../../../benchmark/deliverable/types'

// Re-export for consumers
export type {
  DeliverableReport,
  ExecutiveSummary,
  Findings,
  Opportunities,
  Actions,
  Verification,
  RecommendationItem,
  OpportunityItem,
  ActionItem,
  ScenarioScore,
  BreakdownItem,
  RemainingIssue,
}

function extractTrend(scenario: any): string {
  if (!scenario) return 'stable'
  if (typeof scenario.trend === 'string') return scenario.trend
  return 'stable'
}

function mapPriority(p: string): string {
  const lower = p.toLowerCase()
  if (lower === 'high' || lower === 'medium' || lower === 'low') return lower
  return 'medium'
}

export const geoReportV2Generator = {
  /**
   * Generate a full DeliverableReport for the given projectId
   */
  async generate(projectId: string): Promise<DeliverableReport | null> {
    // Fetch latest data from persistence service
    const [discoveryReport, actionPlan, verificationReport] = await Promise.all([
      geoPersistenceService.getDiscoveryReport(projectId),
      geoPersistenceService.getActionPlan(projectId),
      geoPersistenceService.getVerificationReport(projectId),
    ])

    if (!discoveryReport) {
      return null
    }

    // Extract discovery report data
    const drData = discoveryReport.reportData || {}
    const entityName = discoveryReport.entityName || 'Unknown Entity'
    const currentAdi = discoveryReport.adi ?? 0

    // Extract scenarios from discovery data
    const scenarios: any[] = Array.isArray(drData.scenarios) ? drData.scenarios : []

    // Extract opportunities from discovery data
    const opportunitiesRaw: any[] = Array.isArray(drData.opportunities) ? drData.opportunities : []

    // Extract action plan data
    const apData = actionPlan?.planData || {}
    const actionPlansList: any[] = Array.isArray(apData.actionPlans) ? apData.actionPlans : []

    // Extract verification data
    const vrData = verificationReport?.reportData || {}

    // --- Compute Executive Summary ---
    const beforeAdi = verificationReport?.beforeAdi ?? currentAdi
    const afterAdi = verificationReport?.afterAdi ?? currentAdi
    const deltaAdi = afterAdi - beforeAdi

    const totalActions = actionPlansList.length
    const completedActions = actionPlansList.filter((ap: any) => ap.status === 'completed').length
    const completionRate = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0

    const highPriorityOpen = opportunitiesRaw.filter(
      (o: any) => (o.priority || '').toLowerCase() === 'high'
    ).length

    // Overall health heuristic
    let overallHealth: 'good' | 'fair' | 'poor' = 'fair'
    if (currentAdi >= 70 && completionRate >= 60) overallHealth = 'good'
    else if (currentAdi < 40) overallHealth = 'poor'

    const confidence = verificationReport ? (vrData.confidence ?? 0.8) : 0.5

    const executiveSummary: ExecutiveSummary = {
      currentAdi: afterAdi,
      adiChange: deltaAdi,
      completionRate,
      topOpportunities: highPriorityOpen,
      overallHealth,
      confidence,
    }

    // --- Compute Findings ---
    const coverageCount = discoveryReport.coverageScore ?? 0

    // Sort scenarios by coverage score
    const sortedScenarios = [...scenarios].sort(
      (a, b) => (b.coverageScore ?? 0) - (a.coverageScore ?? 0)
    )

    const topScenarios: ScenarioScore[] = sortedScenarios.slice(0, 5).map((s) => ({
      name: s.scenarioName || s.name || 'Unknown',
      score: s.coverageScore ?? 0,
      trend: extractTrend(s),
    }))

    const bottomScenarios: ScenarioScore[] = sortedScenarios
      .slice(-5)
      .reverse()
      .map((s) => ({
        name: s.scenarioName || s.name || 'Unknown',
        score: s.coverageScore ?? 0,
        trend: extractTrend(s),
      }))

    const findings: Findings = {
      industry: drData.industry || '',
      entityName,
      coverageCount,
      totalScenarios: scenarios.length,
      topScenarios,
      bottomScenarios,
    }

    // --- Compute Opportunities ---
    const highCount = opportunitiesRaw.filter(
      (o: any) => (o.priority || '').toLowerCase() === 'high'
    ).length
    const mediumCount = opportunitiesRaw.filter(
      (o: any) => (o.priority || '').toLowerCase() === 'medium'
    ).length
    const lowCount = opportunitiesRaw.filter(
      (o: any) => (o.priority || '').toLowerCase() === 'low'
    ).length

    const oppItems: OpportunityItem[] = opportunitiesRaw.map((o: any) => ({
      scenarioId: o.scenarioId || o.id || '',
      scenarioName: o.scenarioName || o.name || 'Unknown',
      gap: o.gap ?? 0,
      priority: mapPriority(o.priority || 'medium'),
      expectedAdiGain: o.expectedAdiGain ?? 0,
      suggestion: o.suggestion || o.reason || '',
    }))

    const totalExpectedGain = oppItems.reduce((sum, item) => sum + item.expectedAdiGain, 0)

    const opportunities: Opportunities = {
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      totalExpectedGain,
      items: oppItems,
    }

    // --- Compute Actions ---
    const inProgressCount = actionPlansList.filter(
      (ap: any) => ap.status === 'in-progress' || ap.status === 'in_progress'
    ).length
    const skippedActions = actionPlansList.filter(
      (ap: any) => ap.status === 'skipped'
    ).length
    const pendingActions = actionPlansList.filter(
      (ap: any) => ap.status === 'pending' || ap.status === 'not-started'
    ).length

    // Estimated gain = sum of expectedImpact for completed actions
    let estimatedGain = 0
    let actualGain = 0

    // Gather steps from all action plans
    const actionItems: ActionItem[] = []
    for (const ap of actionPlansList) {
      const steps: any[] = Array.isArray(ap.steps) ? ap.steps : []
      for (const step of steps) {
        actionItems.push({
          title: step.title || step.name || 'Untitled Step',
          status: step.status || ap.status || 'pending',
          expectedImpact: step.expectedImpact ?? step.adiContribution ?? ap.estimatedImpact ?? 0,
          actualImpact: null, // Will be filled from verification
        })
      }
    }

    // If no steps found, use the action plans themselves as items
    if (actionItems.length === 0) {
      for (const ap of actionPlansList) {
        actionItems.push({
          title: ap.title || ap.name || 'Untitled Action',
          status: ap.status || 'pending',
          expectedImpact: ap.estimatedImpact ?? 0,
          actualImpact: null,
        })
      }
    }

    // Compute estimated gain from completed actions
    for (const item of actionItems) {
      if (item.status === 'completed') {
        estimatedGain += item.expectedImpact
      }
    }

    // Actual gain from verification
    actualGain = verificationReport ? Math.max(0, deltaAdi) : 0

    // Try to fill actualImpact from verification items
    if (verificationReport) {
      const verifiedItems: any[] = Array.isArray(vrData.verifiedItems)
        ? vrData.verifiedItems
        : []
      for (const vi of verifiedItems) {
        const match = actionItems.find(
          (a) => a.title === vi.title || a.title === vi.actionStepId
        )
        if (match) {
          match.actualImpact = vi.adiContribution ?? null
        }
      }
    }

    const actions: Actions = {
      total: actionItems.length,
      completed: completedActions,
      inProgress: inProgressCount,
      skipped: skippedActions,
      pending: pendingActions,
      estimatedGain,
      actualGain,
      items: actionItems,
    }

    // --- Compute Verification (if available) ---
    let verification: Verification | null = null

    if (verificationReport) {
      const breakdownRaw: any[] = Array.isArray(vrData.improvementBreakdown)
        ? vrData.improvementBreakdown
        : []

      const breakdown: BreakdownItem[] = breakdownRaw.map((b: any) => ({
        label: b.label || b.name || 'Unknown',
        contribution: b.contribution ?? 0,
      }))

      const remainingRaw: any[] = Array.isArray(vrData.remainingIssues)
        ? vrData.remainingIssues
        : []

      const remainingIssues: RemainingIssue[] = remainingRaw.map((r: any) => ({
        scenario: r.scenarioName || r.scenario || r.name || 'Unknown',
        gap: r.gap ?? 0,
        priority: mapPriority(r.priority || 'medium'),
      }))

      verification = {
        beforeAdi: verificationReport.beforeAdi,
        afterAdi: verificationReport.afterAdi,
        deltaAdi: verificationReport.deltaAdi,
        improvementRate: vrData.improvementRate ?? (
          verificationReport.beforeAdi > 0
            ? Math.round((verificationReport.deltaAdi / verificationReport.beforeAdi) * 100)
            : 0
        ),
        breakdown,
        remainingIssues,
      }
    }

    // --- Compute Next Recommendations ---
    // Based on unhandled opportunities (high priority first)
    const handledScenarios = new Set<string>()
    for (const ap of actionPlansList) {
      if (ap.status === 'completed') {
        handledScenarios.add(ap.relatedScenarioId || ap.scenarioId || '')
      }
    }

    const unhandledOpps = oppItems.filter(
      (o) => !handledScenarios.has(o.scenarioId) && o.gap > 0
    )

    // Also include remaining issues from verification
    if (verification) {
      for (const issue of verification.remainingIssues) {
        const exists = unhandledOpps.some((o) => o.scenarioName === issue.scenario)
        if (!exists) {
          unhandledOpps.push({
            scenarioId: issue.scenario,
            scenarioName: issue.scenario,
            gap: issue.gap,
            priority: issue.priority,
            expectedAdiGain: Math.round(issue.gap * 0.3),
            suggestion: '',
          })
        }
      }
    }

    // Sort: high priority first, then by gap descending
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    unhandledOpps.sort((a, b) => {
      const pDiff = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
      if (pDiff !== 0) return pDiff
      return b.gap - a.gap
    })

    const nextRecommendations: RecommendationItem[] = unhandledOpps.map((o) => ({
      scenarioId: o.scenarioId,
      scenarioName: o.scenarioName,
      gap: o.gap,
      priority: o.priority,
      expectedAdiGain: o.expectedAdiGain,
    }))

    // --- Assemble Full Report ---
    const projectName = discoveryReport.entityName || 'Unknown Project'

    const report: DeliverableReport = {
      id: `rpt-${projectId}-${Date.now()}`,
      projectId,
      projectName,
      generatedAt: new Date().toISOString(),
      executiveSummary,
      findings,
      opportunities,
      actions,
      verification,
      nextRecommendations,
    }

    return report
  },

  /**
   * Render report as Markdown string
   */
  toMarkdown(report: DeliverableReport): string {
    const lines: string[] = []

    // Title
    lines.push(`# Brand Health Report — ${report.projectName}`)
    lines.push(`**Generated:** ${new Date(report.generatedAt).toLocaleString('zh-CN')}`)
    lines.push('')

    // 1. Executive Summary
    lines.push('## 1. Executive Summary')
    lines.push('')
    lines.push(`- **Current ADI:** ${report.executiveSummary.currentAdi}`)
    lines.push(`- **ADI Change:** ${report.executiveSummary.adiChange >= 0 ? '+' : ''}${report.executiveSummary.adiChange}`)
    lines.push(`- **Completion Rate:** ${report.executiveSummary.completionRate}%`)
    lines.push(`- **Top Opportunities:** ${report.executiveSummary.topOpportunities}`)
    lines.push(`- **Confidence:** ${report.executiveSummary.confidence}`)
    lines.push(`- **Overall Health:** ${report.executiveSummary.overallHealth}`)
    lines.push('')

    // 2. Findings
    lines.push('## 2. Findings')
    lines.push('')
    lines.push(`- **Industry:** ${report.findings.industry || 'N/A'}`)
    lines.push(`- **Entity:** ${report.findings.entityName}`)
    lines.push(`- **Coverage Count:** ${report.findings.coverageCount}`)
    lines.push(`- **Total Scenarios:** ${report.findings.totalScenarios}`)
    lines.push('')
    lines.push('### Top Scenarios')
    lines.push('| Scenario | Score | Trend |')
    lines.push('|----------|-------|-------|')
    for (const s of report.findings.topScenarios) {
      lines.push(`| ${s.name} | ${s.score} | ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'} |`)
    }
    lines.push('')
    lines.push('### Bottom Scenarios')
    lines.push('| Scenario | Score | Trend |')
    lines.push('|----------|-------|-------|')
    for (const s of report.findings.bottomScenarios) {
      lines.push(`| ${s.name} | ${s.score} | ${s.trend === 'up' ? '↑' : s.trend === 'down' ? '↓' : '→'} |`)
    }
    lines.push('')

    // 3. Opportunities
    lines.push('## 3. Opportunities')
    lines.push('')
    lines.push(`- **High Priority:** ${report.opportunities.high}`)
    lines.push(`- **Medium Priority:** ${report.opportunities.medium}`)
    lines.push(`- **Low Priority:** ${report.opportunities.low}`)
    lines.push(`- **Total Expected Gain (ADI):** ${report.opportunities.totalExpectedGain.toFixed(1)}`)
    lines.push('')
    if (report.opportunities.items.length > 0) {
      lines.push('| Scenario | Gap | Priority | Expected Gain | Suggestion |')
      lines.push('|----------|-----|----------|---------------|------------|')
      for (const o of report.opportunities.items) {
        lines.push(`| ${o.scenarioName} | ${o.gap} | ${o.priority} | ${o.expectedAdiGain} | ${o.suggestion || '—'} |`)
      }
      lines.push('')
    }

    // 4. Actions
    lines.push('## 4. Actions')
    lines.push('')
    lines.push(`- **Total:** ${report.actions.total}`)
    lines.push(`- **Completed:** ${report.actions.completed}`)
    lines.push(`- **In Progress:** ${report.actions.inProgress}`)
    lines.push(`- **Skipped:** ${report.actions.skipped}`)
    lines.push(`- **Pending:** ${report.actions.pending}`)
    lines.push(`- **Estimated Gain:** ${report.actions.estimatedGain.toFixed(1)}`)
    lines.push(`- **Actual Gain:** ${report.actions.actualGain.toFixed(1)}`)
    lines.push('')
    if (report.actions.items.length > 0) {
      lines.push('| Action | Status | Expected Impact | Actual Impact |')
      lines.push('|--------|--------|-----------------|---------------|')
      for (const a of report.actions.items) {
        const actual = a.actualImpact !== null ? String(a.actualImpact) : '—'
        lines.push(`| ${a.title} | ${a.status} | ${a.expectedImpact} | ${actual} |`)
      }
      lines.push('')
    }

    // 5. Verification
    if (report.verification) {
      lines.push('## 5. Verification')
      lines.push('')
      lines.push(`- **Before ADI:** ${report.verification.beforeAdi}`)
      lines.push(`- **After ADI:** ${report.verification.afterAdi}`)
      lines.push(`- **Delta ADI:** ${report.verification.deltaAdi >= 0 ? '+' : ''}${report.verification.deltaAdi}`)
      lines.push(`- **Improvement Rate:** ${report.verification.improvementRate}%`)
      lines.push('')
      if (report.verification.breakdown.length > 0) {
        lines.push('### Improvement Breakdown')
        lines.push('| Factor | Contribution |')
        lines.push('|--------|--------------|')
        for (const b of report.verification.breakdown) {
          lines.push(`| ${b.label} | ${b.contribution >= 0 ? '+' : ''}${b.contribution} |`)
        }
        lines.push('')
      }
      if (report.verification.remainingIssues.length > 0) {
        lines.push('### Remaining Issues')
        lines.push('| Scenario | Gap | Priority |')
        lines.push('|----------|-----|----------|')
        for (const r of report.verification.remainingIssues) {
          lines.push(`| ${r.scenario} | ${r.gap} | ${r.priority} |`)
        }
        lines.push('')
      }
    }

    // 6. Next Recommendations
    if (report.nextRecommendations.length > 0) {
      lines.push('## 6. Next Recommendations')
      lines.push('')
      lines.push('| Scenario | Gap | Priority | Expected ADI Gain |')
      lines.push('|----------|-----|----------|-------------------|')
      for (const r of report.nextRecommendations) {
        lines.push(`| ${r.scenarioName} | ${r.gap} | ${r.priority} | ${r.expectedAdiGain} |`)
      }
      lines.push('')
    }

    lines.push('---')
    lines.push(`*Report ID: ${report.id}*`)

    return lines.join('\n')
  },

  /**
   * Export report as JSON
   */
  toJSON(report: DeliverableReport): string {
    return JSON.stringify(report, null, 2)
  },
}
