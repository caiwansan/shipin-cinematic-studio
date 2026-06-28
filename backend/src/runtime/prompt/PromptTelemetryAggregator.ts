/**
 * PromptTelemetryAggregator.ts — Phase 4-B Prompt 遥测聚合引擎
 *
 * 职责：
 * 1. 定时从 prompt_runtime_log 聚合数据到统计表
 * 2. 计算核心指标：PSI, RE, VDS, LSI, FCS
 * 3. 纯统计，无 AI/ML
 *
 * @phase-4b
 */

import { prisma } from '../../utils/index.js'
import { runAsAdmin } from './PromptAccessGuard.js'
import crypto from 'crypto'

// ─── 1. Version Stats Aggregation ───

export async function aggregateVersionStats(): Promise<void> {
  const result = await runAsAdmin(() =>
    prisma.$queryRawUnsafe<Array<{
      prompt_name: string
      version: string
      total_calls: bigint
      success_calls: bigint
      avg_latency: number
      p95_latency: number
      failure_rate: number
    }>>(`
      SELECT
        prompt_name,
        version,
        COUNT(*)::int AS total_calls,
        SUM(CASE WHEN success THEN 1 ELSE 0 END)::int AS success_calls,
        ROUND(AVG(latency_ms)::numeric, 2)::float8 AS avg_latency,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::numeric, 2)::float8 AS p95_latency,
        ROUND(1.0 - (SUM(CASE WHEN success THEN 1 ELSE 0 END)::float8 / GREATEST(COUNT(*)::float8, 1)), 4)::float8 AS failure_rate
      FROM prompt_runtime_log
      GROUP BY prompt_name, version
    `)
  )

  for (const row of result) {
    await runAsAdmin(() =>
      prisma.promptVersionStats.upsert({
        where: {
          promptName_version: {
            promptName: String(row.prompt_name),
            version: String(row.version),
          },
        },
        create: {
          promptName: String(row.prompt_name),
          version: String(row.version),
          totalCalls: Number(row.total_calls),
          successCalls: Number(row.success_calls),
          avgLatency: Number(row.avg_latency),
          p95Latency: Number(row.p95_latency),
          failureRate: Number(row.failure_rate),
        },
        update: {
          totalCalls: Number(row.total_calls),
          successCalls: Number(row.success_calls),
          avgLatency: Number(row.avg_latency),
          p95Latency: Number(row.p95_latency),
          failureRate: Number(row.failure_rate),
          updatedAt: new Date(),
        },
      })
    )
  }
}

// ─── 2. Routing Distribution Aggregation ───

export async function aggregateRoutingDistribution(): Promise<void> {
  const result = await runAsAdmin(() =>
    prisma.$queryRawUnsafe<Array<{
      prompt_name: string
      stable_count: bigint
      canary_count: bigint
      override_count: bigint
      total: bigint
    }>>(`
      SELECT
        prompt_name,
        SUM(CASE WHEN routing_mode = 'stable' THEN 1 ELSE 0 END)::int AS stable_count,
        SUM(CASE WHEN routing_mode = 'canary' THEN 1 ELSE 0 END)::int AS canary_count,
        SUM(CASE WHEN routing_mode = 'override' THEN 1 ELSE 0 END)::int AS override_count,
        COUNT(*)::int AS total
      FROM prompt_runtime_log
      GROUP BY prompt_name
    `)
  )

  for (const row of result) {
    const total = Number(row.total)
    const stable = Number(row.stable_count)
    const canary = Number(row.canary_count)
    const override = Number(row.override_count)

    // 计算熵：H = -Σ p(i) * log(p(i))
    const eps = 0.0001
    const pStable = stable / Math.max(total, 1)
    const pCanary = canary / Math.max(total, 1)
    const pOverride = override / Math.max(total, 1)
    const entropy = -(
      (pStable > 0 ? pStable * Math.log(pStable) : 0) +
      (pCanary > 0 ? pCanary * Math.log(pCanary) : 0) +
      (pOverride > 0 ? pOverride * Math.log(pOverride) : 0)
    )

    await runAsAdmin(() =>
      prisma.promptRoutingDistribution.upsert({
        where: { promptName: String(row.prompt_name) },
        create: {
          promptName: String(row.prompt_name),
          stableCount: stable,
          canaryCount: canary,
          overrideCount: override,
          total,
          entropy: Math.round(entropy * 10000) / 10000,
        },
        update: {
          stableCount: stable,
          canaryCount: canary,
          overrideCount: override,
          total,
          entropy: Math.round(entropy * 10000) / 10000,
          updatedAt: new Date(),
        },
      })
    )
  }
}

// ─── 3. Version Drift Snapshot ───

export async function takeVersionSnapshot(): Promise<void> {
  const now = new Date()
  // 窗口起始时间 = 当前整小时
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0)

  const result = await runAsAdmin(() =>
    prisma.$queryRawUnsafe<Array<{
      prompt_name: string
      version: string
      call_count: bigint
    }>>(`
      SELECT
        prompt_name,
        version,
        COUNT(*)::int AS call_count
      FROM prompt_runtime_log
      WHERE "createdAt" >= $1::timestamp
      GROUP BY prompt_name, version
    `, windowStart.toISOString())
  )

  for (const row of result) {
    await runAsAdmin(() =>
      prisma.promptVersionSnapshot.create({
        data: {
          promptName: String(row.prompt_name),
          version: String(row.version),
          callCount: Number(row.call_count),
          windowStart,
        },
      })
    )
  }
}

// ─── 4. Failure Cluster Detection ───

export async function detectFailureClusters(): Promise<void> {
  const result = await runAsAdmin(() =>
    prisma.$queryRawUnsafe<Array<{
      prompt_name: string
      failure_signature: string
      count: bigint
      first_seen: Date
      last_seen: Date
    }>>(`
      SELECT
        prompt_name,
        COALESCE(context_hash, 'unknown') AS failure_signature,
        COUNT(*)::int AS count,
        MIN("createdAt") AS first_seen,
        MAX("createdAt") AS last_seen
      FROM prompt_runtime_log
      WHERE success = false
      GROUP BY prompt_name, context_hash
    `)
  )

  for (const row of result) {
    await runAsAdmin(() =>
      prisma.promptFailureCluster.upsert({
        where: {
          promptName_failureSignature: {
            promptName: String(row.prompt_name),
            failureSignature: String(row.failure_signature),
          },
        },
        create: {
          promptName: String(row.prompt_name),
          failureSignature: String(row.failure_signature),
          count: Number(row.count),
          firstSeen: row.first_seen,
          lastSeen: row.last_seen,
        },
        update: {
          count: Number(row.count),
          lastSeen: row.last_seen,
        },
      })
    )
  }
}

// ─── 5. 全量聚合（主入口） ───

export async function runFullAggregation(): Promise<void> {
  console.log('[PromptTelemetry] 🔄 Starting full aggregation...')
  const start = Date.now()

  await aggregateVersionStats()
  console.log('[PromptTelemetry] ✅ Version stats aggregated')

  await aggregateRoutingDistribution()
  console.log('[PromptTelemetry] ✅ Routing distribution aggregated')

  await takeVersionSnapshot()
  console.log('[PromptTelemetry] ✅ Version snapshot taken')

  await detectFailureClusters()
  console.log('[PromptTelemetry] ✅ Failure clusters detected')

  const elapsed = Date.now() - start
  console.log(`[PromptTelemetry] ✅ Full aggregation complete in ${elapsed}ms`)
}
