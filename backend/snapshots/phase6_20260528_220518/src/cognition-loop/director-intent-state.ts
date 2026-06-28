/**
 * Director Intent State — 导演意图状态
 *
 * 核心新增层。位于 Showrunner Core 与 Director Intelligence Layer 之间。
 * Showrunner Core 的输出必须在此"锁定"为不可变状态。
 * 下游所有系统只允许 read-only 读取此状态，禁止重新解释。
 *
 * 核心原则：
 * - 一次锁定 = 全局真理
 * - 下游系统禁止 reinterpret
 * - 只有 Cognition Loop Engine 可以更新
 */

// ============================================================
// Director Intent State Schema
// ============================================================

export interface DirectorIntentState {
  // 元信息
  episodeId: string
  projectId: string
  lockedAt: number       // 锁定时间戳
  version: number        // 版本（每次更新递增）
  traceId: string

  // 核心导演意图
  globalEmotion: string
  visualTone: string
  cameraLanguage: string
  pacing: string

  // 角色状态（按角色名索引）
  characterStates: Record<string, CharacterIntentState>

  // 场景意图（按场景 ID 索引）
  sceneIntents: SceneIntent[]

  // 全局约束
  constraints: IntentConstraints

  // 校验哈希（下游如有修改则 mismatch）
  checksum: string
}

export interface CharacterIntentState {
  characterId: string
  name: string
  currentEmotion: string
  costumeSet: string
  visualSignature: string
  arcStage: string     // 当前角色弧光阶段
}

export interface SceneIntent {
  sceneId: string
  sceneName: string
  primaryMood: string
  timeOfDay: string
  weather: string
  colorScript: string[]
  cameraApproach: string
}

export interface IntentConstraints {
  noWideShot: boolean
  lowLightOnly: boolean
  handheldOnly: boolean
  warmToneOnly: boolean
  coldToneOnly: boolean
  custom: string[]
}

// ============================================================
// Intent State Manager
// ============================================================

class DirectorIntentStateManager {
  private states = new Map<string, DirectorIntentState>()
  private versionCounter = 0

  /**
   * 锁定：从 Showrunner Core 输出创建 Intent State
   * 这是唯一创建方式。创建后下游只能读取，不能修改。
   */
  lockIntent(
    showrunnerOutput: any,
    config: {
      episodeId: string
      projectId: string
      traceId: string
    },
  ): DirectorIntentState {
    const intent: DirectorIntentState = {
      episodeId: config.episodeId,
      projectId: config.projectId,
      lockedAt: Date.now(),
      version: ++this.versionCounter,
      traceId: config.traceId,
      globalEmotion: showrunnerOutput.emotion?.seriesEmotionCurve?.[0]?.primaryEmotion || '中性',
      visualTone: showrunnerOutput.narrative?.visualStyle || '自然',
      cameraLanguage: showrunnerOutput.strategy?.visualPriorityMap?.[0] || '标准',
      pacing: showrunnerOutput.narrative?.pacing || 'normal',
      characterStates: {},
      sceneIntents: [],
      constraints: {
        noWideShot: false,
        lowLightOnly: false,
        handheldOnly: false,
        warmToneOnly: false,
        coldToneOnly: false,
        custom: [],
      },
      checksum: '',
    }

    // 从 narrative 构建角色状态
    if (showrunnerOutput.narrative?.characterNetwork) {
      for (const char of showrunnerOutput.narrative.characterNetwork) {
        intent.characterStates[char.id] = {
          characterId: char.id,
          name: char.name,
          currentEmotion: '中性',
          costumeSet: '默认',
          visualSignature: '',
          arcStage: char.arc || 'unknown',
        }
      }
    }

    // 从 blueprint 构建场景意图
    if (showrunnerOutput.blueprint?.episodes) {
      const firstEp = showrunnerOutput.blueprint.episodes[0]
      if (firstEp?.keyScenes) {
        intent.sceneIntents = firstEp.keyScenes.map((name: string, i: number) => ({
          sceneId: `scene_${i + 1}`,
          sceneName: name,
          primaryMood: intent.globalEmotion,
          timeOfDay: 'day',
          weather: 'clear',
          colorScript: ['自然'],
          cameraApproach: 'standard',
        }))
      }
    }

    // 从 emotion 构建约束
    if (showrunnerOutput.emotion?.seriesEmotionCurve?.[0]) {
      const firstEmotion = showrunnerOutput.emotion.seriesEmotionCurve[0]
      if (firstEmotion.tension >= 8) {
        intent.constraints.handheldOnly = true
        intent.constraints.lowLightOnly = true
      }
    }

    // 生成校验和（下游如有修改则 mismatch）
    intent.checksum = this.generateChecksum(intent)

    this.states.set(`${config.projectId}:${config.episodeId}`, intent)
    return intent
  }

  /**
   * 只读读取：获取指定 episode 的 Intent State
   */
  getIntent(projectId: string, episodeId: string): DirectorIntentState | null {
    return this.states.get(`${projectId}:${episodeId}`) || null
  }

  /**
   * 更新 Intent State（仅 Cognition Loop Engine 调用）
   */
  updateIntent(
    projectId: string,
    episodeId: string,
    patch: Partial<DirectorIntentState>,
  ): DirectorIntentState | null {
    const key = `${projectId}:${episodeId}`
    const existing = this.states.get(key)
    if (!existing) return null

    const updated: DirectorIntentState = {
      ...existing,
      ...patch,
      version: existing.version + 1,
      lockedAt: Date.now(),
      checksum: '',  // 先清空再重新计算
    }
    updated.checksum = this.generateChecksum(updated)

    this.states.set(key, updated)
    return updated
  }

  /**
   * 计算校验和
   */
  private generateChecksum(intent: DirectorIntentState): string {
    const relevant = {
      globalEmotion: intent.globalEmotion,
      visualTone: intent.visualTone,
      cameraLanguage: intent.cameraLanguage,
      pacing: intent.pacing,
      characterStates: intent.characterStates,
      sceneIntents: intent.sceneIntents,
      constraints: intent.constraints,
    }
    return Buffer.from(JSON.stringify(relevant)).toString('base64').slice(0, 16)
  }

  /**
   * 验证下游输出是否与 Intent State 一致
   */
  validateAgainstIntent(
    projectId: string,
    episodeId: string,
    output: any,
  ): { aligned: boolean; driftScore: number; issues: string[] } {
    const intent = this.getIntent(projectId, episodeId)
    if (!intent) {
      return { aligned: true, driftScore: 0, issues: [] }
    }

    const issues: string[] = []
    let driftScore = 0

    // 检查情绪对齐
    if (output.emotion && output.emotion !== intent.globalEmotion) {
      issues.push(`情绪偏离: 期望=${intent.globalEmotion}, 实际=${output.emotion}`)
      driftScore += 0.3
    }

    // 检查视觉对齐
    if (output.visualTone && output.visualTone !== intent.visualTone) {
      issues.push(`视觉风格偏离: 期望=${intent.visualTone}, 实际=${output.visualTone}`)
      driftScore += 0.3
    }

    // 检查约束
    if (intent.constraints.handheldOnly && output.cameraMotion === 'static') {
      issues.push('约束违反: 要求手持运镜但使用了静态镜头')
      driftScore += 0.4
    }

    return {
      aligned: driftScore < 0.5,
      driftScore: Math.min(driftScore, 1),
      issues,
    }
  }
}

export const intentStateManager = new DirectorIntentStateManager()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "cognition-loop",
  "mode": "LEGACY"
};

