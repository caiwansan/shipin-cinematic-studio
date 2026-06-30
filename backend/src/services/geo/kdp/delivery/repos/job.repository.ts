// ════════════════════════════════════════════════════════════
// KDP K3 — Repository: DeliveryJobRepository
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { DeliveryJob, DeliveryJobStatus, DeliveryJobPriority } from '../../../types'

export class DeliveryJobRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    projectId: string
    packageIds: string[]
    targetId: string
    priority?: DeliveryJobPriority
    maxRetries?: number
  }): Promise<DeliveryJob> {
    const job = await this.prisma.deliveryJob.create({
      data: {
        projectId: data.projectId,
        packageIds: JSON.stringify(data.packageIds),
        targetId: data.targetId,
        status: DeliveryJobStatus.Queued,
        priority: data.priority ?? DeliveryJobPriority.Normal,
        retryCount: 0,
        maxRetries: data.maxRetries ?? 3,
      },
    })
    return this.toDTO(job)
  }

  async findById(id: string): Promise<DeliveryJob | null> {
    const job = await this.prisma.deliveryJob.findUnique({ where: { id } })
    return job ? this.toDTO(job) : null
  }

  async findQueued(limit = 10): Promise<DeliveryJob[]> {
    const jobs = await this.prisma.deliveryJob.findMany({
      where: { status: DeliveryJobStatus.Queued },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    })
    return jobs.map(j => this.toDTO(j))
  }

  async updateStatus(id: string, status: DeliveryJobStatus, errorLog?: string): Promise<DeliveryJob> {
    const data: any = { status }
    if (errorLog) data.errorLog = errorLog
    if (status === DeliveryJobStatus.Dispatching) data.startedAt = new Date()
    if (status === DeliveryJobStatus.Completed || status === DeliveryJobStatus.Failed || status === DeliveryJobStatus.RolledBack) {
      data.completedAt = new Date()
    }
    const job = await this.prisma.deliveryJob.update({ where: { id }, data })
    return this.toDTO(job)
  }

  async incrementRetry(id: string): Promise<DeliveryJob> {
    const job = await this.prisma.deliveryJob.findUnique({ where: { id } })
    if (!job) throw new Error(`DeliveryJob not found: ${id}`)
    const newCount = job.retryCount + 1
    if (newCount >= job.maxRetries) {
      return this.updateStatus(id, DeliveryJobStatus.Failed, `Max retries (${job.maxRetries}) exceeded`)
    }
    const updated = await this.prisma.deliveryJob.update({
      where: { id },
      data: { retryCount: newCount, status: DeliveryJobStatus.Queued },
    })
    return this.toDTO(updated)
  }

  private toDTO(j: any): DeliveryJob {
    return {
      id: j.id,
      projectId: j.projectId,
      packageIds: typeof j.packageIds === 'string' ? JSON.parse(j.packageIds) : j.packageIds,
      targetId: j.targetId,
      status: j.status as DeliveryJobStatus,
      priority: j.priority as DeliveryJobPriority,
      retryCount: j.retryCount,
      maxRetries: j.maxRetries,
      createdAt: j.createdAt.toISOString(),
      startedAt: j.startedAt?.toISOString(),
      completedAt: j.completedAt?.toISOString(),
      errorLog: j.errorLog ?? undefined,
    }
  }
}
