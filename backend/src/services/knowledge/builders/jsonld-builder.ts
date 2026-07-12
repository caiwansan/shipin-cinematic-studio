// ============================================================================
// KH-RC2 M2 — JSON-LD Builder
// 根据 Knowledge Package 自动生成 Schema.org 结构化数据
// ============================================================================

import {
  buildBrandPackage,
  buildProductPackage,
  buildOrganizationPackage,
  buildEntityPackage,
} from './package-builder';

import type {
  BrandPackage,
  ProductPackage,
  OrganizationPackage,
} from './package-builder';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Safely stringify a JSON-LD object, removing empty/null entries.
 */
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length === 0) continue;
    result[key] = value;
  }
  return result;
}

// ── Organization JSON-LD ────────────────────────────────────────────────────

/**
 * 构建 Organization JSON-LD
 * 调用 buildBrandPackage() 获取品牌数据，组装 Organization schema。
 * brands.forEach → 用 makesOffer 关联产品
 */
export async function buildOrganizationJsonLd(): Promise<object> {
  const brandPackages = await buildBrandPackage();
  const brands = Array.isArray(brandPackages) ? brandPackages : [brandPackages];

  if (brands.length === 0) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: '',
      description: '',
    };
  }

  // Use the first brand as the primary organization
  const primary = brands[0];

  // Collect all sameAs URLs from brands that have a website
  const sameAs: string[] = [];
  for (const brand of brands) {
    if (brand.website) {
      sameAs.push(brand.website);
    }
  }

  // Build makesOffer from products across all brands
  const makesOffer: object[] = [];
  for (const brand of brands) {
    for (const product of brand.products) {
      const offer: Record<string, unknown> = {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Product',
          name: product.name,
          description: product.description,
        },
      };
      if (product.pricing) {
        offer.price = product.pricing;
        offer.priceCurrency = 'CNY';
      }
      makesOffer.push(offer);
    }
  }

  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: primary.name,
    description: primary.description,
    url: primary.website ?? undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  };

  if (makesOffer.length > 0) {
    org.makesOffer = makesOffer;
  }

  // Add secondary brands as sub-organizations
  if (brands.length > 1) {
    const subOrganizations = brands.slice(1).map((brand) => ({
      '@type': 'Organization',
      name: brand.name,
      description: brand.description,
      url: brand.website ?? undefined,
    }));
    org.brand = subOrganizations.length === 1 ? subOrganizations[0] : subOrganizations;
  }

  return compact(org);
}

// ── Product JSON-LD ─────────────────────────────────────────────────────────

/**
 * 构建 Product JSON-LD
 * 调用 buildProductPackage(productId)
 * features 用数组，pricing 用 offers
 */
export async function buildProductJsonLd(productId?: string): Promise<object | object[]> {
  const productPackages = await buildProductPackage(productId);
  const products = Array.isArray(productPackages) ? productPackages : [productPackages];

  const results = products.map((product) => {
    const json: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description,
    };

    // Features as an array
    if (product.features.length > 0) {
      json.featureList = product.features;
    }

    // Pricing as offers
    if (product.pricing) {
      json.offers = {
        '@type': 'Offer',
        price: product.pricing,
        priceCurrency: 'CNY',
        availability: 'https://schema.org/InStock',
      };
    }

    return compact(json);
  });

  if (productId) {
    return results[0] ?? {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: '',
      description: '',
    };
  }

  return results;
}

// ── Article JSON-LD ─────────────────────────────────────────────────────────

/**
 * 构建 Article JSON-LD
 * 从 Repository 获取文章数据，组装 Article schema
 */
export async function buildArticleJsonLd(): Promise<object[]> {
  // Dynamic import to avoid circular dependency
  const { knowledgeRepository } = await import('../repository');
  const articles = await knowledgeRepository.getArticles();

  return articles.map((article) => {
    const json: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      articleBody: article.content,
      datePublished: article.createdAt.toISOString(),
      dateModified: article.updatedAt.toISOString(),
    };

    if (article.category) {
      json.articleSection = article.category;
    }

    return compact(json);
  });
}

// ── FAQ JSON-LD ─────────────────────────────────────────────────────────────

/**
 * 构建 FAQ JSON-LD
 * 目前 Repository 没有 FAQ 字段，返回空的 FAQPage schema
 */
export async function buildFaqJsonLd(): Promise<object> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [],
  };
}

// ── Breadcrumb JSON-LD ──────────────────────────────────────────────────────

/**
 * 构建 Breadcrumb JSON-LD
 * 接收 items 数组，组装 itemListElement
 * 每个元素: { @type: ListItem, position, item: { @id, name } }
 */
export async function buildBreadcrumbJsonLd(
  items: { name: string; url: string }[],
): Promise<object> {
  const itemListElement = items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: {
      '@id': item.url,
      name: item.name,
    },
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  };
}

// ── Full JSON-LD ────────────────────────────────────────────────────────────

/**
 * 构建完整的 JSON-LD 包
 * 合并所有类型为一个 @graph 数组，排除 null/empty
 */
export async function buildFullJsonLd(): Promise<object> {
  const [org, product, articles, faq] = await Promise.all([
    buildOrganizationJsonLd(),
    buildProductJsonLd(),
    buildArticleJsonLd(),
    buildFaqJsonLd(),
  ]);

  const graph: object[] = [];

  // Organization (always present, but skip if empty name)
  const orgObj = org as Record<string, unknown>;
  if (orgObj.name && orgObj.name !== '') {
    graph.push(orgObj);
  }

  // Product(s)
  if (Array.isArray(product)) {
    for (const p of product) {
      const pObj = p as Record<string, unknown>;
      if (pObj.name && pObj.name !== '') {
        graph.push(pObj);
      }
    }
  } else {
    const pObj = product as Record<string, unknown>;
    if (pObj.name && pObj.name !== '') {
      graph.push(pObj);
    }
  }

  // Articles
  for (const article of articles) {
    const aObj = article as Record<string, unknown>;
    if (aObj.headline && aObj.headline !== '') {
      graph.push(aObj);
    }
  }

  // FAQ (always included even if empty)
  graph.push(faq);

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
