/**
 * GEO Store Extension — Adds Shell layout state (sidebar, tabs, inspector, copilot).
 *
 * Extends the GeoStore with workspace shell UI state.
 * This is a separate module to keep the core store clean.
 *
 * @package workspace/geo/stores
 */

import type { SidebarNavItem } from '../../../platform/ui/workspace/WorkspaceTypes';
import type { GEOPage } from './useGeoStore';

// ============ Shell-specific Types ============

/**
 * Main workspace tab.
 */
export interface WorkspaceTab {
  id: string;
  label: string;
  pageId: GEOPage;
  closable: boolean;
}

/**
 * Inspector context types.
 */
export type InspectorContextType = 'none' | 'project' | 'brand' | 'entity' | 'citation' | 'recommendation' | 'publication';

/**
 * Inspector selection state.
 */
export interface InspectorSelection {
  type: InspectorContextType;
  id: string | null;
  label: string;
  data: Record<string, unknown> | null;
}

/**
 * Copilot panel state.
 */
export interface CopilotState {
  expanded: boolean;
  activeTab: 'chat' | 'execution' | 'timeline';
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
}

// ============ Shell Store Extension ============

export interface GeoShellStore {
  // Sidebar state
  sidebarItems: SidebarNavItem[];
  sidebarCollapsed: boolean;
  sidebarActiveItem: string;

  // Tab state
  tabs: WorkspaceTab[];
  activeTabId: string | null;

  // Inspector state
  inspectorVisible: boolean;
  inspectorWidth: number;
  inspectorSelection: InspectorSelection;

  // Copilot state
  copilot: CopilotState;

  // Breadcrumb
  breadcrumb: Array<{ label: string; pageId: string }>;

  // ============ Actions ============

  // Sidebar
  setSidebarItems(items: SidebarNavItem[]): void;
  setActiveSidebarItem(itemId: string): void;

  // Tabs
  addTab(tab: WorkspaceTab): void;
  closeTab(tabId: string): void;
  setActiveTab(tabId: string): void;

  // Inspector
  showInspector(selection: InspectorSelection): void;
  hideInspector(): void;
  setInspectorWidth(width: number): void;
  clearInspector(): void;

  // Copilot
  toggleCopilot(): void;
  setCopilotTab(tab: CopilotState['activeTab']): void;
  addCopilotMessage(message: CopilotState['messages'][0]): void;

  // Breadcrumb
  setBreadcrumb(items: Array<{ label: string; pageId: string }>): void;
}

/**
 * Default sidebar navigation items for GEO workspace.
 */
export const DEFAULT_SIDEBAR_ITEMS: SidebarNavItem[] = [
  { id: 'dashboard', label: '仪表盘', icon: '📊', group: 'main', order: 0 },
  { id: 'projects', label: '项目管理', icon: '📁', group: 'main', order: 1 },
  { id: 'research', label: '品牌研究', icon: '🔍', group: 'analysis', order: 2 },
  { id: 'knowledge', label: '知识图谱', icon: '🔗', group: 'analysis', order: 3 },
  { id: 'optimization', label: 'SEO优化', icon: '📈', group: 'optimize', order: 4 },
  { id: 'settings', label: '设置', icon: '⚙️', group: 'bottom', order: 99 },
];

/**
 * Create default shell store state.
 */
export function createShellStore(): GeoShellStore {
  const state: GeoShellStore = {
    sidebarItems: DEFAULT_SIDEBAR_ITEMS,
    sidebarCollapsed: false,
    sidebarActiveItem: 'dashboard',

    tabs: [],
    activeTabId: null,

    inspectorVisible: false,
    inspectorWidth: 320,
    inspectorSelection: { type: 'none', id: null, label: '', data: null },

    copilot: {
      expanded: false,
      activeTab: 'chat',
      messages: [],
    },

    breadcrumb: [{ label: '仪表盘', pageId: 'dashboard' }],

    // ============ Actions ============

    setSidebarItems(items: SidebarNavItem[]) {
      state.sidebarItems = items;
    },

    setActiveSidebarItem(itemId: string) {
      state.sidebarActiveItem = itemId;
    },

    addTab(tab: WorkspaceTab) {
      const existing = state.tabs.find(t => t.id === tab.id);
      if (!existing) {
        state.tabs.push(tab);
      }
      state.activeTabId = tab.id;
    },

    closeTab(tabId: string) {
      const idx = state.tabs.findIndex(t => t.id === tabId);
      if (idx >= 0) {
        state.tabs.splice(idx, 1);
        // If we closed the active tab, switch to the last remaining tab
        if (state.activeTabId === tabId) {
          state.activeTabId = state.tabs.length > 0
            ? state.tabs[state.tabs.length - 1].id
            : null;
        }
      }
    },

    setActiveTab(tabId: string) {
      state.activeTabId = tabId;
    },

    showInspector(selection: InspectorSelection) {
      state.inspectorVisible = true;
      state.inspectorSelection = selection;
    },

    hideInspector() {
      state.inspectorVisible = false;
    },

    setInspectorWidth(width: number) {
      state.inspectorWidth = Math.max(240, Math.min(600, width));
    },

    clearInspector() {
      state.inspectorSelection = { type: 'none', id: null, label: '', data: null };
    },

    toggleCopilot() {
      state.copilot.expanded = !state.copilot.expanded;
    },

    setCopilotTab(tab: CopilotState['activeTab']) {
      state.copilot.activeTab = tab;
    },

    addCopilotMessage(message: CopilotState['messages'][0]) {
      state.copilot.messages.push(message);
    },

    setBreadcrumb(items: Array<{ label: string; pageId: string }>) {
      state.breadcrumb = items;
    },
  };

  return state;
}
