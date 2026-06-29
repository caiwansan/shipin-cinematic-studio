/**
 * WorkspaceTypes — Shared type definitions for the generic Workspace Shell UI.
 *
 * These types are GEO-free and provide a generic contract for Shell layout
 * configuration. Workspace-level implementations (geo, video, novel, ppt)
 * extend/augment these for their domain-specific needs.
 *
 * @package platform/ui/workspace
 */

/**
 * Sidebar navigation item definition.
 */
export interface SidebarNavItem {
  id: string;
  label: string;
  icon: string;
  group: string;
  order: number;
  badge?: string | number;
}

/**
 * Main workspace tab.
 */
export interface WorkspaceTab {
  id: string;
  label: string;
  pageId: string;
  closable: boolean;
}

/**
 * Inspector context panel types.
 */
export type InspectorContextType =
  | 'none'
  | 'project'
  | 'brand'
  | 'entity'
  | 'citation'
  | 'recommendation'
  | 'publication';

/**
 * Inspector selection state.
 */
export interface InspectorSelection {
  type: InspectorContextType;
  id: string | null;
  label: string;
  data: Record<string, unknown> | null;
}

/**
 * Copilot message entry.
 */
export interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Copilot panel state.
 */
export interface CopilotState {
  expanded: boolean;
  activeTab: 'chat' | 'execution' | 'timeline';
  messages: CopilotMessage[];
}

/**
 * Breadcrumb segment.
 */
export interface BreadcrumbItem {
  label: string;
  pageId: string;
}

/**
 * Workspace Shell configuration.
 * Accepts callbacks and config maps instead of store dependency.
 *
 * @see WorkspaceShell
 */
export interface ShellConfig {
  /** Sidebar navigation items */
  navItems: SidebarNavItem[];
  /** Default page on first load */
  defaultPageId?: string;
  /** Brand label / logo text displayed in the header */
  brandLabel: string;
  /** Project name shown in the header selector area */
  projectName?: string;
  /** User profile */
  userName?: string;
  userAvatar?: string;
  /** Default sidebar collapsed state */
  sidebarCollapsed?: boolean;
  /** Default inspector width (px) */
  inspectorWidth?: number;
  /** Callback fired when a page navigation occurs */
  onNavigate?: (pageId: string) => void;
  /** Callback fired when the sidebar toggle is clicked */
  onSidebarToggle?: (collapsed: boolean) => void;
  /** Callback fired when the copilot is toggled */
  onCopilotToggle?: (expanded: boolean) => void;
  /** Callback fired when a copilot message is sent */
  onCopilotSend?: (message: string) => void;
}
