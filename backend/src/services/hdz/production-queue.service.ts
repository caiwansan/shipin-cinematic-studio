/**
 * services/hdz/production-queue.service.ts — 混沌珠小说生产队列（02-B Task 3）
 *
 * 目标：百万字生产后台化——不依赖 HTTP 请求触发，任务入队后由常驻 Worker 消费。
 *
 * 复用不重造：
 * - bullmq（已装，短剧 ai-runtime 队列同款）
 * - hdzAgentTask 表（已是 DB 队列：queued/running/completed/failed/waiting_approval/blocked）
 * - orchestrator.executeTask（唯一执行入口，内部已管 running/completed/failed + eventLog）
 *
 * 架构：
 *   HTTP 触发（同步异步路径，保留）──┐
 *                                   ├─→ hdzAgentTask(queued) ─→ orchestrator.executeTask
 *   DB Sweeper（常驻，兜底）────────┘         ▲                          │
 *     每 10s 扫 queued → enqueue ──→ hdz-production Queue ──→ Worker ──┘
 *
 * 幂等设计：Worker 消费时原子 claim（queued→running），claim 失败（已被 HTTP 路径执行）→ 跳过。
 */

import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { env } from '../../config/env.js'
import { prisma } from '../../utils/index.js'
import { isHdzCircuitOpen } from './circuit-breaker.service.js'

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

export const hdzProductionQueue = new Queue('hdz-production', { connection })

let worker: Worker | null = null
let sweeper: NodeJS.Timeout | null = null

/** 入队一个 hdz 任务（jobId=taskId 天然幂等，重复入队覆盖） */
export async function enqueueHdzTask(taskId: string): Promise<void> {
  await hdzProductionQueue.add('hdz-task', { taskId }, {
    jobId: taskId,
    removeOnComplete: 1000,
    removeOnFail: 5000,
  })
}

/** 启动 hdz 生产 Worker（常驻） */
export function startHdzWorker(): void {
  if (worker) return
  worker = new Worker('hdz-production', async (job) => {
    const { taskId } = job.data as { taskId: string }
    // 原子 claim：只有 queued 的任务才执行（防 HTTP 路径已执行导致重复）
    const claimed = await prisma.hdzAgentTask.updateMany({
      where: { id: taskId, status: 'queued' },
      data: { status: 'running', startedAt: new Date() },
    })
    if (claimed.count === 0) {
      console.log(`[HDZ/Queue] task ${taskId} 已被执行或不存在，跳过（幂等）`)
      return { skipped: true }
    }
    console.log(`[HDZ/Queue] Worker 消费 task ${taskId}`)
    const { hdzOrchestrator } = await import('./orchestrator.service.js')
    await hdzOrchestrator.executeTask(taskId)
    return { ok: true }
  }, { connection, concurrency: 2 })

  worker.on('failed', (job, err) => {
    console.error(`[HDZ/Queue] task ${job?.data?.taskId} 失败: ${err.message}`)
  })
  worker.on('error', (err) => {
    console.error(`[HDZ/Queue] Worker 错误: ${err.message}`)
  })
  console.log('[HDZ/Queue] 生产 Worker 已启动（hdz-production, concurrency=2）')
}

/** DB 扫描兜底：把遗留 queued 任务入队（幂等；每 10s 一次） */
export function startHdzSweeper(): void {
  if (sweeper) return
  sweeper = setInterval(async () => {
    try {
      const pending = await prisma.hdzAgentTask.findMany({
        where: { status: 'queued' },
        select: { id: true, projectId: true },
        take: 50,
      })
      // ★ 熔断保护：熔断中的项目暂停入队（不制造垃圾）
      const circuitProjects = new Set<string>()
      for (const t of pending) {
        if (await isHdzCircuitOpen(t.projectId)) circuitProjects.add(t.projectId)
      }
      for (const t of pending) {
        if (circuitProjects.has(t.projectId)) {
          console.warn(`[HDZ/CIRCUIT] ⛔ 项目 ${t.projectId} 熔断中，跳过任务 ${t.id} 入队`)
          continue
        }
        await enqueueHdzTask(t.id).catch((e: any) => console.warn(`[HDZ/Queue] enqueue ${t.id} 失败: ${e.message}`))
      }
      if (pending.length > 0) {
        console.log(`[HDZ/Queue] Sweeper: 发现 ${pending.length} 个 queued 任务入队`)
      }
    } catch (e: any) {
      console.warn(`[HDZ/Queue] Sweeper 扫描失败: ${e.message}`)
    }
  }, 10_000)
  sweeper.unref?.()
  console.log('[HDZ/Queue] DB Sweeper 已启动（10s 间隔）')
}

/** 一键启动（server 入口调用） */
export function startHdzProductionQueue(): void {
  startHdzWorker()
  startHdzSweeper()
}
