/**
 * director-engine.ts — Director Layer v3 确定性编排引擎
 *
 * 核心职责：
 *   1. 从 sceneSpecs 推导 shot graph（结构级，不调 AI）
 *   2. 控制节奏/镜头顺序/情绪曲线
 *   3. 生成 VideoProductionArtifact（最终执行指令）
 *
 * 边界约束：
 *   - ❌ 不调用任何 AI Agent
 *   - ❌ 不生成视觉细节（prompt/camera/lighting）
 *   - ✅ deterministic：同一输入 = 同一输出
 *   - ✅ 独立可测试：无外部依赖
 */

import type {
  ShotBlueprint,
  ShotType,
  ShotPurpose,
  DirectorSceneNode,
  TransitionBlueprint,
  PacingModel,
  ShotGraph,
  DirectorPlan,
  VideoProductionArtifact,
} from './director-schemas.js'

export class DirectorEngine {
  private directorRunId = ''
  /**
   * 从 sceneSpecs + plotBlueprint 构建完整导演计划
   */
  build(sceneSpecs: any[], plotBlueprint?: any): DirectorPlan {
    this._buildStartTime = Date.now()
    // LINEAGE: 确定性 run ID
    const { createHash } = require('crypto')
    this.directorRunId = createHash('sha256')
      .update(JSON.stringify(sceneSpecs))
      .digest('hex')
      .slice(0, 12)
    // Step 1: 将 sceneSpecs 转换为标准场景节点
    const sceneNodes = this.buildSceneNodes(sceneSpecs, plotBlueprint)

    // Step 2: 从场景推导 shot graph
    const shotGraph = this.buildShotGraph(sceneNodes)

    // Step 3: 构建转场序列
    const transitions = this.buildTransitions(shotGraph.abstractShots)

    // Step 4: 构建节奏模型
    const pacing = this.buildPacing(sceneNodes)

    // Step 5: 编译最终执行指令
    const videoProduction = this.compileVideoProduction(shotGraph, pacing)

    // v6: 记录 DirectorPhase telemetry
    const buildStartTime = this._buildStartTime || Date.now()
    ExecutionTelemetryCollector.recordDirectorPhase({
      projectId: '',
      directorRunId: this.directorRunId,
      startTime: buildStartTime,
      shotCount: shotGraph.abstractShots.length,
    })

    return {
      timeline: {
        sceneNodes,
        pacingCurve: pacing.curve,
        totalDuration: pacing.totalDuration,
      },
      shotGraph,
      transitions,
      pacingModel: pacing,
      videoProduction,
    }
  }

  // ================================================================
  // Step 1: Scene Node 推导
  // ================================================================

  private buildSceneNodes(sceneSpecs: any[], plotBlueprint?: any): DirectorSceneNode[] {
    return sceneSpecs.map((s, i) => {
      // 从 sceneSpec 各字段推导强度
      const intensity = this.inferSceneIntensity(s)
      const duration = this.inferSceneDuration(s, i, sceneSpecs.length)
      const moodTone = this.inferMoodTone(s)

      return {
        sceneId: s.sceneId || `scene_${i}`,
        sceneName: s.name || s.sceneName || `场景 ${i + 1}`,
        intensity,
        duration,
        moodTone,
      }
    })
  }

  /**
   * 从 scene spec 字段推导情绪强度
   * 优先级：mood > description > summary > 默认
   */
  private inferSceneIntensity(scene: any): number {
    // 尝试从 mood 字段判断
    const mood = (scene.mood || '').toLowerCase()
    if (/高潮|巅峰|决战|惨烈|激烈|爆炸|冲突|战斗/i.test(mood)) return 1.0
    if (/紧张|悬疑|追逐|追击|对峙/i.test(mood)) return 0.8
    if (/悲伤|哀悼|失落|告别/i.test(mood)) return 0.6
    if (/平静|日常|散步|对话|轻松/i.test(mood)) return 0.3
    if (/开头|开篇|启程|出发/i.test(mood)) return 0.4

    // fallback: 默认曲线
    return 0.5
  }

