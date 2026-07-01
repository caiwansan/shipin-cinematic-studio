// ════════════════════════════════════════════════════════════
// KDP K3/K4 — Local Delivery Adapter (Adapter SDK compliant)
// ════════════════════════════════════════════════════════════
// Delivers KnowledgePackage artifacts to local file system.
// Full lifecycle: prepare → deliver → verify → rollback
// Implements the K4 RC2 DeliveryAdapter interface.
// ════════════════════════════════════════════════════════════

import * as fs from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'
import { PrismaClient } from '@prisma/client'
import {
  DeliveryAdapter, AdapterMeta, AdapterCapability, AdapterHealthStatus,
  PrepareContext, PrepareResult,
  DeliveryResult, DeliveryJobStatus,
  VerifyResult, RollbackResult, HealthCheckResult,
  DeliveryTargetType, KnowledgePackage, PackageArtifact,
} from '../../types'

export class LocalDeliveryAdapter implements DeliveryAdapter {
  readonly meta: AdapterMeta = {
    id: 'local',
    name: 'Local Sandbox',
    version: '1.0.0',
    targetType: 'local',
    capabilities: [
      AdapterCapability.Prepare,
      AdapterCapability.Deliver,
      AdapterCapability.Verify,
      AdapterCapability.Rollback,
      AdapterCapability.HealthCheck,
      AdapterCapability.DryRun,
    ],
    description: 'Delivers KnowledgePackages to the local filesystem for testing and validation.',
    provider: 'local',
    providerType: 'local',
    configSchema: {
      type: 'object',
      properties: {
        outputPath: { type: 'string', default: './sandbox/output' },
      },
    },
  }

  constructor(private prisma: PrismaClient) {}

  async prepare(ctx: PrepareContext): Promise<PrepareResult> {
    const outputPath = ctx.config.outputPath || './sandbox/output'
    const dirs = ['website', 'sitemap', 'rss', 'ai-feed', 'bundles', 'manifests']

    for (const dir of dirs) {
      const fullPath = path.join(outputPath, dir)
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
      }
    }

    return { success: true, message: `Prepared at ${outputPath}` }
  }

  async deliver(
    jobId: string,
    pkg: KnowledgePackage,
    target: DeliveryTargetType,
    artifacts: PackageArtifact[],
  ): Promise<DeliveryResult> {
    const outputPath = target.config.outputPath || './sandbox/output'
    const pkgDir = path.join(outputPath, this.mapTypeToDir(pkg.packageType), pkg.id)

    // Track previous state for rollback
    let previousState: string | undefined
    if (fs.existsSync(pkgDir)) {
      previousState = pkgDir + '.prev'
      if (fs.existsSync(previousState)) {
        fs.rmSync(previousState, { recursive: true, force: true })
      }
      fs.renameSync(pkgDir, previousState)
    }

    // Create package directory
    fs.mkdirSync(pkgDir, { recursive: true })

    // Write all artifacts
    for (const artifact of artifacts) {
      const filePath = path.join(pkgDir, artifact.fileName)
      const fileDir = path.dirname(filePath)
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true })
      }
      fs.writeFileSync(filePath, artifact.content, 'utf8')
    }

    const totalBytes = artifacts.reduce((s, a) => s + Buffer.byteLength(a.content, 'utf8'), 0)
    const allHashes = artifacts.map(a => a.contentHash || createHash('sha256').update(a.content).digest('hex')).sort().join('')
    const checksum = createHash('sha256').update(allHashes).digest('hex')

    console.log(`[LocalDelivery] Delivered ${pkg.packageType} (${totalBytes}B, ${artifacts.length} artifacts) → ${pkgDir}`)

    return {
      success: true,
      status: DeliveryJobStatus.Completed,
      outputPath: pkgDir,
      bytes: totalBytes,
      artifactCount: artifacts.length,
      checksum,
      previousState,
    }
  }

  async verify(record: DeliveryResult): Promise<VerifyResult> {
    const errors: string[] = []

    if (!fs.existsSync(record.outputPath)) {
      errors.push(`Output path does not exist: ${record.outputPath}`)
      return { success: false, verified: false, errors }
    }

    const files = fs.readdirSync(record.outputPath)
    if (files.length === 0) {
      errors.push('Output directory is empty')
      return { success: true, verified: false, errors }
    }

    return { success: true, verified: true, errors, details: { files } }
  }

  async rollback(record: DeliveryResult): Promise<RollbackResult> {
    if (!record.previousState || !fs.existsSync(record.previousState)) {
      // No previous state — delete the delivered directory
      if (fs.existsSync(record.outputPath)) {
        fs.rmSync(record.outputPath, { recursive: true, force: true })
        return { success: true, message: `Deleted ${record.outputPath} (no previous state)` }
      }
      return { success: true, message: 'Nothing to roll back' }
    }

    // Remove current delivery
    if (fs.existsSync(record.outputPath)) {
      fs.rmSync(record.outputPath, { recursive: true, force: true })
    }

    // Restore previous state
    fs.renameSync(record.previousState, record.outputPath)
    return { success: true, message: `Restored ${record.previousState} → ${record.outputPath}` }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      const testDir = '/tmp/local-adapter-health'
      fs.mkdirSync(testDir, { recursive: true })
      fs.writeFileSync(path.join(testDir, 'health.txt'), 'ok', 'utf8')
      fs.rmSync(testDir, { recursive: true, force: true })
      return {
        status: AdapterHealthStatus.Ok,
        latencyMs: Date.now() - start,
        message: 'Filesystem is writable',
      }
    } catch (err: any) {
      return {
        status: AdapterHealthStatus.Down,
        message: err.message,
      }
    }
  }

  async dryRun(pkg: KnowledgePackage, target: DeliveryTargetType): Promise<DeliveryResult> {
    return {
      success: true,
      status: DeliveryJobStatus.Completed,
      outputPath: '(dry run)',
      bytes: 0,
      artifactCount: 0,
      checksum: '',
    }
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
}
