// AI Knowledge Hub — Router Configuration
// 6 pages under /workspace/knowledge-hub/

import type { RouteRecordRaw } from 'vue-router';

export const knowledgeHubRoutes: RouteRecordRaw[] = [
  {
    path: '/workspace/knowledge-hub',
    name: 'knowledge-hub',
    redirect: '/workspace/knowledge-hub/index',
  },
  {
    path: '/workspace/knowledge-hub/index',
    name: 'knowledge-hub-dashboard',
    component: () => import('../../pages/workspace/knowledge-hub/index.vue'),
    meta: { title: 'AI Knowledge Hub — Overview' },
  },
  {
    path: '/workspace/knowledge-hub/brand',
    name: 'knowledge-hub-brand',
    component: () => import('../../pages/workspace/knowledge-hub/brand.vue'),
    meta: { title: 'AI Knowledge Hub — Brand Center' },
  },
  {
    path: '/workspace/knowledge-hub/product',
    name: 'knowledge-hub-product',
    component: () => import('../../pages/workspace/knowledge-hub/product.vue'),
    meta: { title: 'AI Knowledge Hub — Product Center' },
  },
  {
    path: '/workspace/knowledge-hub/knowledge',
    name: 'knowledge-hub-knowledge',
    component: () => import('../../pages/workspace/knowledge-hub/knowledge.vue'),
    meta: { title: 'AI Knowledge Hub — Knowledge Center' },
  },
  {
    path: '/workspace/knowledge-hub/entity',
    name: 'knowledge-hub-entity',
    component: () => import('../../pages/workspace/knowledge-hub/entity.vue'),
    meta: { title: 'AI Knowledge Hub — Entity Center' },
  },
  {
    path: '/workspace/knowledge-hub/publishing',
    name: 'knowledge-hub-publishing',
    component: () => import('../../pages/workspace/knowledge-hub/publishing.vue'),
    meta: { title: 'AI Knowledge Hub — Publishing Center' },
  },
];

export default knowledgeHubRoutes;
