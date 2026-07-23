import { MemberTier } from '../middleware/require-member-tier.js'

export type RouteTierPolicy = {
  tier: MemberTier
  enforce: boolean
  pendingConfirmation?: boolean
  note?: string
}

export const routeTierPolicy: Record<string, RouteTierPolicy> = {
  'legal.agent.chat': {
    tier: MemberTier.Pro,
    enforce: true,
    pendingConfirmation: false,
    note: '法律 Agent Chat，已确认 Pro'
  },

  'director.generate': {
    tier: MemberTier.Pro,
    enforce: true,
    pendingConfirmation: true,
    note: '导演工作台生成，临时 Pro，待掌柜确认'
  },

  'director.compileBlueprint': {
    tier: MemberTier.Pro,
    enforce: true,
    pendingConfirmation: true,
    note: '导演工作台蓝图编译，临时 Pro，待掌柜确认'
  },

  'director.render': {
    tier: MemberTier.Pro,
    enforce: true,
    pendingConfirmation: true,
    note: '导演工作台渲染，临时 Pro，待掌柜确认'
  },

  'director.observatory': {
    tier: MemberTier.Pro,
    enforce: true,
    pendingConfirmation: true,
    note: '导演工作台观测台，临时 Pro，待掌柜确认'
  },

  'aiOptimize.adScript': {
    tier: MemberTier.Basic,
    enforce: true,
    pendingConfirmation: true,
    note: '广告脚本优化，临时 Plus，待掌柜确认'
  },

  'aiOptimize.imagePrompt': {
    tier: MemberTier.Pro,
    enforce: true,
    pendingConfirmation: true,
    note: '图片提示词优化，临时 Pro，待掌柜确认'
  },

  'aiOptimize.videoPrompt': {
    tier: MemberTier.Pro,
    enforce: true,
    pendingConfirmation: true,
    note: '视频提示词优化，临时 Pro，待掌柜确认'
  }
}
