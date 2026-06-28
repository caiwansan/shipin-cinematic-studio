/**
 * perturbation-space-generator.ts — Phase B-0 Proof Engine
 *
 * ============================================================
 * Perturbation Manifold Construction
 * ============================================================
 *
 * 职责：构造扰动空间 P(x)
 * 不允许：执行逻辑、判断、执行 runtime
 *
 * 宪法约束：
 *   1. 只生成扰动配置，不执行 runtime
 *   2. 扰动作用于「输入空间」，不作用于「规则空间」
 *   3. 不允许修改 A-3.0 Deterministic Core 的规则
 *   4. 不允许修改 Trust Level 体系、Conflict Resolution 策略集
 *   5. 不允许修改 Grounding ±25% cap
 */

import type { DomainType } from '../business-intelligence/domain-classifier.js'

// ============================================================
// 1. 扰动类型枚举
// ============================================================

export enum PerturbationLayer {
  /** A-4 World Observation Surface */
  SIGNAL = 'signal',
  /** A-3.3 Signal Orchestration Surface */
  ORCHESTRATION = 'orchestration',
  /** A-3.2 Grounding Adjustment Surface */
  GROUNDING = 'grounding',
}

export enum SignalPerturbationType {
  SOURCE_BIAS = 'source_bias',
  MISSING_ENTITIES = 'missing_entities',
  DUPLICATED_ENTITIES = 'duplicated_entities',
  TIMESTAMP_JITTER = 'timestamp_jitter',
  CONFIDENCE_NOISE = 'confidence_noise',
  VALUE_NOISE = 'value_noise',
}

export enum OrchestrationPerturbationType {
  SIGNAL_ORDERING = 'signal_ordering',
  CONFLICT_STRATEGY_SWAP = 'conflict_strategy_swap',
  PRIORITY_WEIGHT_JITTER = 'priority_weight_jitter',
  FILTER_THRESHOLD_SHIFT = 'filter_threshold_shift',
}

export enum GroundingPerturbationType {
  RELIABILITY_SCALING = 'reliability_scaling',
  VOLATILITY_INJECTION = 'volatility_injection',
  DRIFT_AMPLIFICATION = 'drift_amplification',
  SIGNAL_AGGREGATION = 'signal_aggregation',
}

// ============================================================
// 2. 扰动配置类型
// ============================================================

/** 单一扰动操作 */
export interface PerturbationOp {
  /** 所属层 */
  layer: PerturbationLayer
  /** 扰动类型 */
  type: SignalPerturbationType | OrchestrationPerturbationType | GroundingPerturbationType
  /** 扰动强度 [0, 1] */
  strength: number
  /** 可选：随机种子（保证可复现） */
  seed?: number
}

/** 单条扰动路径 = 一系列扰动操作的组合（来自同层或跨层） */
export interface PerturbationPath {
  /** 路径 ID */
  id: string
  /** 该路径包含的扰动操作序列 */
  ops: PerturbationOp[]
  /** 扰动描述 */
  description: string
}

/** 扰动空间 = 所有合法扰动路径的集合 */
export interface PerturbationSpace {
  /** 原始输入（不下扰动的基准） */
  input: string
  /** 领域 */
  domain?: DomainType
  /** 所有扰动路径 */
  paths: PerturbationPath[]
  /** 路径数 */
  pathCount: number
  /** 生成时间戳 */
  createdAt: number
}

// ============================================================
// 3. 扰动空间生成器配置
// ============================================================

export interface PerturbationSpaceConfig {
  /** 每层最少路径数 */
  minPathsPerLayer: number
  /** 每层最多路径数 */
  maxPathsPerLayer: number
  /** 是否包含多层级联扰动（跨层组合） */
  enableCrossLayerPaths: boolean
  /** 跨层路径占比（0~1） */
  crossLayerRatio: number
  /** 默认强度范围 [min, max] */
  defaultStrengthRange: [number, number]
}

const DEFAULT_CONFIG: PerturbationSpaceConfig = {
  minPathsPerLayer: 3,
  maxPathsPerLayer: 5,
  enableCrossLayerPaths: true,
  crossLayerRatio: 0.3,
  defaultStrengthRange: [0.1, 0.5],
}

// ============================================================
// 4. 扰动空间生成
// ============================================================

/**
 * 构造扰动空间 P(x)
 *
 * 生成所有合法扰动路径，涵盖单层和多层组合。
 * 不执行任何 runtime，只生成配置。
 */
