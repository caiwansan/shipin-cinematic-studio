/**
 * frame-invariant.ts — Phase A-0.8 Proof Invariant Compression
 *
 * ============================================================
 * FrameInvariant Schema
 * ============================================================
 *
 * FrameInvariant 不是"增强版 Frame"。
 * 是把 Frame 的整个生成路径压缩成一个不可变证明对象。
 *
 * 本质变化：
 *   以前：Frame comparison = 图同构 + 扰动验证
 *   现在：Frame comparison = 签名相等
 *
 * 宪法约束：
 *   1. invariant 不可变——一旦构造，属性不可修改
 *   2. signature 是确定性哈希——相同输入永远相同签名
 *   3. 不包含图结构——只包含压缩后的签名
 *   4. causalSpan 仅用于溯源，不用于等价判定
 */

// ============================================================
// 1. FrameInvariant（不可变证明对象）
// ============================================================

export interface FrameInvariant {
  /** 唯一标识 */
  frameId: string
  /**
   * 确定性签名。
   * 是 Frame 等价判定的唯一依据。
   * 签名格式：hash(requirement_class + world_view_class + evidence_set + scoring_order)
   * signature 相等 → Frame 等价（无需扰动验证）
   */
  signature: string
  /** 生成路径溯源（仅用于解释，不用于等价判定） */
  lineage: {
    /** 生成 requirement 的事件类型 */
    requirement: string
    /** 世界视图事件 */
    world: string
    /** 所有证据事件类型（有序） */
    evidence: string[]
    /** 评分事件 */
    scoring: string
  }
  /** 因果跨度——事件类型的有序列表 */
  causalSpan: string[]
  /** 推导出的等价类标识 */
  equivalenceClass: string | null
  /** 永真——结构保证 Frame 是可证明对象 */
  readonly stable: true
}

// ============================================================
// 2. 签名哈希函数（确定性）
// ============================================================

/**
 * 简单的确定性哈希
 * 不引入密码学安全哈希——只保证相同输入 → 相同输出
 */
function simpleHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * 计算 Frame 签名
 *
 * 签名 = hash( requirement_class + world_view_class + evidence_set + scoring_order )
 *
 * 这个签名是 Frame 等价判定的唯一依据。
 * 相同输入路径 → 相同签名 → 相同等价类。
 */
export function computeFrameSignature(input: {
  requirementClass: string
  worldViewClass: string
  evidenceSet: string[]
  scoringOrder: string
}): string {
  const raw = [
    input.requirementClass,
    input.worldViewClass,
    input.evidenceSet.sort().join('|'),
    input.scoringOrder,
  ].join('::')

  return simpleHash(raw)
}

// ============================================================
// 3. 等价类标识推导
// ============================================================

let classCounter = 0
const classCache = new Map<string, string>()

/**
 * 从 causalSpan 推导等价类标识
 *
 * 标识格式：FRAME_EQ_UIV_xx
 * 相同的 causalSpan → 相同的等价类（缓存命中）
 * 不同的 causalSpan → 新的等价类（计数器递增）
 */
export function deriveEquivalenceClass(causalSpan: string[]): string {
  const key = causalSpan.join('→')

  if (classCache.has(key)) {
    return classCache.get(key)!
  }

  classCounter++
  const eqClass = `FRAME_EQ_UIV_${String(classCounter).padStart(2, '0')}`
  classCache.set(key, eqClass)
  return eqClass
}

/**
 * 重置等价类缓存（测试用）
 */
export function resetEquivalenceClassCounter(): void {
  classCache.clear()
  classCounter = 0
}
