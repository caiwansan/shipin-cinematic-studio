// ════════════════════════════════════════════════════════════
// KDP K3 — Repository: DeliveryRecordRepository
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { DeliveryRecord, DeliveryJobStatus } from '../../../types'

export class DeliveryRecordRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    jobId: string
    packageId: string
    targetId: string
    status: DeliveryJobStatus
    outputPath: string
    bytes: number
    artifactCount: number
    checksum: string
    previousState?: string
    durationMs?: number
    errorLog?: string
  }): Promise<DeliveryRecord> {
    const record = await this.prisma.deliveryRecord.create({
      data: {
        jobId: data.jobId,
        packageId: data.packageId,
        targetId: data.targetId,
        status: data.status,
        outputPath: data.outputPath,
        bytes: data.bytes,
        artifactCount: data.artifactCount,
        checksum: data.checksum,
        previousState: data.previousState ?? null,
        durationMs: data.durationMs ?? null,
        errorLog: data.errorLog ?? null,
      },
    })
    return this.toDTO(record)
  }

  async findByJob(jobId: string): Promise<DeliveryRecord[]> {
    const records = await this.prisma.deliveryRecord.findMany({
      where: { jobId },
      orderBy: { startedAt: 'asc' },
    })
    return records.map(r => this.toDTO(r))
  }

  async findByPackage(packageId: string): Promise<DeliveryRecord[]> {
    const records = await this.prisma.deliveryRecord.findMany({
      where: { packageId },
      orderBy: { startedAt: 'desc' },
    })
    return records.map(r => this.toDTO(r))
  }

  async getLastDelivery(packageId: string): Promise<DeliveryRecord | null> {
    const record = await this.prisma.deliveryRecord.findFirst({
      where: { packageId, status: DeliveryJobStatus.Completed },
      orderBy: { startedAt: 'desc' },
    })
    return record ? this.toDTO(record) : null
  }

  async countByStatus(status: DeliveryJobStatus): Promise<number> {
    return this.prisma.deliveryRecord.count({ where: { status } })
  }

  private toDTO(r: any): DeliveryRecord {
    return {
      id: r.id,
      jobId: r.jobId,
      packageId: r.packageId,
      targetId: r.targetId,
      status: r.status as DeliveryJobStatus,
      outputPath: r.outputPath,
      bytes: r.bytes,
      artifactCount: r.artifactCount,
      checksum: r.checksum,
      previousState: r.previousState ?? undefined,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString(),
      durationMs: r.durationMs ?? undefined,
      errorLog: r.errorLog ?? undefined,
    }
  }
}
