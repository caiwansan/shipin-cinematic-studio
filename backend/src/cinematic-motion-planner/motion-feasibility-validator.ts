/**
 * Motion Feasibility Validator
 * Motion Planning Enhancer — 动态可信度引擎
 *
 * 运动可行性校验器：检查一组连续镜头的运动是否物理可行。
 *
 * 校验规则：
 *   1. 位移/时间比 > 阈值 → 无效（瞬移）
 *   2. 加速度尖峰 > 阈值 → 无效（物理不可能）
 *   3. 运动方向与叙事意图冲突 → 警告（语法不匹配）
 *   4. 相邻镜头运动类型差异过大 → 警告（跳切）
 */

import { MotionIntentVector } from './motion-intent-compiler'
import { PhysicsConstraints, CameraPhysicsEngine } from './camera-physics-engine'
import { ShotGrammarType } from '../cinematic-grammar/shot-grammar-tree'

export interface MotionViolation {
  /** 镜头索引 */
  shotIndex: number
  /** 违规类型 */
  type: 'teleport' | 'acceleration_spike' | 'intent_conflict' | 'jump_cut' | 'inertia_break'
  /** 严重程度 */
  severity: 'error' | 'warning'
  /** 违规描述 */
  message: string
}

export interface MotionFeasibilityReport {
  /** 是否全部通过 */
  valid: boolean
  /** 违规列表 */
  violations: MotionViolation[]
  /** 通过/总数 */
  summary: string
}

export class MotionFeasibilityValidator {
  private physics = new CameraPhysicsEngine()

  /**
   * 验证一组镜头的运动可行性
   */
  validate(
    grammarTypes: ShotGrammarType[],
    intentVectors: MotionIntentVector[],
    positions?: [number, number, number][],
    constraints: PhysicsConstraints = CameraPhysicsEngine.DEFAULT_CONSTRAINTS,
  ): MotionFeasibilityReport {
    const violations: MotionViolation[] = []

    // 规则 1: 意图与语法类型一致性
    intentVectors.forEach((intent, i) => {
      const type = grammarTypes[i]
      const conflict = this.checkIntentConflict(type, intent)
      if (conflict) violations.push(conflict)
    })

    // 规则 2: 相邻镜头运动类型差异（跳切检测）
    for (let i = 1; i < intentVectors.length; i++) {
      const jumpCutViolation = this.checkJumpCut(intentVectors[i - 1], intentVectors[i], i)
      if (jumpCutViolation) violations.push(jumpCutViolation)
    }

    // 规则 3: 物理位置可行性（如果有位置数据）
    if (positions && positions.length >= 2) {
      for (let i = 1; i < positions.length; i++) {
        const feasible = this.physics.validatePathFeasibility(
          positions[i - 1],
          positions[i],
          2, // 假设每镜头 2 秒
          constraints.maxVelocity,
        )
        if (!feasible) {
          violations.push({
            shotIndex: i,
            type: 'teleport',
            severity: 'error',
            message: `镜头 ${i}-${i + 1}: 位移速度超过限制 (max=${constraints.maxVelocity})，可能发生瞬移`,
          })
        }
      }
    }

    // 规则 4: 加速度尖峰检测（能量突变）
    for (let i = 1; i < intentVectors.length; i++) {
      const energyDelta = Math.abs(
        intentVectors[i].energyFlow - intentVectors[i - 1].energyFlow,
      )
      if (energyDelta > 1.2) {
        violations.push({
          shotIndex: i,
          type: 'inertia_break',
          severity: 'warning',
          message: `镜头 ${i}-${i + 1}: 能量流突变 ${energyDelta.toFixed(2)}，惯性断裂`,
        })
      }
    }

    const valid = violations.filter(v => v.severity === 'error').length === 0
    return {
      valid,
      violations,
      summary: `校验结果: ${violations.filter(v => v.severity === 'error').length} 错误, ${violations.filter(v => v.severity === 'warning').length} 警告`,
    }
  }

  /**
   * 检查叙事意图与镜头语法是否冲突
   */
  private checkIntentConflict(
    type: ShotGrammarType,
    intent: MotionIntentVector,
  ): MotionViolation | null {
    // establishing 不应该有不稳定性
    if (type === 'establishing' && intent.instability > 0.4) {
      return {
        shotIndex: -1, // 会在 validate 中补
        type: 'intent_conflict',
        severity: 'warning',
        message: `Establishing shot 不应有高不稳定性 (${(intent.instability * 100).toFixed(0)}%)`,
      }
    }

    // peak 不应该能量流为负
    if (type === 'peak' && intent.energyFlow < -0.3) {
      return {
        shotIndex: -1,
        type: 'intent_conflict',
        severity: 'warning',
        message: `Peak shot 能量流不应为负 (${intent.energyFlow.toFixed(2)})，高潮需要正向能量`,
      }
    }

    // release 不应该有高压迫感
    if (type === 'release' && intent.pressure > 0.7) {
      return {
        shotIndex: -1,
        type: 'intent_conflict',
        severity: 'warning',
        message: `Release shot 压迫感不应过高 (${(intent.pressure * 100).toFixed(0)}%)，释放需要降低压力`,
      }
    }

    return null
  }

  /**
   * 检查跳切
   */
  private checkJumpCut(
    prev: MotionIntentVector,
    curr: MotionIntentVector,
    currIndex: number,
  ): MotionViolation | null {
    const pressureDelta = Math.abs(curr.pressure - prev.pressure)
    const instabilityDelta = Math.abs(curr.instability - prev.instability)
    const energyFlowDelta = Math.abs(curr.energyFlow - prev.energyFlow)

    if (pressureDelta > 0.6 && instabilityDelta > 0.4) {
      return {
        shotIndex: currIndex,
        type: 'jump_cut',
        severity: 'warning',
        message: `镜头 ${currIndex}-${currIndex + 1}: 压力+不稳定性同时突变，可能产生跳切感`,
      }
    }

    return null
  }
}
