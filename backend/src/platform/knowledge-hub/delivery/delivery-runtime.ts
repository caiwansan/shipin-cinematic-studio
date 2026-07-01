// ════════════════════════════════════════════════════════════
// KDP K3 — DeliveryRuntime
// ════════════════════════════════════════════════════════════
// The delivery workhorse. Handles:
//   Queue → Dispatch → Retry → Rollback → Verify
//
// Does NOT know about target platform types.
// Only knows about DeliveryTarget. Adapters handle the rest.
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import {
  DeliveryJob, DeliveryJobStatus, DeliveryJobPriority,
  DeliveryTargetType, DeliveryRecord, DeliveryAdapter,
  KnowledgePackage, PackageArtifact,
} from '../../types'
import { DeliveryJobRepository } from './repos/job.repository'
import { DeliveryTargetRepository } from './repos/target.repository'
import { DeliveryRecordRepository } from './repos/record.repository'
import { KnowledgePackageRepository } from '../repos/package.repository'
import { ArtifactRepository } from '../repos/artifact.repository'

export interface RuntimeStats {
  totalJobs: number
  pendingJobs: number
  completedDeliveries: number
  failedDeliveries: number
  totalBytes: number
}

export class DeliveryRuntime {
  private jobRepo: DeliveryJobRepository
  private targetRepo: DeliveryTargetRepository
  private recordRepo: DeliveryRecordRepository
  private pkgRepo: KnowledgePackageRepository
  private artifactRepo: ArtifactRepository

  constructor(
    private prisma: PrismaClient,
    private adapters: Map<string, DeliveryAdapter>,
  ) {
    this.jobRepo = new DeliveryJobRepository(prisma)
    this.targetRepo = new DeliveryTargetRepository(prisma)
    this.recordRepo = new DeliveryRecordRepository(prisma)
    this.pkgRepo = new KnowledgePackageRepository(prisma)
    this.artifactRepo = new ArtifactRepository(prisma)
  }

  // ═══ Job Lifecycle ═══

  /**
   * Create a delivery job for one or more packages.
   */
  async createJob(data: {
    packageIds: string[]
    targetId?: string
    projectId?: string
    priority?: DeliveryJobPriority
  }): Promise<DeliveryJob> {
    // Resolve target
    let targetId = data.targetId
    if (!targetId) {
      const local = await this.targetRepo.getDefaultLocalTarget()
      if (!local) throw new Error('No delivery target configured')
      targetId = local.id
    }

    // Get project ID from first package
    let projectId = data.projectId
    if (!projectId && data.packageIds.length > 0) {
      const pkg = await this.pkgRepo.findById(data.packageIds[0])
      if (pkg) projectId = pkg.projectId
    }

    const job = await this.jobRepo.create({
      projectId: projectId || 'unknown',
      packageIds: data.packageIds,
      targetId,
      priority: data.priority,
    })

    console.log(`[Runtime] Created job ${job.id} (${data.packageIds.length} packages → ${targetId})`)
    return job
  }

  /**
   * Process all queued jobs.
   */
  async processQueue(limit = 5): Promise<{
    processed: number
    succeeded: number
    failed: number
  }> {
    const queued = await this.jobRepo.findQueued(limit)
    let processed = 0
    let succeeded = 0
    let failed = 0

    for (const job of queued) {
      processed++
      try {
        await this.dispatch(job)
        succeeded++
      } catch (err) {
        const attempt = await this.jobRepo.incrementRetry(job.id)
        if (attempt.status === DeliveryJobStatus.Failed) {
          failed++
        }
      }
    }

    return { processed, succeeded, failed }
  }

