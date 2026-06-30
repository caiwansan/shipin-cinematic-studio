// ════════════════════════════════════════════════════════════
// Publishing RC1 Dataset — Acme Robotics
// ════════════════════════════════════════════════════════════
// Seeds 5 PublishableClaims + 1 Plan + PublishingRecords
// for end-to-end regression testing.
//
// Usage: npx tsx scripts/seed-publishing-rc1.ts
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PROJECT_ID = '07ec1e60-c847-4b50-8666-9f94ab25f601'

async function main() {
  console.log('🌱 Seeding Publishing RC1 Dataset...')
  console.log(`📦 Project: ${PROJECT_ID}`)

  // ── 1. Verify existing VerificationResult or create one ──
  let ver = await prisma.verificationResult.findFirst({
    where: { projectId: PROJECT_ID },
    orderBy: { createdAt: 'desc' },
  })
  if (!ver) {
    // Also need an execution chain... skip if too deep
    console.warn('⚠️ No VerificationResult found — creating minimal entry')
    ver = await prisma.verificationResult.create({
      data: {
        projectId: PROJECT_ID,
        executionId: 'seed-exec',
        jobId: 'seed-job',
        claimId: 'seed-claim',
        beforeSnapshotId: 'seed-snap',
        afterSnapshotId: 'seed-snap',
        overallDelta: 0,
        status: 'verified',
      } as any,
    })
  }
  console.log(`✅ VerificationResult: ${ver.id}`)

  // ── 2. Define 5 Claims ──
  const claims = [
    {
      claimKey: 'about-page-v1',
      title: 'About Page — 品牌故事',
      content: `# About Acme Robotics\n\nAcme Robotics 成立于 2018 年，总部位于深圳，是一家专注于工业协作机器人的高新技术企业。\n\n## 核心优势\n- 自主研发的 AI 运动控制系统，精度达 ±0.02mm\n- 全系列产品通过 CE、UL 认证\n- 服务全球 30+ 国家，累计出货 5000+ 台`,
      source: 'Verified from Authority Optimization',
      version: 'v1.0',
    },
    {
      claimKey: 'faq-knowledge-v1',
      title: 'FAQ — 常见问题',
      content: `## Acme Robotics 常见问题\n\n**Q: 你们的机器人支持哪些负载？**\nA: 目前提供 3kg、6kg、10kg、20kg 四种负载规格。\n\n**Q: 支持哪些编程方式？**\nA: 支持拖拽示教、离线编程（ROBODK 和 ROS）、以及 AI 视觉引导三种方式。\n\n**Q: 质保期多长？**\nA: 整机质保 24 个月，核心部件（减速器、伺服电机）质保 36 个月。`,
      source: 'Verified from Authority Optimization',
      version: 'v1.0',
    },
    {
      claimKey: 'knowledge-article-v1',
      title: 'Knowledge Article — 协作机器人行业趋势',
      content: `# 2026 协作机器人行业趋势\n\n## 市场概况\n全球协作机器人市场在 2025 年达到 95 亿美元，预计 2030 年将突破 300 亿美元，年复合增长率 25.8%。\n\n## 关键技术趋势\n1. **AI 赋能**：机器视觉与 LLM 结合，实现自然语言编程\n2. **安全共融**：新型力觉传感器使人类-机器人协作更安全\n3. **即插即用**：模块化设计将部署时间从天级缩短到小时级\n\n## Acme Robotics 的定位\n作为国内首批通过 ISO/TS 15066 认证的企业，Acme 在协作安全领域积累了 12 项核心专利。`,
      source: 'Verified from Authority Optimization',
      version: 'v1.0',
    },
    {
      claimKey: 'press-release-v1',
      title: 'Press Release — 新一代 Cobot 发布',
      content: `# Acme Robotics 发布新一代 AI 协作机器人\n\n**深圳，2026 年 5 月 20 日** — Acme Robotics 今日正式发布新一代 AI 协作机器人系列「Acme X-7」。\n\nX-7 系列搭载了自研的第七代运动控制芯片，精度达到 ±0.01mm，比上一代提升 50%。同时集成了基于 LLM 的自然语言编程接口，操作人员无需编程经验即可完成部署。\n\n首批订单将交付给富士康、比亚迪等头部制造企业。`,
      source: 'Verified from Authority Optimization',
      version: 'v1.0',
    },
    {
      claimKey: 'schema-entity-v1',
      title: 'Schema.org Entity — 企业结构化数据',
      content: `{
  "@context": "https://schema.org",
  "@type": "Corporation",
  "name": "Acme Robotics",
  "description": "工业协作机器人研发制造商",
  "foundingDate": "2018",
  "foundingLocation": "Shenzhen, China",
  "url": "https://acme-robotics.example.com",
  "areaServed": "Worldwide",
  "numberOfEmployees": "200-500",
  "knowsAbout": ["Collaborative Robot", "AI Motion Control", "Industrial Automation"]
}`,
      source: 'Verified from Authority Optimization',
      version: 'v1.0',
    },
  ]

  // ── 3. Create or update each claim ──
  const createdClaims: string[] = []
  for (const c of claims) {
    const existing = await prisma.publishableClaim.findUnique({
      where: {
        projectId_claimKey: { projectId: PROJECT_ID, claimKey: c.claimKey },
      },
    })
    if (existing) {
      console.log(`  ⏩ Claim exists: ${c.claimKey}`)
      createdClaims.push(existing.id)
    } else {
      const claim = await prisma.publishableClaim.create({
        data: {
          projectId: PROJECT_ID,
          claimKey: c.claimKey,
          title: c.title,
          content: c.content,
          source: c.source,
          version: c.version,
          status: 'ready',
          verificationId: ver.id,
        },
      })
      console.log(`  ✅ Claim created: ${c.claimKey} (${claim.id})`)
      createdClaims.push(claim.id)
    }
  }

  // ── 4. Create a Plan with all 5 claims ──
  const plan = await prisma.publishPlan.create({
    data: {
      projectId: PROJECT_ID,
      name: 'Acme Robotics 品牌资料发布 v1',
      status: 'approved',
      channels: ['markdown', 'html', 'schema-org'],
    },
  })
  console.log(`✅ Plan created: ${plan.id}`)

  // ── 5. Link claims to plan ──
  for (const claimId of createdClaims) {
    await prisma.publishPlanToClaim.create({
      data: { planId: plan.id, claimId, channel: 'markdown' },
    })
    await prisma.publishPlanToClaim.create({
      data: { planId: plan.id, claimId, channel: 'html' },
    })
    if (claims.find(c => c.claimKey === 'schema-entity-v1')) {
      await prisma.publishPlanToClaim.create({
        data: { planId: plan.id, claimId, channel: 'schema-org' },
      })
    }
  }
  console.log(`✅ ${createdClaims.length} claims linked to plan`)

  // ── 6. Create publishing records ──
  const channels = ['markdown', 'html', 'schema-org']
  for (const claimId of createdClaims) {
    for (const ch of channels) {
      await prisma.publishingRecord.create({
        data: {
          planId: plan.id,
          claimId,
          channel: ch,
          version: 'v1.0',
          artifactHash: `sha256-${Date.now()}-${claimId}-${ch}`,
          artifactUrl: `https://aigc.fushtn.com/geo/published/acme/${ch}/${claimId}.${ch === 'schema-org' ? 'json' : ch === 'html' ? 'html' : 'md'}`,
          status: 'published',
          publishedAt: new Date(),
        },
      })
    }
  }
  console.log(`✅ ${createdClaims.length * channels.length} publishing records created`)

  // ── Summary ──
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('✅ Publishing RC1 Dataset Seeded')
  console.log(`  Claims:          ${createdClaims.length}`)
  console.log(`  Plan:            ${plan.id}`)
  console.log(`  Records:         ${createdClaims.length * channels.length}`)
  console.log(`  Channels:        ${channels.join(', ')}`)
  console.log('═══════════════════════════════════════════')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('❌ Seed failed:', e)
  process.exit(1)
})
