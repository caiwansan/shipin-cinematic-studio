// @deprecated — GEO v3 Legacy. Use design-system product blocks instead.
/**
 * GeoRoutes — Centralized route definitions for all GEO API calls.
 *
 * Single source of truth for backend route paths.
 * Backend base is /api/geo — all paths are relative.
 *
 * Never hardcode route strings. Use this module exclusively.
 *
 * @package workspace/brand-geo/config
 */

const BASE = '/api/geo'

/** Dashboard */
export const GeoRoutes = {
  dashboard: {
    stats: `${BASE}/dashboard/stats`,
    providerStatus: `${BASE}/dashboard/provider-status`,
  },

  /** Brands (maps to GEOProject) */
  brand: {
    list: `${BASE}/brands`,
    create: `${BASE}/brands`,
    detail: (id: string) => `${BASE}/brands/${id}`,
    update: (id: string) => `${BASE}/brands/${id}`,
    delete: (id: string) => `${BASE}/brands/${id}`,
    settings: {
      get: (id: string) => `${BASE}/brands/${id}/settings`,
      update: (id: string) => `${BASE}/brands/${id}/settings`,
    },
    status: (id: string) => `${BASE}/brands/${id}/status`,
  },

  /** Projects (alternative to brand routes, maps to GEOProject) */
  project: {
    list: `${BASE}/projects`,
    create: `${BASE}/projects`,
    detail: (id: string) => `${BASE}/projects/${id}`,
    update: (id: string) => `${BASE}/projects/${id}`,
    delete: (id: string) => `${BASE}/projects/${id}`,
    entities: (projectId: string) => `${BASE}/projects/${projectId}/entities`,
    discover: (projectId: string) => `${BASE}/projects/${projectId}/discover`,
    graph: {
      main: (projectId: string) => `${BASE}/projects/${projectId}/graph`,
      edges: (projectId: string) => `${BASE}/projects/${projectId}/graph/edges`,
      node: (projectId: string, entityId: string) =>
        `${BASE}/projects/${projectId}/graph/node/${entityId}`,
      versions: (projectId: string, version: string) =>
        `${BASE}/projects/${projectId}/graph/versions/${version}`,
      visualize: (projectId: string) =>
        `${BASE}/projects/${projectId}/graph/visualize`,
      build: (projectId: string) =>
        `${BASE}/projects/${projectId}/graph/build`,
    },
    snapshot: (id: string) => `${BASE}/projects/${id}/snapshot`,
  },

  /** Entities */
  entity: {
    detail: (id: string) => `${BASE}/entities/${id}`,
    update: (id: string) => `${BASE}/entities/${id}`,
    relations: {
      add: (sourceId: string) => `${BASE}/entities/${sourceId}/relations`,
      list: (id: string) => `${BASE}/entities/${id}/relations`,
    },
    provenance: (id: string) => `${BASE}/entities/${id}/provenance`,
  },

  /** Keywords */
  keyword: {
    list: `${BASE}/keywords`,
    create: `${BASE}/keywords`,
    remove: (id: string) => `${BASE}/keywords/${id}`,
    import: `${BASE}/keywords/import`,
    export: `${BASE}/keywords/export`,
  },

  /** Scans */
  scan: {
    list: `${BASE}/scans`,
    create: `${BASE}/scans`,
    detail: (id: string) => `${BASE}/scans/${id}`,
    remove: (id: string) => `${BASE}/scans/${id}`,
  },

  /** Knowledge Objects */
  knowledge: {
    list: `${BASE}/knowledge`,
    detail: (id: string) => `${BASE}/knowledge/${id}`,
    status: (id: string) => `${BASE}/knowledge/${id}/status`,
    merge: `${BASE}/knowledge/merge`,
  },

  /** Claims */
  claim: {
    list: `${BASE}/claims`,
    detail: (id: string) => `${BASE}/claims/${id}`,
    update: (id: string) => `${BASE}/claims/${id}`,
  },

  /** Evidence */
  evidence: {
    list: `${BASE}/evidence`,
    detail: (id: string) => `${BASE}/evidence/${id}`,
  },

  /** History */
  history: {
    list: `${BASE}/history`,
    stats: `${BASE}/history/stats`,
  },

  /** Reports */
  report: {
    list: `${BASE}/reports`,
    generate: `${BASE}/reports/generate`,
  },

  /** Trace */
  trace: {
    list: `${BASE}/traces`,
    detail: (traceId: string) => `${BASE}/traces/${traceId}`,
    projectSummary: (projectId: string) =>
      `${BASE}/traces/project/${projectId}/summary`,
  },

  /** Watcher */
  watcher: {
    drift: `${BASE}/watcher/drift`,
    recent: `${BASE}/watcher/recent`,
    summary: `${BASE}/watcher/summary`,
  },

  /** Knowledge Quality */
  knowledgeQuality: {
    health: `${BASE}/knowledge-quality/health`,
    evaluate: `${BASE}/knowledge-quality`,
  },
} as const

export type GeoRouteKey = keyof typeof GeoRoutes
