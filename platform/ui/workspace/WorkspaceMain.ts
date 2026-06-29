/**
 * WorkspaceMain — Generic main content area component.
 *
 * Renders the tab bar and the active page content area.
 * Pages are provided through a content callback — the shell handles rendering.
 *
 * All colors use the platform tokens system. Zero GEO-specific references.
 *
 * @package platform/ui/workspace
 */

import type { WorkspaceTab } from './WorkspaceTypes';

export interface MainAreaConfig {
  /** Open tabs in the main area */
  tabs: WorkspaceTab[];
  /** Currently active tab ID */
  activeTabId: string | null;
  /** Rendered HTML for the active page content */
  pageContent: string;
  /** Tokens map for colors / styling */
  tokens?: Record<string, string>;
}

/**
 * Render the main workspace area (tab bar + content).
 */
export function renderMainArea(config: MainAreaConfig): string {
  const { tabs, activeTabId, pageContent } = config;
  const tokens = config.tokens ?? {};

  const bg = tokens.background ?? '#f8fafc';
  const surface = tokens.surface ?? '#ffffff';
  const border = tokens.border ?? '#e2e8f0';
  const brand = tokens.brand ?? '#2563eb';
  const text = tokens.text ?? '#0f172a';
  const textSecondary = tokens.textSecondary ?? '#64748b';

  return `
    <div style="
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 0;
    ">
      ${tabs.length > 0 ? renderTabBar(tabs, activeTabId, surface, border, brand, text, textSecondary) : ''}
      <div id="shell-main-content" style="
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        background: ${bg};
      ">
        ${pageContent}
      </div>
    </div>
  `;
}

/**
 * Render a tab bar with closeable tabs.
 */
function renderTabBar(
  tabs: WorkspaceTab[],
  activeTabId: string | null,
  surface: string,
  border: string,
  brand: string,
  text: string,
  textSecondary: string,
): string {
  return `
    <div style="
      display: flex;
      align-items: center;
      background: ${surface};
      border-bottom: 1px solid ${border};
      padding: 0 8px;
      height: 36px;
      flex-shrink: 0;
      overflow-x: auto;
    ">
      ${tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        return `
          <div
            class="shell-tab"
            data-tab-id="${tab.id}"
            style="
              display: flex;
              align-items: center;
              gap: 6px;
              padding: 6px 12px;
              font-size: 12px;
              cursor: pointer;
              border-bottom: 2px solid ${isActive ? brand : 'transparent'};
              color: ${isActive ? text : textSecondary};
              white-space: nowrap;
              user-select: none;
              transition: all 0.15s;
            "
          >
            <span>${tab.label}</span>
            ${tab.closable ? `<span class="shell-tab-close" data-tab-close="${tab.id}" style="
              font-size: 14px;
              color: #94a3b8;
              margin-left: 4px;
              line-height: 1;
            ">×</span>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}
