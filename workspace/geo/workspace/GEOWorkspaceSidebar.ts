/**
 * GEOWorkspaceSidebar — GEO-specific workspace sidebar.
 *
 * Re-exports the generic renderSidebar from platform/ui/workspace
 * with GEO default tokens applied. Provides GEO-specific conveniences.
 *
 * @package workspace/geo/workspace
 */

export { renderSidebar, renderResizeHandle } from '../../../platform/ui/workspace/WorkspaceSidebar';
export type { SidebarConfig } from '../../../platform/ui/workspace/WorkspaceSidebar';
