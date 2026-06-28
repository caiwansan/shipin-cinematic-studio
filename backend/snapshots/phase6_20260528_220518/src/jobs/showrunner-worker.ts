/**
 * Showrunner Worker v2 — Memory + Reflection Engine (Async-Safe)
 *
 * 所有 jobStore 调用 await 化，替换 memory Map 为 PostgreSQL。
 * Narrative LLM 调用加 12s timeout + fallback。
 */

import { analyzeNarrative } from '../showrunner/narrative-understanding.js'
import { buildEmotionalArchitecture } from '../showrunner/emotional-engine.js'
import { generateBlueprint } from '../showrunner/structural-planner.js'
import { generateStrategy } from '../showrunner/production-strategist.js'
import { orchestrate } from '../showrunner/execution-orchestrator.js'
import { jobStore } from './job-store.js'
import { workerMemoryManager, WorkerMemory } from './worker-memory.js'
import { reflectionEngine } from './reflection-engine.js'
import { intentRouter } from './intent-engine-v3/index.js'
import { scenarioGenerator } from './multi-scenario-v4/scenario-generator.js'
import { scenarioSimulator } from './multi-scenario-v4/scenario-simulator.js'
import { scenarioEvaluator } from './multi-scenario-v4/scenario-evaluator.js'
import { directorSelectionBrain } from './multi-scenario-v4/director-selection-brain.js'
import { llmPool } from './llm-pool.js'
import { worldMemory } from '../services/world-memory.service.js'
import { jobQueue } from './job-queue.js'

// ============================================================
// Narrative Fallback — LLM 超时时使用的规则引擎模板
// ============================================================
function fallbackNarrative(intentType: string, scenarioType: string, script: string): any {
  const themeMap: Record<string, string> = {
    concept: '概念探索',
    story_seed: '故事发展',
    full_story: '完整叙事',
    scene_request: '场景刻画',
    emotion_seed: '情绪渲染',
  }

  const toneMap: Record<string, string> = {
    commercial: '轻快主流，节奏紧凑',
    emotional: '温暖细腻，情感驱动',
    artistic: '抽象内省，氛围至上',
    high_tension: '紧张悬疑，张力拉满',
  }

  return {
    theme: themeMap[intentType] || '通用叙事',
    tone: toneMap[scenarioType] || '中性',
    storyBeats: [
      { beat: '开场建立', description: '建立世界观和角色初始状态' },
      { beat: '冲突引入', description: '引入核心矛盾或困境' },
      { beat: '发展升级', description: '冲突加深，角色面临选择' },
      { beat: '高潮转折', description: '核心冲突爆发，关键抉择' },
      { beat: '收束结局', description: '冲突解决，情绪落地' },
    ],
    visualIntent: 'cinematic',
    narrativeArc: 'rise_fall_resolve',
    isFallback: true,
  }
}

const NARRATIVE_TIMEOUT_MS = 12000

/**
 * 执行单步（async-safe）
 */
async function runStep(
  step: string,
  executor: () => Promise<any>,
  memory: WorkerMemory,
  jobId: string,
  _progress: number,
): Promise<any> {
  const start = Date.now()

  workerMemoryManager.updateStepState(memory.projectId, step, {
    status: 'running',
    correctionCount: 0,
  })
  workerMemoryManager.logDecision(memory.projectId, {
    step,
    action: 'execute',
    reason: `开始执行步骤 ${step}`,
    timestamp: Date.now(),
  })
  await jobStore.setProgress(jobId, _progress, step)

  let result = await executor()

  const reflection = reflectionEngine.analyze(step, result, memory)

  workerMemoryManager.updateStepState(memory.projectId, step, {
    output: result,
    reflection,
    latency: Date.now() - start,
    status: 'completed',
  })

  workerMemoryManager.logDecision(memory.projectId, {
    step,
    action: 'execute',
    reason: `步骤 ${step} 完成，一致性评分 ${reflection.consistencyScore.toFixed(2)}`,
    timestamp: Date.now(),
  })

  // Self-Correction Loop
  if (reflection.needsCorrection) {
    const correction = reflectionEngine.planCorrection(step, reflection, memory)
    workerMemoryManager.logDecision(memory.projectId, {
      step,
      action: 'correct',
      reason: `修正：${correction.reason}`,
      timestamp: Date.now(),
    })

    for (let retry = 0; retry < 2; retry++) {
      const retryResult = await executor()
      const retryReflection = reflectionEngine.analyze(step, retryResult, memory)

      workerMemoryManager.updateStepState(memory.projectId, step, {
        output: retryResult,
        reflection: retryReflection,
        correctionCount: retry + 1,
        status: 'corrected',
      })

      if (!retryReflection.needsCorrection) {
        result = retryResult
        break
      }
      result = retryResult
    }
  }

  updateMemoryFromStep(memory, step, result)
  return result
}

