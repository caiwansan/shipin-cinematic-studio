/**
 * Geo Components — 统一导出入口
 *
 * 基础 UI 组件从 `@/ui` 统一导出（G1 Consolidation）。
 * 领域级组件保持原有路径不变。
 *
 * Workspace 页面只能从本文件中引用领域级 Geo 组件。
 * 不得直接引用 `~/design-system/*` 或 `~/components/kmki-ui/*`。
 *
 * @see docs/reviews/RC1-DESIGN-SYSTEM-CONVERGENCE.md
 * @see workspaces/geo/ui/  — 统一 UI 层
 */

// ── 基础 UI 组件（从 @/ui 统一导出） ──
export {
  GeoBadge,
  GeoButton,
  GeoCard,
  GeoEmptyState,
  GeoMetricCard,
  GeoScoreCard,
} from 'workspaces/geo/ui'

// ── 领域级组件（保持原有路径） ──
export { default as GeoChartCard } from './GeoChartCard/index.vue'
export { default as GeoErrorState } from './GeoErrorState/index.vue'
export { default as GeoPageHeader } from './GeoPageHeader/index.vue'
export { default as GeoPageSkeleton } from './GeoPageSkeleton/index.vue'
export { default as GeoSectionHeader } from './GeoSectionHeader/index.vue'
export { default as GeoReportViewer } from './GeoReportViewer/index.vue'

// ── Geo Verification Pattern ──
export { default as GeoVerificationPattern } from './GeoVerificationPattern/index.vue'

// ── RC1-T005: AI Visibility Showcase ──
export { default as GeoShowcase } from './GeoShowcase/index.vue'
export { default as StatusBanner } from './GeoVerificationPattern/StatusBanner.vue'
export { default as EvidenceList } from './GeoVerificationPattern/EvidenceList.vue'

// Verification Pattern sub-components (for advanced usage)
export { default as VerificationSummary } from './GeoVerificationPattern/VerificationSummary.vue'
export { default as DimensionChanges } from './GeoVerificationPattern/DimensionChanges.vue'
export { default as ActionCompletion } from './GeoVerificationPattern/ActionCompletion.vue'
export { default as VerifiedItemsTable } from './GeoVerificationPattern/VerifiedItemsTable.vue'
export { default as RemainingIssuesList } from './GeoVerificationPattern/RemainingIssuesList.vue'
export { default as ConfidenceIndicator } from './GeoVerificationPattern/ConfidenceIndicator.vue'
export { default as VerificationTimeline } from './GeoVerificationPattern/VerificationTimeline.vue'
export { default as BreakdownBlock } from './GeoVerificationPattern/BreakdownBlock.vue'
export { default as NextActionsBlock } from './GeoVerificationPattern/NextActionsBlock.vue'

// Verification Pattern types
export type {
  VerificationReport,
  VerificationMeta,
  VerificationPayload,
  VerificationDimensionChanges,
  BreakdownSection,
  BreakdownType,
  VerifiedItem,
  RemainingIssue,
} from './GeoVerificationPattern/types'
