// ════════════════════════════════════════════════════════════
// PublishManifest — Single Publishing Contract for RC3 Production
// ════════════════════════════════════════════════════════════
// All publishing components (Renderer / Generator / Sitemap / Feed / API)
// consume the Manifest only — no direct database reads.
// ════════════════════════════════════════════════════════════

// ====== Identity ======
export interface ManifestIdentity {
  type: 'brand' | 'entity' | 'topic' | 'faq' | 'claim';
  id: string;                // 内部 ID
  slug: string;              // 永久 URL slug（不包含数据库 ID）
  name: string;              // 显示名称
  canonicalUrl: string;      // 永久公开 URL
}

// ====== Routing ======
export interface ManifestRouting {
  path: string;              // /knowledge/brand/{slug}
  routeName: string;         // knowledge-brand
  params: Record<string, string>;
  version: number;           // 内容版本号
  updatedAt: string;         // ISO 时间
}

// ====== Content ======
export interface ManifestContentBlock {
  type: 'text' | 'markdown' | 'html' | 'list' | 'table' | 'code';
  label: string;             // 区块标题
  content: string;           // 原始内容
  rendered?: string;         // 渲染后的内容
  order: number;             // 排序
}

export interface ManifestContent {
  summary: string;           // 摘要（不超过 200 字）
  definition: string;        // 定义
  body: ManifestContentBlock[];
  features: string[];        // 关键特征
  useCases: string[];        // 用例
  timeline?: { date: string; event: string }[];  // 时间线
}

// ====== Structured Data ======
export interface ManifestStructuredData {
  jsonld: Record<string, any>[];  // 完整的 JSON-LD 对象数组
  schemaTypes: string[];          // 用到的 Schema.org 类型
  entityGraph?: Record<string, any>;  // 知识图谱
}

// ====== Metadata ======
export interface ManifestMetadata {
  title: string;
  description: string;
  keywords: string[];
  lang: string;
  og: {
    title: string;
    description: string;
    image?: string;
    url: string;
    type: string;
  };
  twitter: {
    card: string;
    title: string;
    description: string;
    image?: string;
  };
  canonical: string;
  hreflang?: { lang: string; url: string }[];
  robots: string;
}

// ====== Discoverability ======
export interface ManifestDiscoverability {
  inSitemap: boolean;
  sitemapPriority: number;    // 0.0 - 1.0
  sitemapChangefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  inFeed: boolean;
  feedType: 'knowledge' | 'brand' | 'entity' | 'faq';
  llmsSection: string;        // llms.txt 章节名
  links: { rel: string; href: string; title?: string }[];
}

// ====== Assets ======
export interface ManifestAsset {
  type: 'image' | 'video' | 'document' | 'external';
  url: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface ManifestAssets {
  primary?: ManifestAsset;   // 主图/Logo
  gallery: ManifestAsset[];
  attachments: ManifestAsset[];
}

// ====== Publishing ======
export interface ManifestPublishing {
  status: 'draft' | 'published' | 'archived';
  publishedAt?: string;
  lastVerifiedAt?: string;
  confidence: number;
  snapshotVersion: string;
  source: string;             // 知识来源标识
  replayId?: string;          // 关联的 Replay
}

// ====== Version ======
export interface ManifestVersion {
  manifestVersion: string;    // 契约本身版本（当前 = "1.0.0"）
  contentVersion: number;     // 内容递增版本
  hash: string;               // SHA-256 内容哈希
  compiledAt: string;         // 编译时间
  compilerVersion: string;    // Compiler 版本
}

// ====== 主类型 ======
export interface PublishManifest {
  identity: ManifestIdentity;
  routing: ManifestRouting;
  content: ManifestContent;
  structuredData: ManifestStructuredData;
  metadata: ManifestMetadata;
  discoverability: ManifestDiscoverability;
  assets: ManifestAssets;
  publishing: ManifestPublishing;
  version: ManifestVersion;
}
