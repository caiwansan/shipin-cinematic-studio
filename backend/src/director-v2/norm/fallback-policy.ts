/**
 * fallback-policy.ts — 降级策略层
 *
 * 定义 Constitution 编译过程中各阶段的降级行为。
 * 核心原则：降级不是失败，是有记录的妥协。
 *
 * 每个降级决策包含：
 * - 降级原因（why）
 * - 降级影响（what breaks）
 * - 降级层级（how bad）
 * - 恢复条件（how to fix）
 */

import type { StoryConstitution } from '../schema/story-constitution.js'
import { createDefaultConstitution } from '../schema/story-constitution.js'

// ============================================================
// Degrade Levels
// ============================================================

export type DegradeLevel = 'none' | 'minor' | 'major' | 'catastrophic'

export const DEGRADE_PRIORITY: Record<DegradeLevel, number> = {
  none: 0,
  minor: 1,
  major: 2,
  catastrophic: 3,
}

// ============================================================
// Fallback Config
// ============================================================

export interface FallbackConfig {
  /**
   * 是否允许降级
   */
  allowDegrade: boolean

  /**
   * 最大容忍降级层级
   * catastrophic 降级会触发 Constitution 编译失败
   */
  maxDegradeLevel: DegradeLevel

  /**
   * 降级时的默认值策略
   */
  defaultStrategy: DefaultStrategy
}

export type DefaultStrategy =
  | 'safe_defaults'     // 使用安全的默认值（推荐）
  | 'partial'           // 保留部分成功字段
  | 'reject'            // 完全拒绝

// ============================================================
// Fallback Record
// ============================================================

export interface FallbackRecord {
  level: DegradeLevel
  stage: 'schema_validation' | 'llm_call' | 'normalization' | 'semantic_repair'
  field: string
  reason: string
  recovered: boolean
  recoveredValue?: string
}

// ============================================================
// Fallback Policy
// ============================================================

export class FallbackPolicy {
  private config: FallbackConfig

  constructor(config?: Partial<FallbackConfig>) {
    this.config = {
      allowDegrade: config?.allowDegrade ?? true,
      maxDegradeLevel: config?.maxDegradeLevel ?? 'major',
      defaultStrategy: config?.defaultStrategy ?? 'safe_defaults',
    }
  }

  /**
   * 获取当前配置（允许运行时读取）
   */
  getConfig(): FallbackConfig {
    return { ...this.config }
  }

  /**
   * 更新配置（运行时热更新）
   */
  updateConfig(partial: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...partial }
  }

  /**
   * 检查本次降级是否在容忍范围内
   */
  isWithinTolerance(level: DegradeLevel): boolean {
    return DEGRADE_PRIORITY[level] <= DEGRADE_PRIORITY[this.config.maxDegradeLevel]
  }

  /**
   * 判断 Constitutional 编译是否应因为降级而失败
   */
  shouldFail(records: FallbackRecord[]): boolean {
    if (!this.config.allowDegrade) {
      return records.length > 0
    }

    const worstLevel = records.reduce<DegradeLevel>((worst, r) => {
      return DEGRADE_PRIORITY[r.level] > DEGRADE_PRIORITY[worst] ? r.level : worst
    }, 'none')

    return !this.isWithinTolerance(worstLevel)
  }

  /**
   * 生成降级 Constitution（根据策略）
   */
  createFallbackConstitution(
    projectId: string,
    traceId: string,
    records: FallbackRecord[],
    partial?: Partial<StoryConstitution>,
  ): { constitution: StoryConstitution; records: FallbackRecord[] } {
    const base = createDefaultConstitution(projectId, traceId, {
      reason: records.map(r => r.reason).join('; '),
    })

    if (this.config.defaultStrategy === 'safe_defaults') {
      return {
        constitution: { ...base, ...partial },
        records: [
          ...records,
          {
            level: 'catastrophic',
            stage: 'schema_validation',
            field: 'constitution',
            reason: '使用完全默认 Constitution',
            recovered: false,
          },
        ],
      }
    }

    return {
      constitution: { ...base, ...partial },
      records,
    }
  }
}

/** 全局默认策略（允许 major 级别降级） */
export const defaultFallbackPolicy = new FallbackPolicy()
