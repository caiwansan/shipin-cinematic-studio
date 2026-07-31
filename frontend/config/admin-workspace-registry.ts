/**
 * AdminWorkspaceRegistry — 昆仑镜后台管理导航注册表
 *
 * 🚫 冻结治理规则（Sprint-ADMIN-IA-REALITY-02）：
 *   > 后台管理 = 管理昆仑镜平台本身
 *   > 工作台管理 = 管理某个业务 Workspace 的运营能力
 *   > 企业管理 = 企业客户自己的组织/员工/订阅/资产管理
 *   > 个人中心 = 当前用户自己的账户与权益管理
 *
 *   不得混在一起。
 *
 * 硬规则：
 *   1. 一个 Workspace = 一个后台入口（全部折叠在「🏭 Workspace工作台管理」组内）
 *   2. 禁止在后台一级导航出现业务套餐/订阅/模型/ROI/额度（如 enterprise-plans / recruitment-roi）
 *      → 业务商业能力（套餐/订阅/能力/Agent）只允许存在于对应 Workspace 内部
 *   3. 新增功能只能进入所属模块内部，禁止新增一级菜单
 *   4. 新增 Workspace 的唯一方式：在 ADMIN_WORKSPACE_REGISTRY 增加一项（三件套：前台 + Workspace Registry + Route Registry）
 */

export interface AdminWorkspaceChild {
  id: string
  label: string
  to: string
}

export interface AdminWorkspaceEntry {
  /** 唯一码：recruitment / short-drama / novel / legal / geo / music / ... */
  code: string
  /** Workspace 显示名 */
  name: string
  icon: string
  /** 后台入口路由（唯一） */
  entry: string
  /** Workspace 内部子页（Tabs / 二级导航） */
  children: AdminWorkspaceChild[]
}

/** 平台运营模块组（折叠在一个一级入口下） */
export interface AdminPlatformGroup {
  id: string
  label: string
  icon: string
  children: AdminWorkspaceChild[]
}

/**
 * ─── 🏭 Workspace 工作台管理 ───
 * 一个 Workspace = 一个子项。业务商业能力（套餐/订阅/能力/Agent）只能存在于此。
 */
export const ADMIN_WORKSPACE_REGISTRY: AdminWorkspaceEntry[] = [
  {
    code: 'recruitment',
    name: '求职招聘管理',
    icon: '💼',
    entry: '/admin/recruitment',
    // ── Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01：25 页运营后台 → 5 页商业管理后台 ──
    // 只保留商业管理 5 入口；岗位/候选人/面试/会话/Campaign/审计/运行监控/ROI/日报/额度/模型健康
    // 全部退出后台导航（代码保留，URL 仍可达；运营数据归数据罗盘，业务数据归企业工作台）
    children: [
      { id: 'rec-agent-config', label: '求职管家 Agent 配置', to: '/admin/recruitment/config' },
      { id: 'rec-plans', label: '套餐订阅管理', to: '/admin/recruitment/plans' },
      { id: 'rec-agents', label: 'AI Agent 管理', to: '/admin/recruitment/agents' },
      { id: 'rec-enterprises', label: '企业用户管理', to: '/admin/recruitment/enterprises' },
      { id: 'rec-authorization', label: '企业套餐授权', to: '/admin/recruitment/authorization' },
    ],
  },
  {
    name: '法律工作台管理',
    icon: '⚖️',
    entry: '/admin/aigc/legal',
    children: [{ id: 'legal-main', label: '法律工作台', to: '/admin/aigc/legal' }],
  },
  {
    code: 'mall',
    name: '商城管理',
    icon: '🛒',
    entry: '/admin/aigc/mall',
    children: [{ id: 'mall-main', label: '商城管理', to: '/admin/aigc/mall' }],
  },
  {
    code: 'short-drama',
    name: '短剧工作台',
    icon: '🎬',
    entry: '/admin/workspace/short-drama/data',
    // SPRINT-ADMIN-CLEANUP-02 T03：统一壳（配置/Agent/数据/用户 4 Tab）
    children: [
      { id: 'sd-config', label: '配置', to: '/admin/workspace/short-drama/config' },
      { id: 'sd-agents', label: 'Agent', to: '/admin/workspace/short-drama/agents' },
      { id: 'sd-data', label: '数据', to: '/admin/workspace/short-drama/data' },
      { id: 'sd-users', label: '用户', to: '/admin/workspace/short-drama/users' },
    ],
  },
  {
    code: 'geo',
    name: 'GEO优化工作台',
    icon: '🌎',
    entry: '/admin/workspace/geo/data',
    // SPRINT-ADMIN-CLEANUP-02 T03：统一壳（配置/Agent/数据/用户 4 Tab）
    children: [
      { id: 'geo-config', label: '配置', to: '/admin/workspace/geo/config' },
      { id: 'geo-agents', label: 'Agent', to: '/admin/workspace/geo/agents' },
      { id: 'geo-data', label: '数据', to: '/admin/workspace/geo/data' },
      { id: 'geo-users', label: '用户', to: '/admin/workspace/geo/users' },
    ],
  },
  // ── SPRINT-ADMIN-CLEANUP-02 T03：未上线业务线隐藏，待业务真正上线再注册 ──
  // {
  //   code: 'novel', name: '小说工作台', icon: '📖', entry: '/admin/workspace/novel/data',
  //   children: [
  //     { id: 'novel-config', label: '配置', to: '/admin/workspace/novel/config' },
  //     { id: 'novel-agents', label: 'Agent', to: '/admin/workspace/novel/agents' },
  //     { id: 'novel-data', label: '数据', to: '/admin/workspace/novel/data' },
  //     { id: 'novel-users', label: '用户', to: '/admin/workspace/novel/users' },
  //   ],
  // },
  // { code: 'music', name: '音乐制作工作台', icon: '🎵', entry: '/admin/workspace/music/data', children: [] },
  // { code: 'ecom-image', name: '电商图片工作台', icon: '🖼️', entry: '/admin/workspace/ecom-image/data', children: [] },
  // { code: 'ad-create', name: '广告制作工作台', icon: '📣', entry: '/admin/workspace/ad-create/data', children: [] },
]

