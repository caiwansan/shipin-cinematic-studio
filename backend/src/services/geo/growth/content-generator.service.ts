// ============================================================
// GEO Growth Engine — Content Generator Service (v3)
// Uses Unified AI Gateway for all LLM calls.
// Each content type has a registered PromptRegistry entry.
// ============================================================

import { UnifiedAIGateway } from '../../unified-ai-gateway.js'
import { getPrompt } from '../../../runtime/prompt/PromptRegistry.js'
import { prisma } from '../../../utils/index.js'

const gateway = new UnifiedAIGateway()

export type ContentType = 'faq' | 'about' | 'brandStory' | 'knowledgeArticle' | 'productDescription'
  | 'organizationSchema' | 'faqSchema' | 'breadcrumbSchema'

export interface GeneratedContent {
  contentType: ContentType
  title: string
  content: string
  language: string
  projectId: string
}

export async function generateContent(params: {
  userId: string
  projectId: string
  contentType: ContentType
  brandName: string
  context?: Record<string, any>
}): Promise<GeneratedContent> {
  const prompt = await getPrompt(`geo-content-${params.contentType}`, {
    brandName: params.brandName,
    ...params.context
  })

  const result = await gateway.invokeAI({
    userId: params.userId,
    projectId: params.projectId,
    agentType: 'geo-content-generator',
    capability: 'llm',
    input: { messages: [{ role: 'user', content: prompt }] }
  })

  if (result.status === 'failed') throw new Error(result.error || 'Content generation failed')

  const content = result.output?.choices?.[0]?.message?.content || result.output?.text || String(result.output)

  // Save as KnowledgeObject (GeoKnowledgeObject)
  const saved = await prisma.knowledgeObject.create({
    data: {
      projectId: params.projectId,
      topic: generateTitle(params.contentType, params.brandName),
      status: 'GENERATED',
      confidence: 0.85,
      qualityScore: 0.8,
      metadata: { contentType: params.contentType, brandName: params.brandName, aiGenerated: true },
      createdAt: new Date(),
    }
  })

  return {
    contentType: params.contentType,
    title: saved.topic || generateTitle(params.contentType, params.brandName),
    content,
    language: 'zh',
    projectId: params.projectId,
  }
}

function generateTitle(type: ContentType, brand: string): string {
  const titles: Record<ContentType, string> = {
    faq: `${brand} 常见问题（FAQ）`,
    about: `${brand} 企业介绍`,
    brandStory: `${brand} 品牌故事`,
    knowledgeArticle: `${brand} 知识百科`,
    productDescription: `${brand} 产品说明`,
    organizationSchema: `${brand} Organization Schema`,
    faqSchema: `${brand} FAQ Schema`,
    breadcrumbSchema: `${brand} Breadcrumb Schema`,
  }
  return titles[type]
}