function updateMemoryFromStep(memory: WorkerMemory, step: string, result: any): void {
  switch (step) {
    case 'narrative':
      memory.globalState.tone = result.theme || 'neutral'
      break
    case 'emotion':
      if (result.seriesEmotionCurve) {
        memory.episodeContext.emotionArc = `曲线长度：${result.seriesEmotionCurve.length}`
      }
      break
    case 'structure':
      if (result.episodes) {
        memory.globalState.timeline = result.episodes.map((e: any) => ({
          episode: e.episode,
          title: e.title || `第 ${e.episode} 集`,
        }))
      }
      break
    case 'strategy':
      if (result.characters) {
        result.characters.forEach((c: any) => {
          memory.globalState.characters[c.id || c.name] = c
        })
      }
      break
  }
}

/**
 * 带超时的 narrative 执行器
 */
async function narrativeWithFallback(
  script: string,
  jobId: string,
  intentType: string,
  scenarioType: string,
  userId?: string,
): Promise<any> {
  // 通过 LLM Pool 获取 slot
  const acquired = await llmPool.acquire(12000)
  if (!acquired) {
    console.warn(`[ShowrunnerWorker] LLMPool reject/timeout, fallback immediately for job ${jobId}`)
    llmPool.recordCall(false)
    return fallbackNarrative(intentType, scenarioType, script)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), NARRATIVE_TIMEOUT_MS)

  let success = false
  try {
    const result = await analyzeNarrative(script, `showrunner_${jobId}`, userId)
    clearTimeout(timeout)
    success = true
    return result
  } catch (err: any) {
    clearTimeout(timeout)
    console.warn(`[ShowrunnerWorker] Narrative LLM timeout/error, using fallback. Error: ${err.message}`)
    return fallbackNarrative(intentType, scenarioType, script)
  } finally {
    llmPool.recordCall(success)
    llmPool.release()
  }
}

/**
 * Showrunner Worker v2 — 入口函数（async-safe）
 */
