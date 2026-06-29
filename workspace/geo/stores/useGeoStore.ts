/**
 * GEO Store — Ephemeral UI state for the GEO workspace.
 *
 * Per STATE-SPEC.md §7:
 * - Pinia stores are for UI orchestration ONLY
 * - Domain state goes through platform StateRuntime
 * - No data persistence in Pinia stores
 * - No direct API calls (use services/)
 *
 * @package workspace/geo/stores
 * @see STATE-SPEC.md §7
 */

import type { Project } from '@studio/platform';

// ============ Types ============

/**
 * GEO workspace page identifiers.
 */
export type GEOPage =
  | 'dashboard'
  | 'projects'
  | 'claims'
  | 'evidences'
  | 'brand'
  | 'workflows'
  | 'settings'
  | 'project-detail';

/**
 * View mode options.
 */
export type ViewMode = 'list' | 'grid' | 'detail';

/**
 * Filter options for GEO lists.
 */
export interface GEOFilterState {
  status?: string;
  searchQuery: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Project list pagination state.
 */
export interface GEOPaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
}

// ============ Store Type ============

export interface GeoStore {
  // Page state
  currentPage: GEOPage;
  viewMode: ViewMode;

  // Sidebar state
  sidebarCollapsed: boolean;
  sidebarActiveGroup: string | null;

  // Project list state (UI-only cache, not authoritative)
  projectListCache: Array<{ id: string; name: string; status: string }>;
  projectListLastFetch: number | null;

  // Filter state
  filter: GEOFilterState;

  // Pagination state
  pagination: GEOPaginationState;

  // Modal state
  activeModal: string | null;
  modalData: Record<string, unknown> | null;

  // Selection state
  selectedProjectId: string | null;
  selectedClaimIds: string[];

  // Form draft (non-persisted)
  formDraft: Record<string, unknown> | null;
  formDirty: boolean;

  // ============ Actions ============

  // Navigation
  navigateTo(page: GEOPage): void;
  setViewMode(mode: ViewMode): void;

  // Sidebar
  toggleSidebar(): void;
  setSidebarGroup(group: string | null): void;

  // Project cache
  updateProjectListCache(projects: Array<{ id: string; name: string; status: string }>): void;
  invalidateProjectCache(): void;

  // Filter
  setFilter(partial: Partial<GEOFilterState>): void;
  resetFilter(): void;

  // Pagination
  setPage(page: number): void;
  setPageSize(size: number): void;

  // Modal
  openModal(modalId: string, data?: Record<string, unknown>): void;
  closeModal(): void;

  // Selection
  selectProject(id: string | null): void;
  toggleClaimSelection(id: string): void;
  clearClaimSelection(): void;

  // Form draft
  setFormDraft(data: Record<string, unknown> | null): void;
  markFormClean(): void;

  // Reset
  reset(): void;
}

/**
 * Create a default GEO store instance.
 * This is a plain factory function — not a Pinia store implementation.
 * The Pinia wrapper is added by the consuming application.
 */
export function createGeoStore(): GeoStore {
  const state: GeoStore = {
    // Initial page state
    currentPage: 'dashboard',
    viewMode: 'list',

    // Initial sidebar state
    sidebarCollapsed: false,
    sidebarActiveGroup: 'main',

    // Project cache (UI-only, never source of truth)
    projectListCache: [],
    projectListLastFetch: null,

    // Default filter
    filter: {
      status: undefined,
      searchQuery: '',
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    },

    // Default pagination
    pagination: {
      page: 1,
      pageSize: 20,
      totalItems: 0,
    },

    // Modal state
    activeModal: null,
    modalData: null,

    // Selection state
    selectedProjectId: null,
    selectedClaimIds: [],

    // Form draft
    formDraft: null,
    formDirty: false,

    // ============ Action Implementations ============

    navigateTo(page: GEOPage) {
      state.currentPage = page;
    },

    setViewMode(mode: ViewMode) {
      state.viewMode = mode;
    },

    toggleSidebar() {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },

    setSidebarGroup(group: string | null) {
      state.sidebarActiveGroup = group;
    },

    updateProjectListCache(projects) {
      state.projectListCache = projects;
      state.projectListLastFetch = Date.now();
    },

    invalidateProjectCache() {
      state.projectListCache = [];
      state.projectListLastFetch = null;
    },

    setFilter(partial: Partial<GEOFilterState>) {
      state.filter = { ...state.filter, ...partial };
      // Reset to page 1 when filter changes
      state.pagination.page = 1;
    },

    resetFilter() {
      state.filter = {
        status: undefined,
        searchQuery: '',
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      };
      state.pagination.page = 1;
    },

    setPage(page: number) {
      state.pagination.page = page;
    },

    setPageSize(size: number) {
      state.pagination.pageSize = size;
      state.pagination.page = 1;
    },

    openModal(modalId: string, data?: Record<string, unknown>) {
      state.activeModal = modalId;
      state.modalData = data ?? null;
    },

    closeModal() {
      state.activeModal = null;
      state.modalData = null;
    },

    selectProject(id: string | null) {
      state.selectedProjectId = id;
    },

    toggleClaimSelection(id: string) {
      const index = state.selectedClaimIds.indexOf(id);
      if (index >= 0) {
        state.selectedClaimIds.splice(index, 1);
      } else {
        state.selectedClaimIds.push(id);
      }
    },

    clearClaimSelection() {
      state.selectedClaimIds = [];
    },

    setFormDraft(data: Record<string, unknown> | null) {
      state.formDraft = data;
      state.formDirty = true;
    },

    markFormClean() {
      state.formDirty = false;
    },

    reset() {
      state.currentPage = 'dashboard';
      state.viewMode = 'list';
      state.sidebarCollapsed = false;
      state.sidebarActiveGroup = 'main';
      state.projectListCache = [];
      state.projectListLastFetch = null;
      state.filter = {
        status: undefined,
        searchQuery: '',
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      };
      state.pagination = { page: 1, pageSize: 20, totalItems: 0 };
      state.activeModal = null;
      state.modalData = null;
      state.selectedProjectId = null;
      state.selectedClaimIds = [];
      state.formDraft = null;
      state.formDirty = false;
    },
  };

  return state;
}
