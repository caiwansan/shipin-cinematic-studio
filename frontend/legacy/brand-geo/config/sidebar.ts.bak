// GEO Product Navigation — Consumer Mode
// Default visible: 工作台, 品牌分析, 品牌, 报告, 历史, 设置
// Hidden (default): Knowledge, Claim, Evidence, Graph, Trace, Execution Studio, Metadata, System
// Toggle "高级" to show hidden items

import type { SidebarMenuItem } from '~/studio-v2/types/geo/runtime'

// Consumer-facing navigation (always visible)
export const GEO_CONSUMER_MENU: SidebarMenuItem[] = [
  { id: 'workspace-v1', label: 'GEO 工作台', icon: '🌐', route: '/workspace/geo?panel=workspace-v1' },
  { id: 'dashboard', label: '工作台', icon: '📊', route: '/workspace/geo?panel=dashboard' },
  { id: 'wizard', label: '品牌分析', icon: '🚀', route: '/workspace/geo?panel=wizard' },
  { id: 'brands', label: '品牌', icon: '🏢', route: '/workspace/geo?panel=brands' },
  { id: 'report', label: '报告', icon: '📄', route: '/workspace/geo?panel=report' },
  { id: 'history', label: '历史', icon: '📜', route: '/workspace/geo?panel=history' },
  { id: 'settings', label: '设置', icon: '⚙️', route: '/workspace/geo?panel=settings' },
]

// Advanced navigation (hidden by default, shown when "高级" toggle is on)
// Uses progressive disclosure naming
export const GEO_ADVANCED_MENU: SidebarMenuItem[] = [
  { id: 'knowledge', label: '知识内容', icon: '📚', route: '/workspace/geo?panel=knowledge' },
  { id: 'claim', label: '事实', icon: '📋', route: '/workspace/geo?panel=claim' },
  { id: 'evidence', label: '来源', icon: '📄', route: '/workspace/geo?panel=evidence' },
  { id: 'knowledge-graph', label: '关系图', icon: '🔗', route: '/workspace/geo?panel=knowledge-graph' },
  { id: 'keywords', label: '搜索词', icon: '🔑', route: '/workspace/geo?panel=keywords' },
]

// Developer navigation (hidden, accessible via URL only)
// Not shown in sidebar even in expert mode
export const GEO_DEVELOPER_MENU: SidebarMenuItem[] = [
  { id: 'execution-studio', label: '执行工作室', icon: '🎬', route: '/workspace/geo?panel=execution-studio', adminOnly: true },
  { id: 'execution-trace', label: '分析记录', icon: '📋', route: '/workspace/geo?panel=execution-trace', adminOnly: true },
  { id: 'system-lens', label: '系统镜头', icon: '🔬', route: '/workspace/geo?panel=system-lens', adminOnly: true },
  { id: 'system-control', label: '系统控制', icon: '⚙️', route: '/workspace/geo?panel=system-control', adminOnly: true },
  { id: 'system-metadata', label: '配置信息', icon: '🌐', route: '/workspace/geo?panel=system-metadata', adminOnly: true },
]

// Legacy export for backward compatibility
export const GEO_SIDEBAR_MENU = GEO_CONSUMER_MENU
