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
  { route: '/admin/aigc/agents', owner: 'platform', status: 'active', note: 'AI员工运营中心（5 Tab：员工/模板/能力/运行/价值）' },
  { route: '/admin/aigc/market', owner: 'platform', status: 'active', note: '市场代理管理' },
  { route: '/admin/aigc/styles', owner: 'platform', status: 'active', note: '风格库（AI资源管理）' },
  { route: '/admin/aigc/runtime', owner: 'platform', status: 'deprecated', note: 'Runtime监控（Hermes/Worker执行监控）：API 从未挂载（credential-lifecycle 路由群 0 注册）+ platform_provider_config 表不存在（Hybrid Runtime 从未落地），功能已被数据罗盘第八层 AI 基础设施取代', replacement: '/admin/dashboard' },
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
  // Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01：5 页商业管理 IA；旧运营页保留登记（URL 可达，无导航）
  { route: '/admin/recruitment', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '求职招聘管理工作台（5 入口）' },
  { route: '/admin/recruitment/config', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '求职管家 Agent 配置（产品定义，无模型配置）' },
  { route: '/admin/recruitment/plans', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '套餐订阅管理（套餐 + 订阅双 Tab）' },
  { route: '/admin/recruitment/agents', owner: 'workspace', workspace: 'recruitment', status: 'active', note: 'AI Agent 管理（企业已部署员工）' },
  { route: '/admin/recruitment/enterprises', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '企业用户管理' },
  { route: '/admin/recruitment/authorization', owner: 'workspace', workspace: 'recruitment', status: 'active', note: '企业套餐授权' },
  // 旧运营页（隐藏于导航，代码保留，URL 可达）
  { route: '/admin/recruitment/jobs', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '岗位管理（已退出后台导航）' },
  { route: '/admin/recruitment/candidates', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '候选人管理（已退出后台导航）' },
  { route: '/admin/recruitment/interviews', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '面试管理（已退出后台导航）' },
  { route: '/admin/recruitment/conversations', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '会话管理（已退出后台导航）' },
  { route: '/admin/recruitment/campaigns', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: 'Campaign（已退出后台导航）' },
  { route: '/admin/recruitment/departments', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '企业招聘部门（已退出后台导航）' },
  { route: '/admin/recruitment/reviews', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '审核队列（已退出后台导航）' },
  { route: '/admin/recruitment/subscriptions', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '订阅管理（已并入套餐订阅管理 Tab）' },
  { route: '/admin/recruitment/audit', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '审计中心（已退出后台导航）' },
  { route: '/admin/recruitment/runtime', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '运行监控（已退出后台导航）' },

  // ─── 💼 企业域（原 /admin/enterprise/*，归招聘 Workspace；运营数据已归数据罗盘）───
  { route: '/admin/enterprise/subscriptions', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '企业订阅（已并入企业套餐授权）' },
  { route: '/admin/enterprise/plans', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '套餐定义（已并入套餐订阅管理）' },
  { route: '/admin/enterprise/llm-health', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '模型健康中心（已退出后台导航，属大模型管理）' },
  { route: '/admin/enterprise/agent-activity', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: 'AI员工活动（已退出后台导航）' },
  { route: '/admin/enterprise/roi-report', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: 'AI员工ROI（已移入数据罗盘）' },
  { route: '/admin/enterprise/pilot-dashboard', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '企业试运营（已退出后台导航）' },
  { route: '/admin/enterprise/daily-report', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '员工工作日报（已移入数据罗盘）' },
  { route: '/admin/enterprise/quotas', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: 'AI员工额度（已移入数据罗盘）' },
  { route: '/admin/enterprise/revenue', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '收入报表（已退出后台导航）' },
  { route: '/admin/enterprise/validation', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '企业入驻审核（已退出后台导航）' },
  { route: '/admin/enterprise/recruitment', owner: 'workspace', workspace: 'recruitment', status: 'deprecated', note: '企业招聘管理（已退出后台导航）' },

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
