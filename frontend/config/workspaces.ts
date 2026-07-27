/**
 * 工作台状态配置 — 唯一真相源
 *
 * 替代散落的 enabled: false / CSS 隐藏
 * 所有工作台入口读取此配置
 */

import type { WorkspaceConfig, WorkspaceStatus } from '../types/workspace'

export const workspaces: WorkspaceConfig[] = [
  // ===== stable =====
  {
    id: 'legal',
    name: '法律工作台',
    status: 'stable',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 90,
    note: '13 个路由，功能最完整的工作台之一',
  },
  {
    id: 'enterprise',
    name: '企业工作台',
    status: 'stable',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 85,
    note: '大型 B2B 模块，30+ 数据表',
  },
  {
    id: 'geo',
    name: 'GEO 知识图谱',
    status: 'stable',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 80,
    note: '品牌知识运营、内容发布、评分体系',
  },
  {
    id: 'knowledge-hub',
    name: '知识中枢',
    status: 'stable',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 80,
    note: '平台级知识中枢，插件方式注册',
  },
  {
    id: 'novel-public',
    name: '小说公开阅读',
    status: 'stable',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 75,
    note: '公开小说阅读入口，复用 HDZ 表',
  },
  {
    id: 'mall',
    name: '积分商城',
    status: 'stable',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 85,
    note: '独立电商模块，积分兑换',
  },
  {
    id: 'platform-workspace',
    name: '平台通用工作台',
    status: 'stable',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 85,
    note: '通用 CRUD 工作区级',
  },

  // ===== beta =====
  {
    id: 'director',
    name: '导演工作台',
    status: 'beta',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 70,
    note: 'AI 短剧全流程，BYOK，Pro 临时策略',
  },

  // ===== preview =====
  {
    id: 'job',
    name: '求职管家',
    status: 'preview',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 55,
    note: 'MVP 求职者端，AI职业顾问+岗位推荐+面试助手',
  },
  {
    id: 'recruitment',
    name: '企业招聘',
    status: 'preview',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 60,
    note: '企业招聘中心，AI岗位解析+人才匹配+招聘管理',
  },
  {
    id: 'ecom-image',
    name: '电商图片',
    status: 'preview',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 50,
    note: '简化版工作台，项目 CRUD + AI 分析/生成',
  },
  {
    id: 'media-department',
    name: '媒体部门',
    status: 'preview',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 45,
    note: '内部媒体部门管理，半完成',
  },

  // ===== hidden =====
  {
    id: 'music',
    name: '音乐工作台',
    status: 'stable',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 35,
    note: 'AI音乐创作、作曲、编曲',
  },
  {
    id: 'hdz',
    name: '小说写作',
    status: 'stable',
    visibleOnHome: true,
    routeAccessible: true,
    completion: 40,
    note: '混沌珠独立工作台',
  },
  {
    id: 'voice',
    name: '语音工作台',
    status: 'hidden',
    visibleOnHome: false,
    routeAccessible: false,
    completion: 30,
    note: '音色管理子模块，非完整独立工作台',
  },
]

/**
 * 首页过滤：只展示 stable / beta / preview
 */
export function getHomeVisibleWorkspaces(): WorkspaceConfig[] {
  return workspaces.filter(w => w.visibleOnHome)
}

/**
 * 按 ID 查找工作台
 */
export function getWorkspaceById(id: string): WorkspaceConfig | undefined {
  return workspaces.find(w => w.id === id)
}

/**
 * 获取状态描述文案
 */
export function getStatusLabel(status: WorkspaceStatus): string {
  const map: Record<WorkspaceStatus, string> = {
    stable: '正式版',
    beta: '公测版',
    preview: '预览版',
    hidden: '暂未开放',
    deprecated: '即将下线',
  }
  return map[status]
}

/**
 * 获取状态提示文案
 */
export function getStatusNotice(status: WorkspaceStatus): string | null {
  const map: Record<WorkspaceStatus, string | null> = {
    stable: null,
    beta: '公测版，功能完整但可能存在 bug。',
    preview: '预览版，部分功能未开放。',
    hidden: '该工作台暂未开放。',
    deprecated: '该工作台即将下线，仅保留历史数据查询。',
  }
  return map[status]
}
