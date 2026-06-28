// ============================================================
// Brand GEO — Scanner Types
// ============================================================

export interface ScannerContext {
  url: string
  projectId: string
}

export interface ScanResult {
  title?: string
  description?: string
  language?: string
  robots?: Record<string, unknown>
  sitemap?: SitemapResult
  meta?: MetaResult
  openGraph?: Record<string, string>
  schema?: Record<string, unknown>
  jsonLd?: unknown[]
  pages?: PageResult[]
  images?: ImageResult[]
  scripts?: ScriptResult[]
  styles?: StyleResult[]
  headers?: Record<string, string>
  error?: string
}

export interface SitemapResult {
  urls: string[]
  count: number
}

export interface MetaResult {
  title: string
  description: string
  keywords?: string
  canonical?: string
  viewport?: string
  robots?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogUrl?: string
  twitterCard?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
}

export interface PageResult {
  url: string
  title: string
  depth: number
  type: string
}

export interface ImageResult {
  src: string
  alt?: string
  width?: number
  height?: number
  type?: string
}

export interface ScriptResult {
  src?: string
  type?: string
  async?: boolean
  defer?: boolean
  inline?: boolean
  contentLength?: number
}

export interface StyleResult {
  href?: string
  inline?: boolean
  media?: string
}

export type ScannerStep = (ctx: ScannerContext) => Promise<Partial<ScanResult>>
