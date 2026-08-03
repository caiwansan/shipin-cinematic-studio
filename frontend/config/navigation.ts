/**
 * 昆仑镜导航配置
 * 所有「更多项目」入口集中配置，未来新增项目只改此文件
 */
export type RealmStatus = 'stable' | 'beta' | 'preview' | 'hidden' | 'deprecated'

export interface NavItem {
  label: string
  icon: string
  to: string
  desc?: string
  badge?: string
  disabled?: boolean
  /** 工作台状态，hidden 时不展示 */
  status?: RealmStatus
}

export interface NavCategory {
  title: string
  items: NavItem[]
}

export const navCategories: NavCategory[] = [
  {
    title: '第一排',
    items: [
      { label: '短剧工作台', icon: '🎬', to: '/studio/v2', desc: 'AI短剧策划、剧本、分镜、视频生产', status: 'beta' },
      { label: '音乐创作', icon: '🎵', to: '/workspace/music', desc: 'AI音乐创作、作曲、编曲' },
      { label: '小说创作', icon: '📖', to: '/hdz', desc: 'AI小说生成、世界观、角色创作' },
    ],
  },
  {
    title: '第二排',
    items: [
      { label: '法律工作台', icon: '⚖️', to: '/workspace/legal', desc: 'AI法律助手、合同分析、法律文书' },
      { label: 'PPT制作', icon: '📊', to: '/ppt/', desc: 'AI演示文稿、商业汇报' },
      { label: 'GEO优化', icon: '🌐', to: '/workspace/geo/dashboard', desc: 'AI搜索优化、品牌智能增长' },
    ],
  },
  {
    title: '第三排',
    items: [
      { label: 'AI全渠道运营中心', icon: '📱', to: '/workspace/media', desc: '我的 AI 员工团队 · 内容平台 · 电商店铺 · 客户渠道' },
      { label: '电商图片', icon: '🖼️', to: '/workspace/ecom-image', desc: '商品图、营销视觉、电商素材' },
      { label: '广告制作', icon: '📢', to: '/workspace/ad-create' },
      { label: '🪞 镜心 · AI 职业伙伴', icon: '🪞', to: '/workspace/job', badge: '⭐新', desc: '认识自己 · 规划方向 · 发现机会 · 提升竞争力' },
      { label: '企业招聘', icon: '🏢', to: '/workspace/recruitment', desc: 'AI岗位解析、人才智能匹配、招聘决策辅助' },
    ],
  },
]

export const primaryNav: NavItem[] = [
  { label: '商城', icon: '🛍️', to: '/mall' },
  { label: '社区', icon: '🌐', to: '/community' },
  // 应用中心：应用生态入口层（掌柜指令 2026-08-04 ECO-09）
  { label: '应用中心', icon: '🧩', to: '/ecosystem/applications' },
  // 插件中心：AI 能力生态入口层（掌柜指令 2026-08-04 ECO-10.1，与应用中心并列：应用=使用工具，插件=增强能力）
  { label: '插件中心', icon: '🔌', to: '/ecosystem/plugins' },
  // AI Center：昆仑镜 AI 生态入口层（掌柜指令 2026-08-01）
  { label: 'AI中心', icon: '🧠', to: '/ai-center' },
]
