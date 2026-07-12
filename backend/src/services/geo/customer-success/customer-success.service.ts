// ============================================================
// Customer Success Service — Sprint G
// Generates projected impact reports after optimization completion
// ============================================================

export interface CustomerSuccessInput {
  projectId: string
  completedActions: Array<{
    type: string
    completedAt: string
    estimatedImpact: number
  }>
  currentHealthScore: number
  currentAIVisibility: number
}

export interface CustomerSuccessReport {
  congratulations: string
  projectedImpact: {
    aiExposureIncrease: number      // 预计 AI 曝光提升
    aiCitationIncrease: number       // 预计引用增长
    newInquiries: number             // 预计新增咨询
    timeFrame: string                // 预计时间框架: "未来30天"
  }
  nextActions: Array<{
    action: string
    estimatedImpact: string
    timeToComplete: string
    suggestedDate: string            // 建议日期："7天后"
  }>
  summary: string
}

/**
 * Generates a customer success report based on project state.
 *
 * Uses heuristic multipliers derived from industry benchmarks:
 * - Each completed action contributes a weighted impact on visibility.
 * - Health score acts as a base multiplier for projected growth.
 * - AI visibility baseline drives citation & inquiry projections.
 */
export function generateCustomerSuccessReport(input: CustomerSuccessInput): CustomerSuccessReport {
  const { completedActions, currentHealthScore, currentAIVisibility } = input

  // ── Compute total impact from completed actions ──
  const totalImpact = completedActions.reduce((sum, a) => sum + (a.estimatedImpact || 0), 0)

  // ── Project AI exposure increase ──
  // Base: each impact point ~ 3-5% exposure. Capped at +60% for realism.
  const baseExposure = totalImpact * 3.8
  const healthMultiplier = 1 + (currentHealthScore - 50) / 100 // 50 → 1.0, 90 → 1.4
  const rawExposure = baseExposure * healthMultiplier
  const aiExposureIncrease = Math.min(Math.round(rawExposure), 60)

  // ── Project citation increase ──
  // Typically 30-40% of exposure gain translates to citation growth
  const rawCitations = aiExposureIncrease * 0.4
  const aiCitationIncrease = Math.min(Math.round(rawCitations), 25)

  // ── Project new inquiries ──
  // Inquiries are a fraction of citation growth, adjusted by health score
  const rawInquiries = (aiCitationIncrease / 100) * currentHealthScore * 0.12
  const newInquiries = Math.max(Math.round(rawInquiries * 10) / 10, 1)

  // ── Build next actions ──
  const nextActions = buildNextActions(input)

  // ── Summary ──
  const summary = `基于 ${completedActions.length} 项已完成优化，你的品牌预计将在未来30天内获得 AI 曝光提升 ${aiExposureIncrease}%、引用增长 ${aiCitationIncrease}%、新增咨询约 ${newInquiries} 次。建议 7 天后再次验证以跟踪趋势。`

  return {
    congratulations: generateCongratulation(aiExposureIncrease, aiCitationIncrease),
    projectedImpact: {
      aiExposureIncrease,
      aiCitationIncrease,
      newInquiries,
      timeFrame: '未来30天',
    },
    nextActions,
    summary,
  }
}

/**
 * Builds a dynamic list of recommended next actions.
 */
function buildNextActions(input: CustomerSuccessInput): CustomerSuccessReport['nextActions'] {
  const actions: CustomerSuccessReport['nextActions'] = []

  // Always suggest re-verification after 7 days
  actions.push({
    action: '7 天后再次验证品牌健康度',
    estimatedImpact: '验证优化效果是否持续，跟踪 AI 曝光变化趋势',
    timeToComplete: '7 天',
    suggestedDate: '7天后',
  })

  // If health score is below 70, suggest more optimization
  if (input.currentHealthScore < 70) {
    actions.push({
      action: '继续优化薄弱维度',
      estimatedImpact: '重点提升低分维度，预计可再提升 ADI 15-20%',
      timeToComplete: '3-5 天',
      suggestedDate: '3天后',
    })
  }

  // If visibility is below 40, suggest distribution expansion
  if (input.currentAIVisibility < 40) {
    actions.push({
      action: '扩展 AI 分发渠道',
      estimatedImpact: '覆盖更多 AI 平台，提升品牌可见度至 60%+',
      timeToComplete: '2-3 天',
      suggestedDate: '2天后',
    })
  }

  // Always suggest viewing the full report
  actions.push({
    action: '查看完整品牌健康报告',
    estimatedImpact: '获取详细的维度分析和行业对比数据',
    timeToComplete: '即时',
    suggestedDate: '现在',
  })

  return actions
}

/**
 * Generates a personalized congratulations message.
 */
function generateCongratulation(exposureIncrease: number, citationIncrease: number): string {
  if (exposureIncrease >= 40) {
    return '🎉 太棒了！你的品牌优化效果显著，AI 曝光大幅提升！'
  }
  if (exposureIncrease >= 20) {
    return '🎉 很好！你的品牌优化已取得明显进展，继续保持！'
  }
  return '🎉 恭喜！你的优化已完成，品牌可见度正在稳步提升！'
}

/**
 * Finds the optimal "suggested next" action — the one with the soonest suggested date
 * that isn't "now".
 */
export function getPrimaryNextAction(report: CustomerSuccessReport): CustomerSuccessReport['nextActions'][0] | null {
  const sorted = [...report.nextActions]
    .filter(a => a.suggestedDate !== '现在')
    .sort((a, b) => {
      const order = ['现在', '2天后', '3天后', '7天后']
      return order.indexOf(a.suggestedDate) - order.indexOf(b.suggestedDate)
    })
  return sorted[0] || report.nextActions[0] || null
}
