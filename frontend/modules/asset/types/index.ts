// ============================================================
// Asset Module — Type Definitions
// ============================================================

export const ASSET_TYPES = {
  BRAND: 'Brand',
  WEBSITE: 'Website',
  LANDING_PAGE: 'LandingPage',
  ARTICLE: 'Article',
  BLOG: 'Blog',
  NEWS: 'News',
  FAQ: 'FAQ',
  GLOSSARY: 'Glossary',
  WHITE_PAPER: 'WhitePaper',
  CASE_STUDY: 'CaseStudy',
  GUIDE: 'Guide',
  TUTORIAL: 'Tutorial',
  API: 'API',
  DOCUMENT: 'Document',
  FEATURE: 'Feature',
  PRICING: 'Pricing',
  SERVICE: 'Service',
  PRODUCT: 'Product',
  PROMPT: 'Prompt',
  WORKFLOW: 'Workflow',
  IMAGE: 'Image',
  VIDEO: 'Video',
  LOGO: 'Logo',
  SCHEMA: 'Schema',
  JSON_LD: 'JSONLD',
  METADATA: 'Metadata',
  SOCIAL_POST: 'SocialPost',
  EMAIL: 'Email',
  PDF: 'PDF',
  MARKDOWN: 'Markdown',
} as const

export type AssetType = typeof ASSET_TYPES[keyof typeof ASSET_TYPES]

export interface UnifiedAsset {
  id: string
  projectId: string
  type: string
  title: string
  language: string
  source: string | null
  sourceUrl: string | null
  content: string | null
  summary: string | null
  metadata: string | null
  hash: string | null
  status: string
  schemaVersion: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  tags?: { id: string; tag: string }[]
  versions?: { id: string; version: number; createdAt: string }[]
}

export interface AssetFilter {
  type?: string
  status?: string
  source?: string
  tag?: string
  search?: string
  language?: string
  limit?: number
  offset?: number
}

export interface AssetListResult {
  items: UnifiedAsset[]
  total: number
}

export interface AssetStats {
  total: number
  [key: string]: number
}

export interface AssetProvider {
  importAsset(source: string, type: string): Promise<UnifiedAsset>
  exportAsset(id: string): Promise<UnifiedAsset>
  getAsset(id: string): Promise<UnifiedAsset>
  listAssets(projectId: string, filter?: AssetFilter): Promise<AssetListResult>
  updateAsset(id: string, data: Partial<UnifiedAsset>): Promise<UnifiedAsset>
  deleteAsset(id: string): Promise<void>
}
