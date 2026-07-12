// ============================================================================
// KH-RC2 M4 — Knowledge Compiler
// 唯一的知识输出入口，所有调用方（API、GEO、Publishing、Benchmark）都只走 Compiler
// ============================================================================

import * as crypto from 'crypto';

import {
  buildBrandPackage,
  buildProductPackage,
  buildOrganizationPackage,
  buildEntityPackage,
} from '../builders/package-builder';

import type {
  BrandPackage,
  ProductPackage,
  OrganizationPackage,
  EntityPackage,
} from '../builders/package-builder';

import type {
  CanonicalFacts,
} from '../builders/prompt-builder';

import {
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildArticleJsonLd,
  buildFaqJsonLd,
  buildFullJsonLd,
} from '../builders/jsonld-builder';

import {
  buildLlmSummary,
  buildAiCitationBlock,
  buildRetrievalContext,
  buildCanonicalFacts,
  buildFaqPrompt,
} from '../builders/prompt-builder';

// ── 核心接口 ──────────────────────────────────────────────────────────────

export interface CompileOptions {
  /** 自定义版本号，默认自动生成 '1.0.0' */
  version?: string;
  /** 默认 true */
  includeProducts?: boolean;
  /** 默认 true */
  includeArticles?: boolean;
  /** 默认 true */
  includeEntities?: boolean;
  /** 默认 true */
  includePublications?: boolean;
  /** 默认 'json' */
  targetFormat?: 'json' | 'text';
}

export interface CompiledKnowledgePackage {
  meta: {
    version: string;          // SemVer
    compiledAt: string;       // ISO timestamp
    duration: number;         // 编译耗时(ms)
    contentHash: string;      // SHA-256 of the content
    sourceRevision: string;   // 固定 'v1.0.0'
  };
  summary: {
    brandCount: number;
    productCount: number;
    articleCount: number;
    entityCount: number;
    publicationCount: number;
    jsonLdCount: number;
    promptCount: number;
  };
  data: {
    brands: BrandPackage[];
    organization: OrganizationPackage | null;
    products: ProductPackage[];
    articles: any[];
    entities: EntityPackage[];
    publications: any[];
    jsonld: {
      organization: object | null;
      products: object | object[];
      articles: object[];
      faq: object;
      full: object;
    };
    prompts: {
      llmSummary: string;
      citationBlock: string;
      retrievalContext: string;
      canonicalFacts: CanonicalFacts[];
      faqPrompt: string;
    };
  };
}

// ── 默认选项 ──────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: CompileOptions = {
  version: '1.0.0',
  includeProducts: true,
  includeArticles: true,
  includeEntities: true,
  includePublications: true,
  targetFormat: 'json',
};

// ── 主编译入口 ────────────────────────────────────────────────────────────

/**
 * 主编译入口 — 所有知识输出都走这里
 *
 * 流程：
 * 1. 记录开始时间
 * 2. 并发调用所有 Builder
 * 3. 构造 summary
 * 4. 计算 contentHash（SHA-256）
 * 5. 计算 duration
 * 6. 返回 CompiledKnowledgePackage
 */
