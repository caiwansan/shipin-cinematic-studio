// ════════════════════════════════════════════════════════════
// Knowledge Hub Package → Manifest Builder
// ════════════════════════════════════════════════════════════
// Builds PublishManifests from Knowledge Hub data models and
// auto-registers them in the manifest registry.
// ════════════════════════════════════════════════════════════

import { buildManifestFromPackage } from './builder'
import type { PublishManifest } from './types'
import { manifestRegistry } from './registry'

/**
 * Build a single PublishManifest from a Knowledge Hub package and
 * register it in the manifest registry.
 *
 * @param pkg  - Knowledge Hub package object
 * @param baseUrl - Base URL for canonical URLs
 */
export function buildFromKnowledgePackage(
  pkg: any,
  baseUrl: string,
): PublishManifest {
  const type = determineType(pkg)
  const manifest = buildManifestFromPackage(pkg, type, baseUrl)
  manifestRegistry.save(manifest)
  return manifest
}

/**
 * Batch-build PublishManifests from an array of Knowledge Hub packages.
 * Useful for rebuild / re-publish operations.
 *
 * @param packages - Array of Knowledge Hub package objects
 * @param baseUrl  - Base URL for canonical URLs
 */
export function buildAllFromPackages(
  packages: any[],
  baseUrl: string,
): PublishManifest[] {
  return packages.map((pkg) => buildFromKnowledgePackage(pkg, baseUrl))
}

// ====== Type Determination ======

function determineType(pkg: any): PublishManifest['identity']['type'] {
  if (pkg.type === 'brand' || pkg.brand) return 'brand'
  if (pkg.type === 'entity' || pkg.entityType) return 'entity'
  if (pkg.type === 'topic' || pkg.topic) return 'topic'
  if (pkg.type === 'faq' || pkg.faqs || pkg.questions) return 'faq'
  return 'topic'
}
