/**
 * Showrunner Core — Layer 4: Production Strategist
 *
 * 制片策略层：决定怎么拍，而不是拍什么。
 * - 成本优化（哪些集用廉价方案）
 * - 渲染优先级（高成本镜头的调度）
 * - 资源复用策略（角色、场景、道具复用）
 * - 风险控制（哪些集/镜头可能失败，预置降级方案）
 */

// ============================================================
// Production Strategy
// ============================================================

export interface ProductionStrategy {
  budgetAllocation: BudgetAllocation[]
  renderPriorityQueue: RenderPriority[]
  assetReusePlan: AssetReuse[]
  riskManagement: RiskManagement[]
  totalEstimatedCost: number
  optimizationSummary: string
}

export interface BudgetAllocation {
  episode: number
  budgetLevel: 'low' | 'medium' | 'high'
  reason: string
  costSavingMeasures: string[]
}

export interface RenderPriority {
  episode: number
  scenes: string[]
  priority: number  // 1-10
  deadline: string
  fallbackStrategy: string
}

export interface AssetReuse {
  assetType: 'character' | 'scene' | 'prop' | 'animation'
  sourceEpisode: number
  reuseEpisodes: number[]
  modificationRequired: string
}

export interface RiskManagement {
  episode: number
  riskType: 'character_complexity' | 'scene_scale' | 'action_sequence' | 'emotion_subtlety'
  riskLevel: number  // 1-10
  mitigationStrategy: string
  degradePlan: string
}

export function generateStrategy(blueprint: any, totalEpisodes: number): ProductionStrategy {
  // 基于 blueprint 的结构化策略生成（规则引擎驱动，不调用 LLM）
  const budget: BudgetAllocation[] = []
  const renderQueue: RenderPriority[] = []
  const reuse: AssetReuse[] = []
  const risk: RiskManagement[] = []

  for (let i = 1; i <= totalEpisodes; i++) {
    const ep = blueprint.episodes?.find((e: any) => e.episode === i)

    // 预算分配：关键集高预算，过渡集低预算
    const isCritical = blueprint.criticalEpisodes?.includes(i)
    budget.push({
      episode: i,
      budgetLevel: isCritical ? 'high' : ep?.priority === 'high' ? 'medium' : 'low',
      reason: isCritical ? '关键剧情集' : ep?.priority === 'high' ? '重要推进集' : '过渡/填充集',
      costSavingMeasures: isCritical ? [] : ['简化场景复杂度', '复用已有资产', '减少特效镜头'],
    })

    // 渲染优先级：关键集优先
    if (isCritical) {
      renderQueue.push({
        episode: i,
        scenes: ep?.keyScenes || ['全部场景'],
        priority: 10,
        deadline: '优先',
        fallbackStrategy: '简化渲染参数，降低分辨率',
      })
    }

    // 资源复用：角色/场景跨集复用
    if (i > 1 && blueprint.overallStructure) {
      reuse.push({
        assetType: 'character',
        sourceEpisode: 1,
        reuseEpisodes: [i],
        modificationRequired: i % 5 === 0 ? '角色服装变化' : '无',
      })
    }

    // 风险控制：高冲突集有风险
    const conflictLevel = ep?.conflictLevel || 5
    if (conflictLevel >= 7) {
      risk.push({
        episode: i,
        riskType: conflictLevel >= 9 ? 'action_sequence' : 'emotion_subtlety',
        riskLevel: conflictLevel,
        mitigationStrategy: '分段渲染，逐帧检查',
        degradePlan: conflictLevel >= 9 ? '降级为静态分镜+动画' : '降低渲染分辨率',
      })
    }
  }

  return {
    budgetAllocation: budget,
    renderPriorityQueue: renderQueue,
    assetReusePlan: reuse,
    riskManagement: risk,
    totalEstimatedCost: budget.filter(b => b.budgetLevel === 'high').length * 100 +
      budget.filter(b => b.budgetLevel === 'medium').length * 50 +
      budget.filter(b => b.budgetLevel === 'low').length * 20,
    optimizationSummary: `共${totalEpisodes}集，${
      budget.filter(b => b.budgetLevel === 'high').length
    }集高预算，${budget.filter(b => b.budgetLevel === 'medium').length}集中等预算，${
      budget.filter(b => b.budgetLevel === 'low').length
    }集低预算优化`,
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "showrunner-v1",
  "mode": "LEGACY"
};