export function generatePerturbationSpace(
  input: string,
  config?: Partial<PerturbationSpaceConfig>,
  domain?: DomainType,
  seed?: number
): PerturbationSpace {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const paths: PerturbationPath[] = []

  // 每层的扰动类型列表
  const signalTypes = Object.values(SignalPerturbationType)
  const orchestrationTypes = Object.values(OrchestrationPerturbationType)
  const groundingTypes = Object.values(GroundingPerturbationType)

  // === 单层路径生成 ===

  // SIGNAL 层
  const signalPathCount = pickRandom(cfg.minPathsPerLayer, cfg.maxPathsPerLayer, seed, 'signal')
  for (let i = 0; i < signalPathCount; i++) {
    const type = signalTypes[i % signalTypes.length]
    paths.push({
      id: `signal_path_${i}`,
      ops: [{
        layer: PerturbationLayer.SIGNAL,
        type,
        strength: randomInRange(cfg.defaultStrengthRange[0], cfg.defaultStrengthRange[1], seed, `signal_${i}_strength`),
        seed: seed ? seed + i * 100 : undefined,
      }],
      description: `Signal perturbation: ${type} @ layer=SIGNAL`,
    })
  }

  // ORCHESTRATION 层
  const orchPathCount = pickRandom(cfg.minPathsPerLayer, cfg.maxPathsPerLayer, seed, 'orchestration')
  for (let i = 0; i < orchPathCount; i++) {
    const type = orchestrationTypes[i % orchestrationTypes.length]
    paths.push({
      id: `orch_path_${i}`,
      ops: [{
        layer: PerturbationLayer.ORCHESTRATION,
        type,
        strength: randomInRange(cfg.defaultStrengthRange[0], cfg.defaultStrengthRange[1], seed, `orch_${i}_strength`),
        seed: seed ? seed + i * 100 + 10 : undefined,
      }],
      description: `Orchestration perturbation: ${type} @ layer=ORCHESTRATION`,
    })
  }

  // GROUNDING 层
  const groundPathCount = pickRandom(cfg.minPathsPerLayer, cfg.maxPathsPerLayer, seed, 'grounding')
  for (let i = 0; i < groundPathCount; i++) {
    const type = groundingTypes[i % groundingTypes.length]
    paths.push({
      id: `ground_path_${i}`,
      ops: [{
        layer: PerturbationLayer.GROUNDING,
        type,
        strength: randomInRange(cfg.defaultStrengthRange[0], cfg.defaultStrengthRange[1], seed, `ground_${i}_strength`),
        seed: seed ? seed + i * 100 + 20 : undefined,
      }],
      description: `Grounding perturbation: ${type} @ layer=GROUNDING`,
    })
  }

  // === 跨层路径生成（可选）===
  if (cfg.enableCrossLayerPaths) {
    const crossCount = Math.round(paths.length * cfg.crossLayerRatio / (1 - cfg.crossLayerRatio))
    for (let i = 0; i < crossCount; i++) {
      // 从每层各取一个扰动类型
      const sType = signalTypes[i % signalTypes.length]
      const oType = orchestrationTypes[(i + 2) % orchestrationTypes.length]
      const gType = groundingTypes[(i + 3) % groundingTypes.length]

      paths.push({
        id: `cross_path_${i}`,
        ops: [
          { layer: PerturbationLayer.SIGNAL, type: sType, strength: 0.2, seed: seed ? seed + i * 1000 : undefined },
          { layer: PerturbationLayer.ORCHESTRATION, type: oType, strength: 0.2, seed: seed ? seed + i * 1000 + 50 : undefined },
          { layer: PerturbationLayer.GROUNDING, type: gType, strength: 0.2, seed: seed ? seed + i * 1000 + 100 : undefined },
        ],
        description: `Cross-layer perturbation: ${sType} + ${oType} + ${gType}`,
      })
    }
  }

  return {
    input,
    domain,
    paths,
    pathCount: paths.length,
    createdAt: Date.now(),
  }
}

// ============================================================
// 5. 查询与工具
// ============================================================

/**
 * 按层过滤扰动路径
 */
export function filterByLayer(space: PerturbationSpace, layer: PerturbationLayer): PerturbationPath[] {
  return space.paths.filter(p => p.ops.some(op => op.layer === layer))
}

/**
 * 获取扰动空间的参考路径（零扰动基准）
 */
export function getReferencePath(input: string, domain?: DomainType): PerturbationPath {
  return {
    id: 'reference',
    ops: [],
    description: `Zero-perturbation reference for input: ${input}`,
  }
}

// ============================================================
// 6. 确定性工具函数
// ============================================================

/** 基于种子的确定性随机整数 */
function pickRandom(min: number, max: number, seed?: number, salt?: string): number {
  if (seed === undefined) return min + Math.floor(Math.random() * (max - min + 1))
  const hash = simpleHash(`${seed}_${salt ?? ''}`)
  return min + (hash % (max - min + 1))
}

/** 基于种子的确定性随机浮点 */
function randomInRange(min: number, max: number, seed?: number, salt?: string): number {
  if (seed === undefined) return min + Math.random() * (max - min)
  const hash = simpleHash(`${seed}_${salt ?? ''}`)
  return min + (hash % 10000) / 10000 * (max - min)
}

/** 简单哈希（确定性的数字 → 数字映射） */
function simpleHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}