  /**
   * Dispatch a single job: deliver each package → verify.
   */
  async dispatch(job: DeliveryJob): Promise<DeliveryRecord[]> {
    const records: DeliveryRecord[] = []

    // Mark as dispatching
    await this.jobRepo.updateStatus(job.id, DeliveryJobStatus.Dispatching)

    // Resolve target and adapter
    const target = await this.targetRepo.findById(job.targetId)
    if (!target) throw new Error(`DeliveryTarget not found: ${job.targetId}`)

    const adapter = this.adapters.get(target.type)
    if (!adapter) throw new Error(`No adapter for target type: ${target.type}`)

    // Prepare
    await adapter.prepare(target.config)

    // Deliver each package
    for (const packageId of job.packageIds) {
      const pkg = await this.pkgRepo.findById(packageId)
      if (!pkg) {
        records.push(await this.recordRepo.create({
          jobId: job.id,
          packageId,
          targetId: target.id,
          status: DeliveryJobStatus.Failed,
          outputPath: '',
          bytes: 0,
          artifactCount: 0,
          checksum: '',
          errorLog: `Package not found: ${packageId}`,
        }))
        continue
      }

      const artifacts = await this.artifactRepo.findByPackage(packageId)
      if (artifacts.length === 0) {
        records.push(await this.recordRepo.create({
          jobId: job.id,
          packageId,
          targetId: target.id,
          status: DeliveryJobStatus.Failed,
          outputPath: '',
          bytes: 0,
          artifactCount: 0,
          checksum: '',
          errorLog: `No artifacts for package: ${packageId}`,
        }))
        continue
      }

      // Deliver
      await this.jobRepo.updateStatus(job.id, DeliveryJobStatus.Delivering)
      const record = await adapter.deliver(job.id, pkg, target, artifacts)
      records.push(record)

      // Verify
      await this.jobRepo.updateStatus(job.id, DeliveryJobStatus.Verifying)
      const verification = await adapter.verify(record)
      if (!verification.valid) {
        // Rollback
        console.log(`[Runtime] Delivery failed verification for ${packageId}, rolling back`)
        await adapter.rollback(record)
        records.push(await this.recordRepo.create({
          jobId: job.id,
          packageId,
          targetId: target.id,
          status: DeliveryJobStatus.RolledBack,
          outputPath: record.outputPath,
          bytes: 0,
          artifactCount: 0,
          checksum: '',
          errorLog: `Verification failed: ${verification.errors.join('; ')}`,
        }))
      }
    }

    // Mark job as completed
    const allSucceeded = records.every(r => r.status === DeliveryJobStatus.Completed)
    await this.jobRepo.updateStatus(
      job.id,
      allSucceeded ? DeliveryJobStatus.Completed : DeliveryJobStatus.Failed,
    )

    console.log(`[Runtime] Job ${job.id}: ${records.filter(r => r.status === 'completed').length}/${records.length} delivered`)
    return records
  }

  /**
   * Rollback a completed delivery.
   */
  async rollback(jobId: string): Promise<void> {
    const job = await this.jobRepo.findById(jobId)
    if (!job) throw new Error(`DeliveryJob not found: ${jobId}`)

    const records = await this.recordRepo.findByJob(jobId)
    for (const record of records) {
      const target = await this.targetRepo.findById(record.targetId)
      if (!target) continue
      const adapter = this.adapters.get(target.type)
      if (!adapter) continue

      try {
        await adapter.rollback(record)
      } catch (err: any) {
        console.error(`[Runtime] Rollback failed for record ${record.id}: ${err.message}`)
      }
    }

    await this.jobRepo.updateStatus(jobId, DeliveryJobStatus.RolledBack)
  }

  /**
   * Get runtime stats.
   */
  async getStats(): Promise<RuntimeStats> {
    const allJobs = await this.prisma.deliveryJob.findMany({
      select: { status: true },
    })

    const completed = await this.recordRepo.countByStatus(DeliveryJobStatus.Completed)
    const failed = await this.recordRepo.countByStatus(DeliveryJobStatus.Failed)

    return {
      totalJobs: allJobs.length,
      pendingJobs: allJobs.filter(j => j.status === 'queued').length,
      completedDeliveries: completed,
      failedDeliveries: failed,
      totalBytes: 0, // Could add aggregation
    }
  }
}
