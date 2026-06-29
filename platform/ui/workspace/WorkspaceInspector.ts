/**
 * WorkspaceInspector — Generic right-side context inspector panel.
 *
 * Shows context-sensitive details for the currently selected item.
 * Accepts selection data and render callbacks — the parent decides what to show.
 *
 * All colors use the platform tokens system. Zero GEO-specific references.
 *
 * @package platform/ui/workspace
 */

import type { InspectorSelection } from './WorkspaceTypes';

export interface InspectorConfig {
  /** Whether the inspector panel is visible */
  visible: boolean;
  /** Panel width in pixels */
  width: number;
  /** Current selection data to display */
  selection: InspectorSelection;
  /** Optional custom render function for inspector content */
  renderContent?: (selection: InspectorSelection) => string;
  /** Tokens map for colors / styling */
  tokens?: Record<string, string>;
}

/** Default content renderer when no custom renderContent provided. */
function defaultRenderContent(selection: InspectorSelection): string {
  const { type, label, data } = selection;

  if (type === 'none') {
    return `
      <div style="text-align: center; padding: 32px 0; color: #64748b; font-size: 13px;">
        <div style="font-size: 32px; margin-bottom: 8px;">👈</div>
        <div>Select an item to view details</div>
      </div>
    `;
  }

  const fields = data ? Object.entries(data) : [];

  return `
    <div style="margin-bottom: 16px;">
      <span style="
        font-size: 11px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      ">${type}</span>
      <h3 style="
        font-size: 16px;
        font-weight: 600;
        color: #0f172a;
        margin: 6px 0 0;
      ">${label || '—'}</h3>
    </div>

    ${fields.length > 0 ? `
      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px;">
        ${fields.map(([key, val]) => `
          <div style="margin-bottom: 10px;">
            <span style="
              font-size: 11px;
              color: #64748b;
              display: block;
              margin-bottom: 2px;
            ">${formatFieldName(key)}</span>
            <span style="
              font-size: 13px;
              color: #0f172a;
              display: block;
            ">${formatFieldValue(val)}</span>
          </div>
        `).join('')}
      </div>
    ` : `
      <div style="color: #64748b; font-size: 13px;">No details available</div>
    `}
  `;
}

/**
 * Render the inspector panel.
 */
export function renderInspector(config: InspectorConfig): string {
  if (!config.visible) return '';

  const { width, selection, renderContent, tokens } = config;
  const surface = tokens?.surface ?? '#ffffff';
  const border = tokens?.border ?? '#e2e8f0';
  const text = tokens?.text ?? '#0f172a';

  const contentRenderer = renderContent || defaultRenderContent;

  return `
    <div id="shell-inspector" style="
      width: ${width}px;
      min-width: ${width}px;
      background: ${surface};
      border-left: 1px solid ${border};
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex-shrink: 0;
    ">
      <!-- Header -->
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid ${border};
      ">
        <span style="font-size: 14px; font-weight: 600; color: ${text};">Details</span>
        <button id="shell-inspector-close" style="
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: #94a3b8;
          padding: 2px;
          line-height: 1;
        ">×</button>
      </div>

      <!-- Content -->
      <div style="padding: 16px; flex: 1; overflow-y: auto;">
        ${contentRenderer(selection)}
      </div>
    </div>
  `;
}

// ============ Helpers ============

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/_/g, ' ');
}

function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.join(', ') || '—';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}
