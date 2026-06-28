/**
 * cinematic-bridge.ts — Director Layer v3 CinematicBridge
 *
 * 职责：
 *   ShotGraph (abstract) → RenderedShot[] (visual layer)
 *
 * 它是"语义编译器"，不是 pipeline step：
 *   ❌ 不修改 DirectorPlan（结构性零侵入）
 *   ❌ 不参与节奏/结构计算（不抢 DirectorEngine 的活）
 *   ❌ 不做逐 shot AI 调用（批处理，保持全局视觉一致性）
 *
 * 输入冻结（CanonicalInput）：
 *   只消费 DirectorPlan + ExecutionContext。
 *   ❌ 不消费原始 script（AI 只能看编译后的结构，不能 reinterpret 剧本）
 *   ✅ script 仅作为日志/审计传递，不进 agent
 *
 * 执行策略：
 *   - 只在用户前端触发时执行（不自动、不预生成）
 *   - 重入安全：重复调用仅覆盖 renderedShots
 *   - 单次 generateShotDesign() 调用完成所有 shot 渲染
 */

import type { DirectorPlan, ShotBlueprint, DirectorSceneNode, ExecutionLineage } from './director-schemas.js'
import { generateShotDesign } from '../../director/cinematic-shot.agent.js'
import { randomUUID } from 'crypto'

// ============================================================
// Rendered Shot — 视觉层镜头
// ============================================================

export interface RenderedShot {
  shotId: string
  abstractShotId: string
  sceneId: string
  type: string
  camera: string
  lens: string
  lighting: string
  prompt: string
  description: string
  duration: number
}

// ============================================================
// ExecutionContext — 执行上下文（可扩展）
// ============================================================

export interface ExecutionContext {
  projectId?: string
  userId?: string
  renderPolicy?: 'fill' | 'overwrite'
}

// ============================================================
// CanonicalInput — 冻结的桥接输入
//
// 这是 CinematicBridge 唯一消费的输入类型。
// script 不进 agent，仅作审计用途。
// ============================================================

export interface CinematicInput {
  directorPlan: DirectorPlan
  executionContext: ExecutionContext
}

// ============================================================
// CinematicBridge — 序列级语义编译器
// ============================================================

export class CinematicBridge {
  /** v6 telemetry: compile start timestamp */
  private _compileStartTime: number = Date.now()
  /**
   * 编译：CinematicInput → RenderedShot[]
   *
   * 一次调用 generateShotDesign()，获取完整视觉 shot plan。
   * AI 调用耗时约 1.5~3s，优于逐 shot 调用的 14×1.8s。
   */
  async compile(input: CinematicInput): Promise<RenderedShot[]> {
    this._compileStartTime = Date.now()
    const { directorPlan, executionContext } = input
    const abstractShots = directorPlan.shotGraph.abstractShots

    if (!abstractShots.length) {
      console.warn('[CinematicBridge] no abstract shots to render')
      return []
    }

    // LINEAGE: 生成本次渲染 run ID
    const cinematicRunId = randomUUID()

    // Step 1: 构建冻结的序列级视觉上下文（Canonical）
    const canonicalUnderstanding = this.buildCanonicalUnderstanding(directorPlan, abstractShots)

    // Step 2: 单次 AI 调用
    console.log(`[CinematicBridge] 🎬 run=${cinematicRunId.slice(0, 8)} shots=${abstractShots.length}`)
    // 从 executionContext 取 userId 传给 agent
    const agentUserId = executionContext.userId || ''
    const result = await generateShotDesign(
      '',  // 不传原始 script
      canonicalUnderstanding,
      undefined,  // traceId
      agentUserId,
    )

    // Step 3: 标准化输出
    const rendered = this.mapToRenderedShots(result, cinematicRunId)

    // Step 4: 持久化（带 lineage 信息）
    if (executionContext.projectId) {
      await this.persistRenderedShots(executionContext.projectId, rendered, directorPlan, cinematicRunId)
    }

    console.log(`[CinematicBridge] ✅ rendered=${rendered.length}/${abstractShots.length} run=${cinematicRunId.slice(0, 8)}`)

    // v6: 记录 BridgePhase telemetry
    const projectId = executionContext.projectId || ''
    ExecutionTelemetryCollector.recordBridgePhase({
      projectId,
      directorRunId: directorPlan.shotGraph.lineage?.directorRunId || '',
      cinematicRunId,
      startTime: this._compileStartTime || Date.now(),
      shotCount: rendered.length,
      success: true,
    })

    return rendered
  }

  /**
   * 编译前兼容入口（从旧 CinematicContext 输入）
   * 未来可删除，当前用于过渡期
   */
  async compileLegacy(ctx: { script: string; directorPlan: DirectorPlan; projectId?: string }): Promise<RenderedShot[]> {
    return this.compile({
      directorPlan: ctx.directorPlan,
      executionContext: { projectId: ctx.projectId },
    })
  }