  /**
   * 从 scene spec 推导时长
   * 按场景在故事中的位置有节奏地分配
   */
  private inferSceneDuration(scene: any, index: number, total: number): number {
    // 如果有 AI 指定的时长则使用
    if (scene.duration && typeof scene.duration === 'number') {
      return Math.max(3, Math.min(scene.duration, 60))
    }

    // 按节奏分配：开场短、中段长、高潮集中、结尾收束
    const position = index / Math.max(1, total - 1)
    if (total <= 1) return 15

    if (position < 0.15) return 10           // 开场
    if (position < 0.35) return 15           // 展开
    if (position < 0.65) return 20           // 中段高潮
    if (position < 0.85) return 12           // 收束
    return 8                                  // 结尾
  }

  /**
   * 从 mood 字段推导情绪色调
   */
  private inferMoodTone(scene: any): 'dark' | 'neutral' | 'bright' {
    const mood = (scene.mood || '').toLowerCase()
    if (/暗|黑|夜|阴|雾|血|战|杀|惨|悲/i.test(mood)) return 'dark'
    if (/光|明|日|晴|春|欢|喜|圣/i.test(mood)) return 'bright'
    return 'neutral'
  }

  // ================================================================
  // Step 2: Shot Graph 推导
  // ================================================================

  private buildShotGraph(sceneNodes: DirectorSceneNode[]): ShotGraph {
    const shots: ShotBlueprint[] = []
    let shotIndex = 0

    for (const scene of sceneNodes) {
      const sceneShots = this.buildSceneShots(scene, sceneNodes, shotIndex)
      shots.push(...sceneShots)
      shotIndex += sceneShots.length
    }

    // 构建转场
    const transitions = this.buildTransitions(shots)

    return {
      abstractShots: shots,
      renderedShots: undefined,
      transitions,
      sceneGraph: {
        sceneIds: sceneNodes.map(s => s.sceneId),
        order: sceneNodes.map((_, i) => i),
      },
      mode: 'abstract' as const,
      version: 'v3',
      lineage: {
        projectId: '',
        directorRunId: this.directorRunId || '',
      },
    }
  }

  /**
   * 从单个场景推导其镜头序列
   *
   * 推导规则：
   * - 强力场景（intensity >= 0.7）：6~8 个 shot，节奏密集
   * - 常规场景（0.4~0.7）：4~6 个 shot
   * - 平静场景（< 0.4）：2~4 个 shot
   */
  private buildSceneShots(scene: DirectorSceneNode, allScenes: DirectorSceneNode[], globalIndex: number): ShotBlueprint[] {
    const shotCount = this.computeShotCount(scene)
    const shots: ShotBlueprint[] = []

    for (let i = 0; i < shotCount; i++) {
      shots.push({
        shotId: `${scene.sceneId}_shot_${i}`,
        sceneId: scene.sceneId,
        type: this.inferShotType(i, shotCount, scene),
        purpose: this.inferShotPurpose(i, shotCount, scene),
        duration: scene.duration / shotCount,
        intensity: scene.intensity,
      })
    }

    return shots
  }

  /**
   * 计算镜头数量
   */
  private computeShotCount(scene: DirectorSceneNode): number {
    if (scene.intensity >= 0.8) return 6
    if (scene.intensity >= 0.6) return 5
    if (scene.intensity >= 0.4) return 4
    return 3
  }

  /**
   * 推导镜头类型
   *
   * 模式语言：
   * - 开场：establishing → wide → medium
   * - 中段：medium/closeup 交替，高潮时更多 closeup
   * - 结尾：medium → wide（收束）
   * - 强力场景：更多 closeup + insert
   */
  private inferShotType(shotIndex: number, totalShots: number, scene: DirectorSceneNode): ShotType {
    const shotTypes: ShotType[] = this.getShotPattern(scene)

    // 按位置从 pattern 中选择最合适的类型
    const position = shotIndex / Math.max(1, totalShots - 1)
    const patternIndex = Math.round(position * (shotTypes.length - 1))
    return shotTypes[Math.min(patternIndex, shotTypes.length - 1)]
  }

