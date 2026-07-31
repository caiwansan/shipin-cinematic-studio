/**
 * AdminRouteRegistry — 昆仑镜后台页面归属登记表
 *
 * ⚠️ 冻结治理规则（Sprint-ADMIN-IA-REALITY-01-B）：
 *   任何新 Workspace 必须同时提交：
 *     1. 前台 Workspace
 *     2. 后台 Workspace Registry（admin-workspace-registry.ts）
 *     3. Admin Route Registry（本文件）
 *   缺一不可。禁止孤儿页面（无归属的后台页面）。
 *
 * 状态语义：
 *   active     — 正常页面，归属于某个 Workspace / platform / system
 *   deprecated — 废弃页面，保留代码不删除，replacement 指向替代路由
 *
 * 页面归属分类（Sprint-ADMIN-IA-REALITY-02 对齐）：
 *   platform  — 平台运营管理（公共信息设置 🌐 / VIP 💎 / 用户与权限 👥 / 大模型 🤖 / AI Agent 🧠）
 *   system    — 系统设置（⚙️）
 *   workspace — 归属某个 Workspace（code 对应 ADMIN_WORKSPACE_REGISTRY，全部折叠在 🏭 工作台管理组内）
 *   deprecated— 废弃归档
 */

export type AdminRouteStatus = 'active' | 'deprecated'
export type AdminRouteOwner = 'platform' | 'system' | 'workspace' | 'deprecated'

export interface AdminRouteEntry {
  /** 后台路由（不含 [id] 动态段，动态段用父路由登记） */
  route: string
  /** 归属分类 */
  owner: AdminRouteOwner
  /** workspace: 对应的 Workspace code（owner=workspace 时必填） */
  workspace?: string
  status: AdminRouteStatus
  /** 废弃原因（status=deprecated 时必填） */
  deprecatedReason?: string
  /** 替代路由（status=deprecated 时建议填） */
  replacement?: string
  /** 备注 */
  note?: string
}

/**
 * 后台全量路由归属登记表
 * CI 检查（scripts/route-ownership-check.mjs）会扫描 pages/admin/* 与此表比对，
 * 未登记的页面 → build warning；已登记为 deprecated 的页面 → 允许存在但警告。
 */
