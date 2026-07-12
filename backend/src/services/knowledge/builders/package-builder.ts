// ============================================================================
// KH-RC2 M1 — Knowledge Package Builder
// 将 Repository 中的数据结构编译为可导出的知识包
// ============================================================================

import { knowledgeRepository } from '../repository';

// ── 包类型定义 ──────────────────────────────────────────────────────────────

export interface BrandPackage {
  id: string;
  name: string;
  industry: string;
  description: string;
  website: string | null;
  mission: string | null;
  vision: string | null;
  values: string[];
  products: ProductPackage[];
  createdAt: string;
}

export interface ProductPackage {
  id: string;
  name: string;
  description: string;
  features: string[];
  pricing: string | null;
  useCases: string[];
  faq: FaqItem[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface OrganizationPackage {
  brands: BrandPackage[];
  totalProducts: number;
  totalArticles: number;
  totalEntities: number;
  exportedAt: string;
}

export interface EntityPackage {
  id: string;
  type: string;
  name: string;
  aliases: string[];
  description: string;
  relations: RelationItem[];
}

export interface RelationItem {
  type: string;
  targetId?: string;
  targetName?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * 将 Repository Product 记录转换为 ProductPackage
 * FAQ 暂不支持（Repository 无对应字段），返回空数组
 */
function toProductPackage(product: Awaited<ReturnType<typeof knowledgeRepository.getProduct>>): ProductPackage {
  if (!product) {
    throw new Error('Product not found');
  }
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    features: Array.isArray(product.features) ? product.features as string[] : [],
    pricing: product.pricing ?? null,
    useCases: Array.isArray(product.useCases) ? product.useCases as string[] : [],
    faq: [],
  };
}

/**
 * 将 Repository Brand 记录转换为 BrandPackage（含产品列表）
 */
function toBrandPackage(
  brand: NonNullable<Awaited<ReturnType<typeof knowledgeRepository.getBrand>>>,
  products: Awaited<ReturnType<typeof knowledgeRepository.getProducts>>,
): BrandPackage {
  const brandProducts = products.filter((p) => p.brandId === brand.id);
  return {
    id: brand.id,
    name: brand.name,
    industry: brand.industry,
    description: brand.description,
    website: brand.website ?? null,
    mission: brand.mission ?? null,
    vision: brand.vision ?? null,
    values: Array.isArray(brand.values) ? brand.values as string[] : [],
    products: brandProducts.map(toProductPackage),
    createdAt: brand.createdAt.toISOString(),
  };
}

/**
 * 将 Repository Entity 记录转换为 EntityPackage
 * relations 从 JSON 字段直接转换
 */
function toEntityPackage(
  entity: NonNullable<Awaited<ReturnType<typeof knowledgeRepository.getEntity>>>,
): EntityPackage {
  const rawRelations = Array.isArray(entity.relations) ? entity.relations as Array<Record<string, unknown>> : [];
  const relations: RelationItem[] = rawRelations.map((r) => ({
    type: String(r.type ?? ''),
    targetId: r.targetId != null ? String(r.targetId) : undefined,
    targetName: r.targetName != null ? String(r.targetName) : undefined,
  }));

  return {
    id: entity.id,
    type: entity.type,
    name: entity.name,
    aliases: Array.isArray(entity.aliases) ? entity.aliases as string[] : [],
    description: entity.description,
    relations,
  };
}

// ── 导出函数 ──────────────────────────────────────────────────────────────

/**
 * 构建品牌知识包
 * @param brandId 可选，指定品牌 ID 则返回单个包，否则返回全部品牌包
 */
export async function buildBrandPackage(brandId?: string): Promise<BrandPackage | BrandPackage[]> {
  const allProducts = await knowledgeRepository.getProducts();

  if (brandId) {
    const brand = await knowledgeRepository.getBrand(brandId);
    if (!brand) {
      throw new Error(`Brand not found: ${brandId}`);
    }
    return toBrandPackage(brand, allProducts);
  }

  const brands = await knowledgeRepository.getBrands();
  return brands.map((brand) => toBrandPackage(brand, allProducts));
}

/**
 * 构建产品知识包
 * @param productId 可选，指定产品 ID 则返回单个包，否则返回全部产品包
 */
export async function buildProductPackage(productId?: string): Promise<ProductPackage | ProductPackage[]> {
  if (productId) {
    const product = await knowledgeRepository.getProduct(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }
    return toProductPackage(product);
  }

  const products = await knowledgeRepository.getProducts();
  return products.map(toProductPackage);
}

/**
 * 构建组织知识包 —— 包含所有品牌、产品、文章、实体的统计概览
 */
export async function buildOrganizationPackage(): Promise<OrganizationPackage> {
  const [brands, productCount, articleCount, entityCount] = await Promise.all([
    knowledgeRepository.getBrands(),
    knowledgeRepository.getProductCount(),
    knowledgeRepository.getArticleCount(),
    knowledgeRepository.getEntityCount(),
  ]);

  const allProducts = await knowledgeRepository.getProducts();
  const brandPackages = brands.map((brand) => toBrandPackage(brand, allProducts));

  return {
    brands: brandPackages,
    totalProducts: productCount,
    totalArticles: articleCount,
    totalEntities: entityCount,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * 构建实体知识包
 * @param entityId 可选，指定实体 ID 则返回单个包，否则返回全部实体包
 */
export async function buildEntityPackage(entityId?: string): Promise<EntityPackage | EntityPackage[]> {
  if (entityId) {
    const entity = await knowledgeRepository.getEntity(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }
    return toEntityPackage(entity);
  }

  const entities = await knowledgeRepository.getEntities();
  return entities.map(toEntityPackage);
}
