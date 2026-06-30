// ============================================================
// GEO v3 — Seed Prompt Templates for Content Generation
// Run: npx tsx backend/src/services/geo/growth/seed-prompts.ts
// ============================================================

import { prisma } from '../../../utils/index.js'

const geoContentPrompts = [
  {
    name: 'geo-content-faq',
    description: 'Generate FAQ for a brand',
    category: 'geo-content',
    content: {
      prompt: '你是一个品牌内容专家。请为品牌「{brandName}」生成 10 条常见问题（FAQ）及回答。以 JSON 数组格式返回，每条包含 question 和 answer 字段。',
      output_schema: '{"type":"array","items":{"type":"object","properties":{"question":{"type":"string"},"answer":{"type":"string"}}}}',
    },
  },
  {
    name: 'geo-content-about',
    description: 'Generate brand introduction',
    category: 'geo-content',
    content: {
      prompt: '你是一个品牌文案专家。请为品牌「{brandName}」撰写一篇专业的企业介绍（500-800字）。内容包括：品牌定位、核心业务、企业优势、品牌愿景。使用正式、专业的语言风格。以 Markdown 格式返回。',
      output_schema: '{"type":"string","description":"Markdown formatted brand introduction"}',
    },
  },
  {
    name: 'geo-content-brandStory',
    description: 'Generate brand story',
    category: 'geo-content',
    content: {
      prompt: '你是一个品牌故事专家。请为品牌「{brandName}」创作一篇引人入胜的品牌故事（800-1200字）。故事应包含：品牌创立起源、发展历程中的关键转折、核心价值理念、未来愿景。使用叙事性语言，情感丰富但不夸张。以 Markdown 格式返回。',
      output_schema: '{"type":"string","description":"Markdown formatted brand story"}',
    },
  },
  {
    name: 'geo-content-knowledgeArticle',
    description: 'Generate knowledge article related to brand',
    category: 'geo-content',
    content: {
      prompt: '你是一个行业知识专家。请为品牌「{brandName}」所属行业撰写一篇知识科普文章（600-1000字）。要求：1) 选择品牌所在行业的一个关键知识点 2) 深入浅出地解释 3) 结合品牌定位进行延伸讨论。以 Markdown 格式返回。',
      output_schema: '{"type":"string","description":"Markdown formatted knowledge article"}',
    },
  },
  {
    name: 'geo-content-productDescription',
    description: 'Generate product description',
    category: 'geo-content',
    content: {
      prompt: '你是一个产品文案专家。请为品牌「{brandName}」的核心产品或服务撰写一篇详细的产品说明（400-600字）。内容包括：产品名称、核心功能、主要优势、适用场景、差异化特点。使用简洁清晰的语言，突出卖点。以 Markdown 格式返回。',
      output_schema: '{"type":"string","description":"Markdown formatted product description"}',
    },
  },
  {
    name: 'geo-content-organizationSchema',
    description: 'Generate Organization Schema (JSON-LD)',
    category: 'geo-content',
    content: {
      prompt: '你是一个结构化数据专家。请为品牌「{brandName}」生成一个完整的 Organization Schema（JSON-LD 格式）。包含：name, description, url, logo, sameAs (社交媒体链接), address, contactPoint, foundingDate 等标准字段。直接返回 JSON-LD 代码块。',
      output_schema: '{"type":"string","description":"JSON-LD schema markup"}',
    },
  },
  {
    name: 'geo-content-faqSchema',
    description: 'Generate FAQ Schema (JSON-LD)',
    category: 'geo-content',
    content: {
      prompt: '你是一个结构化数据专家。请为品牌「{brandName}」生成一个 FAQ Schema（JSON-LD 格式）。生成 5-8 条常见问题及其回答，直接返回完整的 JSON-LD 代码块。每条问答应包含 mainEntity 数组，每个元素包含 name (问题) 和 acceptedAnswer (回答)。',
      output_schema: '{"type":"string","description":"JSON-LD FAQ schema"}',
    },
  },
  {
    name: 'geo-content-breadcrumbSchema',
    description: 'Generate Breadcrumb Schema (JSON-LD)',
    category: 'geo-content',
    content: {
      prompt: '你是一个结构化数据专家。请为品牌「{brandName}」生成一个 BreadcrumbList Schema（JSON-LD 格式）。生成 3-5 级面包屑导航，直接返回完整的 JSON-LD 代码块。每个元素包含 @type: ListItem, position, name, item 字段。',
      output_schema: '{"type":"string","description":"JSON-LD Breadcrumb schema"}',
    },
  },
]

async function seedGeoContentPrompts() {
  console.log('[seed] Seeding GEO content prompt templates...')

  for (const tpl of geoContentPrompts) {
    const existing = await prisma.promptTemplate.findUnique({ where: { name: tpl.name } })
    if (existing) {
      console.log(`[seed] ⏭️  "${tpl.name}" already exists, updating...`)
      await prisma.promptTemplate.update({
        where: { name: tpl.name },
        data: {
          description: tpl.description,
          category: tpl.category,
          content: tpl.content as any,
        },
      })
    } else {
      console.log(`[seed] ✅ Creating "${tpl.name}"...`)
      await prisma.promptTemplate.create({
        data: {
          name: tpl.name,
          description: tpl.description,
          category: tpl.category,
          content: tpl.content as any,
        },
      })
    }
  }

  console.log('[seed] ✅ GEO content prompts seeded successfully!')
  await prisma.$disconnect()
}

seedGeoContentPrompts().catch(err => {
  console.error('[seed] ❌ Failed to seed prompts:', err)
  process.exit(1)
})
