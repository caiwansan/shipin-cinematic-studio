// ============================================================
// BrandGEO — Sidebar 菜单配置 (Phase 1 + Phase 2 + Phase 2.5)
// ============================================================

import type { SidebarMenuItem } from '~/studio-v2/types/geo/runtime'

export const GEO_SIDEBAR_MENU: SidebarMenuItem[] = [
  {
    id: 'dashboard',
    label: '总览仪表盘',
    icon: '📊',
    route: '/workspace/geo?panel=dashboard',
  },
  {
    id: 'asset-center',
    label: '资产中心',
    icon: '📦',
    route: '/workspace/geo?panel=asset-center',
  },
  {
    id: 'brand-profile',
    label: '品牌档案',
    icon: '🏷️',
    route: '/workspace/geo?panel=brand-profile',
  },
  {
    id: 'website-scanner',
    label: '网站扫描',
    icon: '🔍',
    route: '/workspace/geo?panel=website-scanner',
  },
  {
    id: 'knowledge-graph',
    label: '知识图谱',
    icon: '🔗',
    route: '/workspace/geo?panel=knowledge-graph',
  },
  {
    id: 'semantic-explorer',
    label: '语义管理器',
    icon: '🧠',
    route: '/workspace/geo?panel=semantic-explorer',
  },
  {
    id: 'entities',
    label: '实体图谱',
    icon: '🔗',
    route: '/workspace/geo?panel=entities',
  },
  {
    id: 'visibility',
    label: '可见性分析',
    icon: '👁️',
    route: '/workspace/geo?panel=visibility',
  },
  {
    id: 'citations',
    label: '引用追踪',
    icon: '📝',
    route: '/workspace/geo?panel=citations',
  },
  {
    id: 'topics',
    label: '热门话题',
    icon: '🔥',
    route: '/workspace/geo?panel=topics',
  },
  {
    id: 'projects',
    label: '项目管理',
    icon: '📋',
    route: '/workspace/geo?panel=projects',
  },
  {
    id: 'tasks',
    label: '任务中心',
    icon: '✅',
    route: '/workspace/geo?panel=tasks',
  },
  {
    id: 'settings',
    label: '设置',
    icon: '⚙️',
    route: '/workspace/geo?panel=settings',
  },
]
