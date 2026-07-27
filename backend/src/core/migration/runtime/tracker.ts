/**
 * BETA-ARCH-03.0.2
 * Migration Runtime — Tracker Implementation
 * 
 * 默认 Tracker 实现：写入 PostgreSQL (Prisma)。
 * 支持 fallback 到 console 以隔离遥测失败。
 */

import type { MigrationTracker, MigrationUsageLogEntry } from './types.js'

/**
 * 数据库 Tracker — Prisma 写入 migration_usage_log
 */
export class PrismaMigrationTracker implements MigrationTracker {
  private prisma: any

  constructor(prisma: any) {
    this.prisma = prisma
  }

  async log(entry: MigrationUsageLogEntry): Promise<void> {
    await this.prisma.migrationUsageLog.create({
      data: {
        adapter: entry.adapter,
        source: entry.source,
        target: entry.target,
        status: entry.status,
        durationMs: entry.durationMs,
        callCount: entry.callCount ?? 1,
        caller: entry.caller ?? 'system',
        metadata: entry.metadata ?? {},
      },
    })
  }
}

/**
 * 内存 Tracker — 测试用，不落库
 */
export class InMemoryMigrationTracker implements MigrationTracker {
  public logs: MigrationUsageLogEntry[] = []

  async log(entry: MigrationUsageLogEntry): Promise<void> {
    this.logs.push({ ...entry })
  }

  clear(): void {
    this.logs = []
  }
}

/**
 * 空 Tracker — 用于性能基准测试
 */
export class NoOpMigrationTracker implements MigrationTracker {
  async log(_entry: MigrationUsageLogEntry): Promise<void> {
    // 不执行任何操作
  }
}
