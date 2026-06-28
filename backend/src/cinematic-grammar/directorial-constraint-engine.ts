/**
 * Directorial Constraint Engine
 * Cinematic Grammar System — 镜头语法系统
 *
 * 导演约束引擎：对镜头序列施加导演级别的语法约束。
 *
 * 约束类别：
 *   1. Structural Constraints（结构约束）— 镜头顺序/位置的规则
 *   2. Rhythm Constraints（节奏约束）— 镜头时长的规则
 *   3. Composition Constraints（构图约束）— 景别分布规则
 *   4. Genre Constraints（类型约束）— 不同类型电影的拍摄惯例
 *
 * 约束强度级别：
 *   - hard（必须遵守，否则违规）
 *   - soft（建议遵守，不违规但扣分）
 *   - style（风格化，只作为提示）
 */

import { ShotGrammarNode, ShotGrammarType, analyzeGrammarSequence } from './shot-grammar-tree'

export interface DirectorialConstraint {
  /** 约束名称 */
  name: string
  /** 约束类别 */
  category: 'structural' | 'rhythm' | 'composition' | 'genre'
  /** 约束强度 */
  severity: 'hard' | 'soft' | 'style'
  /** 违规描述 */
  violation: string
}

export interface ConstraintReport {
  /** 是否通过全部硬约束 */
  passed: boolean
  /** 所有检测到的约束 */
  constraints: DirectorialConstraint[]
  /** 硬约束违规 */
  hardViolations: DirectorialConstraint[]
  /** 建议 */
  recommendations: string[]
}

export class DirectorialConstraintEngine {
  /**
   * 对镜头序列施加导演约束
   */
  enforce(nodes: ShotGrammarNode[]): ConstraintReport {
    const constraints: DirectorialConstraint[] = []

    // 结构约束
    constraints.push(...this.checkStructuralConstraints(nodes))

    // 节奏约束
    constraints.push(...this.checkRhythmConstraints(nodes))

    // 构图约束
    constraints.push(...this.checkCompositionConstraints(nodes))

    const hardViolations = constraints.filter(c => c.severity === 'hard')
    const passed = hardViolations.length === 0

    const recommendations = constraints
      .filter(c => c.severity === 'style')
      .map(c => c.violation)

    return { passed, constraints, hardViolations, recommendations }
  }

  // ─── 结构约束 ───

  private checkStructuralConstraints(nodes: ShotGrammarNode[]): DirectorialConstraint[] {
    const c: DirectorialConstraint[] = []
    const analysis = analyzeGrammarSequence(nodes)

    analysis.violations.forEach(v => {
      c.push({
        name: `语法违规: ${v}`,
        category: 'structural',
        severity: 'hard',
        violation: v,
      })
    })

    // 检查 peak 是否至少出现一次
    if (!nodes.some(n => n.type === 'peak')) {
      c.push({
        name: '缺少高潮镜头',
        category: 'structural',
        severity: 'soft',
        violation: '建议至少安排一个 peak（高潮）镜头，否则叙事缺乏冲击点',
      })
    }

    // 检查是否所有镜头都是同一个 type
    if (new Set(nodes.map(n => n.type)).size === 1) {
      c.push({
        name: '镜头类型单一',
        category: 'structural',
        severity: 'soft',
        violation: '所有镜头类型相同，建议多样化镜头语法类型',
      })
    }

    return c
  }

  // ─── 节奏约束 ───

  private checkRhythmConstraints(nodes: ShotGrammarNode[]): DirectorialConstraint[] {
    const c: DirectorialConstraint[] = []

    // 高潮前后应有节奏变化
    const peakIndices = nodes.map((n, i) => n.type === 'peak' ? i : -1).filter(i => i >= 0)
    for (const pi of peakIndices) {
      // 高潮前：应有 build-up 来提高强度
      if (pi > 0) {
        const prevType = nodes[pi - 1].type
        if (prevType !== 'build_up' && prevType !== 'reaction') {
          c.push({
            name: `高潮前节奏断层（镜头 ${pi + 1}）`,
            category: 'rhythm',
            severity: 'style',
            violation: `高潮（peak）前建议有一个 build-up 或 reaction 镜头来提升情绪节奏`,
          })
        }
      }
      // 高潮后：不应立即再接高潮
      if (pi < nodes.length - 1 && nodes[pi + 1].type === 'peak') {
        c.push({
          name: `连续高潮镜头`,
          category: 'rhythm',
          severity: 'soft',
          violation: '连续两个高潮镜头会削弱冲击力，建议中间插入 release 或 reaction',
        })
      }
    }

    return c
  }

  // ─── 构图约束 ───

  private checkCompositionConstraints(nodes: ShotGrammarNode[]): DirectorialConstraint[] {
    const c: DirectorialConstraint[] = []

    // 类型分布建议
    const types = nodes.map(n => n.type)
    const establishingCount = types.filter(t => t === 'establishing').length
    const insertCount = types.filter(t => t === 'insert').length

    if (establishingCount === 0) {
      c.push({
        name: '缺少建立镜头',
        category: 'composition',
        severity: 'hard',
        violation: '没有 establishing shot，观众无法建立空间认知——建议第一镜用远景/全景建立场景',
      })
    }

    if (insertCount > types.length * 0.5) {
      c.push({
        name: '插入镜头过多',
        category: 'composition',
        severity: 'soft',
        violation: '插入（insert）镜头超过一半，建议减少特写/细节镜头，增加主镜头',
      })
    }

    return c
  }
}