/**
 * ─── 📊 数据罗盘 ───
 * 平台全局数据总览。
 */
export const ADMIN_DASHBOARD: AdminWorkspaceChild = {
  id: 'dashboard',
  label: '数据罗盘',
  to: '/admin/dashboard',
}

/**
 * ─── 🌐 公共信息设置 ───
 * 短信/微信/QQ/邮件/支付/COS/CDN 等平台公共通道。
 */
export const ADMIN_PUBLIC_GROUP: AdminPlatformGroup = {
  id: 'public',
  label: '公共信息设置',
  icon: '🌐',
  children: [
    { id: 'pub-sms', label: '短信配置', to: '/admin/aigc/sms' },
    { id: 'pub-wechat', label: '微信配置', to: '/admin/aigc/wechat' },
    { id: 'pub-qq', label: 'QQ配置', to: '/admin/aigc/qq' },
    { id: 'pub-payment', label: '支付配置', to: '/admin/aigc/payment' },
    { id: 'pub-cos', label: 'COS对象存储', to: '/admin/aigc/cos' },
    // P2: 邮件配置 / CDN配置
  ],
}

/**
 * ─── 💎 VIP 套餐管理 ───
 * 平台级会员商业化（不是某个 Workspace 的业务）。
 */
export const ADMIN_VIP_GROUP: AdminPlatformGroup = {
  id: 'vip',
  label: 'VIP套餐管理',
  icon: '💎',
  children: [
    { id: 'vip-plans', label: '套餐列表', to: '/admin/aigc/vip' },
    { id: 'vip-orders', label: 'VIP订单', to: '/admin/aigc/vip-orders' },
  ],
}

/**
 * ─── 👥 用户与权限 ───
 * 用户/会员/管理员/角色权限/代理/企业客户。
 */
export const ADMIN_USER_GROUP: AdminPlatformGroup = {
  id: 'users',
  label: '用户与权限',
  icon: '👥',
  children: [
    { id: 'usr-members', label: '会员管理', to: '/admin/aigc/members' },
    { id: 'usr-admins', label: '管理员管理', to: '/admin/aigc/admins' },
    { id: 'usr-market', label: '代理管理', to: '/admin/aigc/market' },
    { id: 'usr-community', label: '社区管理', to: '/admin/aigc/community' },
    { id: 'usr-messages', label: '发私信', to: '/admin/aigc/messages' },
    { id: 'usr-enterprises', label: '企业客户列表', to: '/admin/aigc/enterprises' },
    // P2: 角色权限管理
  ],
}

/**
 * ─── 🤖 大模型管理 ───
 * 模型列表 / Provider / 平台模型配置 / 健康检测 / 调用统计。
 */
