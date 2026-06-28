/**
 * Shot Grammar Tree
 * Cinematic Grammar System — 镜头语法系统
 *
 * 镜头语法树：定义每个镜头在叙事结构中的"语法角色"。
 *
 * 一个镜头不仅仅是画面，它在叙事中承担特定功能：
 *   - establishing: 场景建立（告诉观众"我们在哪"）
 *   - build-up: 叙事累积（让观众"进入状态"）
 *   - peak: 叙事高潮（冲突/情绪爆发）
 *   - release: 释放/过渡（让观众"喘口气"）
 *
 * 类比自然语言：就像一个句子中的主语/谓语/宾语。
 * 没有语法结构的镜头序列，就像语法混乱的句子。
 */

/**
 * 镜头语法节点类型
 */
export type ShotGrammarType =
  | 'establishing'   // 场景建立
  | 'build_up'       // 累积推进
  | 'peak'           // 高潮爆发
  | 'release'        // 释放过渡
  | 'insert'         // 插入镜头（道具/细节）
  | 'reaction'       // 反应镜头
  | 'pov'            // 主观视角
  | 'transition'     // 转场

/**
 * 镜头语法功能
 */
export type ShotGrammarFunction =
  | 'context'     // 提供上下文
  | 'emotion'     // 渲染情绪
  | 'action'      // 推进动作
  | 'reaction'    // 回应/后果
  | 'detail'      // 细节/特写
  | 'pause'       // 停顿/留白
  | 'reveal'      // 揭示/反转

/**
 * 镜头语法节点
 */
export interface ShotGrammarNode {
  /** 语法类型 */
  type: ShotGrammarType
  /** 功能 */
  function: ShotGrammarFunction
  /** 强度（0~1，高潮镜头强度高，过渡镜头强度低） */
  intensity: number
  /** 是否必须在序列中的位置约束 */
  positionalConstraint?: {
    /** 必须在此类型之后 */
    afterType?: ShotGrammarType
    /** 必须不在开头 */
    notFirst?: boolean
    /** 必须不在结尾 */
    notLast?: boolean
  }
}

/**
 * 镜头语法序列（完整的镜头语言结构）
 */
export interface ShotGrammarSequence {
  /** 所有语法节点 */
  nodes: ShotGrammarNode[]
  /** 总镜头数 */
  length: number
  /** 语法复杂度（不同 type 的数量） */
  complexity: number
  /** 是否符合基本镜头语言规范 */
  isGrammatical: boolean
}

// ─── 语法规则 ───

/**
 * 基本镜头语法规则
 * 一场戏的镜头序列应遵循的基本结构
 */
export const GRAMMAR_RULES = {
  /** 第一镜必须是 establishing */
  FIRST_SHOT_MUST_BE_ESTABLISHING: true,
  /** 建立镜头后不能直接高潮 */
  MIN_BUILD_UP_BEFORE_PEAK: 1,
  /** 高潮后必须有释放 */
  PEAK_MUST_HAVE_RELEASE: true,
  /** 转场镜头不能连续超过 2 个 */
  MAX_CONTINUOUS_TRANSITION: 2,
  /** 插入镜头前后应有主镜头 */
  INSERT_SURROUNDED: true,
} as const

/**
 * 预设镜头语法配置（按剧作节奏）
 */
export const GRAMMAR_PRESETS: Record<string, ShotGrammarNode[]> = {
  /** 经典三幕式 */
  classic_three_act: [
    { type: 'establishing', function: 'context', intensity: 0.3 },
    { type: 'build_up', function: 'action', intensity: 0.5 },
    { type: 'build_up', function: 'emotion', intensity: 0.6 },
    { type: 'peak', function: 'action', intensity: 0.9 },
    { type: 'release', function: 'reaction', intensity: 0.4 },
  ],
  /** 紧张积累式 */
  tense_build: [
    { type: 'establishing', function: 'context', intensity: 0.2 },
    { type: 'build_up', function: 'emotion', intensity: 0.4 },
    { type: 'build_up', function: 'emotion', intensity: 0.6 },
    { type: 'build_up', function: 'action', intensity: 0.7 },
    { type: 'peak', function: 'action', intensity: 1.0 },
    { type: 'release', function: 'pause', intensity: 0.3 },
  ],
  /** 抒情蒙太奇 */
  lyrical_montage: [
    { type: 'establishing', function: 'context', intensity: 0.3 },
    { type: 'build_up', function: 'emotion', intensity: 0.5 },
    { type: 'insert', function: 'detail', intensity: 0.4 },
    { type: 'build_up', function: 'emotion', intensity: 0.6 },
    { type: 'insert', function: 'detail', intensity: 0.5 },
    { type: 'release', function: 'pause', intensity: 0.2 },
  ],
}

// ─── 工具函数 ───

/**
 * 分析镜头语法序列的合法性
 */
export function analyzeGrammarSequence(nodes: ShotGrammarNode[]): {
  isValid: boolean
  violations: string[]
  complexity: number
} {
  const violations: string[] = []

  // 规则 1: 第一镜 must be establishing
  if (GRAMMAR_RULES.FIRST_SHOT_MUST_BE_ESTABLISHING && nodes[0]?.type !== 'establishing') {
    violations.push('第一镜必须是 establishing shot（场景建立）')
  }

  // 规则 2: 高潮前须有足够累积
  const peakIndex = nodes.findIndex(n => n.type === 'peak')
  const buildUpBeforePeak = nodes.slice(0, peakIndex).filter(n => n.type === 'build_up').length
  if (peakIndex >= 0 && buildUpBeforePeak < GRAMMAR_RULES.MIN_BUILD_UP_BEFORE_PEAK) {
    violations.push(`高潮前至少需要 ${GRAMMAR_RULES.MIN_BUILD_UP_BEFORE_PEAK} 个 build-up 镜头`)
  }

  // 规则 3: 高潮后须有释放
  if (GRAMMAR_RULES.PEAK_MUST_HAVE_RELEASE) {
    const lastPeakIndex = nodes.map((n, i) => n.type === 'peak' ? i : -1).filter(i => i >= 0).pop() ?? -1
    if (lastPeakIndex >= 0 && lastPeakIndex === nodes.length - 1) {
      violations.push('高潮镜头后不能立即结束，须有 release 镜头')
    }
    if (lastPeakIndex >= 0) {
      const afterPeak = nodes.slice(lastPeakIndex + 1)
      if (!afterPeak.some(n => n.type === 'release')) {
        violations.push('高潮后缺少 release（释放/过渡）镜头')
      }
    }
  }

  const uniqueTypes = new Set(nodes.map(n => n.type))
  return {
    isValid: violations.length === 0,
    violations,
    complexity: uniqueTypes.size,
  }
}
