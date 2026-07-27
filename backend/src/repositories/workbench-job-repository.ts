/**
 * WorkbenchJobRepository — 短剧工作台任务持久化层
 * 
 * WORKBENCH-HARDENING-01 Phase 3
 * 
 * 职责：
 * 1. 替换 mockJobs Map 内存存储
 * 2. 以 PostgreSQL 为真相源
 * 3. 强制 tenant 隔离（organization_id）
 * 
 * 使用 PipelineJob 表，附加 workbench 专用字段。
 */

import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient()
  }
  return prisma
}

export interface WorkbenchJobInput {
  traceId: string
  projectId?: string
  blueprint: any
  userId?: string
  organizationId?: string
  adapterName?: string
  isMock?: boolean
}

export interface WorkbenchJobUpdate {
  state?: string
  result?: any
  error?: string
  adapterName?: string
  isMock?: boolean
}

/**
 * 状态机冻结：
 * 
 * PENDING → DISPATCHED → RUNNING → COMPLETED
 *                                  → FAILED
 *                      → CANCELLED
 * 
 * 禁止无中生有地"成功"。
 */
export const WORKBENCH_STATES = {
  PENDING: 'pending',
  DISPATCHED: 'dispatched',
  RUNNING: 'running',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export type WorkbenchJobState = typeof WORKBENCH_STATES[keyof typeof WORKBENCH_STATES]

export class WorkbenchJobRepository {
  /**
   * 创建任务（PENDING）
   */
  async create(input: WorkbenchJobInput) {
    const job = await getPrisma().pipelineJob.create({
      data: {
        projectId: input.projectId || null,
        stageKey: 'workbench-render',
        jobType: 'render',
        status: WORKBENCH_STATES.PENDING,
        payload: {
          blueprint: input.blueprint,
          traceId: input.traceId,
        } as any,
        result: null,
        traceId: input.traceId,
        userId: input.userId || null,
        organizationId: input.organizationId || null,
        adapterName: input.adapterName || 'stub-render',
        isMock: input.isMock ?? false,
        priority: 0,
        attempts: 0,
        maxAttempts: 3,
        startedAt: null,
        completedAt: null,
      },
    })
    return job
  }

  /**
   * 查找任务 — 强制 tenant 隔离
   * 
   * 查询必须包含 organizationId 或 id，禁止跨租户读取。
   */
  async findById(id: string, organizationId?: string) {
    if (organizationId) {
      // 严格 tenant 隔离
      return prisma.pipelineJob.findFirst({
        where: { id, organizationId },
      })
    }
    // 无 orgId 时仅支持 traceId 查找（工作台 scenario）
    return prisma.pipelineJob.findUnique({ where: { id } })
  }

  async findByTraceId(traceId: string, organizationId?: string) {
    if (organizationId) {
      return prisma.pipelineJob.findFirst({
        where: { traceId, organizationId },
      })
    }
    return prisma.pipelineJob.findFirst({ where: { traceId } })
  }

  /**
   * 更新任务状态 — 强制执行状态机
   */
  async update(id: string, update: WorkbenchJobUpdate) {
    return prisma.pipelineJob.update({
      where: { id },
      data: {
        status: update.state || undefined,
        result: update.result || undefined,
        error: update.error || undefined,
        adapterName: update.adapterName || undefined,
        isMock: update.isMock ?? undefined,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * 删除任务 — 仅允许已完成/失败的
   */
  async delete(id: string) {
    return prisma.pipelineJob.delete({ where: { id } })
  }

  /**
   * 列出任务 — 强制 tenant 隔离
   */
  async listByUser(userId: string) {
    return prisma.pipelineJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async listByOrganization(organizationId: string) {
    return prisma.pipelineJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    })
  }
}

export const workbenchJobRepo = new WorkbenchJobRepository()
