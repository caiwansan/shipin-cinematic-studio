/**
 * director-intelligence/sampler.ts
 *
 * ⚔️ Phase 3 — Controlled Sampling Layer（可控采样层）
 *
 * 职责：
 *   控制生成过程的随机性，保证可复现、可约束。
 *
 * 核心能力：
 *   1. Randomness Seed 控制：相同的 seed → 相同的输出
 *   2. Divergence Range 限制：变体之间的差异不能超出范围
 *   3. Determinism Guarantee：输入 + seed → 确定性输出
 *
 * 使用场景：
 *   - 测试模式：seed=固定值，每次输出相同
 *   - 用户模式：seed=time，每次输出不同但可控
 *   - 比较模式：seed=1,2,3，观察多样性范围
 */

// ── 采样配置 ──

export interface SamplerConfig {
  /** 随机种子（0 = 使用时间戳） */
  seed: number
  /** 变体发散范围（0-1，1为最大发散） */
  divergenceRange: number
  /** 变体数量 */
  variantCount: number
  /** 是否保证确定性 */
  deterministic: boolean
}

export const DEFAULT_SAMPLER_CONFIG: SamplerConfig = {
  seed: 0,
  divergenceRange: 0.5,
  variantCount: 2,
  deterministic: true,
}

// ── 确定性随机数生成器（Mulberry32） ──

/**
 * createRng — 创建确定性伪随机数生成器
 *
 * 保证：
 *   same seed → same sequence → same output
 */
export function createRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── 采样器 ──

export class Sampler {
  private rng: () => number
  private config: SamplerConfig

  constructor(config?: Partial<SamplerConfig>) {
    this.config = { ...DEFAULT_SAMPLER_CONFIG, ...config }
    const effectiveSeed = this.config.seed === 0
      ? Date.now()
      : this.config.seed
    this.rng = createRng(effectiveSeed)
  }

  /**
   * 获取下一个随机值
   */
  next(): number {
    return this.rng()
  }

  /**
   * 获取指定范围内的随机值
   */
  range(min: number, max: number): number {
    return min + this.rng() * (max - min)
  }

  /**
   * 从数组中选择一个随机元素
   */
  pick<T>(items: T[]): T {
    const idx = Math.floor(this.rng() * items.length)
    return items[idx]
  }

  /**
   * 从数组中随机选择多个元素（不重复）
   */
  pickN<T>(items: T[], n: number): T[] {
    const shuffled = [...items]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, Math.min(n, shuffled.length))
  }

  /**
   * 获取当前配置快照
   */
  getConfig(): SamplerConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(patch: Partial<SamplerConfig>): void {
    const oldSeed = this.config.seed
    this.config = { ...this.config, ...patch }
    // 如果 seed 改变，重建 rng
    if (patch.seed !== undefined && patch.seed !== oldSeed) {
      this.rng = createRng(patch.seed)
    }
  }

  /**
   * 获取变体种子数组
   * 用于生成可复现的多个变体
   */
  getVariantSeeds(): number[] {
    const seeds: number[] = []
    for (let i = 0; i < this.config.variantCount; i++) {
      seeds.push(Math.floor(this.rng() * 2147483647))
    }
    return seeds
  }
}

// ── 发散范围控制 ──

/**
 * clampDivergence — 限制发散范围
 *
 * 确保变体之间的差异在控制范围内。
 * 目前基于 meta.version 做简单标记，
 * 后续可扩展为解析 DirectorPlan 的字段差异。
 */
export function clampDivergence<T>(original: T, variant: T): T {
  // Phase 3 占位实现：不做实际发散控制
  // Phase 3.1+ 可扩展为 JSON diff + 字段级发散限制
  return variant
}