export const ADMIN_ROUTE_REGISTRY: AdminRouteEntry[] = [
  // ─── 🏠 控制台 ───
  { route: '/admin/aigc/overview', owner: 'platform', status: 'active', note: '总控制台' },
  { route: '/admin/dashboard', owner: 'platform', status: 'active', note: '数据罗盘（昆仑镜 AI Operating Center）' },

  // ─── 🔐 平台公共管理 ───
  { route: '/admin/aigc/models', owner: 'platform', status: 'active', note: '大模型列表' },
  { route: '/admin/aigc/members', owner: 'platform', status: 'active', note: '会员模块' },
  { route: '/admin/aigc/payment', owner: 'platform', status: 'active', note: '支付设置' },
  { route: '/admin/aigc/vip', owner: 'platform', status: 'active', note: 'VIP套餐管理' },
  { route: '/admin/aigc/admins', owner: 'platform', status: 'active', note: '管理员设置' },
  { route: '/admin/aigc/cos', owner: 'platform', status: 'active', note: 'COS用户存储' },
  { route: '/admin/aigc/community', owner: 'platform', status: 'active', note: '社区管理' },
  { route: '/admin/aigc/messages', owner: 'platform', status: 'active', note: '发私信' },
  { route: '/admin/aigc/agents', owner: 'platform', status: 'active', note: 'Agent管理' },
  { route: '/admin/aigc/market', owner: 'platform', status: 'active', note: '市场代理管理' },
  { route: '/admin/aigc/styles', owner: 'platform', status: 'active', note: '风格库（AI资源管理）' },
  { route: '/admin/aigc/runtime', owner: 'platform', status: 'active', note: 'Runtime监控（Hermes/Worker执行监控）' },
  { route: '/admin/aigc/vip-orders', owner: 'platform', status: 'active', note: 'VIP订单（商业中心）' },
  { route: '/admin/aigc/mall', owner: 'workspace', workspace: 'mall', status: 'active', note: '商城管理' },
  { route: '/admin/aigc/legal', owner: 'workspace', workspace: 'legal', status: 'active', note: '法律工作台管理' },

  // ─── ⚙️ 系统设置 ───
  { route: '/admin/aigc/system', owner: 'system', status: 'active', note: '系统设置（基础信息+SEO）' },
  { route: '/admin/aigc/sms', owner: 'system', status: 'active', note: '短信配置' },
  { route: '/admin/aigc/wechat', owner: 'system', status: 'active', note: '微信登录配置' },
  { route: '/admin/aigc/qq', owner: 'system', status: 'active', note: 'QQ登录配置' },

  // ─── 🚪 登录 ───
  { route: '/admin/aigc/login', owner: 'system', status: 'active', note: '管理员登录' },

  // ─── 💼 求职招聘 Workspace（recruitment）───
  { route: '/admin/recruitment', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '招聘概览' },
  { route: '/admin/recruitment/jobs', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '岗位管理' },
  { route: '/admin/recruitment/candidates', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '候选人管理' },
  { route: '/admin/recruitment/agents', owner: 'workspace', workspace: 'recruitment', status: 'active', note: 'AI员工管理' },
  { route: '/admin/recruitment/interviews', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '面试管理' },
  { route: '/admin/recruitment/conversations', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '会话管理' },
  { route: '/admin/recruitment/campaigns', owner: 'workspace', workspace: 'recruitment', status: 'active', note: 'Campaign' },
  { route: '/admin/recruitment/departments', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '企业招聘部门' },
  { route: '/admin/recruitment/reviews', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '审核队列' },
  { route: '/admin/recruitment/plans', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '套餐管理（旧入口，保留 redirect）' },
  { route: '/admin/recruitment/subscriptions', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '订阅管理（旧入口，保留 redirect）' },
  { route: '/admin/recruitment/config', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '配置' },
  { route: '/admin/recruitment/audit', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '审计中心' },
  { route: '/admin/recruitment/runtime', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '运行监控' },

  // ─── 💼 企业域（原 /admin/enterprise/*，归招聘 Workspace）───
  { route: '/admin/enterprise/subscriptions', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '企业订阅' },
  { route: '/admin/enterprise/plans', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '套餐定义' },
  { route: '/admin/enterprise/llm-health', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '模型健康中心' },
  { route: '/admin/enterprise/agent-activity', owner: 'workspace', workspace: 'recruitment', status: 'active', note: 'AI员工活动' },
  { route: '/admin/enterprise/roi-report', owner: 'workspace', workspace: 'recruitment', status: 'active', note: 'AI员工ROI' },
  { route: '/admin/enterprise/pilot-dashboard', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '企业试运营' },
  { route: '/admin/enterprise/daily-report', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '员工工作日报' },
  { route: '/admin/enterprise/quotas', owner: 'workspace', workspace: 'recruitment', status: 'active', note: 'AI员工额度' },
  { route: '/admin/enterprise/revenue', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '收入报表' },
  { route: '/admin/enterprise/validation', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '企业入驻审核' },
  { route: '/admin/enterprise/recruitment', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '企业招聘管理（冻结/恢复企业）' },

  // ─── 🗄 企业列表（合并候选）───
  { route: '/admin/aigc/enterprises', owner: 'platform', status: 'active', note: '企业列表（与 /admin/enterprises 合并候选）' },
  { route: '/admin/enterprises', owner: 'platform', status: 'active', note: '企业列表（与 /admin/aigc/enterprises 合并候选）' },

  // ─── 🗑 Deprecated（保留代码，不删除）───
  {
    route: '/admin/aigc/beta-customers',
    owner: 'deprecated',
    status: 'deprecated',
    deprecatedReason: 'BetaCustomer 无独立业务入口，疑似废弃',
    replacement: '/admin/aigc/members',
    note: '不删除文件，仅隐藏导航',
  },
  {
    route: '/admin/aigc/customer-service',
    owner: 'deprecated',
    status: 'deprecated',
    deprecatedReason: '客服管理 V4.2 业务废弃',
    replacement: '/admin/aigc/messages',
    note: '入口已隐藏，保留代码可恢复',
  },
]

/** 查询路由归属 */
export function findAdminRoute(route: string): AdminRouteEntry | undefined {
  return ADMIN_ROUTE_REGISTRY.find(e => e.route === route)
}

/** 校验：该路由是否允许存在（active 或 deprecated 均可，孤儿不允许） */
export function isRouteRegistered(route: string): boolean {
  return ADMIN_ROUTE_REGISTRY.some(e => e.route === route)
}
