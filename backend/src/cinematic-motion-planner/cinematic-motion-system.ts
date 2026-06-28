/**
 * Cinematic Motion System — Full Orchestrator
 * Motion Planning Enhancer — 动态可信度引擎
 *
 * 总控编排器：运动意图编译 → 物理约束 → 可行性校验 → 镜头绑定 完整链路。
 *
 * Pipeline:
 *   scene → shot grammar → emotional arc → motion intent → physics validate → bind → output timeline
 *
 * 使用方式：
 *   const system = new CinematicMotionSystem()
 *   const plan = system.generateMotionPlan({
 *     grammarTypes, intensities, tensions, shotTexts
 *   })
 */

import { ShotGrammarType } from '../cinematic-grammar/shot-grammar-tree'
import { MotionIntentCompiler, MotionIntentVector } from './motion-intent-compiler'
import { CameraPhysicsEngine, PhysicsConstraints } from './camera-physics-engine'
import { MotionFeasibilityValidator, MotionFeasibilityReport } from './motion-feasibility-validator'
import { ShotMotionBinder, UnifiedCinematicEvent } from './shot-motion-binder'

export interface MotionPlanInput {
  /** 镜头语法类型列表 */
  grammarTypes: ShotGrammarType[]
  /** 各镜头强度 (0~1) */
  intensities: number[]
  /** 各镜头情绪张力 (0~1) */
  tensions: number[]
  /** 镜头描述文本（可选，用于输出） */
  shotTexts?: string[]
}

export interface MotionPlan {
  /** 每个镜头的运动意图向量 */
  intentVectors: MotionIntentVector[]
  /** 绑定后的统一运动事件 */
  events: UnifiedCinematicEvent[]
  /** 可行性校验报告 */
  feasibility: MotionFeasibilityReport
  /** 运动时间线摘要 */
  timelineSummary: string
}

export class CinematicMotionSystem {
  constructor(
    private intentCompiler: MotionIntentCompiler = new MotionIntentCompiler(),
    private physics: CameraPhysicsEngine = new CameraPhysicsEngine(),
    private validator: MotionFeasibilityValidator = new MotionFeasibilityValidator(),
    private binder: ShotMotionBinder = new ShotMotionBinder(),
  ) {}

  /**
   * 运行完整运动规划流程
   */
  generateMotionPlan(input: MotionPlanInput): MotionPlan {
    const { grammarTypes, intensities, tensions, shotTexts } = input

    // Step 1: 编译运动意图向量
    const intentVectors = this.intentCompiler.compileBatch(grammarTypes, intensities, tensions)

    // Step 2: 可行性校验
    const feasibility = this.validator.validate(grammarTypes, intentVectors)

    // Step 3: 绑定为统一事件
    const events = this.binder.bindBatch(grammarTypes, intentVectors)

    // Step 4: 生成时间线摘要
    const timelineSummary = this.buildTimelineSummary(events, shotTexts)

    return { intentVectors, events, feasibility, timelineSummary }
  }

  /**
   * 构建运动时间线
   */
  private buildTimelineSummary(
    events: UnifiedCinematicEvent[],
    shotTexts?: string[],
  ): string {
    const lines: string[] = ['🎥 Cinematic Motion Timeline']
    lines.push(`  Shot | Type         | Motion Style         | Effect`)
    lines.push(`  ─────┼──────────────┼──────────────────────┼────────────────────────────`)

    events.forEach((e, i) => {
      const text = shotTexts?.[i]?.slice(0, 30) ?? ''
      const style = e.motionStyle.padEnd(20)
      const type = e.grammarType.padEnd(12)
      const index = `${i + 1}`.padStart(4)

      lines.push(`  ${index} | ${type} | ${style} | ${e.narrativeEffect.slice(0, 24)}`)
    })

    lines.push(``)
    lines.push(`  Feasibility: ${this.getFeasibilityIcon(this.validator.validate(events.map(e => e.grammarType), events.map(e => e.motionIntent)).valid)}`)
    lines.push(`  Total Events: ${events.length}`)

    return lines.join('\n')
  }

  private getFeasibilityIcon(valid: boolean): string {
    return valid ? '✅ All pass' : '❌ Violations found'
  }
}
