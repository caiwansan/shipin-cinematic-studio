/**
 * Brand OS Design System — Barrel Export
 *
 * Exports all foundations, primitives, components, and patterns.
 * Workspace pages should only import from this barrel or from product-blocks.
 */

// Foundations
export * from './foundations'

// Primitives
export { default as DSButton } from './primitives/Button/index.vue'
export { default as DSInput } from './primitives/Input/index.vue'
export { default as DSCard } from './primitives/Card/index.vue'
export { default as DSBadge } from './primitives/Badge/index.vue'
export { default as DSAvatar } from './primitives/Avatar/index.vue'
export { default as DSTabs } from './primitives/Tabs/index.vue'
export { default as DSDialog } from './primitives/Dialog/index.vue'
export { default as DSTooltip } from './primitives/Tooltip/index.vue'
export { default as DSProgress } from './primitives/Progress/index.vue'
export { default as DSSkeleton } from './primitives/Skeleton/index.vue'
export { default as DSLayoutSpacer } from './primitives/Spacer/index.vue'
export { default as DSDivider } from './primitives/Divider/index.vue'
export { default as DSIcon } from './primitives/Icon/index.vue'
export { default as DSTypography } from './primitives/Typography/index.vue'

// Components
export { default as ScoreCard } from './components/ScoreCard/index.vue'
export { default as StatusIndicator } from './components/StatusIndicator/index.vue'
export { default as MetricCard } from './components/MetricCard/index.vue'
export { default as EmptyState } from './components/EmptyState/index.vue'
export { default as LoadingState } from './components/LoadingState/index.vue'
export { default as SuccessBanner } from './components/SuccessBanner/index.vue'
export { default as ErrorBanner } from './components/ErrorBanner/index.vue'
export { default as TrendChart } from './components/TrendChart/index.vue'
export { default as Timeline } from './components/Timeline/index.vue'
export { default as SearchBox } from './components/SearchBox/index.vue'
export { default as FilterBar } from './components/FilterBar/index.vue'
export { default as DataList } from './components/DataList/index.vue'
export { default as ConfirmDialog } from './components/ConfirmDialog/index.vue'

// Patterns
export * from './patterns/hero-action-proof-next'
export { useHoverExpandExplain } from './patterns/hover-expand-explain'
export type { HoverExpandState, HoverExpandOptions } from './patterns/hover-expand-explain'

// Product Blocks
export { default as HeroBlock } from './product-blocks/Hero/index.vue'
export { default as HealthSummaryBlock } from './product-blocks/HealthSummary/index.vue'
export { default as ExplanationPanelBlock } from './product-blocks/ExplanationPanel/index.vue'
export { default as RecommendationListBlock } from './product-blocks/RecommendationList/index.vue'
export { default as NextStepPanelBlock } from './product-blocks/NextStepPanel/index.vue'
export { default as ActionPanelBlock } from './product-blocks/ActionPanel/index.vue'
export { default as ImpactPreviewBlock } from './product-blocks/ImpactPreview/index.vue'
export { default as VerificationSummaryBlock } from './product-blocks/VerificationSummary/index.vue'
export { default as ProofPanelBlock } from './product-blocks/ProofPanel/index.vue'
export { default as DistributionOverviewBlock } from './product-blocks/DistributionOverview/index.vue'
export { default as ChannelListBlock } from './product-blocks/ChannelList/index.vue'
export { default as GrowthOverviewBlock } from './product-blocks/GrowthOverview/index.vue'
export { default as LearningSummaryBlock } from './product-blocks/LearningSummary/index.vue'
export { default as OpportunityBlockBlock } from './product-blocks/OpportunityBlock/index.vue'
export { default as MilestoneBannerBlock } from './product-blocks/MilestoneBanner/index.vue'
export { default as KnowledgeOverviewBlock } from './product-blocks/KnowledgeOverview/index.vue'

// Types
export type { ActionItem } from './product-blocks/ActionPanel/index.vue'
export type { ProofItem } from './product-blocks/ProofPanel/index.vue'
export type { LearningItem } from './product-blocks/LearningSummary/index.vue'
export type { ChannelInfo } from './product-blocks/ChannelList/index.vue'
