/**
 * services/hdz/circuit-breaker.service.ts — 混沌珠生产熔断保护
 *
 * 技术总监建议（2026-07-31）：
 *   百万字生产一定会遇到模型异常 → 连续失败 3 章 → 暂停生产 → 通知用户
 *   不要自动继续制造垃圾。
 *
 * 轻量实现（Redis 计数，无 schema 变更）：
 *   - recordHdzFailure():  失败计数 +1（10 分钟窗口），连续 ≥3 → 熔断 10 分钟
 *   - recordHdzSuccess():  任意成功 → 重置失败计数
 *   - isHdzCircuitOpen():  当前是否熔断
 *
 * 消费方：
 *   - orchestrator：任务失败/成功时上报
 *   - production-queue Sweeper：扫描前检查，熔断项目暂停入队
 */

import Redis from 'ioredis'
import { env } from '../../config/env.js'

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

const FAIL_KEY = (projectId: string) => `hdz:fail:${projectId}`
const CIRCUIT_KEY = (projectId: string) => `hdz:circuit:${projectId}`
const FAIL_WINDOW_SEC = 600          // 失败计数窗口 10 分钟
const CIRCUIT_OPEN_SEC = 600         // 熔断持续时间 10 分钟
const FAIL_THRESHOLD = 3             // 连续失败 3 次触发

/** 上报失败；返回是否触发了熔断 */
export async function recordHdzFailure(projectId: string, agentType: string): Promise<boolean> {
  try {
    const count = await connection.incr(FAIL_KEY(projectId))
    if (count === 1) await connection.expire(FAIL_KEY(projectId), FAIL_WINDOW_SEC)
    if (count >= FAIL_THRESHOLD) {
      await connection.set(CIRCUIT_KEY(projectId), '1', 'EX', CIRCUIT_OPEN_SEC)
      await connection.del(FAIL_KEY(projectId))
      console.error(`[HDZ/CIRCUIT] ⛔ 项目 ${projectId} 连续失败 ${count} 次（${agentType}），生产熔断 ${CIRCUIT_OPEN_SEC}s`)
      return true
    }
    console.warn(`[HDZ/CIRCUIT] 项目 ${projectId} 失败 ${count}/${FAIL_THRESHOLD}（${agentType}）`)
    return false
  } catch (e: any) {
    console.warn(`[HDZ/CIRCUIT] 熔断器上报失败（不影响主流程）: ${e.message}`)
    return false
  }
}

/** 上报成功（重置失败计数） */
export async function recordHdzSuccess(projectId: string): Promise<void> {
  try {
    await connection.del(FAIL_KEY(projectId))
  } catch { /* ignore */ }
}

/** 当前是否熔断 */
export async function isHdzCircuitOpen(projectId: string): Promise<boolean> {
  try {
    const v = await connection.exists(CIRCUIT_KEY(projectId))
    return v === 1
  } catch {
    return false
  }
}

/** 手动解除熔断（管理员） */
export async function resetHdzCircuit(projectId: string): Promise<void> {
  await connection.del(CIRCUIT_KEY(projectId))
  await connection.del(FAIL_KEY(projectId))
  console.log(`[HDZ/CIRCUIT] 🔓 手动解除项目 ${projectId} 熔断`)
}
