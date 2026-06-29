// P3.1 — Execution Recipe DSL
// 纯声明层，不执行逻辑，不调用 API，不管理状态
// 只是将现有 discover / graph / kq 能力定义为"可声明模板"

/** 执行步骤标识 */
export type ExecutionStepId = 'discover' | 'graph.build' | 'knowledge.quality'

/** 执行模式 */
export type ExecutionMode = 'auto' | 'step' | 'debug'

/** 用户目标类型 */
export type GoalType = 'seo' | 'geo' | 'brand' | 'knowledge'

/** 输出资产类型 */
export type OutputType = 'knowledge_graph' | 'report' | 'asset'

/** 单步执行定义 */
export interface RecipeStep {
  id: ExecutionStepId
  capabilityId: string
  label: string
  description: string
  requiredTier: string
  icon: string
}

/** Recipe — 系统行为描述 JSON */
export interface ExecutionRecipe {
  id: string
  name: string
  description: string
  goal: GoalType
  mode: ExecutionMode
  steps: RecipeStep[]
  outputType: OutputType
  tags: string[]
}

// ─────────────────────────────────────────
// 内置 Recipe 模板
// ─────────────────────────────────────────

const STEP_DEFS: Record<ExecutionStepId, Omit<RecipeStep, 'requiredTier'>> = {
  'discover': {
    id: 'discover',
    capabilityId: 'geo.execution.discover',
    label: '🔍 实体发现',
    description: '从目标文档/URL 中提取关键实体',
    icon: '🔍',
  },
  'graph.build': {
    id: 'graph.build',
    capabilityId: 'geo.execution.graph.build',
    label: '🔗 知识图谱',
    description: '构建实体关系图谱',
    icon: '🔗',
  },
  'knowledge.quality': {
    id: 'knowledge.quality',
    capabilityId: 'geo.execution.kq',
    label: '✅ 质量评估',
    description: '评估知识质量和一致性',
    icon: '✅',
  },
}

/** 步骤默认所需 Tier（也可从 PermissionService 获取） */
const STEP_TIER: Record<ExecutionStepId, string> = {
  'discover': 'FREE',
  'graph.build': 'VIP_1',
  'knowledge.quality': 'VIP_2',
}

/** 所有步骤定义（供 UI 展示/选择） */
export function getStepDefs(): Omit<RecipeStep, 'requiredTier'>[] {
  return Object.values(STEP_DEFS)
}

/** 内置 Recipe 模板列表 */
export function getBuiltinRecipes(): ExecutionRecipe[] {
  return [
    {
      id: 'geo-knowledge-fast',
      name: '快速扫描',
      description: '快速实体发现 → 知识图谱基础构建（约 1-3 分钟）',
      goal: 'geo',
      mode: 'auto',
      outputType: 'knowledge_graph',
      tags: ['快速', '基础'],
      steps: [
        { ...STEP_DEFS['discover'], requiredTier: STEP_TIER['discover'] },
        { ...STEP_DEFS['graph.build'], requiredTier: STEP_TIER['graph.build'] },
      ],
    },
    {
      id: 'geo-knowledge-full',
      name: 'GEO 完整构建',
      description: '全流程: 实体发现 → 图谱构建 → 质量评估（约 3-8 分钟）',
      goal: 'geo',
      mode: 'auto',
      outputType: 'knowledge_graph',
      tags: ['完整', 'GEO'],
      steps: [
        { ...STEP_DEFS['discover'], requiredTier: STEP_TIER['discover'] },
        { ...STEP_DEFS['graph.build'], requiredTier: STEP_TIER['graph.build'] },
        { ...STEP_DEFS['knowledge.quality'], requiredTier: STEP_TIER['knowledge.quality'] },
      ],
    },
    {
      id: 'geo-quality-audit',
      name: '质量审核',
      description: '只做质量评估和一致性检查（约 2-5 分钟）',
      goal: 'geo',
      mode: 'auto',
      outputType: 'report',
      tags: ['审核', '质量'],
      steps: [
        { ...STEP_DEFS['knowledge.quality'], requiredTier: STEP_TIER['knowledge.quality'] },
      ],
    },
  ]
}

/** 根据 goal 筛选合适的 recipe */
export function getRecipesByGoal(goal: GoalType): ExecutionRecipe[] {
  return getBuiltinRecipes().filter(r => r.goal === goal)
}

/** 根据 tier 筛选可用的 recipe（所有步都满足 tier 才可用） */
export function getAccessibleRecipes(
  userTier: string,
  goal?: GoalType
): ExecutionRecipe[] {
  const tierOrder: Record<string, number> = {
    FREE: 0, VIP_1: 1, VIP_2: 2, ADMIN: 99,
  }
  const userLevel = tierOrder[userTier] ?? 0

  let recipes = getBuiltinRecipes()
  if (goal) recipes = recipes.filter(r => r.goal === goal)

  return recipes.filter(recipe =>
    recipe.steps.every(step => {
      const requiredLevel = tierOrder[step.requiredTier] ?? 0
      return userLevel >= requiredLevel
    })
  )
}

/** 获取可用执行模式（根据 tier） */
export function getAvailableModes(userTier: string): ExecutionMode[] {
  const modes: ExecutionMode[] = ['auto']
  if (userTier === 'VIP_1' || userTier === 'VIP_2' || userTier === 'ADMIN') {
    modes.push('step')
  }
  if (userTier === 'VIP_2' || userTier === 'ADMIN') {
    modes.push('debug')
  }
  return modes
}

/** recipe → project config 序列化（存入 executionResults） */
export function serializeRecipeConfig(recipe: ExecutionRecipe, mode: ExecutionMode): object {
  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    goal: recipe.goal,
    mode,
    steps: recipe.steps.map(s => ({
      id: s.id,
      capabilityId: s.capabilityId,
      label: s.label,
      requiredTier: s.requiredTier,
    })),
    outputType: recipe.outputType,
  }
}

/** Goal 显示名称 */
export function goalDisplayName(goal: GoalType): string {
  const map: Record<GoalType, string> = {
    seo: 'SEO 优化',
    geo: 'GEO 知识图谱',
    brand: '品牌情报',
    knowledge: '知识构建',
  }
  return map[goal] || goal
}

/** Goal 描述 */
export function goalDescription(goal: GoalType): string {
  const map: Record<GoalType, string> = {
    seo: '优化网站在知识图谱中的语义曝光',
    geo: '构建品牌/实体的知识图谱体系',
    brand: '分析品牌在知识空间中的关联度',
    knowledge: '从多源数据构建结构化知识',
  }
  return map[goal] || ''
}
