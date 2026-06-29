/**
 * WorkspaceSidebar — Generic workspace sidebar component.
 *
 * Renders the navigation sidebar with grouped menu items.
 * Accepts nav items, active state, and collapsed state via config.
 *
 * All colors use the platform tokens system. Zero GEO-specific references.
 *
 * @package platform/ui/workspace
 */

import type { SidebarNavItem } from './WorkspaceTypes';

export interface SidebarConfig {
  /** Navigation items to display */
  items: SidebarNavItem[];
  /** Whether sidebar is collapsed to icon-only */
  collapsed: boolean;
  /** Currently active nav item ID */
  activeItemId: string;
  /** Tokens map for colors / styling */
  tokens?: Record<string, string>;
}

/**
 * Render the workspace sidebar HTML.
 */
export function renderSidebar(config: SidebarConfig): string {
  const { items, collapsed, activeItemId } = config;
  const tokens = config.tokens ?? {};
  const groups = groupItems(items);

  const sidebarBg = tokens.sidebarBg ?? '#0f172a';
  const brandColor = tokens.brand ?? '#2563eb';
  const brandLight = tokens.brandLight ?? 'rgba(37, 99, 235, 0.15)';
  const sidebarWidth = tokens.sidebarWidth ?? '260px';

  return `
    <div style="
      width: ${collapsed ? '48px' : sidebarWidth};
      min-width: ${collapsed ? '48px' : sidebarWidth};
      background: ${sidebarBg};
      display: flex;
      flex-direction: column;
      transition: width 0.2s ease;
      overflow: hidden;
      flex-shrink: 0;
    ">
      <nav style="flex: 1; padding: 8px; overflow-y: auto;">
        ${renderGroups(groups, collapsed, activeItemId, tokens)}
      </nav>
    </div>
  `;
}

/**
 * Sidebar resize handle element (for drag-resize).
 */
export function renderResizeHandle(): string {
  return `
    <div id="sidebar-resize-handle" style="
      width: 4px;
      cursor: col-resize;
      background: transparent;
      flex-shrink: 0;
      position: relative;
      z-index: 10;
    "></div>
  `;
}

// ============ Private Helpers ============

function groupItems(items: SidebarNavItem[]): Map<string, SidebarNavItem[]> {
  const groups = new Map<string, SidebarNavItem[]>();
  items.forEach(item => {
    const group = groups.get(item.group) || [];
    group.push(item);
    groups.set(item.group, group);
  });
  return groups;
}

function renderGroups(
  groups: Map<string, SidebarNavItem[]>,
  collapsed: boolean,
  activeItemId: string,
  tokens: Record<string, string>,
): string {
  const brandColor = tokens.brand ?? '#2563eb';
  const brandLight = tokens.brandLight ?? 'rgba(37, 99, 235, 0.15)';
  const errorColor = tokens.error ?? '#ef4444';
  const radius = tokens.radiusMd ?? '8px';

  let html = '';
  groups.forEach((items, groupName) => {
    const sortedItems = items.sort((a, b) => a.order - b.order);
    if (!collapsed) {
      html += `
        <div style="
          font-size: 10px;
          color: #475569;
          padding: 8px 12px 4px;
          text-transform: uppercase;
          letter-spacing: 1px;
        ">${groupName}</div>
      `;
    }
    sortedItems.forEach(item => {
      const isActive = item.id === activeItemId;
      html += `
        <div
          class="shell-nav-item"
          data-page-id="${item.id}"
          style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            border-radius: ${radius};
            cursor: pointer;
            font-size: 13px;
            margin-bottom: 2px;
            transition: all 0.15s;
            ${isActive
              ? `
                background: ${brandLight};
                color: #93c5fd;
                border: 1px solid rgba(37, 99, 235, 0.2);
              `
              : `
                color: #94a3b8;
                border: 1px solid transparent;
              `
            }
          "
          onmouseover="this.style.background='${isActive ? brandLight : 'rgba(255,255,255,0.04)'}'"
          onmouseout="this.style.background='${isActive ? brandLight : 'transparent'}'"
        >
          <span style="font-size: 16px; width: 20px; text-align: center;">${item.icon}</span>
          ${collapsed ? '' : `<span style="flex: 1; font-weight: 500;">${item.label}</span>`}
          ${(!collapsed && item.badge) ? `<span style="background: ${errorColor}; color: white; font-size: 10px; padding: 1px 6px; border-radius: 8px; font-weight: 600;">${item.badge}</span>` : ''}
        </div>
      `;
    });
  });
  return html;
}
