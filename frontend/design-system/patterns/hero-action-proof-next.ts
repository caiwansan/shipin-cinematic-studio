/**
 * Brand OS Design System — Hero → Action/Content → Proof/Evidence → Next Step
 * DS-9 Product Pattern — Page Skeleton Layout
 *
 * This pattern defines the standard layout for all GEO/workspace pages.
 * It exports layout constants and a composable for page structure configuration.
 *
 * Each page follows: Hero → Explanation → Action/Content → Evidence/Detail → Next Step
 * Reference: BRAND_OS_DESIGN_SYSTEM.md DS-9.1
 */

export interface PageLayoutBlock {
  /** Unique block identifier */
  id: string
  /** Visual weight / importance (higher = more prominent) */
  priority: number
  /** Which layout mode to use */
  mode: PageLayoutMode
}

export type PageLayoutMode =
  | 'hero-action-proof-next'
  | 'hero-split-cta'
  | 'hero-full-cta'
  | 'hero-split-full-cta'

export interface PageLayoutConfig {
  /** Page identifier */
  page: string
  /** Ordered list of blocks to render */
  blocks: PageLayoutBlock[]
  /** Layout mode (defaults from DS-2.2) */
  mode: PageLayoutMode
  /** Whether to show navigation sidebar */
  sidebar: boolean
}

/**
 * Layout mode definitions from DS-2.2
 *
 * - Hero → Split → CTA: Health, Recommendations
 * - Hero → Full → CTA: Verification, Publishing
 * - Hero → Split → Full → CTA: Growth, Knowledge
 */
export const LAYOUT_MODES: Record<string, PageLayoutMode> = {
  health: 'hero-split-cta',
  recommendations: 'hero-split-cta',
  verification: 'hero-full-cta',
  publishing: 'hero-full-cta',
  growth: 'hero-split-full-cta',
  knowledge: 'hero-split-full-cta',
} as const

/**
 * Default block priorities for the Hero → Action → Proof → Next pattern
 */
export const BLOCK_PRIORITIES = {
  hero: 100,
  explanation: 80,
  action: 60,
  content: 60,
  evidence: 40,
  detail: 40,
  nextStep: 20,
} as const

/**
 * Create a page layout configuration for the standard pattern.
 *
 * @param page - Page identifier (health, recommendations, etc.)
 * @param blocks - Block IDs in display order
 * @param sidebar - Whether sidebar is shown (default true)
 */
export function createPageLayout(
  page: string,
  blocks: string[],
  sidebar = true,
): PageLayoutConfig {
  const mode = LAYOUT_MODES[page] || 'hero-action-proof-next'

  const pageBlocks: PageLayoutBlock[] = blocks.map((id, index) => ({
    id,
    priority: BLOCK_PRIORITIES[id as keyof typeof BLOCK_PRIORITIES] || 50,
    mode,
  }))

  return {
    page,
    blocks: pageBlocks,
    mode,
    sidebar,
  }
}

/**
 * Determine CSS grid template areas based on layout mode.
 *
 * Returns a template-areas string for CSS Grid.
 */
export function getLayoutTemplate(mode: PageLayoutMode): string {
  switch (mode) {
    case 'hero-action-proof-next':
      return `
        "hero hero"
        "explanation explanation"
        "action evidence"
        "nextStep nextStep"
      `
    case 'hero-split-cta':
      return `
        "hero hero"
        "left right"
        "cta cta"
      `
    case 'hero-full-cta':
      return `
        "hero hero"
        "full full"
        "cta cta"
      `
    case 'hero-split-full-cta':
      return `
        "hero hero"
        "left right"
        "full full"
        "cta cta"
      `
    default:
      return `
        "hero hero"
        "content content"
      `
  }
}

/**
 * CSS grid column definitions based on layout mode.
 */
export function getLayoutColumns(mode: PageLayoutMode): string {
  switch (mode) {
    case 'hero-split-cta':
    case 'hero-split-full-cta':
      return '1fr 1fr'
    default:
      return '1fr'
  }
}

/**
 * Responsive breakpoints from DS-2.3
 */
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1440,
} as const
