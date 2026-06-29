/**
 * WorkspaceCopilot — Generic bottom collapsible AI Copilot panel.
 *
 * Provides AI assistant chat, execution status monitoring,
 * and event timeline views via content slots.
 *
 * All colors use the platform tokens system. Zero GEO-specific references.
 *
 * @package platform/ui/workspace
 */

import type { CopilotState } from './WorkspaceTypes';

export interface CopilotConfig {
  /** The copilot panel state */
  copilot: CopilotState;
  /** Optional custom render function for chat messages */
  renderChatView?: (messages: CopilotState['messages']) => string;
  /** Optional custom render function for execution status view */
  renderExecutionView?: () => string;
  /** Optional custom render function for timeline view */
  renderTimelineView?: () => string;
  /** Tokens map for colors / styling */
  tokens?: Record<string, string>;
}

/**
 * Render the copilot panel.
 */
export function renderCopilot(config: CopilotConfig): string {
  const { copilot } = config;

  if (!copilot.expanded) {
    return '';
  }

  const tokens = config.tokens ?? {};
  const surface = tokens.surface ?? '#ffffff';
  const border = tokens.border ?? '#e2e8f0';
  const brand = tokens.brand ?? '#2563eb';
  const brandLight = tokens.brandLight ?? 'rgba(37, 99, 235, 0.1)';
  const textSecondary = tokens.textSecondary ?? '#64748b';
  const text = tokens.text ?? '#0f172a';
  const copilotHeight = tokens.copilotHeight ?? '280px';

  return `
    <div id="shell-copilot" style="
      height: ${copilotHeight};
      min-height: ${copilotHeight};
      background: ${surface};
      border-top: 1px solid ${border};
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      z-index: 50;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      ${renderCopilotHeader(copilot, brand, brandLight, textSecondary, border)}
      <div id="copilot-content" style="flex: 1; overflow-y: auto; padding: 16px;">
        ${renderCopilotContent(config)}
      </div>
      ${copilot.activeTab === 'chat' ? renderCopilotInput(brand, border, textSecondary) : ''}
    </div>
  `;
}

/**
 * Render the copilot toggle bar (when collapsed).
 */
export function renderCopilotToggle(): string {
  return `
    <div id="shell-copilot-toggle" style="
      height: 32px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      font-size: 12px;
      color: #64748b;
      gap: 6px;
    ">
      <span>▲</span>
      <span>AI Copilot</span>
    </div>
  `;
}

// ============ Private Rendering ============

function renderCopilotHeader(
  copilot: CopilotState,
  brand: string,
  brandLight: string,
  textSecondary: string,
  border: string,
): string {
  const tabs: Array<{ id: CopilotState['activeTab']; label: string; icon: string }> = [
    { id: 'chat', label: 'AI Chat', icon: '💬' },
    { id: 'execution', label: 'Execution', icon: '⚙️' },
    { id: 'timeline', label: 'Timeline', icon: '📋' },
  ];

  return `
    <div style="
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      border-bottom: 1px solid ${border};
      flex-shrink: 0;
    ">
      <div style="display: flex; gap: 4px;">
        ${tabs.map(tab => {
          const isActive = copilot.activeTab === tab.id;
          return `
            <span
              id="copilot-tab-${tab.id}"
              class="copilot-tab"
              style="
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                padding: 4px 10px;
                border-radius: 8px;
                transition: all 0.15s;
                ${isActive
                  ? `color: ${brand}; background: ${brandLight};`
                  : `color: ${textSecondary};`
                }
              "
            >
              ${tab.icon} ${tab.label}
            </span>
          `;
        }).join('')}
      </div>
      <button id="shell-copilot-close" style="
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        color: #94a3b8;
        padding: 4px;
        line-height: 1;
      ">×</button>
    </div>
  `;
}

function renderCopilotContent(config: CopilotConfig): string {
  const { copilot } = config;

  switch (copilot.activeTab) {
    case 'chat':
      return config.renderChatView
        ? config.renderChatView(copilot.messages)
        : defaultRenderChatView(copilot.messages, config.tokens);
    case 'execution':
      return config.renderExecutionView
        ? config.renderExecutionView()
        : defaultRenderExecutionView(config.tokens);
    case 'timeline':
      return config.renderTimelineView
        ? config.renderTimelineView()
        : defaultRenderTimelineView(config.tokens);
    default:
      return '';
  }
}

function defaultRenderChatView(
  messages: CopilotState['messages'],
  tokens?: Record<string, string>,
): string {
  const brand = tokens?.brand ?? '#2563eb';
  const text = tokens?.text ?? '#0f172a';
  const textSecondary = tokens?.textSecondary ?? '#64748b';

  if (messages.length === 0) {
    return `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: ${textSecondary};
        font-size: 13px;
        text-align: center;
        gap: 8px;
      ">
        <div style="font-size: 36px;">🤖</div>
        <div>AI Copilot ready to help</div>
        <div style="font-size: 12px; color: #94a3b8;">
          Ask questions, analyze data, or get recommendations
        </div>
      </div>
    `;
  }

  return messages.map(msg => `
    <div style="
      margin-bottom: 12px;
      text-align: ${msg.role === 'user' ? 'right' : 'left'};
    ">
      <div style="
        display: inline-block;
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 13px;
        max-width: 80%;
        line-height: 1.4;
        ${msg.role === 'user'
          ? `background: ${brand}; color: white;`
          : `background: #f1f5f9; color: ${text};`
        }
      ">
        ${msg.content}
      </div>
      <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">${msg.timestamp}</div>
    </div>
  `).join('');
}

function defaultRenderExecutionView(tokens?: Record<string, string>): string {
  const textSecondary = tokens?.textSecondary ?? '#64748b';
  return `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: ${textSecondary};
      font-size: 13px;
      text-align: center;
      gap: 8px;
    ">
      <div style="font-size: 32px;">⚙️</div>
      <div>No active tasks</div>
      <div style="font-size: 12px; color: #94a3b8;">
        Task execution status will appear here
      </div>
    </div>
  `;
}

function defaultRenderTimelineView(tokens?: Record<string, string>): string {
  const textSecondary = tokens?.textSecondary ?? '#64748b';
  return `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: ${textSecondary};
      font-size: 13px;
      text-align: center;
      gap: 8px;
    ">
      <div style="font-size: 32px;">📋</div>
      <div>No events recorded</div>
      <div style="font-size: 12px; color: #94a3b8;">
        System events and operations will be shown here
      </div>
    </div>
  `;
}

function renderCopilotInput(brand: string, border: string, textSecondary: string): string {
  return `
    <div style="
      display: flex;
      gap: 8px;
      padding: 8px 16px;
      border-top: 1px solid ${border};
      flex-shrink: 0;
    ">
      <input
        id="copilot-input"
        type="text"
        placeholder="Type a message..."
        style="
          flex: 1;
          padding: 8px 12px;
          border: 1px solid ${border};
          border-radius: 8px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        "
        onfocus="this.style.borderColor='${brand}'"
        onblur="this.style.borderColor='${border}'"
      >
      <button id="copilot-send" style="
        background: ${brand};
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        font-weight: 500;
        transition: opacity 0.15s;
      "
        onmouseover="this.style.opacity='0.9'"
        onmouseout="this.style.opacity='1'"
      >Send</button>
    </div>
  `;
}
