// ════════════════════════════════════════════════════════════
// Manifest Adapter — Transform knowledge domain data into Manifests
// ════════════════════════════════════════════════════════════
// Adapts data from multiple knowledge sources into PublishManifest.
// Source: services/knowledge (KnowledgeBrand, KnowledgeProduct, etc.)
// ════════════════════════════════════════════════════════════

import { buildManifestFromPackage } from './builder';
import type { PublishManifest } from './types';

/**
 * Build a Manifest from a services/knowledge Brand object.
 * KnowledgeBrand has: id, name, industry, description, website, mission, vision, values
 */
export async function buildManifestFromKnowledgeBrand(
  brandData: any,
  baseUrl: string,
): Promise<PublishManifest | null> {
  if (!brandData || !brandData.id) return null;

  // Get products if available (from included relation)
  const products = brandData.products || [];
  const features: string[] = [];
  const useCases: string[] = [];

  // Extract features and useCases from products
  for (const product of products) {
    if (product.features && Array.isArray(product.features)) {
      for (const f of product.features) {
        if (typeof f === 'string' && !features.includes(f)) {
          features.push(f);
        }
      }
    }
    if (product.useCases && Array.isArray(product.useCases)) {
      for (const u of product.useCases) {
        if (typeof u === 'string' && !useCases.includes(u)) {
          useCases.push(u);
        }
      }
    }
  }

  // Build description from multiple fields
  const descriptionParts: string[] = [];
  if (brandData.description) descriptionParts.push(brandData.description);
  if (brandData.mission) descriptionParts.push(`**使命**: ${brandData.mission}`);
  if (brandData.vision) descriptionParts.push(`**愿景**: ${brandData.vision}`);
  if (brandData.values && Array.isArray(brandData.values) && brandData.values.length > 0) {
    descriptionParts.push(`**价值观**: ${brandData.values.join('、')}`);
  }

  // Parse timestamps
  const createdAt = brandData.createdAt ? new Date(brandData.createdAt).toISOString() : new Date().toISOString();
  const updatedAt = brandData.updatedAt ? new Date(brandData.updatedAt).toISOString() : createdAt;

  // Construct a KnowledgePackage-compatible object
  const pkg = {
    id: brandData.id,
    name: brandData.name,
    type: 'brand',
    summary: brandData.description?.slice(0, 200) || '',
    description: descriptionParts.join('\n\n'),
    features,
    useCases,
    faqs: brandData.faqs || [],
    logo: null, // KnowledgeBrand has no logo field
    confidence: 0.8,
    snapshotVersion: `v1`,
    source: 'knowledge-hub',
    createdAt,
    updatedAt,
    industry: brandData.industry,
    website: brandData.website,
  };

  const manifest = buildManifestFromPackage(pkg, 'brand', baseUrl);

  // Override metadata with richer brand data
  manifest.metadata.title = brandData.name;
  manifest.metadata.description = brandData.description?.slice(0, 300) || '';
  manifest.metadata.og.title = brandData.name;
  manifest.metadata.og.description = brandData.description?.slice(0, 200) || '';
  manifest.metadata.twitter.title = brandData.name;
  manifest.metadata.twitter.description = brandData.description?.slice(0, 200) || '';
  manifest.metadata.keywords = [brandData.industry, brandData.name, 'brand'].filter(Boolean);

  return manifest;
}

/**
 * Batch rebuild all Brand manifests.
 */
export async function rebuildAllBrandManifests(
  getAllBrands: () => Promise<any[]>,
  baseUrl: string,
): Promise<PublishManifest[]> {
  const brands = await getAllBrands();
  const results: PublishManifest[] = [];

  for (const brand of brands) {
    const manifest = await buildManifestFromKnowledgeBrand(brand, baseUrl);
    if (manifest) results.push(manifest);
  }

  return results;
}
