// ════════════════════════════════════════════════════════════
// PublishManifest Builder — from KnowledgePackage to Manifest
// ════════════════════════════════════════════════════════════
// Converts a KnowledgePackage (or any data envelope) into a
// fully formed PublishManifest. The manifest is the ONLY contract
// consumed by downstream publishing components.
// ════════════════════════════════════════════════════════════

import { createHash } from 'crypto'
import type {
  PublishManifest,
  ManifestIdentity,
  ManifestRouting,
  ManifestContent,
  ManifestContentBlock,
  ManifestStructuredData,
  ManifestMetadata,
  ManifestDiscoverability,
  ManifestAssets,
  ManifestPublishing,
  ManifestVersion,
} from './types'

// ====== Public API ======

/**
 * Build a complete PublishManifest from a knowledge package.
 * @param knowledgePackage - Source data (typically from Knowledge Hub)
 * @param type - Manifest identity type
 * @param baseUrl - Base URL for canonical URLs (e.g. https://example.com)
 */
export function buildManifestFromPackage(
  knowledgePackage: any,
  type: PublishManifest['identity']['type'],
  baseUrl: string,
): PublishManifest {
  const now = new Date().toISOString()
  const slug = generateSlug(knowledgePackage.name || knowledgePackage.id)

  // Build Identity
  const identity: ManifestIdentity = {
    type,
    id: knowledgePackage.id,
    slug,
    name: knowledgePackage.name || 'Unknown',
    canonicalUrl: `${baseUrl}/knowledge/${type}/${slug}`,
  }

  // Build Routing
  const routing: ManifestRouting = {
    path: `/knowledge/${type}/${slug}`,
    routeName: `knowledge-${type}`,
    params: { slug },
    version: 1,
    updatedAt: now,
  }

  // Build Content
  const content = buildContent(knowledgePackage)

  // Build Metadata
  const metadata = buildMetadata(identity, routing)

  // Build StructuredData
  const structuredData = buildStructuredData(knowledgePackage, identity, routing)

  // Build Discoverability
  const discoverability: ManifestDiscoverability = {
    inSitemap: true,
    sitemapPriority: type === 'brand' ? 0.9 : type === 'entity' ? 0.8 : 0.7,
    sitemapChangefreq: 'weekly',
    inFeed: true,
    feedType: type === 'brand' ? 'brand' : type === 'entity' ? 'entity' : 'knowledge',
    llmsSection: type === 'brand' ? 'Brands' : type === 'entity' ? 'Entities' : 'Knowledge',
    links: generateLinks(identity),
  }

  // Build Assets
  const assets: ManifestAssets = {
    primary: knowledgePackage.logo
      ? { type: 'image', url: knowledgePackage.logo }
      : undefined,
    gallery: [],
    attachments: [],
  }

  // Build Publishing
  const publishing: ManifestPublishing = {
    status: 'draft',
    publishedAt: now,
    confidence: knowledgePackage.confidence || 0.5,
    snapshotVersion: knowledgePackage.snapshotVersion || 'v0',
    source: knowledgePackage.source || 'knowledge-hub',
  }

  // Build Version (content hash based on identity + content + structuredData)
  const contentStr = JSON.stringify({ identity, content, structuredData })
  const hash = createHash('sha256').update(contentStr).digest('hex')
  const version: ManifestVersion = {
    manifestVersion: '1.0.0',
    contentVersion: 1,
    hash,
    compiledAt: now,
    compilerVersion: '1.0.0',
  }

  return {
    identity,
    routing,
    content,
    structuredData,
    metadata,
    discoverability,
    assets,
    publishing,
    version,
  }
}

// ====== Internal Helpers ======

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

function buildContent(pkg: any): ManifestContent {
  const blocks: ManifestContentBlock[] = []

  if (pkg.summary) {
    blocks.push({ type: 'text', label: 'Summary', content: pkg.summary, order: 1 })
  }
  if (pkg.description) {
    blocks.push({ type: 'markdown', label: 'Description', content: pkg.description, order: 2 })
  }
  // Add FAQ block
  if (pkg.faqs && Array.isArray(pkg.faqs)) {
    const faqContent = pkg.faqs
      .map((f: any) => `**${f.question}**\n\n${f.answer}`)
      .join('\n\n')
    blocks.push({ type: 'markdown', label: 'FAQ', content: faqContent, order: 3 })
  }

  return {
    summary: pkg.summary || '',
    definition: pkg.definition || pkg.description || '',
    body: blocks.sort((a, b) => a.order - b.order),
    features: pkg.features || [],
    useCases: pkg.useCases || [],
    timeline: pkg.timeline || undefined,
  }
}

function buildMetadata(
  identity: ManifestIdentity,
  routing: ManifestRouting,
): ManifestMetadata {
  return {
    title: identity.name,
    description: '', // filled by Compiler with richer summary
    keywords: [],
    lang: 'zh-CN',
    og: {
      title: identity.name,
      description: '',
      url: identity.canonicalUrl,
      type: getOgType(identity.type),
    },
    twitter: {
      card: 'summary',
      title: identity.name,
      description: '',
    },
    canonical: identity.canonicalUrl,
    robots: 'index, follow',
  }
}

function buildStructuredData(
  _pkg: any,
  identity: ManifestIdentity,
  routing: ManifestRouting,
): ManifestStructuredData {
  const jsonld: Record<string, any>[] = []

  // Base WebPage JSON-LD
  jsonld.push({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': identity.canonicalUrl,
    url: identity.canonicalUrl,
    name: identity.name,
    dateModified: routing.updatedAt,
  })

  return { jsonld, schemaTypes: ['WebPage'] }
}

function generateLinks(
  identity: ManifestIdentity,
): { rel: string; href: string; title?: string }[] {
  return [
    { rel: 'canonical', href: identity.canonicalUrl },
    { rel: 'alternate', href: identity.canonicalUrl, title: identity.name },
  ]
}

function getOgType(type: string): string {
  const map: Record<string, string> = {
    brand: 'website',
    entity: 'website',
    topic: 'article',
    faq: 'website',
    claim: 'article',
  }
  return map[type] || 'website'
}

export type { ManifestMetadata }
