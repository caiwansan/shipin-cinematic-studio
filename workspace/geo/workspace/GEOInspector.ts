/**
 * GEOInspector — GEO-specific context inspector panel.
 *
 * Re-exports the generic renderInspector from platform/ui/workspace.
 * GEO context type labels are available as a constant.
 *
 * @package workspace/geo/workspace
 */

export { renderInspector } from '../../../platform/ui/workspace/WorkspaceInspector';
export type { InspectorConfig } from '../../../platform/ui/workspace/WorkspaceInspector';

/**
 * GEO context type labels (Chinese, for GEO workspace).
 */
export const GEO_INSPECTOR_TYPE_LABELS: Record<string, string> = {
  project: 'Project',
  brand: 'Brand',
  entity: 'Entity',
  citation: 'Citation',
  recommendation: 'Recommendation',
  publication: 'Publication',
};
