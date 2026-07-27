/**
 * LegacyJobStore 兼容层 — Map 接口 → DB 读取
 * 
 * WORKBENCH-HARDENING-01 Phase 3
 * 
 * Phase 4-8 的 handler 函数仍然使用 Map<string, RenderJob> 接口。
 * 本适配器提供相同的 .get() 接口，但落库读取。
 * 
 * 这允许我们在不改变 handler 签名的情况下，将数据真相源切换到 DB。
 * Phase 4+ 重构时可以直接替换掉此 adapter。
 */

import { workbenchJobRepo } from '../repositories/workbench-job-repository'
import type { RenderJob, JobState } from '../production-loop/job-types'

export class LegacyJobStore {
  /**
   * Map.get(id) 的 DB 实现。
   * 先按 id 查，未命中则按 traceId 查。
   */
  async get(id: string): Promise<RenderJob | undefined> {
    let job = await workbenchJobRepo.findById(id)
    if (!job) {
      job = await workbenchJobRepo.findByTraceId(id)
    }
    if (!job) return undefined

    return this.toRenderJob(job)
  }

  /**
   * Map.set(key, value) 的 DB 实现。
   * 用于 Phase 4 handler 的兼容。
   */
  async set(key: string, value: any): Promise<void> {
    const job = await workbenchJobRepo.findByTraceId(key)
    if (job && value && value.blueprint) {
      await workbenchJobRepo.update(job.id, {
        state: value.state,
        result: value.result,
        error: value.error,
      })
    }
  }

  /**
   * 兼容同步 Map.get — 返回 undefined（async 版本请用 get()）
   * 仅作为同步 fallback，不推荐。
   */
  getSync(_id: string): RenderJob | undefined {
    return undefined
  }

  private toRenderJob(job: any): RenderJob {
    const payload = job.payload || {}
    return {
      id: job.id,
      traceId: job.traceId || job.id,
      state: (job.status as JobState) || 'PENDING',
      blueprint: payload.blueprint,
      result: job.result,
      error: job.error,
      updatedAt: job.updatedAt?.getTime?.() || Date.now(),
    }
  }
}

export const legacyJobStore = new LegacyJobStore()
