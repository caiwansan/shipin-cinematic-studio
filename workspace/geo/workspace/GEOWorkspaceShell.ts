/**
 * GEOWorkspaceShell — GEO-specific workspace shell.
 *
 * Extends the generic WorkspaceShell from platform/ui/workspace,
 * adding GEO-specific defaults (labels, nav items, pages) while
 * delegating layout orchestration to the base class.
 *
 * @package workspace/geo/workspace
 */

import { WorkspaceShell } from '../../../platform/ui/workspace/WorkspaceShell';
import type { PageComponent } from '../../../platform/ui/workspace/WorkspaceShell';
import type { ShellConfig, SidebarNavItem } from '../../../platform/ui/workspace/WorkspaceTypes';
import { GEOTokens } from '../tokens/geo-tokens';

/**
 * Default sidebar navigation items for GEO workspace.
 */
export const DEFAULT_GEO_SIDEBAR_ITEMS: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', group: 'main', order: 0 },
  { id: 'projects', label: 'Projects', icon: '📁', group: 'main', order: 1 },
  { id: 'research', label: 'Brand Research', icon: '🔍', group: 'analysis', order: 2 },
  { id: 'knowledge', label: 'Knowledge Graph', icon: '🔗', group: 'analysis', order: 3 },
  { id: 'optimization', label: 'SEO Optimization', icon: '📈', group: 'optimize', order: 4 },
  { id: 'settings', label: 'Settings', icon: '⚙️', group: 'bottom', order: 99 },
];

/**
 * Build a GEO token map from GEOTokens for the base Shell.
 */
function buildGEOTokenMap(): Record<string, string> {
  return {
    brand: GEOTokens.colors.brand,
    surface: GEOTokens.colors.surface,
    background: GEOTokens.colors.background,
    sidebarBg: GEOTokens.colors.sidebarBg,
    sidebarText: GEOTokens.colors.sidebarText,
    hover: GEOTokens.colors.hover,
    active: GEOTokens.colors.active,
    border: GEOTokens.colors.border,
    text: GEOTokens.colors.text,
    textSecondary: GEOTokens.colors.textSecondary,
    success: GEOTokens.colors.success,
    warning: GEOTokens.colors.warning,
    error: GEOTokens.colors.error,
    info: GEOTokens.colors.info,
    accent: GEOTokens.colors.accent,
    brandLight: GEOTokens.colors.brandLight,
    headerBg: GEOTokens.colors.headerBg,
    radiusMd: GEOTokens.radius.md,
    copilotHeight: GEOTokens.panel.copilotHeight,
    sidebarWidth: GEOTokens.panel.sidebarWidth,
    fontFamily: GEOTokens.typography.fontFamily,
  };
}

/**
 * GEO Workspace Shell — extends generic WorkspaceShell with GEO defaults.
 */
export class GEOWorkspaceShell extends WorkspaceShell {
  private geoPageRegistry: Map<string, PageComponent> = new Map();

  constructor() {
    const config: ShellConfig = {
      navItems: DEFAULT_GEO_SIDEBAR_ITEMS,
      defaultPageId: 'dashboard',
      brandLabel: '🌐 GEO',
      projectName: 'Select project',
      userName: 'Admin',
      sidebarCollapsed: false,
      inspectorWidth: 320,
    };
    super(config, buildGEOTokenMap());
  }

  /**
   * Register a GEO page with the shell.
   * Overrides to also store in geo-specific registry.
   */
  registerPage(page: PageComponent): void {
    super.registerPage(page);
    this.geoPageRegistry.set(page.id, page);
  }

  /**
   * Get GEO token map (for use by pages/components).
   */
  getTokens(): Record<string, string> {
    return buildGEOTokenMap();
  }

  /**
   * Get GEO CSS styles to inject.
   */
  getGEOStyles(): string {
    return `
      /* GEO Workspace Styles */
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: ${GEOTokens.typography.fontFamily};
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }

      /* Sidebar nav items */
      .shell-nav-item {
        user-select: none;
      }

      /* Tab interactions */
      .shell-tab {
        transition: all 0.15s ease;
      }
      .shell-tab:hover {
        background: #f1f5f9;
      }
      .shell-tab-close:hover {
        color: #ef4444 !important;
      }

      /* Input focus styles */
      input:focus,
      textarea:focus {
        border-color: ${GEOTokens.colors.brand} !important;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      }

      /* Smooth transitions */
      .geo-transition {
        transition: all 0.2s ease;
      }
    `;
  }
}
