// AI Knowledge Hub — Types

export interface Brand {
  id: string;
  name: string;
  industry: string;
  description: string;
  website?: string;
  logo?: string;
  mission?: string;
  vision?: string;
  values?: string[];
  timeline?: TimelineEvent[];
  faq?: FaqItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  date: string;
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface Product {
  id: string;
  brandId: string;
  name: string;
  description: string;
  features: string[];
  pricing?: string;
  useCases?: string[];
  faq?: FaqItem[];
  documentation?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeArticle {
  id: string;
  type: 'article' | 'white_paper' | 'case_study' | 'glossary' | 'documentation' | 'news' | 'press_release' | 'faq' | 'tutorial';
  title: string;
  content: string;
  category?: string;
  tags: string[];
  version: string;
  status: 'draft' | 'published' | 'archived';
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

export interface Entity {
  id: string;
  type: 'Brand' | 'Company' | 'Product' | 'Founder' | 'Technology' | 'Industry' | 'Certification' | 'Partner' | 'Customer' | 'Competitor' | 'Location';
  name: string;
  aliases: string[];
  description: string;
  relations: EntityRelation[];
  knowledgeSignals: KnowledgeSignal[];
  createdAt: string;
  updatedAt: string;
}

export interface EntityRelation {
  targetEntityId: string;
  targetEntityName: string;
  relationType: string;
}

export interface KnowledgeSignal {
  type: string;
  text: string;
  importance: 'High' | 'Medium' | 'Low';
}

export interface Publication {
  id: string;
  type: 'jsonld' | 'opengraph' | 'faq_schema' | 'organization_schema' | 'software_schema' | 'rss' | 'sitemap';
  status: 'pending' | 'published' | 'failed';
  target: string;
  content?: string;
  publishedAt?: string;
  createdAt: string;
}

export interface DashboardMetrics {
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
