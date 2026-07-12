/**
 * truth/store/truth-repository.ts — Truth Repository（SSOT）
 *
 * Truth-001: 持久化 Truth 数据到 PostgreSQL。
 * Repository 是唯一真实存储（SSOT）。
 * Map（truth-store.ts）降级为 Runtime Cache。
 *
 * 设计约束：
 *   - 不包含业务逻辑（仲裁/评分在 arbitration-engine / scoring-engine）
 *   - Write-through: DB 成功后才更新缓存
 *   - 最小方法集：save / findByTaskId / findRecent / summary
 */

import { prisma } from '../../utils/index.js'
import type { TruthEntry } from '../truth-model.js'

// ─── DB ↔ Entry 映射 ────────────────────────────────────

interface TruthRecordInput {
  taskId: string
  provider: string
  model: string
  latency: number
  cost: number
  completeness: number
  correctness: number
  stability: number
  costEfficiency: number
  winnerOutput: any
  allResults: any
}

function entryToRecord(entry: TruthEntry): TruthRecordInput {
  return {
    taskId: entry.taskId,
    provider: entry.winner.provider,
    model: entry.winner.model,
    latency: entry.winner.latency,
    cost: entry.winner.cost,
    completeness: entry.score.completeness,
    correctness: entry.score.correctness,
    stability: entry.score.stability,
    costEfficiency: entry.score.costEfficiency,
    winnerOutput: entry.winner.output,
    allResults: entry.allResults,
  }
}

function recordToEntry(record: any): TruthEntry {
  return {
    taskId: record.taskId,
    winner: {
      provider: record.provider,
      model: record.model,
      latency: record.latency,
      cost: record.cost,
      output: record.winnerOutput,
    },
    score: {
      completeness: record.completeness,
      correctness: record.correctness,
      stability: record.stability,
      costEfficiency: record.costEfficiency,
    },
    allResults: record.allResults || [],
    timestamp: new Date(record.created_at).getTime(),
  }
}

// ─── Repository ─────────────────────────────────────────

export class TruthRepository {
  /**
   * 保存 Truth 到数据库。
   * Write-through: DB 成功后返回 true。
   * @throws 如果 DB 写入失败（调用方决定是否降级到内存缓存）
   */
  async save(entry: TruthEntry): Promise<boolean> {
    const data = entryToRecord(entry)
    await prisma.truthRecord.upsert({
      where: { taskId: entry.taskId },
      create: data,
      update: data,
    })
    return true
  }

  /** 按 taskId 查询 Truth */
  async findByTaskId(taskId: string): Promise<TruthEntry | null> {
    const record = await prisma.truthRecord.findUnique({
      where: { taskId },
    })
    return record ? recordToEntry(record) : null
  }

  /** 查询最近 N 条 Truth */
  async findRecent(limit: number = 100): Promise<TruthEntry[]> {
    const records = await prisma.truthRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return records.map(recordToEntry)
  }

  /** 统计摘要（供 dashboard 使用） */
  async summary(): Promise<{
    total: number
    avgLatency: number
    avgCost: number
  }> {
    const agg = await prisma.truthRecord.aggregate({
      _count: { id: true },
      _avg: { latency: true, cost: true },
    })
    return {
      total: agg._count.id,
      avgLatency: Math.round(agg._avg.latency || 0),
      avgCost: Math.round((agg._avg.cost || 0) * 100) / 100,
    }
  }
}

/** 全局单例 */
export const truthRepository = new TruthRepository()
