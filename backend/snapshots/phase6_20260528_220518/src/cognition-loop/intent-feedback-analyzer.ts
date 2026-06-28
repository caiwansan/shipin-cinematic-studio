/**
 * Intent Feedback Analyzer — 意图反馈分析器
 *
 * 对比 Showrunner Intent vs 最终视频实际输出结果，
 * 计算语义漂移分数，生成修正补丁。
 *
 * 是 Cognition Loop 的"感知+评估"层。
 */

import { intentStateManager, type DirectorIntentState } from './director-intent-state.js'

// ============================================================
// Feedback Analysis
// ============================================================

export interface DriftReport {
  episodeId: string
  projectId: string
  overallDriftScore: number      // 0-1，0=完全对齐，1=完全偏离
  emotionDrift: number
  visualDrift: number
  cameraDrift: number
  characterDrift: number
  details: DriftDetail[]
  correctionPatch: CorrectionPatch | null
}

export interface DriftDetail {
  field: string
  expected: string
  actual: string
  severity: 'low' | 'medium' | 'high'
  suggestion: string
}

export interface CorrectionPatch {
  type: 'regenerate' | 'adjust' | 'accept'
  targetField: string
  patchData: Record<string, any>
  reason: string
}

/**
 * 分析意图 vs 实际输出的漂移
 */
export function analyzeIntentDrift(
  intent: DirectorIntentState,
  actualOutput: any,
): DriftReport {
  const details: DriftDetail[] = []

  // 1. 情绪漂移分析
  const expectedEmotion = intent.globalEmotion
  const actualEmotion = actualOutput.emotion || intent.globalEmotion
  const emotionDrift = expectedEmotion !== actualEmotion ? 0.6 : 0
  if (expectedEmotion !== actualEmotion) {
    details.push({
      field: 'globalEmotion',
      expected: expectedEmotion,
      actual: actualEmotion,
      severity: emotionDrift > 0.5 ? 'high' : 'medium',
      suggestion: `重新生成提示词，加强"${expectedEmotion}"情绪表达`,
    })
  }

  // 2. 视觉风格漂移分析
  const expectedTone = intent.visualTone
  const actualTone = actualOutput.visualTone || intent.visualTone
  const visualDrift = expectedTone !== actualTone ? 0.5 : 0
  if (expectedTone !== actualTone) {
    details.push({
      field: 'visualTone',
      expected: expectedTone,
      actual: actualTone,
      severity: 'medium',
      suggestion: `调整视觉参数至"${expectedTone}"风格`,
    })
  }

  // 3. 镜头语言漂移
  const expectedCamera = intent.cameraLanguage
  const actualCamera = actualOutput.cameraLanguage || intent.cameraLanguage
  const cameraDrift = expectedCamera !== actualCamera ? 0.4 : 0
  if (expectedCamera !== actualCamera) {
    details.push({
      field: 'cameraLanguage',
      expected: expectedCamera,
      actual: actualCamera,
      severity: 'medium',
      suggestion: `镜头语言调整为"${expectedCamera}"`,
    })
  }

  // 4. 角色一致性漂移
  const characterDrift = analyzeCharacterDrift(
    intent.characterStates,
    actualOutput.characters || [],
  )
  for (const cd of characterDrift.details) {
    details.push(cd)
  }

  // 整体 drift score
  const overallDriftScore = Math.min(
    (emotionDrift + visualDrift + cameraDrift + characterDrift.score) / 4,
    1,
  )

  // 生成修正补丁
  const correctionPatch =
    overallDriftScore > 0.3
      ? generateCorrectionPatch(details, intent)
      : null

  return {
    episodeId: intent.episodeId,
    projectId: intent.projectId,
    overallDriftScore,
    emotionDrift,
    visualDrift,
    cameraDrift,
    characterDrift: characterDrift.score,
    details,
    correctionPatch,
  }
}

function analyzeCharacterDrift(
  expected: Record<string, any>,
  actual: any[],
): { score: number; details: DriftDetail[] } {
  const details: DriftDetail[] = []
  let score = 0

  for (const [charId, expectedState] of Object.entries(expected)) {
    const actualChar = actual.find((a: any) => a.id === charId || a.name === expectedState.name)
    if (!actualChar) {
      details.push({
        field: `character:${charId}`,
        expected: '存在',
        actual: '缺失',
        severity: 'high',
        suggestion: `角色 ${expectedState.name} 在输出中未找到，需要重新生成`,
      })
      score += 0.5
      continue
    }

    if (actualChar.emotion && actualChar.emotion !== expectedState.currentEmotion) {
      details.push({
        field: `character:${charId}.emotion`,
        expected: expectedState.currentEmotion,
        actual: actualChar.emotion,
        severity: 'medium',
        suggestion: `调整角色情绪为"${expectedState.currentEmotion}"`,
      })
      score += 0.3
    }
  }

  return { score: Math.min(score, 1), details }
}

function generateCorrectionPatch(
  details: DriftDetail[],
  intent: DirectorIntentState,
): CorrectionPatch {
  const highSeverity = details.filter(d => d.severity === 'high')
  const mediumSeverity = details.filter(d => d.severity === 'medium')

  // 如果有高严重度问题 → 需要重新生成
  if (highSeverity.length > 0) {
    return {
      type: 'regenerate',
      targetField: highSeverity[0].field,
      patchData: {
        emotion: intent.globalEmotion,
        visualTone: intent.visualTone,
        cameraLanguage: intent.cameraLanguage,
      },
      reason: `检测到${highSeverity.length}个高严重度漂移，需要重新生成`,
    }
  }

  // 中等 → 调整
  if (mediumSeverity.length > 1) {
    return {
      type: 'adjust',
      targetField: 'prompt',
      patchData: {
        overrideEmotion: intent.globalEmotion,
        overrideTone: intent.visualTone,
      },
      reason: '局部调整提示词以纠正漂移',
    }
  }

  // 轻微 → 接受
  return {
    type: 'accept',
    targetField: 'all',
    patchData: {},
    reason: '漂移在可接受范围内（< 0.5）',
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "cognition-loop",
  "mode": "LEGACY"
};

