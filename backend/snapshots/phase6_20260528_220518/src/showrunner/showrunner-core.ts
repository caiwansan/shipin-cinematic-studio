/**
 * Showrunner Core — 总导演大脑
 *
 * 5 层认知结构：
 * Layer 1: Narrative Understanding — 叙事理解
 * Layer 2: Emotional Engine — 情绪建模
 * Layer 3: Structural Planner — 结构规划
 * Layer 4: Production Strategist — 制片策略
 * Layer 5: Execution Orchestrator — 执行统筹
 *
 * 循环：Plan → Execute → Review → Adjust → Re-plan
 */

import { analyzeNarrative, type NarrativeUnderstanding } from './narrative-understanding.js'
import { buildEmotionalArchitecture, type EmotionalArchitecture } from './emotional-engine.js'
import { generateBlueprint, type SeriesBlueprint } from './structural-planner.js'
import { generateStrategy, type ProductionStrategy } from './production-strategist.js'
import { orchestrate, dispatchToScheduler, type ExecutionTaskGraph } from './execution-orchestrator.js'

// ============================================================
// Showrunner Result
// ============================================================

export interface ShowrunnerOutput {
  // 5 层认知输出
  narrative: NarrativeUnderstanding
  emotion: EmotionalArchitecture
  blueprint: SeriesBlueprint
  strategy: ProductionStrategy
  taskGraph: ExecutionTaskGraph

  // 元信息
  totalEpisodes: number
  projectId: string
  status: 'completed' | 'degraded' | 'partial'
  totalTokens: number
  totalLatency: number
  degradeSteps: string[]
}

// ============================================================
// Showrunner Core
// ============================================================

export class ShowrunnerCore {
  /**
   * 全流程制片规划：
   * 输入完整剧本 → 输出完整制片蓝图 + 任务图
   */
  async planProduction(
    script: string,
    config: {
      projectId: string
      totalEpisodes?: number
      traceId?: string
    },
  ): Promise<ShowrunnerOutput> {
    const start = Date.now()
    const degradeSteps: string[] = []
    const totalEpisodes = config.totalEpisodes || 60
    let totalTokens = 0

    // ============================================================
    // Layer 1: 叙事理解
    // ============================================================
    console.log('[Showrunner] Layer 1: 叙事理解...')
    const narrative = await analyzeNarrative(script, config.traceId)
    totalTokens += 2000 // estimated
    if (!narrative.theme) degradeSteps.push('narrative-understanding')

    // ============================================================
    // Layer 2: 情绪建模
    // ============================================================
    console.log('[Showrunner] Layer 2: 情绪建模...')
    const emotion = await buildEmotionalArchitecture(narrative, totalEpisodes, config.traceId)
    totalTokens += 4000
    if (emotion.seriesEmotionCurve.length === 0) degradeSteps.push('emotional-engine')

    // ============================================================
    // Layer 3: 结构规划
    // ============================================================
    console.log('[Showrunner] Layer 3: 结构规划...')
    const blueprint = await generateBlueprint(narrative, emotion, totalEpisodes, config.traceId)
    totalTokens += 4000
    if (blueprint.episodes.length === 0) degradeSteps.push('structural-planner')

    // ============================================================
    // Layer 4: 制片策略（规则引擎，不调 LLM）
    // ============================================================
    console.log('[Showrunner] Layer 4: 制片策略...')
    const strategy = generateStrategy(blueprint, totalEpisodes)

    // ============================================================
    // Layer 5: 执行统筹
    // ============================================================
    console.log('[Showrunner] Layer 5: 执行统筹...')
    const taskGraph = orchestrate(blueprint, config.projectId)

    const totalLatency = Date.now() - start

    return {
      narrative,
      emotion,
      blueprint,
      strategy,
      taskGraph,
      totalEpisodes,
      projectId: config.projectId,
      status: degradeSteps.length === 0 ? 'completed' : degradeSteps.length <= 2 ? 'partial' : 'degraded',
      totalTokens,
      totalLatency,
      degradeSteps,
    }
  }

  /**
   * Plan → Execute → Review → Adjust → Re-plan 循环
   */
  async executeProduction(
    script: string,
    config: {
      projectId: string
      totalEpisodes?: number
      traceId?: string
    },
  ): Promise<{ plan: ShowrunnerOutput; graphIds: string[] }> {
    // Step 1: Plan
    const plan = await this.planProduction(script, config)

    // Step 2: Execute（提交到 Scheduler）
    const graphIds = await dispatchToScheduler(plan.taskGraph)

    // Step 3: Review（异步，通过 review engine）
    // Step 4: Adjust（review 后发现问题的自动修正）
    // Step 5: Re-plan（在下一轮 execution 中体现）

    // 注：Step 3-5 是异步循环过程，这里触发的只是第一次执行
    // Review → Adjust → Re-plan 将在 scheduler 执行完成后触发

    return { plan, graphIds }
  }
}

export const showrunnerCore = new ShowrunnerCore()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "showrunner-v1",
  "mode": "LEGACY"
};

