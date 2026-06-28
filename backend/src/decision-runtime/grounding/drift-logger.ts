/**
 * drift-logger.ts — Phase A-3.2 Reality Grounding Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * DriftLogger — 偏差日志记录器
 * ═══════════════════════════════════════════════════════════════
 *
 * 功能：
 *   1. 记录每次决策运行的偏差历史
 *   2. 维护历史基线数据集（用于后续的偏差检测）
 *   3. 提供基线查询接口（按领域/轴/地域查询）
 *   4. 支持基线持久化（内存 / 文件 / 后续 DB）
 *
 * 设计约束：
 *   - 当前是内存存储（Phase A 阶段），不依赖外部存储
 *   - A-4 数据接入层后可升级为 DB 持久化
 *   - 基线更新策略：滚动窗口（最多保留 N 条）
 */

import type { DriftAssessment, AggregatedDrift } from './drift-detector.js'

// ============================================================
// 1. 偏差记录
// ============================================================

export interface DriftRecord {
  /** 运行时间戳 */
  runAt: number
  /** 运行 Trace ID */
  traceId: string
  /** 领域 */
  domain: string
  /** 用户需求 */
  requirement: string
  /** 评估轴名称 */
  axisName: string
  /** 系统评分 */
  systemScore: number
  /** 偏差评估 */
  assessment: DriftAssessment
  /** 聚合偏差（若有） */
  aggregated?: AggregatedDrift
}

// ============================================================
// 2. 历史基线
// ============================================================

export interface HistoricalBaseline {
  /** 记录数量 */
  recordCount: number
  /** 平均系统评分 */
  averageSystemScore: number
  /** 平均偏差 */
  averageRelativeDrift: number
  /** 最高偏差 */
  maxRelativeDrift: number
  /** 最近一次运行时间 */
  lastRunAt: number
}

// ============================================================
// 3. 查询参数
// ============================================================

export interface BaselineQuery {
  domain?: string
  axisName?: string
  geoScope?: string
  maxRecords?: number
}

// ============================================================
// 4. 偏差日志接口
// ============================================================

export interface DriftLogger {
  /**
   * 记录一次偏差
   */
  record(params: {
    traceId: string
    requirement: string
    domain: string
    axisName: string
    systemScore: number
    assessment: DriftAssessment
    aggregated?: AggregatedDrift
  }): void

  /**
   * 查询历史基线
   */
  getBaseline(query?: BaselineQuery): HistoricalBaseline

  /**
   * 查询最近 N 条记录
   */
  getRecentRecords(limit?: number): DriftRecord[]

  /**
   * 查询所有记录
   */
  getAllRecords(): DriftRecord[]

  /**
   * 清除所有记录
   */
  clear(): void
}

// ============================================================
// 5. 默认实现（内存存储）
// ============================================================

export function createDriftLogger(maxRecords?: number): DriftLogger {
  const max = maxRecords ?? 1000
  const records: DriftRecord[] = []

  function record(params: {
    traceId: string
    requirement: string
    domain: string
    axisName: string
    systemScore: number
    assessment: DriftAssessment
    aggregated?: AggregatedDrift
  }): void {
    const entry: DriftRecord = {
      runAt: Date.now(),
      traceId: params.traceId,
      domain: params.domain,
      requirement: params.requirement,
      axisName: params.axisName,
      systemScore: params.systemScore,
      assessment: params.assessment,
      aggregated: params.aggregated,
    }

    records.push(entry)

    // 滚动窗口：超出 max 时移除最旧的记录
    if (records.length > max) {
      records.splice(0, records.length - max)
    }
  }

  function getBaseline(query?: BaselineQuery): HistoricalBaseline {
    const filtered = query
      ? records.filter(r => {
          if (query.domain && r.domain !== query.domain) return false
          if (query.axisName && r.axisName !== query.axisName) return false
          return true
        })
      : records

    if (filtered.length === 0) {
      return {
        recordCount: 0,
        averageSystemScore: 0,
        averageRelativeDrift: 0,
        maxRelativeDrift: 0,
        lastRunAt: 0,
      }
    }

    const sumScore = filtered.reduce((s, r) => s + r.systemScore, 0)
    const sumDrift = filtered.reduce((s, r) => s + r.assessment.relativeDrift, 0)
    const maxDrift = Math.max(...filtered.map(r => r.assessment.relativeDrift))

    return {
      recordCount: filtered.length,
      averageSystemScore: sumScore / filtered.length,
      averageRelativeDrift: sumDrift / filtered.length,
      maxRelativeDrift: maxDrift,
      lastRunAt: filtered[filtered.length - 1].runAt,
    }
  }

  function getRecentRecords(limit?: number): DriftRecord[] {
    const n = limit ?? 10
    return records.slice(-n)
  }

  function getAllRecords(): DriftRecord[] {
    return [...records]
  }

  function clear(): void {
    records.length = 0
  }

  return { record, getBaseline, getRecentRecords, getAllRecords, clear }
}
