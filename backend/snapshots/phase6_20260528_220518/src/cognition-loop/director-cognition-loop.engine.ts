/**
 * Director Cognition Loop Engine — 导演认知循环引擎
 *
 * 闭环流程：
 *   Plan → Lock → Execute → Perceive → Evaluate → Update → Re-Lock
 *
 * 这是系统的"单一导演意识循环"核心。
 */

import { showrunnerCore } from '../showrunner/showrunner-core.js'
import { intentStateManager, type DirectorIntentState } from './director-intent-state.js'
import { analyzeIntentDrift, type DriftReport, type CorrectionPatch } from './intent-feedback-analyzer.js'

// ============================================================
// Cognition Loop
// ============================================================

export interface CognitionLoopOptions {
  projectId: string
  episodeId: string
  script: string
  totalEpisodes: number
  traceId: string
  maxIterations: number  // 最大循环次数
  driftThreshold: number // 漂移容忍阈值
}

export interface CognitionLoopResult {
  projectId: string
  episodeId: string
  iterations: number
  finalIntentState: DirectorIntentState | null
  driftHistory: DriftReport[]
  patchesApplied: CorrectionPatch[]
  status: 'converged' | 'max_iterations' | 'failed'
  totalLatency: number
}

export class DirectorCognitionLoop {
  /**
   * 运行一次完整的认知循环
   */
  async run(options: CognitionLoopOptions): Promise<CognitionLoopResult> {
    const start = Date.now()
    const driftHistory: DriftReport[] = []
    const patchesApplied: CorrectionPatch[] = []
    const { projectId, episodeId, script, totalEpisodes, traceId, maxIterations, driftThreshold } = options
    let currentIntent: DirectorIntentState | null = null
    let iteration = 0

    console.log(`[CognitionLoop] 开始 project=${projectId} episode=${episodeId}`)

    while (iteration < maxIterations) {
      iteration++
      console.log(`[CognitionLoop] 迭代 ${iteration}/${maxIterations}`)

      // ============================================================
      // Phase 1: Plan — Showrunner Core 生成制片计划
      // ============================================================
      console.log(`[CognitionLoop] Phase 1: Plan (iter ${iteration})`)
      const plan = await showrunnerCore.planProduction(script, {
        projectId,
        totalEpisodes,
        traceId: `${traceId}_iter${iteration}`,
      })

      // ============================================================
      // Phase 2: Lock — 锁定为 Director Intent State
      // ============================================================
      console.log(`[CognitionLoop] Phase 2: Lock`)
      currentIntent = intentStateManager.lockIntent(plan, {
        episodeId,
        projectId,
        traceId: `${traceId}_locked`,
      })

      // ============================================================
      // Phase 3: Execute — 模拟执行（实际场景会调用 Scheduler + Pipeline）
      // ============================================================
      console.log(`[CognitionLoop] Phase 3: Execute`)
      const mockOutput = this.simulateExecution(currentIntent)

      // ============================================================
      // Phase 4-5: Perceive + Evaluate — Review Engine 分析
      // ============================================================
      console.log(`[CognitionLoop] Phase 4-5: Perceive + Evaluate`)
      const driftReport = analyzeIntentDrift(currentIntent, mockOutput)
      driftHistory.push(driftReport)

      // ============================================================
      // Phase 6: Update — 如果漂移超过阈值，修正 Intent State
      // ============================================================
      if (driftReport.overallDriftScore > driftThreshold) {
        console.log(`[CognitionLoop] Phase 6: Update (drift=${driftReport.overallDriftScore.toFixed(2)})`)

        if (driftReport.correctionPatch) {
          patchesApplied.push(driftReport.correctionPatch)

          // 根据修正补丁更新 Intent State
          if (driftReport.correctionPatch.type !== 'accept') {
            intentStateManager.updateIntent(projectId, episodeId, {
              globalEmotion: driftReport.correctionPatch.patchData.emotion || currentIntent.globalEmotion,
              visualTone: driftReport.correctionPatch.patchData.visualTone || currentIntent.visualTone,
              cameraLanguage: driftReport.correctionPatch.patchData.cameraLanguage || currentIntent.cameraLanguage,
            })
            currentIntent = intentStateManager.getIntent(projectId, episodeId)
          }
        }

        // 继续下一轮循环（Re-Lock）
        continue
      }

      // ============================================================
      // 收敛：漂移低于阈值，循环结束
      // ============================================================
      console.log(`[CognitionLoop] Converged after ${iteration} iterations`)
      const totalLatency = Date.now() - start

      return {
        projectId,
        episodeId,
        iterations: iteration,
        finalIntentState: currentIntent,
        driftHistory,
        patchesApplied,
        status: 'converged',
        totalLatency,
      }
    }

    // 达到最大迭代次数
    console.log(`[CognitionLoop] Max iterations (${maxIterations}) reached`)
    return {
      projectId,
      episodeId,
      iterations: maxIterations,
      finalIntentState: currentIntent,
      driftHistory,
      patchesApplied,
      status: 'max_iterations',
      totalLatency: Date.now() - start,
    }
  }

  /**
   * 模拟执行：生成带有随机漂移的输出
   * 实际系统中会调用 Scheduler + Pipeline + Video Gen
   */
  private simulateExecution(intent: DirectorIntentState): any {
    // 生成与 Intent State 基本对齐的输出
    const randomDrift = Math.random() * 0.4  // 0-40% 随机漂移
    const shouldDrift = Math.random() > 0.5

    return {
      emotion: shouldDrift ? '偏离_' + intent.globalEmotion : intent.globalEmotion,
      visualTone: intent.visualTone,
      cameraLanguage: randomDrift > 0.2 ? intent.cameraLanguage : '偏离_' + intent.cameraLanguage,
      characters: Object.values(intent.characterStates).map(c => ({
        id: c.characterId,
        name: c.name,
        emotion: c.currentEmotion,
      })),
    }
  }
}

export const cognitionLoop = new DirectorCognitionLoop()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "cognition-loop",
  "mode": "LEGACY"
};

