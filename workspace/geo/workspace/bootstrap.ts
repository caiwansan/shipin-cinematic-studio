/**
 * GEO Workspace Bootstrap — Assembly module for GEO workspace.
 *
 * Creates the Shell, registers all pages, and provides a simple
 * API for mounting the full GEO workspace experience.
 *
 * @package workspace/geo/workspace
 */

import { GEOWorkspaceShell } from './GEOWorkspaceShell';
import type { PageComponent } from '../../platform/ui/workspace/WorkspaceShell';
import { createDashboardPage, type DashboardStats } from '../pages/GEODashboardPage';
import { renderProjectsList, type GEOProjectItem } from '../pages/GEOProjectsPage';
import { renderResearch, type BrandProfileData, type WebsiteScanResult } from '../pages/GEOResearchPage';
import { renderKnowledge, type KnowledgeNode, type KnowledgeEdge, type SemanticEntity } from '../pages/GEOKnowledgePage';
import { renderOptimization, type VisibilityMetrics, type SEORec } from '../pages/GEOOptimizationPage';
import { renderPublish } from '../pages/GEOPublishPage';
import { renderMonitor } from '../pages/GEOMonitorPage';
import { renderSettings } from '../pages/GEOSettingsPage';

/**
 * Configuration for the GEO workspace.
 */
export interface GEOWorkspaceConfig {
  dashboardStats?: DashboardStats;
  projects?: GEOProjectItem[];
}

/**
 * Available page identifiers in the GEO workspace.
 */
export type GEOWorkspacePageId =
  | 'dashboard'
  | 'projects'
  | 'research'
  | 'knowledge'
  | 'optimization'
  | 'publish'
  | 'monitor'
  | 'settings';

/**
 * Create and bootstrap a fully functional GEO workspace.
 */
export function createGEOWorkspace(config?: GEOWorkspaceConfig): GEOWorkspaceShell {
  const shell = new GEOWorkspaceShell();

  // Register all pages
  registerPages(shell, config);

  // Initialize with dashboard
  shell.navigate('dashboard');

  return shell;
}

/**
 * Register all GEO workspace pages.
 */
function registerPages(shell: GEOWorkspaceShell, config?: GEOWorkspaceConfig): void {
  const pages: PageComponent[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      render: () => createDashboardPage(config?.dashboardStats).render(),
    },
    {
      id: 'projects',
      label: 'Projects',
      render: () => renderProjectsList(config?.projects || []),
    },
    {
      id: 'research',
      label: 'Brand Research',
      render: () => renderResearch('profile', undefined, undefined),
    },
    {
      id: 'knowledge',
      label: 'Knowledge Graph',
      render: () => renderKnowledge('graph', undefined, undefined, undefined),
    },
    {
      id: 'optimization',
      label: 'SEO Optimization',
      render: () => renderOptimization('overview', undefined, undefined),
    },
    {
      id: 'publish',
      label: 'Publish',
      render: () => renderPublish(),
    },
    {
      id: 'monitor',
      label: 'Monitor',
      render: () => renderMonitor(),
    },
    {
      id: 'settings',
      label: 'Settings',
      render: () => renderSettings(),
    },
  ];

  pages.forEach(page => shell.registerPage(page));
}
