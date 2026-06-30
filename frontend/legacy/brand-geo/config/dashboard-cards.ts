// @deprecated — GEO v3 Legacy. Use design-system product blocks instead.
// ============================================================
// BrandGEO — 功能卡片配置
// 8 个 Dashboard 功能入口卡片
// ============================================================

export interface DashboardCard {
  id: string
  title: string
  description: string
  icon: string
  panelId: string
  color: string
  stats?: { label: string; value: string | number }[]
}

export const DASHBOARD_CARDS: DashboardCard[] = [
  {
    id: 'brands',
    title: '品牌管理',
    description: '管理您的品牌档案，查看品牌健康度',
    icon: '🏷️',
    panelId: 'brands',
    color: '#6366f1',
  },
  {
    id: 'entities',
    title: '实体图谱',
    description: '构建品牌关联实体网络，发现关联关系',
    icon: '🔗',
    panelId: 'entities',
    color: '#8b5cf6',
  },
  {
    id: 'visibility',
    title: '可见性分析',
    description: '追踪搜索引擎排名，监控品牌曝光度',
    icon: '👁️',
    panelId: 'visibility',
    color: '#06b6d4',
  },
  {
    id: 'citations',
    title: '引用追踪',
    description: '追踪全网品牌提及，分析舆情风向',
    icon: '📝',
    panelId: 'citations',
    color: '#10b981',
  },
  {
    id: 'topics',
    title: '热门话题',
    description: '发现行业热门话题，把握内容趋势',
    icon: '🔥',
    panelId: 'topics',
    color: '#f59e0b',
  },
  {
    id: 'competitors',
    title: '竞品分析',
    description: '分析竞争对手策略，找到差异化机会',
    icon: '🎯',
    panelId: 'competitors',
    color: '#ef4444',
  },
  {
    id: 'projects',
    title: '项目管理',
    description: '管理GEO优化项目，跟踪执行进度',
    icon: '📋',
    panelId: 'projects',
    color: '#3b82f6',
  },
  {
    id: 'tasks',
    title: '任务中心',
    description: '查看和处理待办任务，高效协作',
    icon: '✅',
    panelId: 'tasks',
    color: '#ec4899',
  },
]
