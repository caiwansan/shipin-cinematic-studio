/**
 * prompt-de-diffusion.ts — Phase 6D.4: Prompt De-Diffusion Layer
 *
 * 防止"模型把结构化执行计划重新坍缩为自然语言"。
 *
 * 核心机制：
 *   1. StructuredPrompt — 不是自然语言，而是"可执行的约束图"
 *   2. ExecutionContract — 区分 hard/soft 约束，hard 不可被模型重写
 *   3. Model Compensator — 不同模型的 bias 补偿
 *   4. Diffusion Barrier — 阻止模型重新解释结构
 *
 * 输入：ExecutionPlan + TemporalFrameGraph
 * 输出：StructuredPrompt（接 backend adapter 转换为最终的 prompt text）
 */

import type { ExecutionPlan } from './backends/execution-plan.js'
import type { TemporalFrameGraph, TemporalGlobalConstraints } from './temporal/temporal-guard.js'

// ============================================================
// StructuredPrompt — 结构化 prompt（非自然语言）
// ============================================================

export interface StructuredPrompt {
  /** 版本 */
  version: string
  /** 源 plan ID */
  planId: string

  // ============================================================
  // 执行图（结构化指令，非描述性文本）
  // ============================================================

  /** 动作执行图 */
  motionGraph: MotionGraph
  /** 摄影机执行图 */
  cameraGraph: CameraGraph
  /** 身份锚点（不可变） */
  identityAnchors: IdentityAnchor[]
  /** 时间约束图 */
  temporalGraph: TemporalConstraintGraph

  // ============================================================
  // 分级约束
  // ============================================================

  constraints: {
    /** 硬约束 — 模型不能修改/忽略 */
    hard: HardConstraint[]
    /** 软约束 — 可调整但不建议 */
    soft: SoftConstraint[]
  }

  /** 模型补偿指令 */
  modelCompensation: Record<string, unknown>
}

// ============================================================
// Motion / Camera / Identity / Temporal 子图
// ============================================================

export interface MotionGraph {
  type: 'SEQUENTIAL' | 'PARALLEL' | 'BRANCHING'
  nodes: MotionNode[]
}

export interface MotionNode {
  shotId: string
  motionType: string
  intensity: number
  /** 帧间最大偏移约束（硬约束） */
  maxFrameDelta: number
  /** 是否是连续运动的延续 */
  continuesFrom: string | null
}

export interface CameraGraph {
  type: 'TRAJECTORY' | 'FREE'
  nodes: CameraNode[]
}

export interface CameraNode {
  shotId: string
  motionType: string
  /** 是否轨迹锁定 */
  trajectoryLocked: boolean
  /** 摄影机运动是否跟随前一帧 */
  followsPreviousCamera: boolean
}

export interface IdentityAnchor {
  character: string
  /** 锚点类型 */
  anchorType: 'VISUAL_SEED' | 'DESCRIPTION' | 'BOTH'
  /** 锁定强度 (0-1), >=0.7 表示不可变 */
  lockStrength: number
  /** 禁止发生的变换 */
  forbiddenTransformations: string[]
}

export interface TemporalConstraintGraph {
  edges: TemporalEdge[]
}

export interface TemporalEdge {
  fromShotId: string
  toShotId: string
  /** 连续性类型 */
  continuityType: 'direct_continuation' | 'scene_transition' | 'camera_cut'
  /** 约束强度 */
  strength: number
  /** 跨边界是否为同一角色 */
  sameCharacterCrossScene: boolean
}

// ============================================================
// 约束定义
// ============================================================

export interface HardConstraint {
  name: string
  description: string
  /** 违反时的行为：block / warn */
  violationAction: 'block' | 'warn'
}

export interface SoftConstraint {
  name: string
  description: string
  /** 偏离惩罚 (0-1) */
  deviationPenalty: number
}

// ============================================================
// Prompt De-Diffusion Compiler
// ============================================================

