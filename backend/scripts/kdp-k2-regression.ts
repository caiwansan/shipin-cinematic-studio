// ════════════════════════════════════════════════════════════
// KDP Sprint K2 — Golden Regression: Knowledge Packaging
// ════════════════════════════════════════════════════════════
// Validates the full Packaging Pipeline:
//   KnowledgeAsset → Package → Manifest → Artifacts → Preview
//
// Consumes from K1 assets (build on K1 Golden Regression data)
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { PackagingOrchestrator } from '../src/services/geo/kdp/packaging-orchestrator'
import { setupDefaultPackagers } from '../src/services/geo/kdp/packagers/setup'
import { KnowledgePackageRepository } from '../src/services/geo/kdp/repos/package.repository'
import { ManifestRepository } from '../src/services/geo/kdp/repos/manifest.repository'
import { ArtifactRepository } from '../src/services/geo/kdp/repos/artifact.repository'
import { PackageType, PackageStatus } from '../src/services/geo/types'

const prisma = new PrismaClient()
const PROJECT_ID = '07ec1e60-c847-4b50-8666-9f94ab25f601'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}`)
    failed++
  }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('KDP Sprint K2 — Golden Regression: Packaging')
  console.log('═══════════════════════════════════════════\n')

  // Setup
  const registry = setupDefaultPackagers()
  assert(registry.count() === 5, `5 packagers registered (got ${registry.count()})`)
  assert(registry.has(PackageType.Website), 'Website packager registered')
  assert(registry.has(PackageType.Sitemap), 'Sitemap packager registered')
  assert(registry.has(PackageType.RSS), 'RSS packager registered')
  assert(registry.has(PackageType.AIFeed), 'AI Feed packager registered')
  assert(registry.has(PackageType.KnowledgeBundle), 'Knowledge Bundle packager registered')

  // ── Phase 1: Package a single asset ──
  console.log('\n📦 Phase 1: Package a single asset through all 5 types')
  console.log('─────────────────────────────────────────')

  const orchestrator = new PackagingOrchestrator(prisma, registry)
  const pkgRepo = new KnowledgePackageRepository(prisma)
  const manifestRepo = new ManifestRepository(prisma)
  const artifactRepo = new ArtifactRepository(prisma)

  // Find an asset from K1
  const asset = await prisma.knowledgeAsset.findFirst({
    orderBy: { createdAt: 'asc' },
  })
  assert(asset !== null, `KnowledgeAsset found: ${asset?.id.substring(0, 8)}`)

  if (!asset) { console.log('No assets found, exiting'); return }

  // Package all 5 types
  const result = await orchestrator.packageAsset({
    assetId: asset.id,
    projectId: PROJECT_ID,
    packageTypes: [
      PackageType.Website,
      PackageType.Sitemap,
      PackageType.RSS,
      PackageType.AIFeed,
      PackageType.KnowledgeBundle,
    ],
    forceRebuild: true,
  })

  assert(result.packages.length === 5, `5 packages created (got ${result.packages.length})`)
  assert(result.totalArtifacts >= 6, `≥6 artifacts total (got ${result.totalArtifacts})`)
  // Website=1, Sitemap=1, RSS=1, AIFeed=1, KnowledgeBundle=2

  // ── Phase 2: Verify each package ──
  console.log('\n📦 Phase 2: Verify each package type')
  console.log('─────────────────────────────────────────')

  for (const p of result.packages) {
    assert(p.pkg.packageType.length > 0, `Package type: ${p.pkg.packageType}`)
    assert(p.pkg.status === PackageStatus.Validated, `${p.pkg.packageType} status = validated`)
    assert(p.pkg.artifactHash.length > 0, `${p.pkg.packageType} has artifact hash`)
    assert(p.pkg.manifestId?.length > 0, `${p.pkg.packageType} has manifestId`)

    // Verify manifest
    const manifest = p.manifest
    assert(manifest.source.assetId === asset.id, 'Manifest source assetId matches')
    assert(manifest.validation.contentHash === p.pkg.artifactHash, 'Manifest contentHash matches package hash')

    // Verify artifacts
    assert(p.artifacts.length > 0, `${p.pkg.packageType} has artifacts`)
    for (const art of p.artifacts) {
      assert(art.content.length > 0, `  ${art.fileName} has content`)
      assert(art.contentHash.length > 0, `  ${art.fileName} has hash`)
    }
  }

  // ── Phase 3: Preview ──
  console.log('\n📦 Phase 3: Preview')
  console.log('─────────────────────────────────────────')

  for (const p of result.packages) {
    const preview = await orchestrator.previewPackage(p.pkg.id)
    assert(preview !== null, `Preview for ${p.pkg.packageType}: ${preview?.preview.substring(0, 60)}`)
  }

  // ── Phase 4: Package Hash = Manifest Hash + Artifact Hashes ──
  console.log('\n📦 Phase 4: Package Hash integrity')
  console.log('─────────────────────────────────────────')

  for (const p of result.packages) {
    const totalHash = await artifactRepo.totalArtifactHash(p.pkg.id)
    assert(totalHash === p.pkg.artifactHash, `${p.pkg.packageType} hash matches computed`)
  }

  // ── Phase 5: Immutability — re-packaging creates new packages ──
  console.log('\n📦 Phase 5: Immutability — re-packaging creates new packages')
  console.log('─────────────────────────────────────────')

  // Without forceRebuild, should skip
  const skipResult = await orchestrator.packageAsset({
    assetId: asset.id,
    projectId: PROJECT_ID,
    packageTypes: [PackageType.Website],
    forceRebuild: false,
  })
  assert(skipResult.packages.length === 0, 'No duplicate packages without forceRebuild')

  // With forceRebuild, should create new
  const rebuildResult = await orchestrator.packageAsset({
    assetId: asset.id,
    projectId: PROJECT_ID,
    packageTypes: [PackageType.Website],
    forceRebuild: true,
  })
  assert(rebuildResult.packages.length === 1, 'New package created with forceRebuild')
  assert(rebuildResult.packages[0].pkg.id !== result.packages[0].pkg.id, 'New package has different ID')

  const wsPkg = rebuildResult.packages[0]
  assert(wsPkg.pkg.version === '1.0.0', 'New package default version is 1.0.0')

  // ── Phase 6: ──
  console.log('\n═══════════════════════════════════════════')
  console.log(`📊 Results: ${passed} passed, ${failed} failed`)
  console.log('═══════════════════════════════════════════')

  if (failed > 0) {
    console.error('\n❌ K2 Regression FAILED\n')
    process.exit(1)
  }

  console.log('\n✅ KDP K2 Golden Regression PASSED — ready for freeze\n')
}

main().catch(e => {
  console.error('\n❌ K2 Regression error:', e)
  process.exit(1)
})
