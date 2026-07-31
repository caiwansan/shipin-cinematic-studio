/**
 * AdminWorkspaceRegistry — 昆仑镜后台管理 Workspace 注册表
 *
 * ⚠️ 冻结规则（Sprint-ADMIN-IA-REALITY-01）：
 *   一个前台 Workspace 在后台只能有一个一级导航入口。
 *   新增功能只能进入 Workspace 内部 Tabs，禁止新增一级菜单。
 *   新增 Workspace 的唯一方式：在此 Registry 增加一项。
 *
 * 一级菜单数量控制：10~15 个以内。
 */

export interface AdminWorkspaceChild {
  id: string
  label: string
  to: string
}

export interface AdminWorkspaceEntry {
  /** 唯一码：recruitment / short-drama / novel / legal / geo / ... */
  code: string
  /** 一级导航显示名 */
  name: string
  icon: string
  /** 后台入口路由（唯一） */
  entry: string
  /** Workspace 内部子页（Tabs / 二级导航） */
  children: AdminWorkspaceChild[]
}

/** 平台公共管理（不属于任何 Workspace，折叠在一个一级入口下） */
export interface AdminPlatformGroup {
  id: string
  label: string
  icon: string
  children: AdminWorkspaceChild[]
}

/** 前台 Workspace → 后台一级入口 映射表 */
export const ADMIN_WORKSPACE_REGISTRY: AdminWorkspaceEntry[] = [
  {
    code: 'recruitment',
    name: '求职招聘管理',
    icon: '💼',
    entry: '/admin/recruitment',
    children: [
      { id: 'rec-overview', label: '概览', to: '/admin/recruitment' },
      { id: 'rec-jobs', label: '岗位管理', to: '/admin/recruitment/jobs' },
      { id: 'rec-candidates', label: '候选人管理', to: '/admin/recruitment/candidates' },
      { id: 'rec-agents', label: 'AI员工管理', to: '/admin/recruitment/agents' },
      { id: 'rec-interviews', label: '面试管理', to: '/admin/recruitment/interviews' },
      { id: 'rec-conversations', label: '会话管理', to: '/admin/recruitment/conversations' },
      { id: 'rec-campaigns', label: 'Campaign', to: '/admin/recruitment/campaigns' },
      { id: 'rec-departments', label: '企业招聘部门', to: '/admin/recruitment/departments' },
      { id: 'rec-reviews', label: '审核队列', to: '/admin/recruitment/reviews' },
      { id: 'rec-plans', label: '套餐管理', to: '/admin/recruitment/plans' },
      { id: 'rec-subscriptions', label: '订阅管理', to: '/admin/recruitment/subscriptions' },
      { id: 'rec-config', label: '配置', to: '/admin/recruitment/config' },
      { id: 'rec-audit', label: '审计中心', to: '/admin/recruitment/audit' },
      { id: 'rec-runtime', label: '运行监控', to: '/admin/recruitment/runtime' },
      // ── 企业域（原 /admin/enterprise/* 一级菜单，全部折叠进招聘 Workspace）──
      { id: 'ent-subscriptions', label: '企业订阅', to: '/admin/enterprise/subscriptions' },
      { id: 'ent-plans', label: '套餐定义', to: '/admin/enterprise/plans' },
      { id: 'ent-llm-health', label: '模型健康中心', to: '/admin/enterprise/llm-health' },
      { id: 'ent-agent-activity', label: 'AI员工活动', to: '/admin/enterprise/agent-activity' },
      { id: 'ent-roi', label: 'AI员工ROI', to: '/admin/enterprise/roi-report' },
      { id: 'ent-pilot', label: '企业试运营', to: '/admin/enterprise/pilot-dashboard' },
      { id: 'ent-daily-report', label: '员工工作日报', to: '/admin/enterprise/daily-report' },
      { id: 'ent-quotas', label: 'AI员工额度', to: '/admin/enterprise/quotas' },
      { id: 'ent-revenue', label: '收入报表', to: '/admin/enterprise/revenue' },
      { id: 'ent-validation', label: '企业入驻审核', to: '/admin/enterprise/validation' },
    ],
  },
  {
    code: 'legal',
    name: '法律工作台管理',
    icon: '⚖️',
    entry: '/admin/aigc/legal',
    children: [{ id: 'legal-main', label: '法律工作台', to: '/admin/aigc/legal' }],
  },
  {
    code: 'short-drama',
    name: '短剧工作台管理',
    icon: '🎬',
    entry: '/admin/aigc/overview', // 占位：短剧后台尚未独立，P1 接入
    children: [],
  },
  {
    code: 'novel',
    name: '小说工作台管理',
    icon: '📖',
    entry: '/admin/aigc/overview', // 占位：小说后台尚未独立，P1 接入
    children: [],
  },
  {
    code: 'geo',
    name: 'GEO优化管理',
    icon: '🌎',
    entry: '/admin/aigc/overview', // 占位：GEO 后台尚未独立，P1 接入
    children: [],
  },
  {
    code: 'ecom-image',
    name: '电商图片管理',
    icon: '🖼',
    entry: '/admin/aigc/overview', // 占位：P1 接入
    children: [],
  },
  {
    code: 'ad-create',
    name: '广告制作管理',
    icon: '📣',
    entry: '/admin/aigc/overview', // 占位：P1 接入
    children: [],
  },
  {
    code: 'mall',
    name: '商城管理',
    icon: '🛒',
    entry: '/admin/aigc/mall',
    children: [{ id: 'mall-main', label: '商城管理', to: '/admin/aigc/mall' }],
  },
]

