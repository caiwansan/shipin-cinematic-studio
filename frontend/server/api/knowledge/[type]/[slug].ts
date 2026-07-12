// ════════════════════════════════════════════════════════════
// SSR Server Proxy — Universal Knowledge Page API
// Provides Manifest data for any knowledge type
// Currently returns static seed data, will be replaced by backend API
// ════════════════════════════════════════════════════════════

const SEED: Record<string, Record<string, any>> = {
  brand: {
    '昆仑镜': {
      identity: { name: '昆仑镜', slug: '昆仑镜', type: 'brand', id: '2cccfaaf-de48-450b-aea9-1bd9c31c2091', canonicalUrl: 'http://aigc.fushtn.com/knowledge/brand/昆仑镜' },
      content: {
        summary: '一站式 AI 视频生成平台，面向短剧创作者的智能制片工具。',
        body: [
          { order: 1, label: 'Summary', type: 'text', content: '一站式 AI 视频生成平台，面向短剧创作者的智能制片工具。' },
          { order: 2, label: 'Description', type: 'markdown', content: '一站式 AI 视频生成平台，面向短剧创作者的智能制片工具。\n\n**使命**: 让每个人都能创作影视级短剧\n\n**愿景**: 成为全球领先的 AI 短剧创作平台\n\n**价值观**: 创新、用户至上、品质第一' },
          { order: 3, label: 'FAQ', type: 'markdown', content: '' },
        ],
        features: [],
        useCases: [],
      },
      metadata: {
        title: '昆仑镜',
        description: '一站式 AI 视频生成平台，面向短剧创作者的智能制片工具。',
        robots: 'index, follow',
        keywords: ['AI / 人工智能', '昆仑镜', 'brand'],
        lang: 'zh-CN',
        canonical: 'http://aigc.fushtn.com/knowledge/brand/昆仑镜',
        og: { title: '昆仑镜', description: '一站式 AI 视频生成平台，面向短剧创作者的智能制片工具。', type: 'website', url: 'http://aigc.fushtn.com/knowledge/brand/昆仑镜' },
        twitter: { card: 'summary', title: '昆仑镜', description: '一站式 AI 视频生成平台，面向短剧创作者的智能制片工具。' },
      },
      version: { manifestVersion: '1.0.0', contentVersion: 1, compiledAt: new Date().toISOString() },
      routing: { path: '/knowledge/brand/昆仑镜', params: { slug: '昆仑镜' }, version: 1, routeName: 'knowledge-brand', updatedAt: new Date().toISOString() },
      structuredData: { jsonld: [{ '@context': 'https://schema.org', '@type': 'WebPage', '@id': 'http://aigc.fushtn.com/knowledge/brand/昆仑镜', url: 'http://aigc.fushtn.com/knowledge/brand/昆仑镜', name: '昆仑镜', dateModified: new Date().toISOString() }], schemaTypes: ['WebPage'] },
      publishing: { source: 'knowledge-hub', status: 'published', confidence: 0.8, publishedAt: new Date().toISOString(), snapshotVersion: 'v1' },
      discoverability: {
        links: [
          { rel: 'canonical', href: 'http://aigc.fushtn.com/knowledge/brand/昆仑镜' },
          { rel: 'alternate', href: 'http://aigc.fushtn.com/knowledge/brand/昆仑镜', title: '昆仑镜' },
        ],
        inFeed: true, feedType: 'brand', inSitemap: true, llmsSection: 'Brands', sitemapPriority: 0.9, sitemapChangefreq: 'weekly',
      },
      assets: { gallery: [], attachments: [] },
    },
  },
}

export default defineEventHandler(async (event) => {
  const type = getRouterParam(event, 'type')
  const slug = getRouterParam(event, 'slug')

  if (!slug) throw createError({ statusCode: 400, message: 'Slug is required' })
  if (!type) throw createError({ statusCode: 400, message: 'Type is required' })

  // Try static seed data first
  const decodedSlug = decodeURIComponent(slug)
  const typeData = SEED[type]
  const staticData = typeData?.[slug] || typeData?.[decodedSlug]
  if (staticData) {
    event.handled = true
    return { success: true, manifest: staticData }
  }

  // Fallback: try backend API
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase || 'http://localhost:4002'
  const url = `${apiBase}/api/v1/public/knowledge/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'Connection': 'close' },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      if (response.status === 404) throw createError({ statusCode: 404, message: `${type} not found` })
      throw new Error(`Backend error: ${response.status}`)
    }
    return await response.json()
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error(`[knowledge/${type}] fetch error for slug="${slug}":`, err.message)
    throw createError({ statusCode: 404, message: `${type} not found` })
  }
})
