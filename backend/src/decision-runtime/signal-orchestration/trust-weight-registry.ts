/**
 * trust-weight-registry.ts — Phase A-3.3 Signal Orchestration Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * TrustWeightRegistry — 信任权重注册表
 * ═══════════════════════════════════════════════════════════════
 *
 * 核心哲学：数据不是平等的。
 *
 * 权重分层（唐太宗十八骑等级）：
 *   Level 0:  GOV_OFFICIAL   政府/官方数据     权重 1.0  — 无可争议（统计局/央行/卫健委）
 *   Level 1:  ENTERPRISE_AUTH 企业认证数据       权重 0.9  — 可追溯（上市公司财报/正式公告）
 *   Level 2:  ENTERPRISE_OPEN 企业公开数据       权重 0.7  — 公开但不可完全验证
 *   Level 3:  PLATFORM_AGG   平台聚合数据        权重 0.6  — 经交叉验证（贝壳成交价/航旅纵横）
 *   Level 4:  PLATFORM_REVIEW 平台点评数据       权重 0.4  — 用户评价（大众点评/美团评论）
 *   Level 5:  EXPERT_OPINION  专家意见           权重 0.3  — 个人权威非系统权威
 *   Level 6:  USER_CONTENT    用户生成内容       权重 0.15 — 个体用户评价/评论
 *   Level 7:  UNKNOWN         未知来源           权重 0.0  — 不信任，不被纳入
 *
 * 宪法规则：
 *   1. 权重是编译时常量，不可动态修改（若需修改，必须走代码变更）
 *   2. 同一来源的权重跨领域可能不同（如"美团"在餐饮业权重 0.6，在医疗业权重 0.2）
 *   3. 未知来源权重恒为 0.0——永远不进入决策管道
 *   4. 权重 = 0 的信号直接被丢弃，不参与冲突化解
 *
 * @phase decision-runtime
 */

import type { DomainType } from '../business-intelligence/domain-classifier.js'
import type { GroundingSignal } from '../grounding/grounding-signal.js'

// ============================================================
// 1. 信任层级枚举
// ============================================================

export enum TrustLevel {
  /** 政府/官方 — 统计局、央行、卫健委、教育部 */
  GOV_OFFICIAL = 'GOV_OFFICIAL',
  /** 企业认证数据 — 上市公司财报、正式公告 */
  ENTERPRISE_AUTH = 'ENTERPRISE_AUTH',
  /** 企业公开数据 — 可查但未认证 */
  ENTERPRISE_OPEN = 'ENTERPRISE_OPEN',
  /** 平台聚合 — 经交叉验证的平台数据 */
  PLATFORM_AGG = 'PLATFORM_AGG',
  /** 平台点评 — 用户评价 */
  PLATFORM_REVIEW = 'PLATFORM_REVIEW',
  /** 专家意见 — 个人权威 */
  EXPERT_OPINION = 'EXPERT_OPINION',
  /** 用户生成内容 — 评论/反馈 */
  USER_CONTENT = 'USER_CONTENT',
  /** 未知来源 — 不信任 */
  UNKNOWN = 'UNKNOWN',
}

// ============================================================
// 2. 信任层级 → 基础权重
// ============================================================

const TRUST_BASE_WEIGHTS: Record<TrustLevel, number> = {
  [TrustLevel.GOV_OFFICIAL]: 1.0,
  [TrustLevel.ENTERPRISE_AUTH]: 0.9,
  [TrustLevel.ENTERPRISE_OPEN]: 0.7,
  [TrustLevel.PLATFORM_AGG]: 0.6,
  [TrustLevel.PLATFORM_REVIEW]: 0.4,
  [TrustLevel.EXPERT_OPINION]: 0.3,
  [TrustLevel.USER_CONTENT]: 0.15,
  [TrustLevel.UNKNOWN]: 0.0,
}

// ============================================================
// 3. 来源名称 → 信任层级（领域感知）
// ============================================================

/**
 * 已知数据源注册表
 *
 * 设计原则：
 *   1. 所有已知来源必须在此注册
 *   2. 不同领域同一来源可以有不同信任层级
 *   3. 未注册的来源默认 UNKNOWN
 *   4. 此表是编译时常量，禁止运行时修改
 */
