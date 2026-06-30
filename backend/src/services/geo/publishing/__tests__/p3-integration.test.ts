// ════════════════════════════════════════════════════════════
// P3.1 Quick Integration Test
// Verifies: Claim → Plan → Artifact → Record
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { ClaimService } from '../claim.service'
import { PlanService } from '../plan.service'
import { RecorderService } from '../recorder.service'
import { channelRegistry, ChannelAdapter } from '../artifact-renderer'
import { ClaimContentType, PlanStatus } from '../../types'

async function main() {
  const prisma = new PrismaClient()
  const claimSvc = new ClaimService(prisma)
  const planSvc = new PlanService(prisma)
  const recorderSvc = new RecorderService(prisma)

  const projectId = 'p3-test-project'

  try {
    // 1. CLAIM: Create a PublishableClaim
    const claim = await claimSvc.create({
      projectId,
      verificationId: 'test-verification-1',
      sourceActionId: 'test-action-1',
      title: '测试品牌 About Page',
      contentType: ClaimContentType.AboutPage,
      content: '# 关于我们的品牌\n\n我们是一家致力于 AI 品牌优化的公司。\n\n- 成立于 2026 年\n- 专注搜索引擎优化\n- 覆盖全球市场',
    })
    console.log('✅ Claim created:', claim.id, 'version:', claim.version)

    // 2. PLAN: Create a PublishPlan with the claim
    const plan = await planSvc.create({
      projectId,
      title: '测试发布计划 — About Page',
      claimIds: [claim.id],
      targetChannels: ['markdown', 'html_preview'],
    })
    console.log('✅ Plan created:', plan.id, 'status:', plan.status, 'claims:', plan.claimIds.length)

    // 3. RENDER: Claim → Artifact (Markdown + HTML)
    const mdAdapter = channelRegistry.resolve('markdown')
    const mdArtifact = mdAdapter.render(claim)
    console.log('✅ Markdown rendered:', mdArtifact.format, `(${mdArtifact.content.length} chars)`)

    const htmlAdapter = channelRegistry.resolve('html_preview')
    const htmlArtifact = htmlAdapter.render(claim)
    console.log('✅ HTML preview rendered:', htmlArtifact.format, `(${htmlArtifact.content.length} chars)`)

    // 4. VALIDATE: Adapter validation
    const mdValid = mdAdapter.validate(mdArtifact)
    console.log('✅ Markdown valid:', mdValid.valid, mdValid.errors)

    const htmlValid = htmlAdapter.validate(htmlArtifact)
    console.log('✅ HTML valid:', htmlValid.valid, htmlValid.errors)

    // 5. RECORD: Publish → PublishingRecord
    const record = await recorderSvc.record(
      plan.id,
      claim.id,
      'html_preview',
      claim.version,
      htmlArtifact,
    )
    console.log('✅ PublishingRecord created:', record.id, 'hash:', record.artifactHash, 'version:', record.version)

    // 6. CONFIRM: Mark as published
    const confirmed = await recorderSvc.confirmPublished(record.id, 'https://preview.example.com/about.html')
    console.log('✅ Record confirmed:', confirmed.status, confirmed.publishedAt)

    // 7. SUMMARY: Get publishing summary
    const summary = await recorderSvc.getSummary(projectId)
    console.log('✅ Publishing summary:', JSON.stringify(summary, null, 2))

    // 8. PLAN STATUS: Full lifecycle
    const inReview = await planSvc.updateStatus(plan.id, PlanStatus.InReview)
    console.log('✅ Plan in review:', inReview.status)
    const approved = await planSvc.updateStatus(plan.id, PlanStatus.Approved)
    console.log('✅ Plan approved:', approved.status)
    const published = await planSvc.updateStatus(plan.id, PlanStatus.Published)
    console.log('✅ Plan published:', published.status, 'publishedAt:', published.publishedAt)

    // ── Cleanup ──
    await prisma.publishingRecord.deleteMany({ where: { claimId: claim.id } })
    await prisma.publishPlanToClaim.deleteMany({ where: { claimId: claim.id } })
    await prisma.publishPlan.deleteMany({ where: { projectId } })
    await prisma.publishableClaim.deleteMany({ where: { projectId } })

    console.log('\n🎉 All P3.1 service tests passed!')
  } catch (err) {
    console.error('❌ Test failed:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
