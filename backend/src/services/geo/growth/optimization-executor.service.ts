// ============================================================
// GEO Growth Engine — Optimization Executor Service (v3)
// Executes optimization tasks: generates content & measures score impact
// ============================================================

export type OptimizationType = 'generate-faq' | 'generate-about' | 'generate-brand-story'
  | 'generate-knowledge' | 'generate-product' | 'generate-schema-org'
  | 'generate-schema-faq' | 'generate-schema-breadcrumb'

export interface ExecutionResult {
  optimizationType: OptimizationType
  status: 'completed' | 'failed'
  contentId?: string
  scoreImprovement?: number
  error?: string
}

const contentTypeMap: Record<string, string> = {
  'generate-faq': 'faq',
  'generate-about': 'about',
  'generate-brand-story': 'brandStory',
  'generate-knowledge': 'knowledgeArticle',
  'generate-product': 'productDescription',
  'generate-schema-org': 'organizationSchema',
  'generate-schema-faq': 'faqSchema',
  'generate-schema-breadcrumb': 'breadcrumbSchema',
}

export async function executeOptimization(params: {
  userId: string
  projectId: string
  type: OptimizationType
  brandName: string
}): Promise<ExecutionResult> {
  const { generateContent } = await import('./content-generator.service.js')
  const { calculateScore } = await import('../recommendation/recommendation-score.service.js')

  const scoreBefore = await calculateScore(params.projectId)

  try {
    const result = await generateContent({
      userId: params.userId,
      projectId: params.projectId,
      contentType: contentTypeMap[params.type] as any,
      brandName: params.brandName,
    })

    const scoreAfter = await calculateScore(params.projectId)
    const improvement = scoreAfter.overall - scoreBefore.overall

    return {
      optimizationType: params.type,
      status: 'completed',
      contentId: result.title,
      scoreImprovement: improvement,
    }
  } catch (err: any) {
    return {
      optimizationType: params.type,
      status: 'failed',
      error: err.message || 'Unknown error during optimization execution',
    }
  }
}
