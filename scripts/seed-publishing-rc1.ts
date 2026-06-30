// ════════════════════════════════════════════════════════════
// Publishing RC1 Dataset — Acme Robotics
// ════════════════════════════════════════════════════════════
// Seeds 5 PublishableClaims + 1 Plan + PublishingRecords
// for end-to-end regression testing.
//
// ⚠️ 前置条件: project + execution + verification 必须已存在
//    Run: cd backend && npx tsx ../scripts/seed-publishing-rc1.ts
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PROJECT_ID = '07ec1e60-c847-4b50-8666-9f94ab25f601'

async function main() {
  console.log('🌱 Publishing RC1 Dataset — Acme Robotics')
  console.log(`📦 Project: ${PROJECT_ID}`)

  // ── 1. Use latest VerificationResult ──
  const ver = await prisma.verificationResult.findFirst({
    where: { projectId: PROJECT_ID },
    orderBy: { verifiedAt: 'desc' },
  })
  if (!ver) {
    console.error('❌ No VerificationResult found. Create one first:')
    console.error('   See previous seed commands or run manually.')
    process.exit(1)
  }
  console.log(`✅ VerificationResult: ${ver.id} (execution: ${ver.executionId})`)

  // ── 2. Define 5 Claims ──
  const claims = [
    {
      title: 'About Page — 品牌故事',
      contentType: 'about_page',
      content: `# About Acme Robotics\n\nAcme Robotics 成立于 2018 年，总部位于深圳，是一家专注于工业协作机器人的高新技术企业。\n\n## 核心优势\n- 自主研发的 AI 运动控制系统，精度达 ±0.02mm\n- 全系列产品通过 CE、UL 认证\n- 服务全球 30+ 国家，累计出货 5000+ 台`,
      version: '1.0.0',
    },
    {
      title: 'FAQ — 常见问题',
      contentType: 'faq_entry',
      content: `## Acme Robotics 常见问题\n\n**Q: 你们的机器人支持哪些负载？**\nA: 目前提供 3kg、6kg、10kg、20kg 四种负载规格。\n\n**Q: 支持哪些编程方式？**\nA: 支持拖拽示教、离线编程（ROBODK 和 ROS）、以及 AI 视觉引导三种方式。\n\n**Q: 质保期多长？**\nA: 整机质保 24 个月，核心部件（减速器、伺服电机）质保 36 个月。`,
      version: '1.0.0',
    },
    {
      title: 'Knowledge Article — 协作机器人行业趋势',
      contentType: 'knowledge_article',
      content: `# 2026 协作机器人行业趋势\n\n## 市场概况\n全球协作机器人市场在 2025 年达到 95 亿美元，预计 2030 年将突破 300 亿美元，年复合增长率 25.8%。\n\n## 关键技术趋势\n1. **AI 赋能**：机器视觉与 LLM 结合，实现自然语言编程\n2. **安全共融**：新型力觉传感器使人类-机器人协作更安全\n3. **即插即用**：模块化设计将部署时间从天级缩短到小时级\n\n## Acme Robotics 的定位\n作为国内首批通过 ISO/TS 15066 认证的企业，Acme 在协作安全领域积累了 12 项核心专利。`,
      version: '1.0.0',
    },
    {
      title: 'Press Release — 新一代 Cobot 发布',
      contentType: 'press_release',
      content: `# Acme Robotics 发布新一代 AI 协作机器人\n\n**深圳，2026 年 5 月 20 日** — Acme Robotics 今日正式发布新一代 AI 协作机器人系列「Acme X-7」。\n\nX-7 系列搭载了自研的第七代运动控制芯片，精度达到 ±0.01mm，比上一代提升 50%。同时集成了基于 LLM 的自然语言编程接口，操作人员无需编程经验即可完成部署。\n\n首批订单将交付给富士康、比亚迪等头部制造企业。`,
      version: '1.0.0',
    },
    {
      title: 'Schema.org Entity — 企业结构化数据',
      contentType: 'schema_entity',
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
      version: '1.0.0',
    },
  ]

  // ── 3. Create claims (avoid duplicates by title+projectId) ──
  const createdClaims: string[] = []
  for (const c of claims) {
    const existing = await prisma.publishableClaim.findFirst({
      where: { projectId: PROJECT_ID, title: c.title },
    })
    if (existing) {
      console.log(`  ⏩ Claim exists: ${c.title}`)
      createdClaims.push(existing.id)
      continue
    }
    const claim = await prisma.publishableClaim.create({
      data: {
        projectId: PROJECT_ID,
        verificationId: ver.id,
        sourceActionId: ver.executionId,
        title: c.title,
        contentType: c.contentType,
        content: c.content,
        version: c.version,
        status: 'ready',
      },
    })
    console.log(`  ✅ ${c.contentType}: ${c.title}`)
    createdClaims.push(claim.id)
  }

  // ── 4. Create Plan ──
  const plan = await prisma.publishPlan.create({
    data: {
      projectId: PROJECT_ID,
      title: 'Acme Robotics 品牌资料发布 v1',
      status: 'approved',
      targetChannels: ['markdown', 'html_preview', 'schema_jsonld'],
    },
  })
  console.log(`✅ Plan created: ${plan.id}`)

  // ── 5. Link claims to plan ──
  const channels = ['markdown', 'html_preview', 'schema_jsonld']
  for (const claimId of createdClaims) {
    for (const ch of channels) {
      await prisma.publishPlanToClaim.create({
        data: { planId: plan.id, claimId, channel: ch },
      })
    }
  }
  console.log(`✅ ${createdClaims.length} claims × ${channels.length} channels linked`)

  // ── 6. Create publishing records ──
  for (const claimId of createdClaims) {
    for (const ch of channels) {
      await prisma.publishingRecord.create({
        data: {
          planId: plan.id,
          claimId,
          channel: ch,
          version: '1.0.0',
          artifactHash: `sha256-${Date.now()}-${claimId}-${ch}`,
          artifactUrl: `https://aigc.fushtn.com/geo/published/acme/${ch}/${claimId}.${ch === 'schema_jsonld' ? 'json' : ch === 'html_preview' ? 'html' : 'md'}`,
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