export async function runShowrunnerJob(
  jobId: string,
  script: string,
  totalEpisodes: number,
  projectId: string,
  userId?: string,
): Promise<void> {
  try {
    const memory = workerMemoryManager.create(projectId, { totalEpisodes })

    // Intent Engine v3
    const intentProfile = intentRouter.route(script)
    memory.intentProfile = intentProfile

    const directive = intentRouter.buildWorkerDirective(intentProfile)
    const userScript = directive + '\n---\n原始输入:\n' + script
    const effectiveEpisodes = intentProfile.elasticity.constraints.maxEpisodes || totalEpisodes

    await jobStore.addTrace(jobId, {
      step: 'intent_analysis',
      status: 'completed',
      output: {
        intentType: intentProfile.classification.intentType,
        strength: intentProfile.strength.intentStrength,
        mode: intentProfile.elasticity.mode,
        expansionLevel: intentProfile.elasticity.expansionLevel,
      },
      timestamp: Date.now(),
    })

    // ============================================================
    // Multi-Scenario Director Brain v4
    // ============================================================
    await jobStore.setProgress(jobId, 5, '多版本策划中')

    const scenarioResult = scenarioGenerator.generate(intentProfile, effectiveEpisodes)
    await jobStore.addTrace(jobId, {
      step: 'multi_scenario_generation',
      status: 'completed',
      output: {
        count: scenarioResult.scenarios.length,
        types: scenarioResult.scenarios.map(s => s.type),
        diversity: scenarioResult.diversity,
      },
      timestamp: Date.now(),
    })

    const simResults = scenarioResult.scenarios.map(s => scenarioSimulator.simulate(s))
    await jobStore.addTrace(jobId, {
      step: 'scenario_simulation',
      status: 'completed',
      output: simResults.map(r => ({
        id: r.scenarioId,
        successScore: r.successScore,
        engagement: r.audienceEngagement,
      })),
      timestamp: Date.now(),
    })

    const scores = scenarioResult.scenarios.map((s, i) =>
      scenarioEvaluator.evaluate(s, simResults[i], intentProfile.strength.intentStrength)
    )

    const selection = directorSelectionBrain.select(scenarioResult.scenarios, scores, intentProfile)
    await jobStore.addTrace(jobId, {
      step: 'director_selection',
      status: 'completed',
      output: {
        selected: selection.selectedScenarioId,
        reason: selection.reason,
        confidence: selection.selectionConfidence,
        allScores: scores.map(s => ({ type: s.scenarioType, total: s.totalScore })),
      },
      timestamp: Date.now(),
    })

    memory.scenarioHistory = scenarioResult.scenarios.map((s, i) => ({
      scenarioId: s.id,
      type: s.type,
      simulation: simResults[i],
      score: scores[i],
    }))
    memory.selectedScenario =
      scenarioResult.scenarios.find(s => s.id === selection.selectedScenarioId) ||
      scenarioResult.scenarios[0]
    memory.rejectedScenarios = scenarioResult.scenarios
      .filter(s => s.id !== selection.selectedScenarioId)
      .map(s => `${s.id}(${s.type})`)

    const selectedType = memory.selectedScenario.type || 'commercial'

    // ============================================================
    // 5 层执行（Narrative 带超时+fallback，其余同步）
    // ============================================================

    // Step 1: 叙事理解（带 LLM fallback）
    await jobStore.setProgress(jobId, 10, '叙事理解中')
    const narrative = await runStep(
      'narrative',
      () => narrativeWithFallback(userScript, jobId, intentProfile.classification.intentType, selectedType, userId),
      memory,
      jobId,
      10,
    )
    await jobStore.addTrace(jobId, {
      step: 'narrative_understanding',
      status: 'completed',
      output: {
        theme: narrative.theme,
        isFallback: narrative.isFallback || false,
      },
      timestamp: Date.now(),
    })

    // Step 2: 情绪建模（同步规则引擎）
    await jobStore.setProgress(jobId, 30, '情绪建模中')
    const emotion = await runStep(
      'emotion',
      () => buildEmotionalArchitecture(narrative, effectiveEpisodes, `showrunner_emotion_${jobId}`, userId),
      memory,
      jobId,
      30,
    )
    await jobStore.addTrace(jobId, {
      step: 'emotional_engine',
      status: 'completed',
      output: { episodes: emotion.seriesEmotionCurve?.length },
      timestamp: Date.now(),
    })

    // Step 3: 结构规划（同步规则引擎）
    await jobStore.setProgress(jobId, 50, '结构规划中')
    const blueprint = await runStep(
      'structure',
      () => generateBlueprint(narrative, emotion, effectiveEpisodes, `showrunner_plan_${jobId}`, userId),
      memory,
      jobId,
      50,
    )
    await jobStore.addTrace(jobId, {
      step: 'structural_planner',
      status: 'completed',
      output: { episodes: blueprint.episodes?.length },
      timestamp: Date.now(),
    })

    // Step 4: 制片策略
    await jobStore.setProgress(jobId, 70, '制片策略计算中')
    const strategy = await runStep(
      'strategy',
      () => Promise.resolve(generateStrategy(blueprint, effectiveEpisodes)),
      memory,
      jobId,
      70,
    )

    // Step 5: 执行统筹
    await jobStore.setProgress(jobId, 85, '执行统筹中')
    const taskGraph = await runStep(
      'orchestration',
      () => Promise.resolve(orchestrate(blueprint, projectId)),
      memory,
      jobId,
      85,
    )

    const confidence = workerMemoryManager.updateConfidence(projectId)
    const decisionTrace = workerMemoryManager.getDecisionTrace(projectId)

    const reflectionSummary: Record<string, any> = {}
    for (const [k, v] of Object.entries(memory.stepStates)) {
      reflectionSummary[k] = {
        consistencyScore: v.reflection?.consistencyScore,
        corrected: v.status === 'corrected',
        correctionCount: v.correctionCount,
      }
    }

    // World Memory 写入 — 保证叙事连续性
    await worldMemory.ingestNarrativeOutput(projectId, narrative, blueprint, 1)
      .catch(e => console.error(`[WorldMemory] ingest failed: ${e.message}`))

    await jobStore.complete(jobId, {
      narrative,
      emotion,
      blueprint,
      strategy,
      taskGraph,
      confidenceScore: confidence,
      reflectionSummary,
      decisionTrace,
      status: confidence >= 0.6 ? 'completed' : 'degraded',
    })

    await jobStore.addTrace(jobId, {
      step: 'completed',
      status: 'completed',
      output: {
        confidence,
        corrections: decisionTrace.filter(d => d.action === 'correct').length,
      },
      timestamp: Date.now(),
    })
  } catch (err: any) {
    console.error(`[ShowrunnerWorker] Fatal: ${err.message}`)
    await jobStore.fail(jobId, err.message || '未知错误')
    // 即使失败了也写入 fallback 标记
    await jobStore.addTrace(jobId, {
      step: 'fatal_error',
      status: 'failed',
      output: { error: err.message },
      timestamp: Date.now(),
    })
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "worker-registry",
  "mode": "WORKER"
};

