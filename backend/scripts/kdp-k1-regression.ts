// ════════════════════════════════════════════════════════════
// KDP Sprint K1 — Golden Regression
// ════════════════════════════════════════════════════════════
// Consumes Publishing RC1 Golden Dataset (Acme Robotics)
// Validates: Idempotency / Version Evolution / Attempt Retry
//
// Usage: cd backend && npx tsx scripts/kdp-k1-regression.ts
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { AssetBuilderService } from '../src/services/geo/kdp/asset-builder.service'
import { DistributionPlannerService } from '../src/services/geo/kdp/distribution-planner.service'
import { AttemptSchedulerService } from '../src/services/geo/kdp/attempt-scheduler.service'
import { AssetType, DistributionTarget, AttemptStatus } from '../src/services/geo/types'

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
  console.log('KDP Sprint K1 — Golden Regression')
  console.log('Using Publishing RC1 Dataset (Acme Robotics)')
  console.log('═══════════════════════════════════════════\n')

  // ── Phase 1: AssetBuilder — Idempotency ──
  console.log('📦 Phase 1: AssetBuilder — Idempotency')
  console.log('─────────────────────────────────────────')

  const records = await prisma.publishingRecord.findMany({
    where: {
      plan: { projectId: PROJECT_ID },
      status: 'published',
    },
    include: {
      claim: true,
    },
    take: 5,
  })

  assert(records.length >= 3, `Found ${records.length} PublishingRecords`)

  const builder = new AssetBuilderService(prisma)

  // Build assets
  const firstResults: string[] = []
  for (const record of records) {
    const result = await builder.buildFromRecord({
      recordId: record.id,
      claimId: record.claimId,
      assetType: mapContentType(record.claim.contentType),
      title: record.claim.title,
      rawContent: record.claim.content,
    })
    firstResults.push(result.assetId)

    assert(!!result.assetId, `Asset created: ${result.assetId.substring(0, 8)}...`)
    assert(result.variants.length === 3, `3 variants for ${result.assetId.substring(0, 8)}...`)

    const types = result.variants.map(v => v.variantType)
    assert(types.includes('human'), 'Has human variant')
    assert(types.includes('search'), 'Has search variant')
    assert(types.includes('ai'), 'Has ai variant')
  }

  // Test idempotency: build same records again
  for (const record of records) {
    const result = await builder.buildFromRecord({
      recordId: record.id,
      claimId: record.claimId,
      assetType: mapContentType(record.claim.contentType),
      title: record.claim.title,
      rawContent: record.claim.content,
    })
    assert(firstResults.includes(result.assetId), `Idempotent: same assetId returned for ${record.id.substring(0, 8)}`)
  }

  const totalAssets = await prisma.knowledgeAsset.count({
    where: { recordId: { in: records.map(r => r.id) } },
  })
  assert(totalAssets === records.length, `No duplicate assets (${totalAssets} === ${records.length})`)

  // Verify all 3 variants exist per asset
  for (const assetId of firstResults) {
    const variants = await prisma.assetVariant.findMany({ where: { assetId } })
    assert(variants.length === 3, `Asset ${assetId.substring(0, 8)} has ${variants.length}/3 variants`)
    for (const v of variants) {
      assert(v.content.length > 0, `${v.variantType} variant has content (${v.content.length} chars)`)
      assert(v.artifactHash.length > 0, `${v.variantType} variant has hash`)
    }
  }

  console.log('')

  // ── Phase 2: DistributionPlanner ──
  console.log('📦 Phase 2: DistributionPlanner')
  console.log('─────────────────────────────────────────')

  const planner = new DistributionPlannerService(prisma)

  const plan = await planner.autoCreateFromAssets({
    projectId: PROJECT_ID,
    assetIds: firstResults,
    targets: [DistributionTarget.Website, DistributionTarget.RSS, DistributionTarget.Sitemap, DistributionTarget.KnowledgeFeed, DistributionTarget.AIManifest],
    title: 'K1 Golden Regression — Acme Robotics Full Distribution',
    incrementalOnly: false, // Force full for first test
    forceFull: true,
  })

  assert(plan.id.length > 0, 'DistributionPlan created')
  assert(plan.status === 'pending_review', `Status is pending_review: ${plan.status}`)
  assert(plan.assetIds.length === firstResults.length, `Plan includes ${plan.assetIds.length}/${firstResults.length} assets`)

  // Approve the plan
  const approved = await planner.approvePlan(plan.id)
  assert(approved.status === 'approved', 'Plan approved')

  // Test incremental: should be empty since nothing changed
  const incrementalPlan = await planner.autoCreateFromAssets({
    projectId: PROJECT_ID,
    assetIds: firstResults,
    targets: [DistributionTarget.Website],
    incrementalOnly: true,
  })
  assert(incrementalPlan.id.length > 0, 'Incremental plan created (empty is OK)')

  console.log('')

  // ── Phase 3: AttemptScheduler — Retry ──
  console.log('📦 Phase 3: AttemptScheduler — Retry')
  console.log('─────────────────────────────────────────')

  const scheduler = new AttemptSchedulerService(prisma)
  const adapterIds = ['sitemap', 'rss', 'knowledge_feed', 'ai_manifest']

  const attempts = await scheduler.scheduleAttempts(approved, adapterIds)

  assert(attempts.length === adapterIds.length, `${attempts.length} attempts scheduled (expected ${adapterIds.length})`)

  // Verify schedules are idempotent
  const dupes = await scheduler.scheduleAttempts(approved, adapterIds)
  assert(dupes.length === 0, 'No duplicate pending attempts')

  // Test retry: mark one as failed, then retry
  const firstAttempt = attempts[0]
  await scheduler.markFailed(firstAttempt.id, 'Simulated network timeout')
  const failedAttempt = await prisma.distributionAttempt.findUnique({ where: { id: firstAttempt.id } })
  assert(failedAttempt?.status === 'failed', `Failed attempt status: ${failedAttempt?.status}`)
  assert(failedAttempt?.errorLog === 'Simulated network timeout', 'Error log preserved')

  // Retry — should create attempt #2
  const retryAttempts = await scheduler.scheduleAttempts(approved, [firstAttempt.adapterId])
  assert(retryAttempts.length === 1, 'Retry created exactly 1 new attempt')
  assert(retryAttempts[0].attemptNo === 2, `Retry attemptNo = ${retryAttempts[0].attemptNo} (expected 2)`)
  assert(retryAttempts[0].status === 'pending', 'Retry status is pending')

  // Mark as success
  const successResult = await scheduler.markSuccess(
    retryAttempts[0].id,
    'https://aigc.fushtn.com/geo/distributed/acme/sitemap.xml',
    'a1b2c3d4e5f6',
    1250
  )
  assert(successResult.status === 'success', 'Success status')
  assert(successResult.durationMs === 1250, 'Duration recorded')

  // ── Phase 4: ──
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log(`📊 Results: ${passed} passed, ${failed} failed`)
  console.log('═══════════════════════════════════════════')

  if (failed > 0) {
    console.error('\n❌ Regression FAILED — review failures above')
    process.exit(1)
  }

  console.log('\n✅ KDP K1 Regression PASSED — ready for freeze\n')

  await prisma.$disconnect()
}

function mapContentType(type: string): AssetType {
  const map: Record<string, AssetType> = {
    about_page: AssetType.Article,
    faq_entry: AssetType.QAPack,
    knowledge_article: AssetType.Article,
    press_release: AssetType.Article,
    schema_entity: AssetType.SchemaEntity,
  }
  return map[type] || AssetType.Article
}

main().catch(e => {
  console.error('\n❌ Regression error:', e)
  process.exit(1)
})
