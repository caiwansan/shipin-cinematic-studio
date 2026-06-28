// ============================================================
// BrandGEO — Sidebar 菜单配置
// 12 个一级菜单项
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
    id: 'brands',
    label: '品牌管理',
    icon: '🏷️',
    route: '/workspace/geo?panel=brands',
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
    id: 'competitors',
    label: '竞品分析',
    icon: '🎯',
    route: '/workspace/geo?panel=competitors',
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
    id: 'reports',
    label: '报告中心',
    icon: '📈',
    route: '/workspace/geo?panel=reports',
  },
  {
    id: 'settings',
    label: '设置',
    icon: '⚙️',
    route: '/workspace/geo?panel=settings',
  },
  {
    id: 'help',
    label: '帮助与教程',
    icon: '❓',
    route: '/workspace/geo?panel=help',
  },
]
