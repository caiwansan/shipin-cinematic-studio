// ============================================================================
// KH-RC2 M3 — Prompt Block Builder
// 生成 LLM 可直接消费的知识块，支撑 AI 对品牌的检索、理解和引用
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
} from './package-builder';

// ── 类型定义 ──────────────────────────────────────────────────────────────

export interface CanonicalFacts {
  brandName: string;
  industry: string;
  description: string;
  website: string | null;
  products: { name: string; description: string }[];
}

// ── 内部工具 ──────────────────────────────────────────────────────────────

/**
 * 获取单个 BrandPackage，若 brandId 未指定则取第一个品牌包
 */
async function resolveBrandPackage(brandId?: string): Promise<BrandPackage> {
  const result = await buildBrandPackage(brandId);
  if (Array.isArray(result)) {
    if (result.length === 0) {
      throw new Error('未找到品牌数据');
    }
    return result[0];
  }
  return result;
}

/**
 * 获取单个 ProductPackage 数组（品牌下的所有产品包）
 */
async function resolveProductPackages(brandId?: string): Promise<ProductPackage[]> {
  const brand = await resolveBrandPackage(brandId);
  return brand.products;
}

// ── Prompt Block 生成函数 ──────────────────────────────────────────────────

/**
 * LLM Summary
 * 生成品牌一句话摘要，长度控制在 200 tokens 以内。
 * 格式：[品牌名] 是一家专注于 [行业] 的公司，核心产品是 [产品名]，提供 [核心功能摘要]。
 */
export async function buildLlmSummary(brandId?: string): Promise<string> {
  const brand = await resolveBrandPackage(brandId);
  const products = brand.products;

  if (products.length === 0) {
    return `${brand.name} 是一家专注于 ${brand.industry} 的公司。`;
  }

  // 取第一个产品的核心功能摘要（最多 3 个 feature）
  const primary = products[0];
  const featureSummary = primary.features.length > 0
    ? primary.features.slice(0, 3).join('、')
    : primary.description;

  return `${brand.name} 是一家专注于 ${brand.industry} 的公司，核心产品是 ${primary.name}，提供 ${featureSummary}。`;
}

/**
 * AI Citation Block
 * 生成可被 AI 引用的标准化信息块。
 */
export async function buildAiCitationBlock(brandId?: string): Promise<string> {
  const brand = await resolveBrandPackage(brandId);
  const products = brand.products;
  const org = await buildOrganizationPackage();
  const entities = await resolveEntityCount();

  const lines: string[] = [];
  lines.push(`# ${brand.name}`);
  lines.push(`行业: ${brand.industry}`);
  lines.push(`描述: ${brand.description}`);
  lines.push(`官网: ${brand.website ?? '暂无'}`);
  lines.push('---');
  lines.push('产品:');
  for (const p of products) {
    const features = p.features.length > 0 ? p.features.join('、') : p.description;
    lines.push(`- ${p.name}: ${features}`);
  }
  lines.push('---');
  lines.push(`知识: ${org.totalArticles} 篇`);
  lines.push(`实体: ${entities} 个`);

  return lines.join('\n');
}

/**
 * Retrieval Context
 * 生成 Markdown 格式的上下文文本，适合 RAG 检索。
 */
export async function buildRetrievalContext(brandId?: string): Promise<string> {
  const brand = await resolveBrandPackage(brandId);
  const products = brand.products;
  const articles = await resolveArticles();

  const lines: string[] = [];
  lines.push(`## ${brand.name}`);
  lines.push('');
  lines.push(brand.description);
  lines.push('');

  if (products.length > 0) {
    lines.push('### 产品');
    for (const p of products) {
      lines.push(`${p.name}: ${p.description}`);
    }
    lines.push('');
  }

  if (articles.length > 0) {
    lines.push('### 知识');
    for (const a of articles) {
      lines.push(`- ${a.title}`);
    }
  }

  return lines.join('\n');
}

/**
 * Canonical Facts
 * 生成 JSON 格式的不可变事实，适合 AI 直接解析。
 */
export async function buildCanonicalFacts(brandId?: string): Promise<CanonicalFacts> {
  const brand = await resolveBrandPackage(brandId);
  const products = brand.products;

  return {
    brandName: brand.name,
    industry: brand.industry,
    description: brand.description,
    website: brand.website,
    products: products.map((p) => ({
      name: p.name,
      description: p.description,
    })),
  };
}

/**
 * FAQ Prompt
 * 生成常见问答的 LLM 友好格式。
 * 目前 Repository 没有 FAQ 字段，返回 "暂无 FAQ 数据"。
 */
export async function buildFaqPrompt(brandId?: string): Promise<string> {
  const brand = await resolveBrandPackage(brandId);
  const products = brand.products;

  // 检查是否有 FAQ 数据（ProductPackage 的 faq 字段目前始终为空）
  const hasFaq = products.some((p) => p.faq && p.faq.length > 0);

  if (!hasFaq) {
    return `常见问题（${brand.name}）:\n暂无 FAQ 数据。`;
  }

  const lines: string[] = [];
  lines.push(`常见问题（${brand.name}）:`);
  for (const p of products) {
    for (const faq of p.faq) {
      lines.push(`Q: ${faq.question}`);
      lines.push(`A: ${faq.answer}`);
    }
  }

  return lines.join('\n');
}

// ── 辅助工具 ──────────────────────────────────────────────────────────────

/**
 * 从 Repository 获取实体总数
 */
async function resolveEntityCount(): Promise<number> {
  try {
    const entityResult = await buildEntityPackage();
    if (Array.isArray(entityResult)) {
      return entityResult.length;
    }
    return 1;
  } catch {
    return 0;
  }
}

/**
 * 从 Repository 获取所有文章标题
 */
async function resolveArticles(): Promise<{ title: string }[]> {
  try {
    // 动态 import 避免循环依赖
    const { knowledgeRepository } = await import('../repository');
    const articles = await knowledgeRepository.getArticles();
    return articles.map((a) => ({ title: a.title }));
  } catch {
    return [];
  }
}
