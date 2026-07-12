import { compileKnowledgePackage } from '../../../knowledge/compiler/index';
import type { CompiledKnowledgePackage } from '../../../knowledge/compiler/index';

export interface DiscoveryContext {
  packageVersion: string;
  snapshotHash: string;
  brands: any[];
  knowledgeCount: number;
  entityCount: number;
  compiledAt: string;
}

/**
 * 从 Knowledge Compiler 获取 Discovery Context
 * 取代原有 MockScanner/Repository 直接读取方式
 */
export async function getDiscoveryContext(): Promise<DiscoveryContext> {
  const pkg = await compileKnowledgePackage({
    version: '1.0.0',
    includeProducts: true,
    includeArticles: true,
    includeEntities: true,
    includePublications: true,
  });

  return {
    packageVersion: pkg.meta.version,
    snapshotHash: pkg.meta.contentHash,
    brands: pkg.data.brands || [],
    knowledgeCount: pkg.summary.articleCount,
    entityCount: pkg.summary.entityCount,
    compiledAt: pkg.meta.compiledAt,
  };
}

export async function getBrandContext(brandId?: string): Promise<any> {
  const pkg = await compileKnowledgePackage();
  const brands = pkg.data.brands;
  if (brandId) {
    return brands.find((b: any) => b.id === brandId) || null;
  }
  return brands;
}
