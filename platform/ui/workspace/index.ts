/**
 * Platform UI — Workspace module barrel export.
 *
 * Re-exports all generic workspace shell components.
 * GEO-free — these components accept config and callbacks,
 * and have zero domain-specific imports.
 *
 * @package platform/ui/workspace
 */

// Shell
export { WorkspaceShell } from './WorkspaceShell';
export type { PageComponent } from './WorkspaceShell';

// Header
export { renderHeader, renderBreadcrumb } from './WorkspaceHeader';
export type { HeaderConfig } from './WorkspaceHeader';

// Sidebar
export { renderSidebar, renderResizeHandle } from './WorkspaceSidebar';
export type { SidebarConfig } from './WorkspaceSidebar';

// Main Area
export { renderMainArea } from './WorkspaceMain';
export type { MainAreaConfig } from './WorkspaceMain';

// Inspector
export { renderInspector } from './WorkspaceInspector';
export type { InspectorConfig } from './WorkspaceInspector';

// Copilot
export { renderCopilot, renderCopilotToggle } from './WorkspaceCopilot';
export type { CopilotConfig } from './WorkspaceCopilot';

// Shared Types
export type {
  SidebarNavItem,
  WorkspaceTab,
  InspectorContextType,
  InspectorSelection,
  CopilotMessage,
  CopilotState,
  BreadcrumbItem,
  ShellConfig,
} from './WorkspaceTypes';