const SOURCE_TRUST_REGISTRY: Record<string, {
  defaultLevel: TrustLevel
  domainOverrides?: Partial<Record<string, TrustLevel>>
}> = {
  // ── 政府/官方 ──
  '国家统计局': { defaultLevel: TrustLevel.GOV_OFFICIAL },
  '央行': { defaultLevel: TrustLevel.GOV_OFFICIAL },
  '卫健委': { defaultLevel: TrustLevel.GOV_OFFICIAL },
  '教育部': { defaultLevel: TrustLevel.GOV_OFFICIAL },
  '住建部': { defaultLevel: TrustLevel.GOV_OFFICIAL },
  '自然资源部': { defaultLevel: TrustLevel.GOV_OFFICIAL },
  '市级住建局': { defaultLevel: TrustLevel.GOV_OFFICIAL },
  '省级统计局': { defaultLevel: TrustLevel.GOV_OFFICIAL },
  '中国房地产指数研究院': { defaultLevel: TrustLevel.GOV_OFFICIAL },

  // ── 企业认证 ──
  '上市公司年报': { defaultLevel: TrustLevel.ENTERPRISE_AUTH },
  '企业征信报告': { defaultLevel: TrustLevel.ENTERPRISE_AUTH },
  '法院判决书': { defaultLevel: TrustLevel.ENTERPRISE_AUTH },

  // ── 企业公开 ──
  '链家': { defaultLevel: TrustLevel.ENTERPRISE_OPEN },
  '贝壳': { defaultLevel: TrustLevel.ENTERPRISE_OPEN },
  '安居客': { defaultLevel: TrustLevel.ENTERPRISE_OPEN },
  '天眼查': { defaultLevel: TrustLevel.ENTERPRISE_OPEN },
  '企查查': { defaultLevel: TrustLevel.ENTERPRISE_OPEN },
  '百度百科': { defaultLevel: TrustLevel.ENTERPRISE_OPEN },

  // ── 平台聚合 ──
  '美团外卖': { defaultLevel: TrustLevel.PLATFORM_AGG },
  '饿了么': { defaultLevel: TrustLevel.PLATFORM_AGG },
  '携程': { defaultLevel: TrustLevel.PLATFORM_AGG, domainOverrides: { MEDICAL: TrustLevel.UNKNOWN } },
  '飞猪': { defaultLevel: TrustLevel.PLATFORM_AGG, domainOverrides: { REAL_ESTATE: TrustLevel.UNKNOWN } },
  '大众点评': { defaultLevel: TrustLevel.PLATFORM_AGG },
  '高德地图': { defaultLevel: TrustLevel.PLATFORM_AGG },
  '百度地图': { defaultLevel: TrustLevel.PLATFORM_AGG },

  // ── 平台点评 ──
  '用户评论(大众点评)': { defaultLevel: TrustLevel.PLATFORM_REVIEW },
  '用户评论(美团)': { defaultLevel: TrustLevel.PLATFORM_REVIEW },
  '用户评论(携程)': { defaultLevel: TrustLevel.PLATFORM_REVIEW },
  '商品评价': { defaultLevel: TrustLevel.PLATFORM_REVIEW },

  // ── 用户生成内容 ──
  '微博': { defaultLevel: TrustLevel.USER_CONTENT },
  '知乎': { defaultLevel: TrustLevel.USER_CONTENT, domainOverrides: { EDUCATION: TrustLevel.PLATFORM_AGG } },
  '小红书': { defaultLevel: TrustLevel.USER_CONTENT },
  '百度贴吧': { defaultLevel: TrustLevel.USER_CONTENT },
  '豆瓣': { defaultLevel: TrustLevel.USER_CONTENT, domainOverrides: { TRAVEL: TrustLevel.PLATFORM_REVIEW } },
  '论坛用户发帖': { defaultLevel: TrustLevel.USER_CONTENT },

  // ── 领域特定 ──
  // 房地产特定
  '深圳市房地产信息平台': { defaultLevel: TrustLevel.GOV_OFFICIAL, domainOverrides: { REAL_ESTATE: TrustLevel.GOV_OFFICIAL } },
  '克而瑞': { defaultLevel: TrustLevel.ENTERPRISE_AUTH, domainOverrides: { REAL_ESTATE: TrustLevel.GOV_OFFICIAL } },
  // 法律特定
  '中国裁判文书网': { defaultLevel: TrustLevel.GOV_OFFICIAL, domainOverrides: { LEGAL: TrustLevel.GOV_OFFICIAL } },
  // 医疗特定
  '好大夫在线': { defaultLevel: TrustLevel.PLATFORM_AGG, domainOverrides: { MEDICAL: TrustLevel.PLATFORM_AGG } },
}

