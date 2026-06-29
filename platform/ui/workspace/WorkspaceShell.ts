/**
 * WorkspaceShell — Generic workspace layout orchestrator.
 *
 * Manages the overall 4-zone layout (Header, Sidebar, Main, Bottom/Copilot)
 * plus an optional Inspector panel. Accepts configuration via ShellConfig
 * and page registrations — no store dependency, no GEO references.
 *
 * Layout:
 * ┌────────────────────────────────────────────────────────────┐
 * │ Header (brand + project selector + user)                   │
 * ├───────────────┬────────────────────────────────┬───────────┤
 * │ Sidebar       │ Main Workspace (tab-based)     │ Inspector │
 * ├───────────────┴────────────────────────────────┴───────────┤
 * │ AI Copilot / Status Panel (collapsible)                     │
 * └────────────────────────────────────────────────────────────┘
 *
 * @package platform/ui/workspace
 */

import { renderHeader } from './WorkspaceHeader';
import { renderSidebar } from './WorkspaceSidebar';
import { renderMainArea } from './WorkspaceMain';
import { renderInspector } from './WorkspaceInspector';
import { renderCopilot, renderCopilotToggle } from './WorkspaceCopilot';
import type {
  SidebarNavItem,
  WorkspaceTab,
  InspectorSelection,
  CopilotState,
  CopilotMessage,
  BreadcrumbItem,
  ShellConfig,
} from './WorkspaceTypes';

/**
 * Page component definition for the workspace.
 */
export interface PageComponent {
  id: string;
  label: string;
  render: () => string;
}

/**
 * Internal shell state, managed by the Shell.
 */
interface ShellState {
  navItems: SidebarNavItem[];
  sidebarCollapsed: boolean;
  sidebarActiveItem: string;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  inspectorVisible: boolean;
  inspectorWidth: number;
  inspectorSelection: InspectorSelection;
  copilot: CopilotState;
  breadcrumb: BreadcrumbItem[];
  brandLabel: string;
  projectName?: string;
  userName?: string;
  userAvatar?: string;
}

/**
 * Workspace Shell — manages the overall layout and orchestration.
 */
export class WorkspaceShell {
  private state: ShellState;
  private pageRegistry: Map<string, PageComponent> = new Map();
  private containerEl: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private config: ShellConfig;
  private tokens: Record<string, string>;

  constructor(config: ShellConfig, tokens?: Record<string, string>) {
    this.config = config;
    this.tokens = tokens ?? {};

    this.state = {
      navItems: config.navItems,
      sidebarCollapsed: config.sidebarCollapsed ?? false,
      sidebarActiveItem: config.defaultPageId || (config.navItems.length > 0 ? config.navItems[0].id : ''),
      tabs: [],
      activeTabId: null,
      inspectorVisible: false,
      inspectorWidth: config.inspectorWidth ?? 320,
      inspectorSelection: { type: 'none', id: null, label: '', data: null },
      copilot: {
        expanded: false,
        activeTab: 'chat',
        messages: [],
      },
      breadcrumb: config.defaultPageId
        ? [{ label: this.getPageLabel(config.defaultPageId) || 'Home', pageId: config.defaultPageId }]
        : [],
      brandLabel: config.brandLabel,
      projectName: config.projectName,
      userName: config.userName,
      userAvatar: config.userAvatar,
    };
  }

  /**
   * Register a page component that can be rendered in the main area.
   */
  registerPage(page: PageComponent): void {
    this.pageRegistry.set(page.id, page);
  }

  /**
   * Get all registered page components.
   */
  getPages(): Map<string, PageComponent> {
    return this.pageRegistry;
  }

  /**
   * Mount the shell into a container element.
   */
  mount(container: HTMLElement): void {
    this.containerEl = container;
    this.render();
    this.attachEventListeners();
  }

  /**
   * Navigate to a specific page.
   */
  navigate(pageId: string): void {
    const page = this.pageRegistry.get(pageId);
    if (!page) {
      console.warn(`[Shell] Unknown page: ${pageId}`);
      return;
    }

    // Update sidebar active item
    this.state.sidebarActiveItem = pageId;

    // Add tab
    this.addTab({
      id: pageId,
      label: page.label,
      pageId: pageId,
      closable: pageId !== (this.config.defaultPageId || 'home'),
    });

    // Update breadcrumb
    this.state.breadcrumb = [{ label: page.label, pageId }];

    // Fire callback
    this.config.onNavigate?.(pageId);

    // Re-render
    this.render();
  }

