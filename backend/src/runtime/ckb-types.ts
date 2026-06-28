/**
 * CKB — Cinematic Knowledge Base v1.0
 *
 * PQL 的知识中枢。不属于闭环执行链，但为闭环所有模块提供知识支持。
 *
 * 五个 Repository：
 *   ① DirectorPatterns — 优秀导演方案（CIR + Evaluation）
 *   ② ProviderProfiles — Provider 能力画像与局限性
 *   ③ OptimizationKnowledge — CIR Patch 成功率与收益
 *   ④ BenchmarkCorpus — Golden Case（Story → CIR → Video → Evidence → Report）
 *   ⑤ FailureAtlas — 失败模式与解决方案
 *
 * 写入策略：Quality Gate — 仅 high-score / high-gain / new-failure 写入
 * 版本策略：每条知识带 version / validatedAt / sampleCount
 */

// ─── ① DirectorPattern ───────────────────

export interface DirectorPattern {
  patternId: string
  sceneType: string
  provider: string
  /** 对应的 CIR（抽象摘要） */
  cirSummary: {
    cameraScales: string[]
    cameraAngles: string[]
    motionPatterns: string[]
    lightingMoods: string[]
  }
  /** 评估结果 */
  evaluation: {
    overallScore: number
    topCapabilities: string[]
    weakCapabilities: string[]
  }
  /** 成功次数 */
  successCount: number
  version: string
  createdAt: string
  tags: string[]
}

// ─── ② Provider Profile ─────────────────

export interface ProviderCapabilityPoint {
  capability: string
  /** 支持程度: full / partial / none */
  supportLevel: 'full' | 'partial' | 'none'
  limitations: string[]
  /** 历史成功率 (0-100) */
  historicalSuccessRate: number
  sampleCount: number
}

export interface ProviderProfile {
  providerId: string
  providerName: string
  /** 能力画像 */
  capabilities: ProviderCapabilityPoint[]
  /** 最佳匹配的场景类型 */
  bestFor: string[]
  /** 弱项场景 */
  weakFor: string[]
  /** 版本记录 */
  version: string
  lastUpdated: string
}

// ─── ③ Optimization Knowledge ───────────

export interface PatchPattern {
  /** Patch 类型摘要 */
  patternId: string
  /** 目标 Capability */
  targetCapability: string
  /** Patch 描述 */
  description: string
  /** 平均收益（百分比提升） */
  averageGain: number
  /** 标准差 */
  gainStdDev: number
  /** 样本数量 */
  sampleCount: number
  /** 成功率（带来正向提升的比例） */
  successRate: number
  /** 适用场景 */
  applicableScenes: string[]
  /** 版本 */
  version: string
  lastUpdated: string
}

// ─── ④ Benchmark Corpus — Golden Case ────

export interface GoldenCase {
  caseId: string
  storyType: string
  provider: string
  /** 评估摘要 */
  evaluationSummary: {
    overallScore: number
    topScores: Record<string, number>
  }
  /** 视频或证据引用 */
  evidenceRef?: string
  tags: string[]
  createdAt: string
}

// ─── ⑤ Failure Atlas ─────────────────────

export interface FailureEntry {
  failureId: string
  /** 失败类型 */
  failureType: string
  /** 关联 Capability */
  capability: string
  /** Provider */
  provider: string
  /** 场景描述 */
  sceneDescription: string
  /** 失败条件 */
  conditions: string[]
  /** 已知解决方案 */
  solutions: string[]
  /** 出现次数 */
  occurrenceCount: number
  /** 最近出现 */
  lastOccurrence: string
  version: string
}

// ─── CKB Repository 接口 ─────────────────

export interface CkbRepository<T> {
  /** 插入知识 */
  insert(entry: T): string
  /** 按 ID 查询 */
  get(id: string): T | undefined
  /** 搜索 */
  search(query: Partial<T>): T[]
  /** 更新 */
  update(id: string, entry: Partial<T>): boolean
  /** 统计 */
  count(): number
}

// ─── Quality Gate 分数阈值 ───────────────

export const CKB_QUALITY_GATES = {
  /** 写入 DirectorPattern 的最低 overallScore */
  directorPatternMinScore: 90,
  /** 被识别为提升的 min Gain */
  minGainForOptimization: 5, // percentage points
  /** 被识别为 new Failure 的 min 间隔（天） */
  newFailureCooldownDays: 7,
  /** Optimization Knowledge 的最小样本数 */
  minSamplesForOptimization: 3,
}