export class PromptDeDiffusionCompiler {
  /**
   * 编译 ExecutionPlan + TemporalFrameGraph → StructuredPrompt
   * 这是 IR 到最终 prompt 前的最后一层结构化屏障
   */
  compile(
    plan: ExecutionPlan,
    temporal?: TemporalFrameGraph | null,
    temporalConstraints?: TemporalGlobalConstraints | null,
  ): StructuredPrompt {
    const motionGraph = this.buildMotionGraph(plan)
    const cameraGraph = this.buildCameraGraph(plan)
    const identityAnchors = this.buildIdentityAnchors(plan, temporal)
    const temporalGraph = this.buildTemporalGraph(plan, temporal)

    const hasHardConstraints = temporalConstraints || (temporal?.globalConstraints)

    const hard: HardConstraint[] = [
      {
        name: 'identity_lock',
        description: '角色身份在整个序列中不可改变',
        violationAction: 'block',
      },
      {
        name: 'temporal_continuity',
        description: '帧间连续性必须保持，不允许跳跃或重置',
        violationAction: 'block',
      },
      {
        name: 'scene_consistency',
        description: '场景视觉元素（灯光/空间布局）不可漂移',
        violationAction: 'block',
      },
    ]

    const soft: SoftConstraint[] = [
      {
        name: 'cinematic_style',
        description: '电影风格保持一致',
        deviationPenalty: 0.3,
      },
      {
        name: 'lighting_coherence',
        description: '灯光氛围尽量连贯',
        deviationPenalty: 0.2,
      },
    ]

    // 如果有强制禁止的操作，加入 hard constraints
    if (hasHardConstraints) {
      const g = (temporalConstraints || temporal!.globalConstraints)!
      for (const op of g.forbiddenOperations) {
        if (!hard.find(h => h.name === op)) {
          hard.push({ name: `forbidden_${op}`, description: op, violationAction: 'block' })
        }
      }
    }

    return {
      version: '1.0.0',
      planId: plan.irId,
      motionGraph,
      cameraGraph,
      identityAnchors,
      temporalGraph,
      constraints: { hard, soft },
      modelCompensation: {},
    }
  }

  /**
   * 应用模型补偿（在 compile 后调用）
   */
  compensateForModel(prompt: StructuredPrompt, modelName: string): StructuredPrompt {
    const compensated = {
      ...prompt,
      modelCompensation: this.getCompensation(modelName, prompt),
    }

    // 补偿可能需要修改 soft constraints
    if (modelName === 'runway') {
      compensated.constraints = {
        hard: [...prompt.constraints.hard],
        soft: [
          ...prompt.constraints.soft,
          { name: 'motion_reinforcement', description: 'Runway 动作强度补偿', deviationPenalty: 0.4 },
        ],
      }
    } else if (modelName === 'pika') {
      compensated.constraints = {
        hard: [
          ...prompt.constraints.hard,
          { name: 'scene_boundary_lock', description: 'Pika 场景边界锁定', violationAction: 'block' as const },
        ],
        soft: [...prompt.constraints.soft],
      }
    }

    return compensated
  }

  /**
   * 编译为可注入 backend prompt 的文本
   */
  compilePromptString(prompt: StructuredPrompt, modelName: string): string {
    const lines: string[] = []

    lines.push(`[STRUCTURED_EXECUTION_GRAPH v${prompt.version}]`)
    lines.push(`Plan: ${prompt.planId}`)

    // Identity anchors (硬约束，放最前面)
    lines.push('\n--- IDENTITY ANCHORS (hard) ---')
    for (const anchor of prompt.identityAnchors) {
      lines.push(`[LOCK] ${anchor.character}: ${anchor.anchorType} (strength=${anchor.lockStrength})`)
      lines.push(`  forbidden: ${anchor.forbiddenTransformations.join(', ')}`)
    }

    // Motion graph
    lines.push('\n--- MOTION EXECUTION GRAPH (hard) ---')
    for (const node of prompt.motionGraph.nodes) {
      const cont = node.continuesFrom ? ` [continues: ${node.continuesFrom}]` : ''
      lines.push(`[MOTION] ${node.shotId}: ${node.motionType} @ ${(node.intensity * 100).toFixed(0)}% maxDelta=${node.maxFrameDelta}${cont}`)
    }

    // Camera graph
    lines.push('\n--- CAMERA EXECUTION GRAPH (hard) ---')
    for (const node of prompt.cameraGraph.nodes) {
      const follows = node.followsPreviousCamera ? ' [follow prev camera]' : ''
      lines.push(`[CAMERA] ${node.shotId}: ${node.motionType} trajectoryLocked=${node.trajectoryLocked}${follows}`)
    }

    // Temporal edges
    if (prompt.temporalGraph.edges.length > 0) {
      lines.push('\n--- TEMPORAL CONSTRAINT GRAPH (hard) ---')
      for (const edge of prompt.temporalGraph.edges) {
        lines.push(`[TEMP] ${edge.fromShotId} → ${edge.toShotId}: ${edge.continuityType} strength=${edge.strength} sameChar=${edge.sameCharacterCrossScene}`)
      }
    }

    // Hard constraints
    lines.push('\n--- HARD CONSTRAINTS (不可违反) ---')
    for (const h of prompt.constraints.hard) {
      lines.push(`[HARD] ${h.name}: ${h.description} (violation: ${h.violationAction})`)
    }

    // Soft constraints
    lines.push('\n--- SOFT CONSTRAINTS (可微调，有惩罚) ---')
    for (const s of prompt.constraints.soft) {
      lines.push(`[SOFT] ${s.name}: ${s.description} (penalty=${s.deviationPenalty})`)
    }

    // Model compensation
    if (Object.keys(prompt.modelCompensation).length > 0) {
      lines.push(`\n--- MODEL COMPENSATION (${modelName}) ---`)
      lines.push(JSON.stringify(prompt.modelCompensation, null, 2))
    }

    return lines.join('\n')
  }

