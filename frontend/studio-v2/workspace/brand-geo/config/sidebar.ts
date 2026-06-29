// Brand GEO Product Navigation
// 分两部分：Product Nav + Developer Nav（管理员可见）

import type { SidebarMenuItem } from '~/studio-v2/types/geo/runtime'

export const GEO_SIDEBAR_MENU: SidebarMenuItem[] = [
  // 产品导航
  { id: 'dashboard', label: 'Dashboard', icon: '📊', route: '/workspace/geo?panel=dashboard' },
  { id: 'brands', label: '品牌管理', icon: '🏢', route: '/workspace/geo?panel=brands' },
  { id: 'website', label: '官网管理', icon: '🌐', route: '/workspace/geo?panel=website' },
  { id: 'keywords', label: '关键词管理', icon: '🔑', route: '/workspace/geo?panel=keywords' },
  { id: 'knowledge', label: 'Knowledge', icon: '📚', route: '/workspace/geo?panel=knowledge' },
  { id: 'knowledge-graph', label: '知识图谱', icon: '🔗', route: '/workspace/geo?panel=knowledge-graph' },
  { id: 'settings', label: '设置', icon: '⚙️', route: '/workspace/geo?panel=settings' },
]

export const GEO_DEVELOPER_MENU: SidebarMenuItem[] = [
  // 开发导航（仅管理员可见）
  { id: 'execution-studio', label: '执行工作室', icon: '🎬', route: '/workspace/geo?panel=execution-studio' },
  { id: 'execution-trace', label: '执行轨迹', icon: '📋', route: '/workspace/geo?panel=execution-trace' },
  { id: 'system-lens', label: '系统镜头', icon: '🔬', route: '/workspace/geo?panel=system-lens' },
  { id: 'system-control', label: '系统控制', icon: '⚙️', route: '/workspace/geo?panel=system-control' },
  { id: 'system-metadata', label: '系统元数据', icon: '🌐', route: '/workspace/geo?panel=system-metadata' },
]
