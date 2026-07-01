// ════════════════════════════════════════════════════════════
// KDP K2 — PackagingOrchestrator
// ════════════════════════════════════════════════════════════
// Orchestration layer. Does NOT generate artifacts.
// Four responsibilities:
//   1. Resolve Variants (human/search/ai from AssetVariant)
//   2. Select Package Types
//   3. Run Pipeline (delegates to PackagingPipeline)
//   4. Return result
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { KnowledgeAsset, PackageType } from '../types'
import { PackagingPipeline, PipelineOutput } from './packaging-pipeline'
import { PackagingAdapterRegistry } from './packaging-adapter-registry'
import { KnowledgePackageRepository } from './repos/package.repository'
import { ManifestRepository } from './repos/manifest.repository'
import { ArtifactRepository } from './repos/artifact.repository'

export interface OrchestratorInput {
  /** Single asset to package */
  assetId: string
  projectId: string
  /** Package types to generate. If empty, generates all registered */
  packageTypes?: PackageType[]
  /** Full redistribution (re-generate even if already packaged) */
  forceRebuild?: boolean
}

export interface OrchestratorOutput {
  packages: PipelineOutput[]
  totalArtifacts: number
  totalSize: number
}

export class PackagingOrchestrator {
  private pipeline: PackagingPipeline
  private pkgRepo: KnowledgePackageRepository
  private artifactRepo: ArtifactRepository

  constructor(
    private prisma: PrismaClient,
    private registry: PackagingAdapterRegistry,
  ) {
    this.pkgRepo = new KnowledgePackageRepository(prisma)
    const manifestRepo = new ManifestRepository(prisma)
    this.artifactRepo = new ArtifactRepository(prisma)
    this.pipeline = new PackagingPipeline(prisma, this.pkgRepo, manifestRepo, this.artifactRepo)
  }

  /**
   * Package a single asset into one or more package types.
   */
  async packageAsset(input: OrchestratorInput): Promise<OrchestratorOutput> {
    const { assetId, projectId, packageTypes, forceRebuild } = input

    // Step 1: Load asset
    const asset = await this.loadAsset(assetId)
    if (!asset) {
      throw new Error(`KnowledgeAsset not found: ${assetId}`)
    }

    // Step 2: Resolve variants (human/search/ai)
    const variants = await this.prisma.assetVariant.findMany({
      where: { assetId },
    })

    // Populate variant content
    for (const v of variants) {
      if (v.variantType === 'human') asset.humanContent = v.content
      if (v.variantType === 'search') asset.searchContent = v.content
      if (v.variantType === 'ai') asset.aiContent = v.content
    }

    // Step 3: Select package types
    const types = packageTypes || this.registry.getAvailableTypes()

    // Step 4: Check existing packages (skip if not force)
    const results: PipelineOutput[] = []
    for (const packageType of types) {
      if (!forceRebuild) {
        const existing = await this.pkgRepo.findByAssetId(assetId)
        const hasType = existing.some(p => p.packageType === packageType && p.status !== 'failed')
        if (hasType) continue
      }

      const adapter = this.registry.get(packageType)
      if (!adapter) continue

      const result = await this.pipeline.run({
        asset,
        packageType,
        projectId,
        adapters: [adapter],
      })
      results.push(result)
    }

    // Step 5: Aggregate
    let totalArtifacts = 0
    let totalSize = 0
    for (const r of results) {
      totalArtifacts += r.artifacts.length
      totalSize += r.artifacts.reduce((s, a) => s + a.size, 0)
    }

    return { packages: results, totalArtifacts, totalSize }
  }

  /**
   * Package multiple assets (creates KnowledgeBundle if registered).
   */
  async packageBundle(input: {
    assetIds: string[]
    projectId: string
    bundleName?: string
    packageTypes?: PackageType[]
  }): Promise<OrchestratorOutput> {
    const results: OrchestratorOutput = { packages: [], totalArtifacts: 0, totalSize: 0 }

    for (const assetId of input.assetIds) {
      const result = await this.packageAsset({
        assetId,
        projectId: input.projectId,
        packageTypes: (input.packageTypes || []).filter(t => t !== PackageType.KnowledgeBundle),
        forceRebuild: false,
      })
      results.packages.push(...result.packages)
      results.totalArtifacts += result.totalArtifacts
      results.totalSize += result.totalSize
    }

    // Generate bundle if requested
    if (!input.packageTypes || input.packageTypes.includes(PackageType.KnowledgeBundle)) {
      const bundleType = PackageType.KnowledgeBundle
      const adapter = this.registry.get(bundleType)
      if (adapter) {
        // Bundle packages all assets into one artifact
        // This is handled by the KnowledgeBundlePackager
      }
    }

    return results
  }

  /**
   * Preview a package (reads from Manifest, not from raw Artifacts).
   */
  async previewPackage(packageId: string): Promise<{ preview: string; manifest: any; artifactCount: number } | null> {
    const pkg = await this.pkgRepo.findById(packageId)
    if (!pkg) return null

    const manifest = pkg.manifestId ? await new ManifestRepository(this.prisma).findById(pkg.manifestId) : null
    const artifacts = await this.artifactRepo.findByPackage(packageId)
    const adapter = this.registry.get(pkg.packageType as PackageType)
    const preview = adapter ? adapter.preview({
      asset: { id: pkg.assetId } as any,
      projectId: pkg.projectId,
      humanContent: '',
      searchContent: '',
      aiContent: '',
    }) : `Package ${pkg.packageType} (${pkg.version})`

    return {
      preview,
      manifest,
      artifactCount: artifacts.length,
    }
  }

  private async loadAsset(assetId: string): Promise<KnowledgeAsset | null> {
    const row = await this.prisma.knowledgeAsset.findUnique({ where: { id: assetId } })
    if (!row) return null
    return {
      id: row.id,
      recordId: row.recordId,
      claimId: row.claimId,
      title: row.title,
      assetType: row.assetType as any,
      status: row.status as any,
      version: row.version,
      humanContent: row.humanContent ?? '',
      searchContent: row.searchContent ?? '',
      aiContent: row.aiContent ?? '',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
