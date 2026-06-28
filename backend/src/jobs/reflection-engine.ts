/**
 * Reflection Engine — 导演级反思引擎
 *
 * 每一步执行后，对当前结果进行一致性分析：
 * - 情绪 vs 叙事 冲突
 * - 结构 vs 节奏 冲突
 * - 角色状态漂移
 * - 是否需要修正
 */

import { StepReflection, WorkerMemory } from './worker-memory.js'

const REFLECTION_STEPS = ['narrative', 'emotion', 'structure', 'strategy', 'orchestration']

export class ReflectionEngine {
  /**
   * 对单步执行结果进行反思
   */
  analyze(step: string, output: any, memory: WorkerMemory): StepReflection {
    const riskFlags: string[] = []
    let consistencyScore = 0.8
    let emotionAlignment = 0.8
    let structureConflict = false

    switch (step) {
      case 'narrative': {
        // 检查叙事是否包含必要元素
        if (!output.theme) riskFlags.push('缺少主题')
        if (!output.storyBeats || output.storyBeats.length === 0) riskFlags.push('缺少故事节拍')
        if (!output.conflicts || output.conflicts.length === 0) riskFlags.push('缺少核心冲突')
        consistencyScore = riskFlags.length === 0 ? 0.85 : 0.5
        break
      }

      case 'emotion': {
        // 情绪与叙事基调对齐检查
        const narrativeStep = memory.stepStates['narrative']
        if (narrativeStep?.output?.theme) {
          const themeTone =
            typeof narrativeStep.output.theme === 'string'
              ? narrativeStep.output.theme.toLowerCase()
              : ''
          emotionAlignment =
            themeTone.includes('悲剧') || themeTone.includes('dark') ? 0.7 : 0.85
        }
        if (
          output.seriesEmotionCurve &&
          output.seriesEmotionCurve.length < memory.episodeContext.totalEpisodes
        ) {
          riskFlags.push('情绪曲线不完整')
          consistencyScore = 0.6
        } else {
          consistencyScore = 0.85
        }
        break
      }

      case 'structure': {
        // 结构与情绪走向对齐
        const emotionStep = memory.stepStates['emotion']
        if (emotionStep?.output?.seriesEmotionCurve) {
          structureConflict = !output.episodes || output.episodes.length < 3
          if (structureConflict) riskFlags.push('剧集结构过少')
        }
        consistencyScore = riskFlags.length === 0 ? 0.9 : 0.5
        break
      }

      case 'strategy': {
        // 策略检查 — 成本、资源
        consistencyScore = 0.9
        if (
          output.estimatedCost &&
          output.budget &&
          output.estimatedCost > output.budget
        ) {
          riskFlags.push('预算超支')
          consistencyScore = 0.4
        }
        break
      }

      case 'orchestration': {
        consistencyScore = 0.9
        if (!output.plan) riskFlags.push('执行计划为空')
        break
      }

      default:
        consistencyScore = 0.7
    }

    const needsCorrection = consistencyScore < 0.6 || riskFlags.length > 2

    return {
      consistencyScore,
      emotionAlignment,
      structureConflict,
      riskFlags,
      needsCorrection,
      confidence: (consistencyScore + emotionAlignment) / 2,
    }
  }

  /**
   * 生成修正计划
   */
  planCorrection(
    step: string,
    reflection: StepReflection,
    memory: WorkerMemory,
  ): {
    action: 'adjust_prompt' | 'rollback_and_rerun' | 'update_memory' | 'skip'
    reason: string
    promptAdjustment?: string
  } {
    if (reflection.riskFlags.length > 2) {
      return {
        action: 'rollback_and_rerun',
        reason: `步骤 "${step}" 风险过高：${reflection.riskFlags.join('、')}`,
        promptAdjustment: `请重新执行步骤 "${step}"，注意避免以下问题：${reflection.riskFlags.join('、')}`,
      }
    }

    if (reflection.consistencyScore < 0.5) {
      return {
        action: 'adjust_prompt',
        reason: `步骤 "${step}" 一致性问题（${reflection.consistencyScore}），需要调整提示`,
        promptAdjustment: `修正步骤 "${step}"：请确保与已有上下文的一致性。当前全局基调：${memory.globalState.tone}。人物状态：${Object.keys(memory.globalState.characters).length} 个角色。`,
      }
    }

    return { action: 'skip', reason: '无需修正' }
  }
}

export const reflectionEngine = new ReflectionEngine()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "worker-registry",
  "mode": "WORKER"
};