// ============================================================
// 4. 信任权重注册表实现
// ============================================================

export interface TrustWeightRegistry {
  /**
   * 获取某个数据源在指定领域的信任权重 [0, 1]
   *
   * 查找顺序：
   *   1. 若来源注册表中有 domainOverrides 指定此领域 → 返回该层级的基础权重
   *   2. 若来源已知 → 返回其 defaultLevel 的基础权重
   *   3. 若来源未知 → 返回 TrustLevel.UNKNOWN（权重 0.0）
   */
  getWeight(source: string, domain: DomainType): number

  /**
   * 获取数据源在指定领域的信任层级
   */
  getLevel(source: string, domain: DomainType): TrustLevel

  /**
   * 按信任层级过滤信号：
   *   权重 < minWeight 的信号被丢弃
   */
  filterByMinimum(signals: GroundingSignal[], minWeight: number, domain: DomainType): GroundingSignal[]

  /**
   * 检查某来源是否被信任（权重 > 0）
   */
  isTrusted(source: string, domain: DomainType): boolean

  /**
   * 注册数据源（运行时注册，用于扩展）
   * 注意：A-4 接入后可增加
   */
  register(source: string, level: TrustLevel, domainOverrides?: Record<string, TrustLevel>): void

  /**
   * 列出已知来源
   */
  listKnownSources(): string[]
}

// ============================================================
// 5. 默认实现
// ============================================================

export function createTrustWeightRegistry(): TrustWeightRegistry {
  // 复制一份（运行时可扩展）
  const registry: Record<string, {
    defaultLevel: TrustLevel
    domainOverrides?: Record<string, TrustLevel>
  }> = JSON.parse(JSON.stringify(SOURCE_TRUST_REGISTRY)) as any

  function getWeight(source: string, domain: DomainType): number {
    const entry = registry[source]
    if (!entry) return TRUST_BASE_WEIGHTS[TrustLevel.UNKNOWN]

    // 领域特定覆盖优先
    if (entry.domainOverrides && entry.domainOverrides[domain] !== undefined) {
      return TRUST_BASE_WEIGHTS[entry.domainOverrides[domain]]
    }

    return TRUST_BASE_WEIGHTS[entry.defaultLevel]
  }

  function getLevel(source: string, domain: DomainType): TrustLevel {
    const entry = registry[source]
    if (!entry) return TrustLevel.UNKNOWN

    if (entry.domainOverrides && entry.domainOverrides[domain] !== undefined) {
      return entry.domainOverrides[domain]
    }

    return entry.defaultLevel
  }

  function filterByMinimum(
    signals: GroundingSignal[],
    minWeight: number,
    domain: DomainType,
  ): GroundingSignal[] {
    return signals.filter(s => getWeight(s.source, domain) >= minWeight)
  }

  function isTrusted(source: string, domain: DomainType): boolean {
    return getWeight(source, domain) > 0
  }

  function register(
    source: string,
    level: TrustLevel,
    domainOverrides?: Record<string, TrustLevel>,
  ): void {
    registry[source] = {
      defaultLevel: level,
      domainOverrides: domainOverrides as Record<string, TrustLevel> | undefined,
    }
  }

  function listKnownSources(): string[] {
    return Object.keys(registry)
  }

  return { getWeight, getLevel, filterByMinimum, isTrusted, register, listKnownSources }
}

/** 单例 */
export const trustWeightRegistry = createTrustWeightRegistry()

/**
 * 获取来源的基础信任权重（领域无关版本）
 */
export function getBaseWeight(level: TrustLevel): number {
  return TRUST_BASE_WEIGHTS[level] ?? 0
}
