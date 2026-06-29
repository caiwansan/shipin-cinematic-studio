/**
 * GEOWorkspaceHeader — GEO-specific workspace header.
 *
 * Re-exports the generic renderHeader from platform/ui/workspace
 * with GEO default tokens applied. Provides GEO-specific conveniences.
 *
 * @package workspace/geo/workspace
 */

export { renderHeader, renderBreadcrumb } from '../../../platform/ui/workspace/WorkspaceHeader';
export type { HeaderConfig } from '../../../platform/ui/workspace/WorkspaceHeader';
