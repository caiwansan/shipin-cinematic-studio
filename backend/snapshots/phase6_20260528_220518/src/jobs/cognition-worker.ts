/**
 * Cognition Worker — 在后台执行 Cognition Loop
 */

import { showrunnerCore } from '../showrunner/showrunner-core.js'
import { intentStateManager } from '../cognition-loop/director-intent-state.js'
import { analyzeIntentDrift } from '../cognition-loop/intent-feedback-analyzer.js'
import { jobStore } from './job-store.js'

export async function runCognitionJob(
  jobId: string,
  script: string,
  projectId: string,
  episodeId: string,
  totalEpisodes: number,
): Promise<void> {
  try {
    // Step 1: Plan
    jobStore.setProgress(jobId, 10, 'Showrunner 规划中')
    const plan = await showrunnerCore.planProduction(script, {
      projectId,
      totalEpisodes,
      traceId: `cog_${jobId}`,
    })
    jobStore.addTrace(jobId, { step: 'showrunner_plan', status: 'completed', output: {}, timestamp: Date.now() })

    // Step 2: Lock
    jobStore.setProgress(jobId, 30, '意图锁定中')
    const intent = intentStateManager.lockIntent(plan, { projectId, episodeId, traceId: `cog_lock_${jobId}` })
    jobStore.addTrace(jobId, { step: 'intent_lock', status: 'completed', output: { emotion: intent.globalEmotion }, timestamp: Date.now() })

    // Step 3: Simulate (mock for now)
    jobStore.setProgress(jobId, 50, '预演中')
    const mockOutput = {
      emotion: intent.globalEmotion,
      visualTone: intent.visualTone,
      cameraLanguage: intent.cameraLanguage,
      characters: Object.values(intent.characterStates).map(c => ({
        id: c.characterId,
        name: c.name,
        emotion: c.currentEmotion,
      })),
    }
    jobStore.addTrace(jobId, { step: 'simulate', status: 'completed', output: {}, timestamp: Date.now() })

    // Step 4: Perceive + Evaluate
    jobStore.setProgress(jobId, 70, '感知评估中')
    const drift = analyzeIntentDrift(intent, mockOutput)
    jobStore.addTrace(jobId, { step: 'evaluate', status: 'completed', output: { driftScore: drift.overallDriftScore }, timestamp: Date.now() })

    // Step 5: 如果需要修正
    if (drift.overallDriftScore > 0.3 && drift.correctionPatch) {
      jobStore.setProgress(jobId, 85, '修正中')
      intentStateManager.updateIntent(projectId, episodeId, {
        globalEmotion: drift.correctionPatch.patchData.emotion || intent.globalEmotion,
        visualTone: drift.correctionPatch.patchData.visualTone || intent.visualTone,
      })
      jobStore.addTrace(jobId, { step: 'correction', status: 'completed', output: { patch: drift.correctionPatch.type }, timestamp: Date.now() })
    }

    const finalIntent = intentStateManager.getIntent(projectId, episodeId)

    // 完成
    jobStore.complete(jobId, {
      plan: { status: plan.status, totalEpisodes, totalLatency: plan.totalLatency },
      intent: finalIntent,
      drift,
      converged: drift.overallDriftScore <= 0.3,
    })
    jobStore.addTrace(jobId, { step: 'completed', status: 'completed', output: { converged: drift.overallDriftScore <= 0.3 }, timestamp: Date.now() })
  } catch (err: any) {
    jobStore.fail(jobId, err.message || '未知错误')
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "worker-registry",
  "mode": "WORKER"
};

