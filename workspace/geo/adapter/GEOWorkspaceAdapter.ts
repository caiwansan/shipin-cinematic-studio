/**
 * GEO Workspace Adapter — Implements WorkspaceAdapter for the GEO workspace.
 *
 * The GEO workspace provides brand analysis, knowledge extraction,
 * content visibility analysis, and SEO-related capabilities.
 *
 * @package workspace/geo/adapter
 * @see WORKSPACE-SPEC.md §3
 *
 * Architecture Compliance:
 * - All GEO route handlers MUST return ApiResponse format (API-SPEC.md §1)
 * - All GEO route handlers MUST use auth middleware (MANIFESTO.md Rule 2)
 * - All GEO data access MUST go through BaseRepository (DATA-SPEC.md §3)
 * - GEO routes use /api/v1/geo/ prefix (API-SPEC.md §7.2)
 */

import type {
  WorkspaceAdapter,
  WorkspaceContext as PlatformContext,
  WorkspaceRoute,
  WorkspaceMenu,
  CapabilityRequirement,
  AssetType,
  CommandDefinition,
  WorkspaceType,
  ApiResponse,
} from '@studio/platform';

/** 
 * GEO workspace specific context.
 * Used to pass project-specific data through the adapter pipeline.
 */
export interface GEOContext {
  projectId: string;
  targetUrl?: string;
  industry?: string;
}

/**
 * GEO Workspace Adapter.
 *
 * Entry point for all GEO workspace operations.
 * - Registers GEO DAG definitions
 * - Provides GEO route configuration
 * - Manages GEO workspace lifecycle
 * - Defines GEO-specific menus, capabilities, and asset types
 * - All handlers return ApiResponse format via platform services
 */
export class GEOWorkspaceAdapter implements WorkspaceAdapter {
  readonly type: WorkspaceType = 'geo';

  private initialized = false;
  private activeProjectId: string | null = null;

  /**
   * Initialize the GEO workspace.
   * Register DAGs, event listeners, and capabilities.
   */
  async initialize(context: PlatformContext): Promise<void> {
    if (this.initialized) {
      console.warn('[GEO] Adapter already initialized');
      return;
    }

    console.log('[GEO] Workspace initialized', {
      userId: context.userId,
      tenantId: context.tenantId,
    });

    this.initialized = true;
  }

  /**
   * Activate the GEO workspace for a specific project.
   * Loads project-specific resources and state.
   */
  async activate(projectId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('[GEO] Cannot activate uninitialized workspace');
    }