export const ADMIN_LLM_GROUP: AdminPlatformGroup = {
  id: 'llm',
  label: '大模型管理',
  icon: '🤖',
  children: [
    { id: 'llm-models', label: '模型列表', to: '/admin/aigc/models' },
    // P2: Provider管理 / 平台模型配置 / 调用统计
  ],
}

/**
 * ─── 🧠 AI Agent 管理 ───
 * Agent列表 / 模板 / 能力 / Runtime状态 / 使用统计。
 */
export const ADMIN_AGENT_GROUP: AdminPlatformGroup = {
  id: 'agents',
  label: 'AI Agent管理',
  icon: '🧠',
  children: [
    { id: 'agt-agents', label: 'AI员工', to: '/admin/aigc/agents' },
    // SPRINT-ADMIN-CLEANUP-02-FIX：Runtime状态已废弃（API 从未挂载+表不存在），AI 基础设施在数据罗盘第八层
    { id: 'agt-styles', label: '能力资源（风格库）', to: '/admin/aigc/styles' },
  ],
}

/**
 * ─── ⚙️ 系统设置 ───
 * 基础信息（系统名称/Logo/域名/ICP/SEO）+ SEO收录配置。
 */
export const ADMIN_SYSTEM_GROUP: AdminPlatformGroup = {
  id: 'system',
  label: '系统设置',
  icon: '⚙️',
  children: [
    { id: 'sys-base', label: '基础信息 + SEO', to: '/admin/aigc/system' },
    // P2: SEO收录配置（robots/sitemap/验证独立页，当前合并于 system.vue）
  ],
}

/** 完整后台一级导航（供 layout 渲染） */
export interface AdminNavSection {
  kind: 'link' | 'group' | 'workspace-group'
  id: string
  label: string
  icon: string
  to?: string
  children?: AdminWorkspaceChild[]
  /** workspace-group 专用：全部 Workspace 子项 */
  workspaces?: AdminWorkspaceEntry[]
}

export function buildAdminNav(): AdminNavSection[] {
  const sections: AdminNavSection[] = [
    // 📊 数据罗盘
    { kind: 'link', id: 'dashboard', label: ADMIN_DASHBOARD.label, icon: '📊', to: ADMIN_DASHBOARD.to },
    // 🌐 公共信息设置
    {
      kind: 'group',
      id: ADMIN_PUBLIC_GROUP.id,
      label: ADMIN_PUBLIC_GROUP.label,
      icon: ADMIN_PUBLIC_GROUP.icon,
      children: ADMIN_PUBLIC_GROUP.children,
    },
    // 💎 VIP 套餐管理
    {
      kind: 'group',
      id: ADMIN_VIP_GROUP.id,
      label: ADMIN_VIP_GROUP.label,
      icon: ADMIN_VIP_GROUP.icon,
      children: ADMIN_VIP_GROUP.children,
    },
    // 👥 用户与权限
    {
      kind: 'group',
      id: ADMIN_USER_GROUP.id,
      label: ADMIN_USER_GROUP.label,
      icon: ADMIN_USER_GROUP.icon,
      children: ADMIN_USER_GROUP.children,
    },
    // 🤖 大模型管理
    {
      kind: 'group',
      id: ADMIN_LLM_GROUP.id,
      label: ADMIN_LLM_GROUP.label,
      icon: ADMIN_LLM_GROUP.icon,
      children: ADMIN_LLM_GROUP.children,
    },
    // 🧠 AI Agent 管理
    {
      kind: 'group',
      id: ADMIN_AGENT_GROUP.id,
      label: ADMIN_AGENT_GROUP.label,
      icon: ADMIN_AGENT_GROUP.icon,
      children: ADMIN_AGENT_GROUP.children,
    },
    // 🏭 Workspace 工作台管理（全部 Workspace 折叠在此）
    {
      kind: 'workspace-group',
      id: 'workspaces',
      label: 'Workspace工作台管理',
      icon: '🏭',
      workspaces: ADMIN_WORKSPACE_REGISTRY,
    },
    // ⚙️ 系统设置
    {
      kind: 'group',
      id: ADMIN_SYSTEM_GROUP.id,
      label: ADMIN_SYSTEM_GROUP.label,
      icon: ADMIN_SYSTEM_GROUP.icon,
      children: ADMIN_SYSTEM_GROUP.children,
    },
  ]
  // 过滤空 children 的 group（如系统设置 P2 待建）
  return sections.filter(s => {
    if (s.kind === 'group') return (s.children?.length ?? 0) > 0
    return true
  })
}
