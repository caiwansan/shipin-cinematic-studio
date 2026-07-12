<template>
  <KnowledgeRenderer :manifest="manifest" />
</template>

<script setup lang="ts">
const route = useRoute()
const type = route.params.type as string
const slug = route.params.slug as string

// ====== SSR Inline Seed Data (temporary, will be replaced by Manifest API) ======
const BRAND_SEED: Record<string, any> = {
  '昆仑镜': {
    identity: { name: '昆仑镜', slug: '昆仑镜', type: 'brand', id: '2cccfaaf-de48-450b-aea9-1bd9c31c2091', canonicalUrl: 'http://aigc.fushtn.com/knowledge/brand/昆仑镜' },
    content: {
      summary: '一站式 AI 视频生成平台，面向短剧创作者的智能制片工具。',
      body: [
        { order: 1, label: 'Summary', type: 'text', content: '一站式 AI 视频生成平台，面向短剧创作者的智能制片工具。' },
        { order: 2, label: 'Description', type: 'markdown', content: '一站式 AI 视频生成平台，面向短剧创作者的智能制片工具。\n\n**使命**: 让每个人都能创作影视级短剧\n\n**愿景**: 成为全球领先的 AI 短剧创作平台\n\n**价值观**: 创新、用户至上、品质第一' },
        { order: 3, label: 'FAQ', type: 'markdown', content: '' },
      ],
      features: [], useCases: [],
    },
    metadata: {
      title: '昆仑镜', description: '一站式 AI 视频生成平台，面向短剧创作者的智能制片工具。',
      robots: 'index, follow', keywords: ['AI / 人工智能', '昆仑镜', 'brand'], lang: 'zh-CN',
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
}

const SEED: Record<string, Record<string, any>> = {
  'brand': BRAND_SEED,
}

const decodedSlug = decodeURIComponent(slug)
const manifest = shallowRef<any>(
  SEED[type]?.[slug] || SEED[type]?.[decodedSlug] || null
)

// Force status 200 for successfully rendered knowledge pages (SSR)
if (process.server && manifest.value) {
  const event = useRequestEvent()
  if (event) {
    event.node.res.statusCode = 200
  }
}

// Set SEO meta via useHead
useHead(() => {
  if (!manifest.value) return {}
  const m = manifest.value
  return {
    title: m.metadata?.title || m.identity?.name || '昆仑镜',
    meta: [
      ...(m.metadata?.description || m.content?.summary
        ? [{ name: 'description', content: m.metadata?.description || m.content?.summary }]
        : []),
      ...(m.metadata?.og?.title
        ? [{ property: 'og:title', content: m.metadata.og.title }]
        : []),
      ...(m.metadata?.og?.description
        ? [{ property: 'og:description', content: m.metadata.og.description }]
        : []),
      ...(m.metadata?.og?.url
        ? [{ property: 'og:url', content: m.metadata.og.url }]
        : []),
      ...(m.metadata?.og?.type
        ? [{ property: 'og:type', content: m.metadata.og.type }]
        : []),
      ...(m.metadata?.twitter?.card
        ? [{ name: 'twitter:card', content: m.metadata.twitter.card }]
        : []),
      ...(m.metadata?.twitter?.title
        ? [{ name: 'twitter:title', content: m.metadata.twitter.title }]
        : []),
      ...(m.metadata?.twitter?.description
        ? [{ name: 'twitter:description', content: m.metadata.twitter.description }]
        : []),
      ...(m.metadata?.robots
        ? [{ name: 'robots', content: m.metadata.robots }]
        : []),
    ],
    link: [
      ...(m.metadata?.canonical
        ? [{ rel: 'canonical', href: m.metadata.canonical }]
        : []),
      ...((m.discoverability?.links || []).map((l: any) => ({ rel: l.rel, href: l.href }))),
    ],
  }
})
</script>