  /**
   * 构建冻结的 CanonicalUnderstanding
   *
   * 只含 DirectorPlan 编译后的结构信息：
   *   - 序列级：shot 数量、节奏曲线、总时长
   *   - 场景级：sceneId/intensity/moodTone
   *   - 镜头级：shotId/type/purpose/intensity/duration
   *
   * 不包含：
   *   - 原始剧本 text
   *   - 原始 sceneSpecs
   *   - 任何 AI 可以 reinterpret 的语义输入
   */
  private buildCanonicalUnderstanding(
    plan: DirectorPlan,
    shots: ShotBlueprint[],
  ): any {
    // ===== 适配层：兼容旧 generateShotDesign() system prompt 格式 =====
    // 旧 agent 期望 directorUnderstanding 包含 _storyConstitution 字段
    // （rhythmSpec / emotionSpecs / visualSpecs / cameraSpecs / transitionSpec）
    // 新 canonical 不包含原始剧本，只包含编译后的结构。
    //
    // 适配策略：将 canonical fields 包装为旧 agent 能消费的格式，
    // 同时保留纯净的 sequence/scenes/shots 结构。
    
    const sceneList = plan.timeline.sceneNodes.map((s: DirectorSceneNode) => ({
      sceneId: s.sceneId,
      sceneName: s.sceneName,
      intensity: s.intensity,
      duration: s.duration,
      moodTone: s.moodTone,
    }))

    const shotList = shots.map((s: ShotBlueprint) => ({
      shotId: s.shotId,
      sceneId: s.sceneId,
      type: s.type,
      purpose: s.purpose,
      intensity: s.intensity,
      duration: s.duration,
    }))

    return {
      // canonical（纯净的结构）
      _canonical: {
        sequence: {
          totalShots: shots.length,
          intensityCurve: plan.pacingModel.curve,
          totalDuration: plan.pacingModel.totalDuration,
          peakPoints: plan.pacingModel.peakPoints,
        },
        scenes: sceneList,
        shots: shotList,
      },

      // 兼容层：旧 agent 期望的格式
      _storyConstitution: {
        rhythmSpec: {
          pacingCurve: plan.pacingModel.curve,
          peakPoints: plan.pacingModel.peakPoints,
          totalDuration: plan.pacingModel.totalDuration,
        },
        emotionSpecs: sceneList.map(s => ({
          sceneId: s.sceneId,
          intensity: s.intensity,
          moodTone: s.moodTone,
        })),
        visualSpecs: {
          sceneTypes: sceneList.map(s => s.moodTone),
        },
      },
    }
  }

  /**
   * ShotDesignPlan → RenderedShot[]
   *
   * generateShotDesign() 返回的结构是：
   *   { scenes: [{ sceneId, sceneName, shots: [...], mood, transitions }, ...] }
   *
   * 标准化为 flat RenderedShot[]，保持 shotId 映射。
   */
  private mapToRenderedShots(shotDesignPlan: any, cinematicRunId?: string): RenderedShot[] {
    if (!shotDesignPlan?.scenes) {
      console.warn('[CinematicBridge] ShotDesignPlan 无 scenes 字段，可能 AI 返回格式异常')
      return []
    }

    const rendered: RenderedShot[] = []

    for (const scene of shotDesignPlan.scenes) {
      const sceneShots = scene.shots || []
      for (const shot of sceneShots) {
        rendered.push({
          shotId: shot.shotId || `${scene.sceneId}_shot_${rendered.length}`,
          abstractShotId: shot.shotId || '',
          sceneId: scene.sceneId,
          type: shot.shotType || shot.type || 'medium',
          camera: shot.cameraMotion || shot.camera || 'static',
          lens: shot.lens || '50mm',
          lighting: shot.lighting || 'natural',
          prompt: shot.description || shot.prompt || '',
          description: shot.narrativePurpose || shot.description || '',
          duration: typeof shot.duration === 'number' ? shot.duration : 3,
        })
      }
    }

    return rendered
  }

  /**
   * 持久化 rendered shots 到 DB（通过唯一写入口）
   */
  private async persistRenderedShots(
    projectId: string,
    rendered: RenderedShot[],
    plan: DirectorPlan,
    cinematicRunId?: string,
  ): Promise<void> {
    try {
      const { writeShotGraph } = await import('./shotgraph-writer.js')
      await writeShotGraph(projectId, {
        mode: 'rendered',
        renderedShots: rendered,
        transitions: plan.shotGraph.transitions,
        sceneGraph: plan.shotGraph.sceneGraph,
        pacing: plan.videoProduction.pacing,
        version: plan.videoProduction.version,
        renderStrategy: plan.videoProduction.renderStrategy,
        lineage: {
          projectId,
          directorRunId: plan.shotGraph.lineage?.directorRunId || '',
          cinematicRunId: cinematicRunId || '',
        } as ExecutionLineage,
      })
      console.log(`[CinematicBridge] ${rendered.length} rendered shots 持久化（run=${cinematicRunId?.slice(0, 8) || '?'}）`)    } catch (err: any) {
      console.warn('[CinematicBridge] 持久化失败（不影响返回）:', err.message)
    }
  }
}

/**
 * 便捷工厂
 */
export function createCinematicBridge(): CinematicBridge {
  return new CinematicBridge()
}