  // ============================================================
  // Internal builders
  // ============================================================

  private buildMotionGraph(plan: ExecutionPlan): MotionGraph {
    const nodes: MotionNode[] = []
    let lastShotId: string | null = null

    for (const scene of plan.scenes) {
      for (const shot of scene.shots) {
        nodes.push({
          shotId: shot.shotId,
          motionType: shot.motion.type,
          intensity: shot.motion.intensity,
          maxFrameDelta: this.maxDeltaForTension(shot.emotionalTension),
          continuesFrom: lastShotId,
        })
        lastShotId = shot.shotId
      }
    }

    return { type: 'SEQUENTIAL', nodes }
  }

  private buildCameraGraph(plan: ExecutionPlan): CameraGraph {
    const nodes: CameraNode[] = []
    let lastCameraMotion: string | null = null

    for (const scene of plan.scenes) {
      for (const shot of scene.shots) {
        const sameAsPrevious = lastCameraMotion === shot.camera.motion
        nodes.push({
          shotId: shot.shotId,
          motionType: shot.camera.motion,
          trajectoryLocked: shot.motion.intensity > 0.5,
          followsPreviousCamera: sameAsPrevious,
        })
        lastCameraMotion = shot.camera.motion
      }
    }

    return { type: 'TRAJECTORY', nodes }
  }

  private buildIdentityAnchors(plan: ExecutionPlan, _temporal?: TemporalFrameGraph | null): IdentityAnchor[] {
    return plan.continuityAnchors.characters.map(char => ({
      character: char,
      anchorType: 'VISUAL_SEED' as const,
      lockStrength: 0.8, // high lock by default
      forbiddenTransformations: [
        'gender_shift', 'age_shift', 'costume_color_drift', 'facial_feature_change',
      ],
    }))
  }

  private buildTemporalGraph(plan: ExecutionPlan, temporal?: TemporalFrameGraph | null): TemporalConstraintGraph {
    const edges: TemporalEdge[] = []

    for (let si = 0; si < plan.scenes.length; si++) {
      const scene = plan.scenes[si]
      for (let shi = 0; shi < scene.shots.length; shi++) {
        const shot = scene.shots[shi]

        // 同一场景内下一镜头
        if (shi < scene.shots.length - 1) {
          edges.push({
            fromShotId: shot.shotId,
            toShotId: scene.shots[shi + 1].shotId,
            continuityType: 'direct_continuation',
            strength: 0.7,
            sameCharacterCrossScene: false,
          })
        }

        // 跨场景边界
        if (shi === scene.shots.length - 1 && si < plan.scenes.length - 1) {
          const nextScene = plan.scenes[si + 1]
          if (nextScene.shots.length > 0) {
            // 检查是否有共同角色
            const sameChars = plan.continuityAnchors.characters
            edges.push({
              fromShotId: shot.shotId,
              toShotId: nextScene.shots[0].shotId,
              continuityType: 'scene_transition',
              strength: sameChars.length > 0 ? 0.6 : 0.3,
              sameCharacterCrossScene: sameChars.length > 0,
            })
          }
        }
      }
    }

    return { edges }
  }

  private maxDeltaForTension(tension: string): number {
    switch (tension) {
      case 'high': return 0.1
      case 'medium': return 0.2
      case 'low': return 0.3
      default: return 0.2
    }
  }

  private getCompensation(modelName: string, prompt: StructuredPrompt): Record<string, unknown> {
    switch (modelName) {
      case 'runway':
        return {
          motionBoost: 1.3,
          temporalStrictness: 'HIGH',
          identityReinforcement: true,
          reason: 'Runway 天生动作弱，需 motion 补偿',
        }
      case 'pika':
        return {
          sceneStabilityLock: 'MAX',
          motionSmoothing: true,
          boundaryHardening: true,
          reason: 'Pika 动作强但结构弱，需场景边界锁定',
        }
      case 'sora':
        return {
          structureSimplification: true,
          temporalContinuityBoost: true,
          reason: 'Sora temporal 强但 prompt 抽象，需简化结构防重解释',
        }
      default:
        return {
          genericMode: true,
          reason: '未知模型，使用通用模式',
        }
    }
  }
}

/** 全局单例 */
export const promptDeDiffusionCompiler = new PromptDeDiffusionCompiler()