  /**
   * Toggle sidebar collapse state.
   */
  toggleSidebar(): void {
    this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    this.config.onSidebarToggle?.(this.state.sidebarCollapsed);
    this.render();
  }

  /**
   * Show inspector with selection data.
   */
  showInspector(selection: InspectorSelection): void {
    this.state.inspectorVisible = true;
    this.state.inspectorSelection = selection;
    this.render();
  }

  /**
   * Hide the inspector panel.
   */
  hideInspector(): void {
    this.state.inspectorVisible = false;
    this.render();
  }

  /**
   * Toggle copilot panel visibility.
   */
  toggleCopilot(): void {
    this.state.copilot.expanded = !this.state.copilot.expanded;
    this.config.onCopilotToggle?.(this.state.copilot.expanded);
    this.render();
  }

  /**
   * Get the current shell state (for extending shells to access).
   */
  getState(): Readonly<ShellState> {
    return this.state;
  }

  /**
   * Update token map (for theme switching).
   */
  setTokens(tokens: Record<string, string>): void {
    this.tokens = tokens;
    this.render();
  }

  /**
   * Update config properties at runtime.
   */
  updateConfig(partial: Partial<ShellConfig>): void {
    this.config = { ...this.config, ...partial };
    if (partial.brandLabel !== undefined) this.state.brandLabel = partial.brandLabel;
    if (partial.projectName !== undefined) this.state.projectName = partial.projectName;
    if (partial.userName !== undefined) this.state.userName = partial.userName;
    if (partial.userAvatar !== undefined) this.state.userAvatar = partial.userAvatar;
    this.render();
  }

  /**
   * Dispose the shell (cleanup).
   */
  dispose(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.containerEl = null;
  }

  // ============ Tab Management ============

  /**
   * Add a workspace tab (or activate if exists).
   */
  private addTab(tab: WorkspaceTab): void {
    const existing = this.state.tabs.find(t => t.id === tab.id);
    if (!existing) {
      this.state.tabs.push(tab);
    }
    this.state.activeTabId = tab.id;
  }

  /**
   * Close a workspace tab.
   */
  private closeTab(tabId: string): void {
    const idx = this.state.tabs.findIndex(t => t.id === tabId);
    if (idx >= 0) {
      this.state.tabs.splice(idx, 1);
      if (this.state.activeTabId === tabId) {
        this.state.activeTabId = this.state.tabs.length > 0
          ? this.state.tabs[this.state.tabs.length - 1].id
          : null;
      }
    }
  }

  /**
   * Set active tab.
   */
  private setActiveTab(tabId: string): void {
    this.state.activeTabId = tabId;
  }

  // ============ Private Helpers ============

  /**
   * Get the page label from registry, or return the id.
   */
  private getPageLabel(pageId: string): string | undefined {
    return this.pageRegistry.get(pageId)?.label;
  }

  /**
   * Build the shared token map for sub-components.
   */
  private getTokens(): Record<string, string> {
    return this.tokens;
  }

  /**
   * Get an empty state message for the main area.
   */
  private renderEmptyState(): string {
    const textSecondary = this.tokens.textSecondary ?? '#94a3b8';
    return `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: ${textSecondary};
        font-size: 14px;
      ">
        Select a page from the sidebar
      </div>
    `;
  }

  // ============ Rendering ============

