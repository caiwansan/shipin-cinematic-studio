// ════════════════════════════════════════════════════════════
// PublishManifest — barrel export
// ════════════════════════════════════════════════════════════

// Types
export type {
  PublishManifest,
  ManifestIdentity,
  ManifestRouting,
  ManifestContent,
  ManifestContentBlock,
  ManifestStructuredData,
  ManifestMetadata,
  ManifestDiscoverability,
  ManifestAsset,
  ManifestAssets,
  ManifestPublishing,
  ManifestVersion,
} from './types'

// Builders
export { buildManifestFromPackage } from './builder'
export { buildFromKnowledgePackage, buildAllFromPackages } from './builder-knowledge'

// Registry
export { manifestRegistry } from './registry'

// Repository
export { manifestRepository } from './manifest-repository'

// Adapter
export { buildManifestFromKnowledgeBrand, rebuildAllBrandManifests } from './manifest-adapter'

// Public API
export { registerPublicManifestRoutes } from './public-api'
