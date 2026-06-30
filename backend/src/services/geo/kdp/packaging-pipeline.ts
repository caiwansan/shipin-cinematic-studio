// ════════════════════════════════════════════════════════════
// KDP K2 — PackagingPipeline
// ════════════════════════════════════════════════════════════
// The workhorse. Runs: Build → Validate → Manifest → Artifact → Preview
// Plugin-ready for future: Quality Check → Signature → Compression
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import {
  KnowledgeAsset, KnowledgePackage, PackageManifest, PackageArtifact,
  PackageType, PackageStatus, DistributionTarget,
} from '../types'
import { KnowledgePackageRepository } from './repos/package.repository'
import { ManifestRepository } from './repos/manifest.repository'
import { ArtifactRepository } from './repos/artifact.repository'

export interface PipelineInput {
  asset: KnowledgeAsset
  packageType: PackageType
  projectId: string
  adapters: PackagerAdapter[]
}

export interface PipelineOutput {
  pkg: KnowledgePackage
  manifest: PackageManifest
  artifacts: PackageArtifact[]
  preview: string
}

export interface PackagerAdapter {
  packageType: PackageType
  /** Generate artifacts for this package type */
  build(input: AssetBuildContext): Promise<PipelineArtifact[]>
  /** Generate a human-readable preview of the package */
  preview(input: AssetBuildContext): string
}

export interface AssetBuildContext {
  asset: KnowledgeAsset
  projectId: string
  /** Human variant content */
  humanContent: string
  /** Search variant content */
  searchContent: string
  /** AI variant content */
  aiContent: string
}

export interface PipelineArtifact {
  fileName: string
  filePath: string
  mimeType: string
  content: string
  sortOrder: number
}

export class PackagingPipeline {
  constructor(
    private prisma: PrismaClient,
    private pkgRepo: KnowledgePackageRepository,
    private manifestRepo: ManifestRepository,
    private artifactRepo: ArtifactRepository,
  ) {}

  /**
   * Run the full pipeline for one asset → one package type.
   * Steps:
   *   1. Build → 2. Validate → 3. Manifest → 4. Persist Artifacts → 5. Preview
   */
  async run(input: PipelineInput): Promise<PipelineOutput> {
    const { asset, packageType, projectId, adapters } = input

    // Resolve variant content
    const humanContent = asset.humanContent || ''
    const searchContent = asset.searchContent || ''
    const aiContent = asset.aiContent || ''

    // Find the right packager adapter
    const adapter = adapters.find(a => a.packageType === packageType)
    if (!adapter) {
      throw new Error(`No adapter registered for package type: ${packageType}`)
    }

    const ctx: AssetBuildContext = { asset, projectId, humanContent, searchContent, aiContent }

    // ═══ Step 1: Build ═══
    const artifacts = await adapter.build(ctx)
    if (artifacts.length === 0) {
      throw new Error(`Adapter ${packageType} produced zero artifacts`)
    }

    // ═══ Step 2: Validate (basic structural) ═══
    for (const art of artifacts) {
      if (!art.fileName || !art.content) {
        throw new Error(`Artifact ${art.fileName || 'unnamed'} missing content`)
      }
    }

    // ═══ Step 3: Create KnowledgePackage ═══
    const pkg = await this.pkgRepo.create({
      assetId: asset.id,
      projectId,
      packageType,
      status: PackageStatus.Packaged,
    })

    // ═══ Step 4: Persist Artifacts ═══
    const persistedArtifacts = await this.artifactRepo.createBatch(
      artifacts.map(a => ({
        packageId: pkg.id,
        fileName: a.fileName,
        filePath: a.filePath,
        mimeType: a.mimeType,
        content: a.content,
        sortOrder: a.sortOrder,
      }))
    )
    this.artifactRepo.findByPackage(pkg.id)

    // Calculate package-wide hash
    const totalHash = await this.artifactRepo.totalArtifactHash(pkg.id)
    await this.pkgRepo.updateArtifactHash(pkg.id, totalHash)

    // ═══ Step 5: Create Manifest ═══
    const totalSize = persistedArtifacts.reduce((s, a) => s + a.size, 0)
    const manifest = await this.manifestRepo.create({
      sourceAssetId: asset.id,
      sourceClaimId: asset.claimId,
      sourceRecordId: asset.recordId,
      sourceProjectId: projectId,
      title: asset.title,
      summary: `Knowledge Package: ${packageType} for ${asset.title}`,
      estimatedSize: totalSize,
      mimeType: this.getMimeType(packageType),
      contentHash: totalHash,
    })
    await this.pkgRepo.linkManifest(pkg.id, manifest.id)

    // ═══ Step 6: Preview ═══
    const preview = adapter.preview(ctx)

    // Update status to validated
    const finalizedPkg = await this.pkgRepo.updateStatus(pkg.id, PackageStatus.Validated)

    return { pkg: finalizedPkg, manifest, artifacts: persistedArtifacts, preview }
  }

  private getMimeType(packageType: PackageType): string {
    switch (packageType) {
      case PackageType.Website: return 'text/html'
      case PackageType.Sitemap: return 'application/xml'
      case PackageType.RSS: return 'application/rss+xml'
      case PackageType.AIFeed: return 'application/json'
      case PackageType.KnowledgeBundle: return 'application/json'
      default: return 'application/octet-stream'
    }
  }
}