/** 平台公共管理组（折叠入口） */
export const ADMIN_PLATFORM_GROUP: AdminPlatformGroup = {
  id: 'platform',
  label: '平台公共管理',
  icon: '🔐',
  children: [
    { id: 'p-models', label: '大模型列表', to: '/admin/aigc/models' },
    { id: 'p-members', label: '会员模块', to: '/admin/aigc/members' },
    { id: 'p-payment', label: '支付设置', to: '/admin/aigc/payment' },
    { id: 'p-vip', label: 'VIP套餐管理', to: '/admin/aigc/vip' },
    { id: 'p-admins', label: '管理员设置', to: '/admin/aigc/admins' },
    { id: 'p-cos', label: 'COS用户存储', to: '/admin/aigc/cos' },
    { id: 'p-community', label: '社区管理', to: '/admin/aigc/community' },
    { id: 'p-messages', label: '发私信', to: '/admin/aigc/messages' },
    { id: 'p-agents', label: 'Agent管理', to: '/admin/aigc/agents' },
    { id: 'p-market', label: '市场代理管理', to: '/admin/aigc/market' },
    { id: 'p-revenue', label: '收入报表', to: '/admin/enterprise/revenue' },
  ],
}

/** 系统设置组 */
export const ADMIN_SYSTEM_GROUP: AdminPlatformGroup = {
  id: 'system',
  label: '系统设置',
  icon: '⚙️',
  children: [
    { id: 's-sms', label: '短信配置', to: '/admin/aigc/sms' },
    { id: 's-wechat', label: '微信登录配置', to: '/admin/aigc/wechat' },
    { id: 's-qq', label: 'QQ登录配置', to: '/admin/aigc/qq' },
  ],
}

/** 完整后台一级导航（供 layout 渲染） */
export interface AdminNavSection {
  kind: 'link' | 'group' | 'workspace'
  id: string
  label: string
  icon: string
  to?: string
  children?: AdminWorkspaceChild[]
}

export function buildAdminNav(): AdminNavSection[] {
  const sections: AdminNavSection[] = [
    { kind: 'link', id: 'overview', label: '控制台', icon: '🏠', to: '/admin/aigc/overview' },
    {
      kind: 'group',
      id: ADMIN_PLATFORM_GROUP.id,
      label: ADMIN_PLATFORM_GROUP.label,
      icon: ADMIN_PLATFORM_GROUP.icon,
      children: ADMIN_PLATFORM_GROUP.children,
    },
    ...ADMIN_WORKSPACE_REGISTRY.filter(w => w.children.length > 0).map(w => ({
      kind: 'workspace' as const,
      id: `ws-${w.code}`,
      label: w.name,
      icon: w.icon,
      to: w.entry,
      children: w.children,
    })),
    {
      kind: 'group',
      id: ADMIN_SYSTEM_GROUP.id,
      label: ADMIN_SYSTEM_GROUP.label,
      icon: ADMIN_SYSTEM_GROUP.icon,
      children: ADMIN_SYSTEM_GROUP.children,
    },
  ]
  return sections
}