  private render(): void {
    if (!this.containerEl) return;

    const tokens = this.getTokens();
    const bg = tokens.background ?? '#f8fafc';
    const fontFamily = tokens.fontFamily ?? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    this.containerEl.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
        background: ${bg};
        font-family: ${fontFamily};
      ">
        ${this.renderHeader()}
        <div style="
          display: flex;
          flex: 1;
          overflow: hidden;
          position: relative;
        ">
          ${renderSidebar({
            items: this.state.navItems,
            collapsed: this.state.sidebarCollapsed,
            activeItemId: this.state.sidebarActiveItem,
            tokens,
          })}
          ${this.renderMainArea()}
          ${this.renderInspector()}
        </div>
        ${this.renderCopilot()}
      </div>
    `;
  }

  private renderHeader(): string {
    return renderHeader({
      collapsed: this.state.sidebarCollapsed,
      brandLabel: this.state.brandLabel,
      projectName: this.state.projectName,
      userName: this.state.userName,
      userAvatar: this.state.userAvatar,
      breadcrumb: this.state.breadcrumb,
      tokens: this.getTokens(),
    });
  }

  private renderMainArea(): string {
    const activeTab = this.state.tabs.find(t => t.id === this.state.activeTabId);
    const activePage = activeTab ? this.pageRegistry.get(activeTab.id) : null;
    const pageContent = activePage ? activePage.render() : this.renderEmptyState();

    return renderMainArea({
      tabs: this.state.tabs,
      activeTabId: this.state.activeTabId,
      pageContent,
      tokens: this.getTokens(),
    });
  }

  private renderInspector(): string {
    return renderInspector({
      visible: this.state.inspectorVisible,
      width: this.state.inspectorWidth,
      selection: this.state.inspectorSelection,
      tokens: this.getTokens(),
    });
  }

  private renderCopilot(): string {
    if (!this.state.copilot.expanded) {
      return renderCopilotToggle();
    }

    return renderCopilot({
      copilot: this.state.copilot,
      tokens: this.getTokens(),
    });
  }

  // ============ Event Handling ============

  private attachEventListeners(): void {
    if (!this.containerEl) return;

    this.containerEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Sidebar navigation
      const navItem = target.closest('.shell-nav-item');
      if (navItem) {
        const pageId = navItem.getAttribute('data-page-id');
        if (pageId) this.navigate(pageId);
      }

      // Tab navigation
      const tab = target.closest('.shell-tab');
      if (tab && !target.closest('.shell-tab-close')) {
        const tabId = tab.getAttribute('data-tab-id');
        if (tabId) {
          this.setActiveTab(tabId);
          const foundTab = this.state.tabs.find(t => t.id === tabId);
          if (foundTab) {
            this.state.sidebarActiveItem = foundTab.pageId;
          }
          this.render();
        }
      }

      // Tab close
      const tabClose = target.closest('.shell-tab-close');
      if (tabClose) {
        const tabId = tabClose.getAttribute('data-tab-close');
        if (tabId) {
          this.closeTab(tabId);
          this.render();
        }
      }

      // Sidebar toggle
      const toggleBtn = target.closest('#shell-sidebar-toggle');
      if (toggleBtn) {
        this.toggleSidebar();
      }

      // Inspector close
      const inspectorClose = target.closest('#shell-inspector-close');
      if (inspectorClose) {
        this.hideInspector();
      }

      // Copilot close / toggle
      const copilotClose = target.closest('#shell-copilot-close');
      if (copilotClose) {
        this.toggleCopilot();
      }

      // Copilot toggle bar
      const copilotToggleBar = target.closest('#shell-copilot-toggle');
      if (copilotToggleBar) {
        this.toggleCopilot();
      }

      // Copilot tab switch
      const copilotTab = target.closest('.copilot-tab');
      if (copilotTab) {
        const tab = copilotTab.id.replace('copilot-tab-', '') as 'chat' | 'execution' | 'timeline';
        this.state.copilot.activeTab = tab;
        this.render();
      }

      // Settings button
      const settingsBtn = target.closest('[data-page-id="settings"]');
      if (settingsBtn) {
        this.navigate('settings');
      }
    });

    // Copilot send on Enter
    this.containerEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const input = e.target as HTMLInputElement;
        if (input.id === 'copilot-input') {
          const text = input.value.trim();
          if (text) {
            this.state.copilot.messages.push({
              role: 'user',
              content: text,
              timestamp: new Date().toLocaleTimeString(),
            });
            // Send callback
            this.config.onCopilotSend?.(text);
            // Echo by default — subclasses override
            this.state.copilot.messages.push({
              role: 'assistant',
              content: `Received: "${text}"`,
              timestamp: new Date().toLocaleTimeString(),
            });
            input.value = '';
            this.render();
          }
        }
      }
    });
  }
}
