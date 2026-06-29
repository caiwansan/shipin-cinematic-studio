/**
 * WorkspaceHeader — Generic workspace header component.
 *
 * Renders the global header bar with brand logo, project selector,
 * breadcrumb trail, and user profile area.
 *
 * All colors use the platform tokens system. Zero GEO-specific references.
 *
 * @package platform/ui/workspace
 */

/** Style tokens used in header rendering. */
const HEADER_STYLES = {
  height: '48px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
} as const;

export interface HeaderConfig {
  /** Whether the sidebar is collapsed (affects toggle button icon) */
  collapsed: boolean;
  /** Brand label text (e.g. "GEO", "Video Studio") */
  brandLabel: string;
  /** Current project name shown in the selector area */
  projectName?: string;
  /** Display name for the current user */
  userName?: string;
  /** URL for the user avatar image (empty = use initial) */
  userAvatar?: string;
  /** Breadcrumb trail segments */
  breadcrumb?: Array<{ label: string; pageId: string }>;
  /** Tokens map for colors / styling */
  tokens?: Record<string, string>;
}

/**
 * Render the workspace header HTML.
 */
export function renderHeader(config: HeaderConfig): string {
  const { collapsed, brandLabel, projectName, userName = '', userAvatar } = config;
  const tokens = config.tokens ?? {};
  const brandColor = tokens.brand ?? '#2563eb';
  const borderColor = tokens.border ?? '#e2e8f0';
  const textSecondary = tokens.textSecondary ?? '#64748b';
  const bg = tokens.headerBg ?? '#ffffff';

  return `
    <div style="
      height: ${HEADER_STYLES.height};
      background: ${bg};
      border-bottom: 1px solid ${borderColor};
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      flex-shrink: 0;
      z-index: 100;
      font-family: ${HEADER_STYLES.fontFamily};
    ">
      <div style="display: flex; align-items: center; gap: 12px;">
        <button id="shell-sidebar-toggle" style="
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 4px;
          color: ${textSecondary};
          transition: color 0.15s;
        ">${collapsed ? '☰' : '✕'}</button>

        <span style="
          font-size: 16px;
          font-weight: 700;
          color: ${brandColor};
          letter-spacing: 1px;
        ">${brandLabel}</span>

        <span id="shell-project-selector" style="
          font-size: 13px;
          color: ${textSecondary};
          background: #f1f5f9;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          📁 ${projectName || 'Select project'} ▾
        </span>

        <!-- Breadcrumb -->
        <div id="shell-breadcrumb" style="
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: ${textSecondary};
          margin-left: 8px;
        ">${config.breadcrumb ? renderBreadcrumb(config.breadcrumb, tokens) : ''}</div>
      </div>

      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 13px; color: ${textSecondary};">${userName}</span>
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${brandColor};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          ${userAvatar ? `background-image: url(${userAvatar}); background-size: cover;` : ''}
        ">
          ${userAvatar ? '' : (userName ? userName.charAt(0).toUpperCase() : 'U')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a breadcrumb trail.
 */
export function renderBreadcrumb(
  items: Array<{ label: string; pageId: string }>,
  tokens?: Record<string, string>,
): string {
  const textSecondary = tokens?.textSecondary ?? '#64748b';
  const textColor = tokens?.text ?? '#0f172a';

  return items.map((item, i) => `
    <span style="
      color: ${i < items.length - 1 ? textSecondary : textColor};
      cursor: ${i < items.length - 1 ? 'pointer' : 'default'};
    ">
      ${i > 0 ? '<span style="margin: 0 4px;">/</span>' : ''}
      ${item.label}
    </span>
  `).join('');
}
