// ════════════════════════════════════════════════════════════
// Knowledge Hub — Platform Entry Point
// ════════════════════════════════════════════════════════════

export { PackageBuilder, BuildOptions, BuildResult } from './core/package-builder'
export { PackageValidator, ValidationResult } from './core/package-validator'
export { VersionEngine, PackageVersion, VersionStage, VersionChange } from './core/version-engine'
export { ProviderRuntime } from './core/provider-runtime'
export { KnowledgePackageRepository } from './repository/package-repository'
export { registerKnowledgeHubRoutes } from './api/routes'

// Publishing (KH2)
export { PublishingEngine, PublishRequest, PublishResponse } from './publishing/publishing-engine'
export { PublisherRegistry } from './publishing/publisher-registry'
export { PublishingQueue } from './publishing/publishing-queue'
export { registerPublishingRoutes } from './publishing/api'
export type {
  Publisher,
  PublishingResult,
  PublishArtifact,
  PublisherCapability as PublisherCapabilityType,
} from './publishing/types'
export { PublisherCapability } from './publishing/types'

// Publishing Adapters
export { WebsitePublisher } from './publishing/adapters/website.publisher'
export { CMSPublisher } from './publishing/adapters/cms.publisher'
export { WebhookPublisher } from './publishing/adapters/webhook.publisher'
export { ExportPublisher } from './publishing/adapters/export.publisher'

// Types
export {
  KnowledgePackage,
  KnowledgeClaim,
  KnowledgeEvidence,
  KnowledgeAsset,
  Citation,
  PublishingTarget,
  StatusChange,
  KnowledgeProvider,
} from './core/types'

// Providers
export { GeoKnowledgeProvider } from './providers/geo/geo-knowledge.provider'
export { NovelKnowledgeProvider } from './providers/stubs/novel.provider'
export { StoryKnowledgeProvider } from './providers/stubs/story.provider'
export { PresentationKnowledgeProvider } from './providers/stubs/presentation.provider'