export async function compileKnowledgePackage(
  options?: CompileOptions,
): Promise<CompiledKnowledgePackage> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // ── 并发调用所有 Builder ──────────────────────────────────────────────

  const [
    brandResult,
    orgResult,
    productResult,
    entityResult,
    articleJsonLd,
    faqJsonLd,
    fullJsonLd,
    llmSummary,
    citationBlock,
    retrievalContext,
    canonicalFactsResult,
    faqPromptResult,
  ] = await Promise.all([
    buildBrandPackage(),
    buildOrganizationPackage(),
    buildProductPackage(),
    buildEntityPackage(),
    buildArticleJsonLd(),
    buildFaqJsonLd(),
    buildFullJsonLd(),
    buildLlmSummary(),
    buildAiCitationBlock(),
    buildRetrievalContext(),
    buildCanonicalFacts(),
    buildFaqPrompt(),
  ]);

  // ── 规范化数据 ────────────────────────────────────────────────────────

  const brands: BrandPackage[] = Array.isArray(brandResult) ? brandResult : [brandResult];
  const organization: OrganizationPackage | null = orgResult;
  const products: ProductPackage[] = Array.isArray(productResult) ? productResult : [productResult];
  const entities: EntityPackage[] = Array.isArray(entityResult) ? entityResult : [entityResult];

  // CanonicalFacts — buildCanonicalFacts returns a single object
  const canonicalFactsFlat: CanonicalFacts[] = [canonicalFactsResult];

  // ── Product JSON-LD ───────────────────────────────────────────────────

  const productJsonLd: object | object[] = productResult;

  // ── 计算 JSON-LD 数量 ────────────────────────────────────────────────

  const jsonLdArticleCount = Array.isArray(articleJsonLd) ? articleJsonLd.length : 0;
  const jsonLdProductCount = Array.isArray(productJsonLd) ? productJsonLd.length : 1;

  // ── 组装 data ────────────────────────────────────────────────────────

  const data: CompiledKnowledgePackage['data'] = {
    brands,
    organization,
    products: opts.includeProducts ? products : [],
    articles: opts.includeArticles ? articleJsonLd : [],
    entities: opts.includeEntities ? entities : [],
    publications: opts.includePublications ? [] : [],
    jsonld: {
      organization: ((fullJsonLd as any)['@graph'] as any[])?.[0] || null,
      products: opts.includeProducts ? productJsonLd : [],
      articles: opts.includeArticles ? articleJsonLd : [],
      faq: faqJsonLd,
      full: fullJsonLd,
    },
    prompts: {
      llmSummary,
      citationBlock,
      retrievalContext,
      canonicalFacts: canonicalFactsFlat,
      faqPrompt: faqPromptResult,
    },
  };

  // ── 计算 contentHash ──────────────────────────────────────────────────

  const contentHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');

  // ── 计算 duration ─────────────────────────────────────────────────────

  const duration = Date.now() - startTime;

  // ── 构造 summary ──────────────────────────────────────────────────────

  const summary: CompiledKnowledgePackage['summary'] = {
    brandCount: brands.length,
    productCount: products.length,
    articleCount: data.articles.length,
    entityCount: entities.length,
    publicationCount: 0,
    jsonLdCount: (data.jsonld.organization ? 1 : 0) + jsonLdProductCount + jsonLdArticleCount + 2, // faq + full
    promptCount: 5,
  };

  // ── 生成 version ─────────────────────────────────────────────────────

  const version = opts.version || '1.0.0';

  // ── 组装最终结果 ──────────────────────────────────────────────────────

  const result: CompiledKnowledgePackage = {
    meta: {
      version,
      compiledAt: new Date().toISOString(),
      duration,
      contentHash,
      sourceRevision: 'v1.0.0',
    },
    summary,
    data,
  };

  return result;
}

// ── 快速入口 ────────────────────────────────────────────────────────────

/**
 * 快速获取知识资产汇总（轻量级，不包含全文）
 */
export async function getKnowledgeSummary(): Promise<CompiledKnowledgePackage['summary']> {
  const org = await buildOrganizationPackage();

  return {
    brandCount: org.brands.length,
    productCount: org.totalProducts,
    articleCount: org.totalArticles,
    entityCount: org.totalEntities,
    publicationCount: 0,
    jsonLdCount: 0,
    promptCount: 0,
  };
}

/**
 * 快速获取 JSON-LD 输出
 */
export async function getJsonLdData(): Promise<CompiledKnowledgePackage['data']['jsonld']> {
  const pkg = await compileKnowledgePackage({
    includeProducts: true,
    includeArticles: true,
    includeEntities: true,
    includePublications: true,
  });
  return pkg.data.jsonld;
}

/**
 * 快速获取 Prompt 输出
 */
export async function getPromptData(): Promise<CompiledKnowledgePackage['data']['prompts']> {
  const pkg = await compileKnowledgePackage();
  return pkg.data.prompts;
}
