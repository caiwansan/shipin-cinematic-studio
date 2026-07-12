// ============================================================
// SnapshotBuilder — 唯一 GEOScoreSnapshot 数据构造入口
// P0-5.1: Snapshot Constitution
//
// SSOT: 整个系统只允许通过此 Builder 构造 Snapshot 数据。
// Repository.create() 必须接收 SnapshotBuildResult 作为输入。
// ============================================================

/**
 * Score Engine 版本常量
 * 更新评分算法时同步修改此版本号
 */
export const SCORE_ENGINE_VERSION = '1.0.0'

/**
 * Provider Adapter 版本常量
 * 实际应当从 package.json 或 adapter 元数据自动获取
 */
export const PROVIDER_ADAPTER_VERSION = '1.0.0'

/**
 * 评分版本
 */
export const SCORE_VERSION = '1.0'

export interface SnapshotBuildParams {
  projectId: string
  scanId?: string
  evidenceIds?: string[]
  providerVersion?: string
  responseHash?: string
  sourceType: 'stub' | 'real' | 'migration'
  /** Snapshot 主体数据（原有 snapshot 字段内容） */
  snapshotData: Record<string, unknown>
  /** 评分数据（原有 scores 字段内容） */
  scoresData?: Record<string, unknown>
  /** 元数据（原有 metadata 字段内容） */
  metadataData?: Record<string, unknown>
  optimizationExecutionId?: string
  tenantId?: string
}

export interface SnapshotBuildResult {
  projectId: string
  tenantId?: string
  snapshot: Record<string, unknown>
  scores?: Record<string, unknown>
  metadata?: Record<string, unknown>
  optimizationExecutionId?: string
  scanId?: string
  evidenceIds: string[]
  providerVersion: string
  engineVersion: string
  responseHash?: string
  sourceType: string
  scoreVersion: string
}

export class SnapshotBuilder {
  static readonly VERSION = '1.0'

  /**
   * 构建标准化的 Snapshot 数据
   *
   * 设计原则：
   * - `engineVersion` 自动从 SCORE_ENGINE_VERSION 获取，禁止人工传参
   * - `scoreVersion` 自动从 SCORE_VERSION 获取
   * - `sourceType` 必须在调用方显式传入（不能默认）
   * - `evidenceIds` 默认空数组
   * - `providerVersion` 默认使用 PROVIDER_ADAPTER_VERSION
   */
  build(params: SnapshotBuildParams): SnapshotBuildResult {
    return {
      projectId: params.projectId,
      tenantId: params.tenantId,
      snapshot: params.snapshotData,
      scores: params.scoresData,
      metadata: params.metadataData,
      optimizationExecutionId: params.optimizationExecutionId,
      scanId: params.scanId,
      evidenceIds: params.evidenceIds ?? [],
      providerVersion: params.providerVersion ?? PROVIDER_ADAPTER_VERSION,
      engineVersion: SCORE_ENGINE_VERSION,
      responseHash: params.responseHash,
      sourceType: params.sourceType,
      scoreVersion: SCORE_VERSION,
    }
  }
}

// Singleton
export const snapshotBuilder = new SnapshotBuilder()
