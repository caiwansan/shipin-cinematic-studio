// ════════════════════════════════════════════════════════════
// Knowledge Hub — Platform Entry Point
// ════════════════════════════════════════════════════════════

export { PackageBuilder, BuildOptions, BuildResult } from './core/package-builder'
export { PackageValidator, ValidationResult } from './core/package-validator'
export { VersionEngine, PackageVersion, VersionStage, VersionChange } from './core/version-engine'
export { ProviderRuntime } from './core/provider-runtime'
export { KnowledgePackageRepository } from './repository/package-repository'
export { registerKnowledgeHubRoutes } from './api/routes'

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
