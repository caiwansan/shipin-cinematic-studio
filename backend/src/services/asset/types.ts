// Asset type categories
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

export interface AssetData {
  projectId: string
  type: string
  title: string
  language?: string
  source?: string
  sourceUrl?: string
  content?: string
  summary?: string
  metadata?: Record<string, unknown>
  hash?: string
  status?: string
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
  projectId?: string
}

export interface StructuredBlock {
  type: string
  title: string
  content: string
  metadata?: Record<string, unknown>
  sourceUrl?: string
}

export interface RawDocumentData {
  projectId: string
  url: string
  mime?: string
  headers?: Record<string, string>
  html?: string
  markdown?: string
  text?: string
  status?: number
  fetchedAt?: Date
}

// Event types
export type AssetEventType = 'created' | 'updated' | 'deleted' | 'versioned'

export interface AssetEvent {
  type: AssetEventType
  assetId: string
  projectId: string
  timestamp: Date
  data?: Record<string, unknown>
}