  /**
   * 根据场景情绪强度获取 shot pattern
   */
  private getShotPattern(scene: DirectorSceneNode): ShotType[] {
    if (scene.intensity >= 0.8) {
      // 高潮/强力：establishing → closeup → extreme_closeup → closeup → insert → wide
      return ['establishing', 'closeup', 'extreme_closeup', 'closeup', 'insert', 'wide']
    }
    if (scene.intensity >= 0.6) {
      // 有张力：wide → medium → closeup → reaction → medium
      return ['wide', 'medium', 'closeup', 'reaction', 'medium']
    }
    if (scene.moodTone === "dark") {
      // 暗色调：establishing → wide → medium → transitional
      return ['establishing', 'wide', 'medium', 'transitional']
    }
    // 平静/明亮：establishing → full → medium → wide
    return ['establishing', 'full', 'medium', 'wide']
  }

  /**
   * 推导镜头叙事意图
   */
  private inferShotPurpose(shotIndex: number, totalShots: number, scene: DirectorSceneNode): ShotPurpose {
    if (totalShots === 1) return 'establish'

    const position = shotIndex / Math.max(1, totalShots - 1)

    if (shotIndex === 0) return 'introduce'
    if (position < 0.3) return 'establish'
    if (position < 0.6) return scene.intensity >= 0.6 ? 'escalate' : 'sustain'
    if (position < 0.85) return 'sustain'
    return 'resolve'
  }

  // ================================================================
  // Step 3: 转场构建
  // ================================================================

  private buildTransitions(shots: ShotBlueprint[]): TransitionBlueprint[] {
    const transitions: TransitionBlueprint[] = []

    for (let i = 0; i < shots.length - 1; i++) {
      const from = shots[i]
      const to = shots[i + 1]
      const type = this.inferTransitionType(from, to)
      transitions.push({
        fromShotId: from.shotId,
        toShotId: to.shotId,
        type,
      })
    }

    return transitions
  }

  /**
   * 推导转场类型
   * - 同场景内不同 shot pair 之间用 cut
   * - 场景切换处用 dissolve
   * - 强力场景退出用 fade
   */
  private inferTransitionType(from: ShotBlueprint, to: ShotBlueprint): TransitionBlueprint['type'] {
    if (from.sceneId !== to.sceneId) {
      // 场景切换
      if (from.intensity >= 0.8 || to.intensity >= 0.8) return 'fade_in'
      return 'dissolve'
    }
    // 同场景内
    if (from.type === 'reaction' || to.type === 'reaction') return 'match_cut'
    return 'cut'
  }

  // ================================================================
  // Step 4: 节奏模型
  // ================================================================

  private buildPacing(sceneNodes: DirectorSceneNode[]): PacingModel {
    const curve = sceneNodes.map(s => s.intensity)
    const sceneDurations = sceneNodes.map(s => s.duration)
    const totalDuration = sceneDurations.reduce((a, b) => a + b, 0)

    // 找出节奏峰值
    const peakPoints: number[] = []
    for (let i = 1; i < curve.length - 1; i++) {
      if (curve[i] > curve[i - 1] && curve[i] > curve[i + 1]) {
        peakPoints.push(i)
      }
    }
    // 确保首尾不为峰值
    if (curve.length > 0 && curve[0] === Math.max(...curve)) peakPoints.push(0)
    if (curve.length > 1 && curve[curve.length - 1] === Math.max(...curve)) peakPoints.push(curve.length - 1)

    return { curve, peakPoints, totalDuration, sceneDurations }
  }

  // ================================================================
  // Step 5: VideoProduction 编译
  // ================================================================

  private compileVideoProduction(shotGraph: ShotGraph, pacing: PacingModel): VideoProductionArtifact {
    return {
      version: 'v3',
      shotGraph,
      pacing: {
        curve: pacing.curve,
        peakPoints: pacing.peakPoints,
        totalDuration: pacing.totalDuration,
      },
      renderStrategy: 'director-driven',
    }
  }
}

/**
 * 便捷工厂函数
 */
export function createDirectorEngine(): DirectorEngine {
  return new DirectorEngine()
}
