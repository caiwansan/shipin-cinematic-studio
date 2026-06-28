/**
 * 会员等级系统 — 唯一映射源
 * 
 * Truth Source: Membership.tier（数据库）
 * 所有前端页面必须通过此文件获取标签/颜色等展示信息
 * 
 * 禁止：switch(tier)、if(tier==='xxx') 硬编码旧等级
 * 新增等级时只改此处
 */

/** 会员等级 → 中文标签 */
export const MEMBERSHIP_LABELS: Record<string, string> = {
  free: '体验版',
  basic: '基础版',
  pro: '本地版',
  enterprise: '年卡',
  // 旧等级兼容（保留原名称）
  vip: 'VIP',
  vip_season: 'VIP季卡',
  vip_year: 'VIP年卡',
  gold: '黄金会员',
  premium: '黄金会员',
  Pro: '钻石会员',
  director: '至尊会员',
  standard: '标准',
  flagship: '旗舰',
  ultra: '至尊',
}

/** 会员等级 → CSS 颜色类名后缀（需在对应组件的 CSS 中定义） */
export const MEMBERSHIP_COLORS: Record<string, string> = {
  free: 'gray',
  basic: 'blue',
  pro: 'purple',
  enterprise: 'green',
  // 旧等级
  vip: 'yellow',
  premium: 'yellow',
  gold: 'amber',
  Pro: 'purple',
  director: 'rose',
}

/** 会员等级 → 标签过滤组（用于 COS 页面筛选） */
export const MEMBER_FILTER_GROUPS: Record<string, string[]> = {
  free: ['free'],
  vip: ['vip', 'premium', 'enterprise', 'pro', 'basic', 'gold', 'Pro', 'director'],
  all: [],
}

/**
 * 唯一安全的前端等级标签获取函数
 * 后端传过来的 tier 可能是旧等级，用此函数兜底
 */
export function getTierLabel(tier: string | null | undefined): string {
  if (!tier) return '体验版'
  return MEMBERSHIP_LABELS[tier] || tier
}

/**
 * 唯一安全的 badge 颜色类名获取函数
 */
export function getTierColorClass(tier: string | null | undefined): string {
  if (!tier) return 'gray'
  return MEMBERSHIP_COLORS[tier] || 'gray'
}

/** 判断是否属于 VIP（非 free 即 VIP） */
export function isVip(tier: string | null | undefined): boolean {
  return !!tier && tier !== 'free'
}

/** 旧等级 → 新等级映射（用于数据迁移/兼容） */
export const TIER_LEGACY_MAP: Record<string, string> = {
  gold: 'enterprise',
  premium: 'enterprise',
  vip: 'enterprise',
  vip_year: 'enterprise',
  vip_season: 'enterprise',
  Pro: 'enterprise',
  director: 'enterprise',
}
