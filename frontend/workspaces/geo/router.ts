/**
 * GEO Workspace Router
 *
 * Sub-route configuration for GEO workspace pages.
 * Routes:
 *   /workspace/geo/health          → HealthPage
 *   /workspace/geo/recommendations → RecommendationsPage
 *   /workspace/geo/verification    → VerificationPage
 *   /workspace/geo/publishing      → PublishingPage
 *   /workspace/geo/growth          → GrowthPage
 *   /workspace/geo/knowledge       → KnowledgePage
 *   /workspace/geo                 → redirect to /workspace/geo/health
 */
export const geoRoutes = [
  {
    path: '/workspace/geo',
    redirect: '/workspace/geo/health',
  },
  {
    path: '/workspace/geo/health',
    name: 'geo-health',
    component: () => import('./pages/HealthPage.vue'),
  },
  {
    path: '/workspace/geo/recommendations',
    name: 'geo-recommendations',
    component: () => import('./pages/RecommendationsPage.vue'),
  },
  {
    path: '/workspace/geo/verification',
    name: 'geo-verification',
    component: () => import('./pages/VerificationPage.vue'),
  },
  {
    path: '/workspace/geo/publishing',
    name: 'geo-publishing',
    component: () => import('./pages/PublishingPage.vue'),
  },
  {
    path: '/workspace/geo/growth',
    name: 'geo-growth',
    component: () => import('./pages/GrowthPage.vue'),
  },
  {
    path: '/workspace/geo/knowledge',
    name: 'geo-knowledge',
    component: () => import('./pages/KnowledgePage.vue'),
  },
  {
    path: '/workspace/geo/dashboard',
    name: 'geo-dashboard',
    component: () => import('./pages/GEODashboard.vue'),
  },
  {
    path: '/workspace/geo/discovery',
    name: 'geo-discovery',
    component: () => import('./pages/DiscoveryLabPage.vue'),
  },
  {
    path: '/workspace/geo/detail/:id',
    name: 'geo-detail',
    component: () => import('./pages/GEODetail.vue'),
  },
  {
    path: '/workspace/geo/create',
    name: 'geo-create',
    component: () => import('./pages/GEOCreate.vue'),
  },
]
