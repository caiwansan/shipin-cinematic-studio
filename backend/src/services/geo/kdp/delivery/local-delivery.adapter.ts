// ════════════════════════════════════════════════════════════
// KDP K3 — Local Delivery Adapter
// ════════════════════════════════════════════════════════════
// Delivers KnowledgePackage artifacts to local file system.
// Full lifecycle: prepare → deliver → verify → rollback
// Writes to sandbox/output/ organized by project and target.
// ════════════════════════════════════════════════════════════

import * as fs from 'fs'
import * as path from 'path'
import { DeliveryAdapter, DeliveryTargetType, DeliveryJobStatus } from '../../types'
import { PackageArtifact, KnowledgePackage } from '../../types'
import { DeliveryRecordRepository } from './repos/record.repository'
import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

export class LocalDeliveryAdapter implements DeliveryAdapter {
  readonly id = 'local'
  readonly targetType = 'local'
  readonly name = 'Local Sandbox'

  private recordRepo: DeliveryRecordRepository

  constructor(private prisma: PrismaClient) {
    this.recordRepo = new DeliveryRecordRepository(prisma)
  }

  async prepare(config: Record<string, any>): Promise<void> {
    const outputPath = config.outputPath || './sandbox/output'
    const dirs = ['website', 'sitemap', 'rss', 'ai-feed', 'bundles', 'manifests']

    for (const dir of dirs) {
      const fullPath = path.join(outputPath, dir)
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
      }
    }

    console.log(`[LocalDelivery] Prepared at ${outputPath}`)
  }

  async deliver(
    jobId: string,
    pkg: KnowledgePackage,
    target: DeliveryTargetType,
    artifacts: PackageArtifact[]
  ): Promise<DeliveryRecord> {
    const outputPath = target.config.outputPath || './sandbox/output'
    const pkgDir = path.join(outputPath, this.mapTypeToDir(pkg.packageType), pkg.id)

    // Get previous state for rollback
    const prevDelivery = await this.recordRepo.getLastDelivery(pkg.id)
    let previousState: string | undefined

    if (prevDelivery && fs.existsSync(prevDelivery.outputPath)) {
      previousState = prevDelivery.outputPath
    }

    // Create package directory
    if (!fs.existsSync(pkgDir)) {
      fs.mkdirSync(pkgDir, { recursive: true })
    }

    const startedAt = new Date()

    // Write all artifacts
    for (const artifact of artifacts) {
      const filePath = path.join(pkgDir, artifact.fileName)
      const fileDir = path.dirname(filePath)
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true })
      }
      fs.writeFileSync(filePath, artifact.content, 'utf8')
    }

    // Also write manifest at package level
    if (pkg.manifestId) {
      const manifestDir = path.join(outputPath, 'manifests')
      if (!fs.existsSync(manifestDir)) fs.mkdirSync(manifestDir, { recursive: true })
    }

    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()
    const totalBytes = artifacts.reduce((s, a) => s + Buffer.byteLength(a.content, 'utf8'), 0)

    // Calculate checksum of all artifacts
    const checksum = artifacts
      .map(a => a.contentHash)
      .sort()
      .join('')

    // Create record
    const record = await this.recordRepo.create({
      jobId,
      packageId: pkg.id,
      packageId: pkg.id,
      targetId: target.id,
      status: DeliveryJobStatus.Completed,
      outputPath: pkgDir,
      bytes: totalBytes,
      artifactCount: artifacts.length,
      checksum: createHash('sha256').update(checksum).digest('hex'),
      previousState,
      durationMs,
    })

    console.log(`[LocalDelivery] Delivered ${pkg.packageType} (${totalBytes} bytes, ${artifacts.length} artifacts) → ${pkgDir}`)

    return record
  }

  async verify(record: DeliveryRecord): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    // Check output directory exists
    if (!fs.existsSync(record.outputPath)) {
      errors.push(`Output path does not exist: ${record.outputPath}`)
      return { valid: false, errors }
    }

    // Check at least some files exist
    const dirContents = fs.readdirSync(record.outputPath)
    if (dirContents.length === 0) {
      errors.push('Output directory is empty')
      return { valid: false, errors }
    }

    console.log(`[LocalDelivery] Verified ${record.outputPath} (${dirContents.length} files)`)
    return { valid: errors.length === 0, errors }
  }

  async rollback(record: DeliveryRecord): Promise<void> {
    if (!record.previousState) {
      // No previous state — delete the delivered directory
      if (fs.existsSync(record.outputPath)) {
        fs.rmSync(record.outputPath, { recursive: true, force: true })
        console.log(`[LocalDelivery] Rolled back: deleted ${record.outputPath}`)
      }
      return
    }

    // If previous state exists, restore it
    if (!fs.existsSync(record.previousState)) {
      console.log(`[LocalDelivery] Previous state no longer exists at ${record.previousState}, deleting delivery`)
      if (fs.existsSync(record.outputPath)) {
        fs.rmSync(record.outputPath, { recursive: true, force: true })
      }
      return
    }

    // Remove current delivery and link back to previous
    if (fs.existsSync(record.outputPath)) {
      fs.rmSync(record.outputPath, { recursive: true, force: true })
    }

    // Copy previous state back
    this.copyRecursive(record.previousState, record.outputPath)
    console.log(`[LocalDelivery] Rolled back: restored ${record.previousState} → ${record.outputPath}`)
  }

  private mapTypeToDir(packageType: string): string {
    const map: Record<string, string> = {
      website: 'website',
      sitemap: 'sitemap',
      rss: 'rss',
      ai_feed: 'ai-feed',
      knowledge_bundle: 'bundles',
    }
    return map[packageType] || 'other'
  }

  private copyRecursive(src: string, dest: string): void {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
    const entries = fs.readdirSync(src, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        this.copyRecursive(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}
