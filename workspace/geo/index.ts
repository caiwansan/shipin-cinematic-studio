/**
 * GEO Workspace — Barrel export.
 *
 * Single entry point for all GEO workspace modules.
 *
 * @package workspace/geo
 */

// Tokens
export { GEOTokens } from './tokens/geo-tokens';
export type { GEOTokenColor, GEOTokenSpacing, GEOTokenRadius } from './tokens/geo-tokens';

// Stores
export { createGeoStore } from './stores/useGeoStore';
export type {
  GeoStore,
  GEOPage,
  ViewMode,
  GEOFilterState,
  GEOPaginationState,
} from './stores/useGeoStore';
export {
  createShellStore,
  DEFAULT_SIDEBAR_ITEMS,
} from './stores/useGeoShellStore';
export type {
  GeoShellStore,
  WorkspaceTab,
  InspectorSelection,
  InspectorContextType,
  CopilotState,
} from './stores/useGeoShellStore';
// Re-export SidebarNavItem from platform (duplicate removed from geo store)
export type { SidebarNavItem } from '../../platform/ui/workspace/WorkspaceTypes';

// Services
export { GEOProjectService } from './services/geo-project-service';
export type {
  GEOProjectMetadata,
  GEOProject,
  CreateGEOProjectInput,
} from './services/geo-project-service';
export { GEOResearchService } from './services/geo-research-service';
export type {
  BrandProfile,
  WebsiteSnapshot,
  BrandAnalysisResult,
} from './services/geo-research-service';
export { GEOKnowledgeService } from './services/geo-knowledge-service';
export type {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  SemanticEntity,
  SemanticSearchResult,
} from './services/geo-knowledge-service';
export { GEOOptimizationService } from './services/geo-optimization-service';
export type {
  VisibilityScore,
  KeywordSuggestion,
  SEORecommendation,
  CompetitorAnalysis,
} from './services/geo-optimization-service';
export { GEOPublishService } from './services/geo-publish-service';
export type {
  PublishChannel,
  Publication,
  PublishResult,
} from './services/geo-publish-service';
export { GEOMonitorService } from './services/geo-monitor-service';
export type {
  DashboardSummary,
  HealthMetrics,
  Alert,
  TrendPoint,
} from './services/geo-monitor-service';

// Workspace Shell
export { GEOWorkspaceShell } from './workspace/GEOWorkspaceShell';
export type { PageComponent } from './workspace/GEOWorkspaceShell';
export { renderHeader } from './workspace/GEOWorkspaceHeader';
export { renderSidebar, renderResizeHandle } from './workspace/GEOWorkspaceSidebar';
export { renderMainArea } from './workspace/GEOWorkspaceMain';
export { renderInspector } from './workspace/GEOInspector';
export { renderCopilot, renderCopilotToggle } from './workspace/GEOCopilot';
export { createGEOWorkspace, getGEOStyles } from './workspace/bootstrap';
export type { GEOWorkspaceConfig, GEOWorkspacePageId } from './workspace/bootstrap';

// Pages
export { createDashboardPage, renderDashboard } from './pages/GEODashboardPage';
export type { DashboardStats, DashboardCard } from './pages/GEODashboardPage';
export { renderProjectsList } from './pages/GEOProjectsPage';
export type { GEOProjectItem, ProjectCreateForm } from './pages/GEOProjectsPage';
export { renderResearch } from './pages/GEOResearchPage';
export type { BrandProfileData, WebsiteScanResult } from './pages/GEOResearchPage';
export { renderKnowledge } from './pages/GEOKnowledgePage';
export type { KnowledgeNode, KnowledgeEdge } from './pages/GEOKnowledgePage';
export { renderOptimization } from './pages/GEOOptimizationPage';
export type { VisibilityMetrics, SEORec } from './pages/GEOOptimizationPage';
export { renderPublish } from './pages/GEOPublishPage';
export { renderMonitor } from './pages/GEOMonitorPage';
export { renderSettings } from './pages/GEOSettingsPage';
