// AI Knowledge Hub — Domain Types (v1.0)
// 2026-07-02

export interface KnowledgeBrand {
  id: string;
  name: string;
  industry: string;
  description: string;
  website?: string;
  mission?: string;
  vision?: string;
  values?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeProduct {
  id: string;
  brandId: string;
  name: string;
  description: string;
  features: string[];
  pricing?: string;
  useCases?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeArticle {
  id: string;
  type: 'article' | 'white_paper' | 'case_study' | 'glossary' | 'documentation' | 'news';
  title: string;
  content: string;
  category?: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  articleCount: number;
}

export interface KnowledgeEntity {
  id: string;
  type: string;
  name: string;
  aliases: string[];
  description: string;
  relations: Array<{ targetEntityId: string; targetEntityName: string; relationType: string }>;
  knowledgeSignals: Array<{ type: string; text: string; importance: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgePublication {
  id: string;
  type: string;
  status: 'pending' | 'published' | 'failed';
  target: string;
  content?: string;
  publishedAt?: string;
  createdAt: string;
}

export interface KnowledgeDashboardMetrics {
  aiReadiness: number;
  knowledgeCompleteness: number;
  publishedAssets: number;
  entityCount: number;
  structuredData: number;
  articleCount: number;
  brandCount: number;
  productCount: number;
  recentUpdates: number;
  overview: {
    totalBrands: number;
    totalProducts: number;
    totalArticles: number;
    totalEntities: number;
    totalPublications: number;
    latestActivity: string;
  };
  readiness: {
    knowledgeScore: number;
    schemaCoverage: number;
    faqCoverage: number;
    evidenceCoverage: number;
    entityCoverage: number;
    authorityCoverage: number;
    contentFreshness: number;
  };
}