    this.activeProjectId = projectId;
    console.log('[GEO] Workspace activated for project:', projectId);
  }

  /**
   * Deactivate the GEO workspace.
   * Saves state and releases project-specific resources.
   */
  async deactivate(): Promise<void> {
    this.activeProjectId = null;
    console.log('[GEO] Workspace deactivated');
  }

  /**
   * Dispose the GEO workspace.
   * Clean up all resources, event listeners, and subscriptions.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    this.activeProjectId = null;
    console.log('[GEO] Workspace disposed');
  }

  /**
   * Get GEO workspace route definitions.
   * Routes are defined here, not in individual route files.
   * All routes use /api/v1/geo/ prefix (per API-SPEC.md §7.2).
   */
  getRoutes(): WorkspaceRoute[] {
    return [
      // Project routes
      { method: 'GET', path: '/api/v1/geo/projects', handler: 'listProjects' },
      { method: 'POST', path: '/api/v1/geo/projects', handler: 'createProject' },
      { method: 'GET', path: '/api/v1/geo/projects/:id', handler: 'getProject' },
      { method: 'PATCH', path: '/api/v1/geo/projects/:id', handler: 'updateProject' },
      { method: 'DELETE', path: '/api/v1/geo/projects/:id', handler: 'deleteProject' },

      // Claim routes
      { method: 'GET', path: '/api/v1/geo/projects/:projectId/claims', handler: 'listClaims' },
      { method: 'POST', path: '/api/v1/geo/projects/:projectId/claims', handler: 'createClaim' },
      { method: 'PATCH', path: '/api/v1/geo/claims/:id', handler: 'updateClaim' },
      { method: 'DELETE', path: '/api/v1/geo/claims/:id', handler: 'deleteClaim' },

      // Evidence routes
      { method: 'GET', path: '/api/v1/geo/claims/:claimId/evidences', handler: 'listEvidences' },
      { method: 'POST', path: '/api/v1/geo/claims/:claimId/evidences', handler: 'createEvidence' },

      // Brand analysis routes
      { method: 'POST', path: '/api/v1/geo/brand/analyze', handler: 'analyzeBrand' },
      { method: 'GET', path: '/api/v1/geo/brand/profile/:projectId', handler: 'getBrandProfile' },

      // Workflow routes
      { method: 'POST', path: '/api/v1/geo/workflows/trigger', handler: 'triggerWorkflow' },
      { method: 'GET', path: '/api/v1/geo/workflows/:executionId', handler: 'getWorkflowStatus' },

      // Dashboard
      { method: 'GET', path: '/api/v1/geo/dashboard/:projectId', handler: 'getDashboard' },
    ];
  }

  /**
   * Get GEO workspace sidebar menu items.
   */
  getMenus(): WorkspaceMenu[] {
    return [
      { id: 'dashboard', label: '仪表盘', icon: 'dashboard', route: '/geo/dashboard', group: 'main', order: 0 },
      { id: 'projects', label: '项目管理', icon: 'folder', route: '/geo/projects', group: 'main', order: 1 },
      { id: 'claims', label: '知识声明', icon: 'fact_check', route: '/geo/claims', group: 'analysis', order: 2 },
      { id: 'evidences', label: '证据管理', icon: 'source', route: '/geo/evidences', group: 'analysis', order: 3 },
      { id: 'brand', label: '品牌分析', icon: 'branding_watermark', route: '/geo/brand', group: 'analysis', order: 4 },
      { id: 'workflows', label: '工作流', icon: 'account_tree', route: '/geo/workflows', group: 'tools', order: 5 },
      { id: 'settings', label: '项目设置', icon: 'settings', route: '/geo/settings', group: 'bottom', order: 99 },
    ];
  }

  /**
   * Get capabilities required by the GEO workspace.
   */
  getCapabilities(): CapabilityRequirement[] {
    return [
      { capabilityId: 'llm.generate', modelId: 'chat-model-v2' },
      { capabilityId: 'llm.embed' },
      { capabilityId: 'knowledge.extract' },
    ];
  }

  /**
   * Get asset types managed by the GEO workspace.
   */
  getAssetTypes(): AssetType[] {
    return [
      {
        type: 'brand-logo',
        schema: {
          format: ['png', 'jpg', 'svg'],
          maxSize: 5 * 1024 * 1024, // 5MB
        },
      },
      {
        type: 'website-screenshot',
        schema: {
          format: ['png', 'jpg', 'webp'],
          maxSize: 2 * 1024 * 1024, // 2MB
        },
      },
      {
        type: 'brand-asset',
        schema: {
          format: ['pdf', 'docx', 'pptx', 'txt'],
          maxSize: 20 * 1024 * 1024, // 20MB
        },
      },
    ];
  }

  /**
   * Get commands available in the GEO workspace.
   */
  getCommands(): CommandDefinition[] {
    return [
      { id: 'geo:analyze-brand', label: '品牌分析', handler: 'handleAnalyzeBrand' },
      { id: 'geo:run-quality-check', label: '知识质量检查', handler: 'handleQualityCheck' },
      { id: 'geo:extract-claims', label: '提取知识声明', handler: 'handleExtractClaims' },
      { id: 'geo:generate-faq', label: '生成 FAQ', handler: 'handleGenerateFAQ' },
      { id: 'geo:generate-schema', label: '生成 Schema Markup', handler: 'handleGenerateSchema' },
      { id: 'geo:competitor-analysis', label: '竞品分析', handler: 'handleCompetitorAnalysis' },
    ];
  }
}
