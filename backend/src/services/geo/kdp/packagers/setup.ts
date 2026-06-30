// ════════════════════════════════════════════════════════════
// KDP K2 — Default Packager Setup
// ════════════════════════════════════════════════════════════
// Registers all five local packagers into PackagingAdapterRegistry.
// ════════════════════════════════════════════════════════════

import { PackagingAdapterRegistry } from '../packaging-adapter-registry'
import { WebsitePackager } from './website.packager'
import { SitemapPackager } from './sitemap.packager'
import { RSSPackager } from './rss.packager'
import { AIFeedPackager } from './ai-feed.packager'
import { KnowledgeBundlePackager } from './knowledge-bundle.packager'

export function setupDefaultPackagers(): PackagingAdapterRegistry {
  const registry = new PackagingAdapterRegistry()

  registry.register(new WebsitePackager())
  registry.register(new SitemapPackager())
  registry.register(new RSSPackager())
  registry.register(new AIFeedPackager())
  registry.register(new KnowledgeBundlePackager())

  return registry
}

export type {
  WebsitePackager,
  SitemapPackager,
  RSSPackager,
  AIFeedPackager,
  KnowledgeBundlePackager,
}
