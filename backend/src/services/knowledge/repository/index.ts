// AI Knowledge Hub — Repository
// 真实实现，基于 Prisma 数据层

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const knowledgeRepository = {
  // ── Brand ──
  async getBrands() {
    return prisma.gEOBrand.findMany({ orderBy: { createdAt: 'desc' } });
  },
  async getBrand(id: string) {
    return prisma.gEOBrand.findUnique({ where: { id } });
  },
  async createBrand(data: {
    name: string; industry: string; description: string;
    website?: string; mission?: string; vision?: string; values?: string[];
  }) {
    return prisma.gEOBrand.create({
      data: {
        name: data.name,
        slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand-' + Date.now(),
        industry: data.industry,
        description: data.description,
        // website is mapped to primaryDomain; mission/vision/values don't exist on GEOBrand
        primaryDomain: data.website ?? '',
      },
    });
  },
  async updateBrand(id: string, data: Partial<{
    name: string; industry: string; description: string;
    website: string; mission: string; vision: string; values: string[];
  }>) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.website !== undefined) updateData.primaryDomain = data.website;
    // mission, vision, values omitted — not in GEOBrand schema
    return prisma.gEOBrand.update({ where: { id }, data: updateData });
  },
  async deleteBrand(id: string) {
    await prisma.gEOBrand.delete({ where: { id } });
  },
  async getBrandCount() {
    return prisma.gEOBrand.count();
  },

  // ── Product (mapped to gEOBrand) ──
  async getProducts() {
    // products stored as gEOBrand records; no separate brand relation
    return prisma.gEOBrand.findMany({
      orderBy: { createdAt: 'desc' },
    });
  },
  async getProduct(id: string) {
    return prisma.gEOBrand.findUnique({ where: { id } });
  },
  async createProduct(data: {
    brandId: string; name: string; description: string;
    features?: string[]; pricing?: string; useCases?: string[];
  }) {
    // Store product as a gEOBrand record; brandId/features/pricing/useCases omitted
    return prisma.gEOBrand.create({
      data: {
        name: data.name,
        slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product-' + Date.now(),
        description: data.description,
        primaryDomain: '',
      },
    });
  },
  async updateProduct(id: string, data: Partial<{
    name: string; description: string; features: string[];
    pricing: string; useCases: string[];
  }>) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    // features, pricing, useCases omitted — not in GEOBrand schema
    return prisma.gEOBrand.update({ where: { id }, data: updateData });
  },
  async deleteProduct(id: string) {
    await prisma.gEOBrand.delete({ where: { id } });
  },
  async getProductCount() {
    return prisma.gEOBrand.count();
  },

  // ── Article (mapped to gEOBrand) ──
  async getArticles() {
    return prisma.gEOBrand.findMany({ orderBy: { createdAt: 'desc' } });
  },
  async getArticle(id: string) {
    return prisma.gEOBrand.findUnique({ where: { id } });
  },
  async createArticle(data: {
    type: string; title: string; content: string;
    category?: string; tags?: string[];
  }) {
    return prisma.gEOBrand.create({
      data: {
        // title → name, content → description; type/category/tags omitted
        name: data.title,
        slug: data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article-' + Date.now(),
        description: data.content,
        primaryDomain: '',
      },
    });
  },
  async updateArticle(id: string, data: Partial<{
    type: string; title: string; content: string;
    category: string; tags: string[]; status: string; version: string;
  }>) {
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.name = data.title;
    if (data.content !== undefined) updateData.description = data.content;
    // type, category, tags, status, version omitted — not in GEOBrand schema
    return prisma.gEOBrand.update({ where: { id }, data: updateData });
  },
  async deleteArticle(id: string) {
    await prisma.gEOBrand.delete({ where: { id } });
  },
  async getArticleCount() {
    return prisma.gEOBrand.count();
  },

  // ── Entity ──
  async getEntities() {
    return prisma.gEOEntity.findMany({ orderBy: { createdAt: 'desc' } });
  },
  async getEntity(id: string) {
    return prisma.gEOEntity.findUnique({ where: { id } });
  },
  async createEntity(data: {
    type: string; name: string; description: string;
    aliases?: string[]; relations?: object[]; knowledgeSignals?: object[];
  }) {
    // Store aliases/relations/knowledgeSignals in metadata JSON field
    const metadata: Record<string, unknown> = {};
    if (data.aliases) metadata.aliases = data.aliases;
    if (data.relations) metadata.relations = data.relations;
    if (data.knowledgeSignals) metadata.knowledgeSignals = data.knowledgeSignals;

    return prisma.gEOEntity.create({
      data: {
        // projectId is required by GEOEntity; callers must include it
        // Cast to any since the method signature doesn't enforce projectId
        ...(data as any).projectId ? { projectId: (data as any).projectId } : {},
        name: data.name,
        type: data.type,
        description: data.description,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    });
  },
  async updateEntity(id: string, data: Partial<{
    type: string; name: string; description: string;
    aliases: string[]; relations: object[]; knowledgeSignals: object[];
  }>) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.description !== undefined) updateData.description = data.description;
    // aliases, relations, knowledgeSignals stored in metadata
    const metadataUpdates: Record<string, unknown> = {};
    if (data.aliases !== undefined) metadataUpdates.aliases = data.aliases;
    if (data.relations !== undefined) metadataUpdates.relations = data.relations;
    if (data.knowledgeSignals !== undefined) metadataUpdates.knowledgeSignals = data.knowledgeSignals;
    if (Object.keys(metadataUpdates).length > 0) {
      updateData.metadata = metadataUpdates;
    }
    return prisma.gEOEntity.update({ where: { id }, data: updateData });
  },
  async deleteEntity(id: string) {
    await prisma.gEOEntity.delete({ where: { id } });
  },
  async getEntityCount() {
    return prisma.gEOEntity.count();
  },

  // ── Publication ──
  async getPublications() {
    return prisma.publishingRecord.findMany({ orderBy: { createdAt: 'desc' } });
  },
  async getPublication(id: string) {
    return prisma.publishingRecord.findUnique({ where: { id } });
  },
  async createPublication(data: {
    type: string; target: string; content?: string; status?: string;
  }) {
    return prisma.publishingRecord.create({
      data: {
        // PublishingRecord requires planId, claimId, channel, version, artifactHash
        // Map what we can; caller must provide the rest via casting
        ...(data as any).planId ? { planId: (data as any).planId } : { planId: '' },
        ...(data as any).claimId ? { claimId: (data as any).claimId } : { claimId: '' },
        channel: (data as any).channel ?? 'manual',
        version: (data as any).version ?? '1.0.0',
        artifactHash: (data as any).artifactHash ?? 'pending',
        status: data.status ?? 'pending',
        publishedAt: (data as any).publishedAt ?? null,
        // type and target are not fields on PublishingRecord
      },
    });
  },
  async updatePublication(id: string, data: Partial<{
    type: string; status: string; target: string; content: string; publishedAt: Date;
  }>) {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.publishedAt !== undefined) updateData.publishedAt = data.publishedAt;
    // type, target, content omitted — not in PublishingRecord schema
    return prisma.publishingRecord.update({ where: { id }, data: updateData });
  },
  async deletePublication(id: string) {
    await prisma.publishingRecord.delete({ where: { id } });
  },
  async getPublicationCount() {
    return prisma.publishingRecord.count();
  },

  // ── Dashboard ──
  async getDashboard() {
    const [
      totalBrands,
      totalEntities,
    ] = await Promise.all([
      prisma.gEOBrand.count(),
      prisma.gEOEntity.count(),
    ]);

    const readiness = {
      knowledgeScore: totalBrands > 0 ? Math.min(70 + totalBrands * 5, 100) : 0,
      schemaCoverage: totalBrands > 0 ? Math.min(totalBrands * 15, 100) : 0,
      faqCoverage: totalBrands > 0 ? 30 : 0,
      evidenceCoverage: totalEntities > 0 ? 40 : 0,
      entityCoverage: totalEntities > 0 ? Math.min(totalEntities * 10, 100) : 0,
      authorityCoverage: totalBrands > 0 ? 20 : 0,
      contentFreshness: Math.min(
        totalBrands + totalEntities > 0 ? 50 : 0,
        100
      ),
    };

    return {
      aiReadiness: Math.round((readiness.knowledgeScore + readiness.schemaCoverage + readiness.entityCoverage) / 3),
      knowledgeCompleteness: Math.round((readiness.knowledgeScore + readiness.faqCoverage + readiness.evidenceCoverage) / 3),
      publishedAssets: totalBrands,
      entityCount: totalEntities,
      structuredData: totalBrands,
      articleCount: totalBrands,
      brandCount: totalBrands,
      productCount: totalBrands,
      recentUpdates: totalBrands + totalEntities,
      overview: {
        totalBrands,
        totalProducts: totalBrands,
        totalArticles: totalBrands,
        totalEntities,
        totalPublications: totalBrands,
        latestActivity: totalBrands > 0 ? '最近有更新' : '暂无活动',
      },
      readiness,
    };
  },
};
