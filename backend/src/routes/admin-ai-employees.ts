// ============================================================
// ADMIN-IA-REALITY-05-C — AI 员工运营中心路由
// 数据源（SSOT，只读企业 AI 员工体系）：
//   EnterpriseAgentProfile → EnterpriseAgentInstance → HermesProfileBinding
//   → AgentModelBinding → EnterpriseAgentTask → usage_logs
// 禁止读 agent_def / agent_definition 等旁路表（见 05-B 审计）
// ============================================================
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

function safeJson(s: string | null | undefined, fallback: any = null) {
  if (!s) return fallback
  try { return JSON.parse(s) } catch { return fallback }
}

// ---------- AI Employee Reality Gate（六要素） ----------
// G1 Identity / G2 Capability / G3 Runtime / G4 Model Policy / G5 Memory / G6 Usage
// 六项全 PASS → 运行中；否则 → 配置不完整（不能假装上线）
function gateFor(profile: any, instance: any, hermes: any, bindings: any[], taskCount: number, orgModel?: any) {
  const g1 = !!(profile?.name && profile?.role)
  const g2 = (profile?.capabilities && safeJson(profile.capabilities, []).length > 0) || !!profile?.agentType
  const g3 = !!(instance && hermes)
  // SPRINT-IDENTITY-REALITY-FIX-01: G4 改为「企业模型设置（BYOK）」判定
  // 企业 AI 员工使用企业自己的 Key（OrgModelConfig + ProviderCredential，企业资产）
  // 平台不再持有企业 Key，不再以平台模型池/绑定作为判定依据
  const g4 = !!orgModel && !!orgModel.provider && !!orgModel.model && orgModel.hasCredential &&
    ['ok', 'untested'].includes(orgModel.healthStatus || 'untested')
  const g5 = !!instance?.namespace || !!hermes?.memoryNamespace
  const g6 = taskCount > 0
  const gates = { G1_Identity: g1, G2_Capability: g2, G3_Runtime: g3, G4_ModelPolicy: g4, G5_Memory: g5, G6_Usage: g6 }
  const allPass = Object.values(gates).every(Boolean)
  return { gates, allPass, missing: Object.entries(gates).filter(([, v]) => !v).map(([k]) => k) }
}

export default async function adminAiEmployeesRoutes(fastify: FastifyInstance) {
  const requireAdmin = async (request: any, reply: any) => {
    // 复用全局 admin 鉴权（同 admin-agents.ts 模式）
    const token = (request.headers as any).authorization?.replace('Bearer ', '') || request.headers['x-admin-token']
    if (!token) return reply.code(401).send({ error: '未登录' })
    return true
  }

  // SPRINT-IDENTITY-REALITY-01 T04: 自动绑定（企业已配置 Key → 员工绑定，幂等）
  // SPRINT-IDENTITY-REALITY-FIX-01: auto-bind 退役 — AgentModelBinding 已 deprecated
  // 企业 AI 员工模型来源 = OrgModelConfig + ProviderCredential（企业 BYOK，平台不托管 Key）
  // 该端点仅保留为「企业模型设置覆盖检查」（幂等，不创建 binding）
  fastify.post('/api/admin/ai-employees/auto-bind', { preHandler: [requireAdmin] }, async () => {
    const profiles: any[] = await prisma.enterpriseAgentProfile.findMany({
      where: { organizationId: { not: null } },
      select: { id: true, name: true, organizationId: true },
    })
    const orgIds = [...new Set(profiles.map(p => p.organizationId))] as string[]
    const orgConfigs = orgIds.length ? await prisma.orgModelConfig.findMany({ where: { organizationId: { in: orgIds as any }, enabled: true } }) : []
    const credentials = orgIds.length ? await prisma.providerCredential.findMany({ where: { ownerType: 'organization', organizationId: { in: orgIds as any } } }) : []
    const cfgByOrg = new Map(orgConfigs.map(c => [c.organizationId, c]))
    const credKey = (orgId: string, provider: string) => `${orgId}:${provider}`
    const credByOrg = new Map(credentials.map(c => [credKey(c.organizationId as string, c.provider), c]))
    let covered = 0, skipped = 0
    const details: string[] = []
    for (const p of profiles) {
      const cfg = cfgByOrg.get(p.organizationId as string)
      if (!cfg) { skipped++; continue }
      const cred = credByOrg.get(credKey(p.organizationId, cfg.provider))
      details.push(`${p.name} → ${cfg.provider}/${cfg.model}[${cred?.status === 'active' ? (cred.healthStatus || 'untested') : '无Key'}](企业BYOK)`)
      covered++
    }
    return { success: true, bound: 0, covered, skipped, details, note: 'AgentModelBinding 已 deprecated，企业模型来源 = OrgModelConfig + ProviderCredential（BYOK）' }
  })

  // SPRINT-IDENTITY-REALITY-01 T02: 套餐→模板授权校验（模板是否被套餐允许）
  fastify.get('/api/admin/ai-employees/template-eligibility/:planId', { preHandler: [requireAdmin] }, async (request: any) => {
    const plan = await prisma.enterprisePlan.findUnique({ where: { id: request.params.planId } })
    if (!plan) return { error: '套餐不存在' }
    const parsed = (plan.capabilityCodes as any) || {}
    const planCaps: string[] = Array.isArray(parsed) ? parsed : (parsed.capabilities || [])
    const planEmployees: any[] = Array.isArray(parsed) ? [] : (parsed.employees || [])
    const templates = await prisma.agentTemplate.findMany({ where: { status: 'active' } })
    return {
      plan: plan.name,
      allowedEmployees: planEmployees,
      templates: templates.map(t => {
        const caps = JSON.parse(t.defaultCapabilities || '[]')
        const allowed = caps.some((c: string) => planCaps.includes(c))
        return { code: t.code, name: t.name, allowed, matchedCaps: caps.filter((c: string) => planCaps.includes(c)) }
      }),
    }
  })

  // ============ Tab1: AI 员工列表 + 六要素 Gate ============
  fastify.get('/api/admin/ai-employees/overview', { preHandler: [requireAdmin] }, async () => {
    const profiles = await prisma.enterpriseAgentProfile.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        organization: { select: { name: true } },
        modelBindings: { select: { id: true, taskType: true, llmConfigId: true, enabled: true, llmConfig: { select: { enabled: true, healthStatus: true, provider: true, modelName: true } } } },
      },
    })
    const ids = profiles.map(p => p.id)
    const instances = await prisma.enterpriseAgentInstance.findMany({
      where: { employeeId: { in: ids } },
      include: { organization: { select: { name: true } } },
    })
    const instByEmployee = new Map(instances.map(i => [i.employeeId, i]))
    const hermes = await prisma.hermesProfileBinding.findMany({ where: { agentInstanceId: { in: instances.map(i => i.id) } } })
    const hermesByInstance = new Map(hermes.map(h => [h.agentInstanceId, h]))
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const taskAgg = await prisma.enterpriseAgentTask.groupBy({
      by: ['agentInstanceId'],
      where: { startedAt: { gte: todayStart } },
      _count: { _all: true },
      _sum: { tokenInput: true, tokenOutput: true, cost: true },
    })
    const taskMap = new Map(taskAgg.map(t => [t.agentInstanceId, t]))
    const totalTasks = await prisma.enterpriseAgentTask.groupBy({
      by: ['agentInstanceId'], _count: { _all: true },
    })
    const totalMap = new Map(totalTasks.map(t => [t.agentInstanceId, t._count._all]))

    // SPRINT-IDENTITY-REALITY-FIX-01: 企业模型设置（BYOK）—— OrgModelConfig + ProviderCredential
    // 平台管理员不可见企业 Key（G4 验收）：只返回 provider/model/健康状态，绝不返回 key 明文
    const orgIds = [...new Set(profiles.map(p => p.organizationId).filter(Boolean))] as string[]
    const orgConfigs = orgIds.length ? await prisma.orgModelConfig.findMany({ where: { organizationId: { in: orgIds as any }, enabled: true } }) : []
    const credentials = orgIds.length ? await prisma.providerCredential.findMany({ where: { ownerType: 'organization', organizationId: { in: orgIds as any } } }) : []
    const orgConfigByOrg = new Map<string, any>()
    for (const c of orgConfigs) {
      if (!orgConfigByOrg.has(c.organizationId)) orgConfigByOrg.set(c.organizationId, c)
    }
    const credByOrgProvider = new Map<string, any>()
    for (const c of credentials) credByOrgProvider.set(`${c.organizationId}:${c.provider}`, c)
    const orgModelFor = (orgId: string | null | undefined) => {
      if (!orgId) return null
      const cfg = orgConfigByOrg.get(orgId)
      if (!cfg) return null
      const cred = credByOrgProvider.get(`${orgId}:${cfg.provider}`)
      return {
        provider: cfg.provider,
        model: cfg.model,
        fallbackModel: cfg.fallbackModel,
        hasCredential: !!(cred && cred.status === 'active'),
        healthStatus: cred?.healthStatus || 'untested',
      }
    }

    const employees = profiles.map(p => {
      const inst = instByEmployee.get(p.id)
      const h = inst ? hermesByInstance.get(inst.id) : undefined
      const today = inst ? taskMap.get(inst.id) : undefined
      const orgModel = orgModelFor(p.organizationId)
      const gate = gateFor(p, inst, h, p.modelBindings, totalMap.get(inst?.id || '') || 0, orgModel)
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        agentType: p.agentType,
        organization: p.organization?.name || inst?.organization?.name || null,
        status: p.status,
        runtimeStatus: p.runtimeStatus,
        lifecycleState: inst?.lifecycleState || null,
        runtimeAgentId: inst?.agentId || null,
        lastExecutionAt: inst?.lastActiveAt || p.lastExecutionAt,
        isDefault: p.isDefault,
        capabilities: safeJson(p.capabilities, []),
        // 今日运行（Tab4 复用）
        today: today ? {
          tasks: today._count._all,
          tokens: (today._sum.tokenInput || 0) + (today._sum.tokenOutput || 0),
          cost: today._sum.cost || 0,
        } : { tasks: 0, tokens: 0, cost: 0 },
        // SPRINT-IDENTITY-REALITY-FIX-01: 模型来源 = 企业BYOK（不显示平台 Key / 平台模型池）
        modelPolicy: orgModel ? [{
          source: 'org_byok',
          provider: orgModel.provider,
          modelName: orgModel.model,
          fallbackModel: orgModel.fallbackModel,
          hasCredential: orgModel.hasCredential,
          healthStatus: orgModel.healthStatus,
        }] : [],
        memoryNamespace: h?.memoryNamespace || inst?.namespace || null,
        gate: { ...gate, label: gate.allPass ? '运行中' : '配置不完整' },
      }
    })
    return {
      summary: {
        total: profiles.length,
        draft: profiles.filter(p => p.runtimeStatus === 'draft').length,
        active: profiles.filter(p => p.runtimeStatus === 'active').length,
        running: employees.filter(e => e.gate.allPass).length,
        incomplete: employees.filter(e => !e.gate.allPass).length,
        // SPRINT-IDENTITY-REALITY-01 T05: 上线率 = 运行中/总数（商业价值指标）
        deploymentRate: profiles.length ? Math.round((employees.filter(e => e.gate.allPass).length / profiles.length) * 100) : 0,
      },
      employees,
    }
  })

  // ============ Tab2: 模板中心 CRUD ============
  fastify.get('/api/admin/ai-employees/templates', { preHandler: [requireAdmin] }, async () => {
    const templates = await prisma.agentTemplate.findMany({ orderBy: { sortOrder: 'asc' } })
    return templates.map(t => ({
      ...t,
      workspace: safeJson(t.workspace, []),
      defaultCapabilities: safeJson(t.defaultCapabilities, []),
      defaultModelPolicy: safeJson(t.defaultModelPolicy, {}),
      defaultMemoryPolicy: safeJson(t.defaultMemoryPolicy, {}),
    }))
  })
  fastify.post('/api/admin/ai-employees/templates', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    const b = request.body || {}
    if (!b.code || !b.name) return reply.code(400).send({ error: 'code 与 name 必填' })
    const t = await prisma.agentTemplate.create({
      data: {
        code: b.code, name: b.name, description: b.description || null,
        workspace: JSON.stringify(b.workspace || []),
        defaultCapabilities: JSON.stringify(b.defaultCapabilities || []),
        defaultMemoryPolicy: JSON.stringify(b.defaultMemoryPolicy || {}),
        defaultRuntime: b.defaultRuntime || 'openclaw',
        defaultModelPolicy: JSON.stringify(b.defaultModelPolicy || {}),
        status: b.status || 'active', sortOrder: b.sortOrder || 0,
      },
    })
    return t
  })
  fastify.put('/api/admin/ai-employees/templates/:id', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    const { id } = request.params
    const b = request.body || {}
    const exist = await prisma.agentTemplate.findUnique({ where: { id } })
    if (!exist) return reply.code(404).send({ error: '模板不存在' })
    const t = await prisma.agentTemplate.update({
      where: { id }, data: {
        name: b.name ?? exist.name, description: b.description !== undefined ? b.description : exist.description,
        workspace: b.workspace ? JSON.stringify(b.workspace) : exist.workspace,
        defaultCapabilities: b.defaultCapabilities ? JSON.stringify(b.defaultCapabilities) : exist.defaultCapabilities,
        defaultModelPolicy: b.defaultModelPolicy ? JSON.stringify(b.defaultModelPolicy) : exist.defaultModelPolicy,
        status: b.status ?? exist.status, sortOrder: b.sortOrder ?? exist.sortOrder,
      },
    })
    return t
  })
  fastify.delete('/api/admin/ai-employees/templates/:id', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    const { id } = request.params
    await prisma.agentTemplate.delete({ where: { id } }).catch(() => {})
    return { ok: true }
  })

  // ============ Tab3: 能力中心（Capability Grant 聚合 + 模板默认能力） ============
  fastify.get('/api/admin/ai-employees/capabilities', { preHandler: [requireAdmin] }, async () => {
    const grants = await prisma.capabilityGrant.groupBy({ by: ['capability'], _count: { _all: true } })
    const grantMap = new Map(grants.map(g => [g.capability, g._count._all]))
    const templates = await prisma.agentTemplate.findMany({ where: { status: 'active' } })
    // 模板默认能力 → 岗位能力画像
    const byTemplate = templates.map(t => ({
      template: t.name, code: t.code,
      capabilities: safeJson(t.defaultCapabilities, []),
    }))
    // 全部能力代码（grant + 模板）
    const allCodes = new Set<string>([...grantMap.keys(), ...templates.flatMap(t => safeJson(t.defaultCapabilities, []))])
    const capabilities = [...allCodes].sort().map(code => ({
      code,
      grantedPlans: grantMap.get(code) || 0,
      templates: templates.filter(t => safeJson(t.defaultCapabilities, []).includes(code)).map(t => t.name),
    }))
    return { capabilities, byTemplate, total: capabilities.length }
  })

  // ============ Tab4: 运行中心（任务聚合，非日志） ============
  fastify.get('/api/admin/ai-employees/runtime', { preHandler: [requireAdmin] }, async (request: any) => {
    const range = (request.query as any).range || 'today'
    const now = new Date()
    let start: Date
    if (range === 'today') { start = new Date(); start.setHours(0, 0, 0, 0) }
    else if (range === '7d') { start = new Date(now.getTime() - 7 * 86400000) }
    else if (range === 'month') { start = new Date(now.getTime() - 30 * 86400000) }
    else { start = new Date(); start.setHours(0, 0, 0, 0) }

    const tasks = await prisma.enterpriseAgentTask.findMany({ where: { startedAt: { gte: start } } })
    const instIds = [...new Set(tasks.map(t => t.agentInstanceId))]
    const instances = instIds.length ? await prisma.enterpriseAgentInstance.findMany({ where: { id: { in: instIds } } }) : []
    const profiles = instances.length
      ? await prisma.enterpriseAgentProfile.findMany({ where: { id: { in: instances.map(i => i.employeeId) } } })
      : []
    const nameMap = new Map(profiles.map(p => [p.id, p.name]))

    const agg = new Map<string, { tasks: number; success: number; failed: number; running: number; tokens: number; cost: number }>()
    for (const t of tasks) {
      const key = t.agentInstanceId
      const a = agg.get(key) || { tasks: 0, success: 0, failed: 0, running: 0, tokens: 0, cost: 0 }
      a.tasks++
      if (t.status === 'success') a.success++
      else if (t.status === 'failed') a.failed++
      else a.running++
      a.tokens += (t.tokenInput || 0) + (t.tokenOutput || 0)
      a.cost += t.cost || 0
      agg.set(key, a)
    }
    const byEmployee = [...agg.entries()].map(([instId, a]) => {
      const inst = instances.find(i => i.id === instId)
      return { employeeId: inst?.employeeId || instId, name: nameMap.get(inst?.employeeId || '') || '未知员工', ...a }
    }).sort((x, y) => y.tasks - x.tasks)

    const total = byEmployee.reduce((acc, e) => ({
      tasks: acc.tasks + e.tasks, success: acc.success + e.success, failed: acc.failed + e.failed,
      running: acc.running + e.running, tokens: acc.tokens + e.tokens, cost: acc.cost + e.cost,
    }), { tasks: 0, success: 0, failed: 0, running: 0, tokens: 0, cost: 0 })
    return { range, total, byEmployee }
  })

  // ============ Tab5: 成本与价值（ROI 模型：成本 + 替代工时 + 估算价值） ============
  // 价值模型（平台定义，可调）：单任务替代工时 0.5h，工时单价 ¥50/h
  fastify.get('/api/admin/ai-employees/value', { preHandler: [requireAdmin] }, async (request: any) => {
    const range = (request.query as any).range || 'month'
    const now = new Date()
    const start = new Date(now.getTime() - (range === 'month' ? 30 : range === '7d' ? 7 : 1) * 86400000)
    const tasks = await prisma.enterpriseAgentTask.findMany({ where: { startedAt: { gte: start } } })
    const instIds = [...new Set(tasks.map(t => t.agentInstanceId))]
    const instances = instIds.length ? await prisma.enterpriseAgentInstance.findMany({ where: { id: { in: instIds } } }) : []
    const profiles = instances.length
      ? await prisma.enterpriseAgentProfile.findMany({ where: { id: { in: instances.map(i => i.employeeId) } } })
      : []
    const nameMap = new Map(profiles.map(p => [p.id, p.name]))

    const HOURS_PER_TASK = 0.5
    const HOURLY_RATE = 50
    const agg = new Map<string, { tasks: number; cost: number; tokens: number }>()
    for (const t of tasks) {
      const a = agg.get(t.agentInstanceId) || { tasks: 0, cost: 0, tokens: 0 }
      a.tasks++; a.cost += t.cost || 0; a.tokens += (t.tokenInput || 0) + (t.tokenOutput || 0)
      agg.set(t.agentInstanceId, a)
    }
    const rows = [...agg.entries()].map(([instId, a]) => {
      const inst = instances.find(i => i.id === instId)
      const savedHours = a.tasks * HOURS_PER_TASK
      const value = savedHours * HOURLY_RATE
      const roi = a.cost > 0 ? Math.round(value / a.cost) : 0
      return {
        employeeId: inst?.employeeId || instId,
        name: nameMap.get(inst?.employeeId || '') || '未知员工',
        tasks: a.tasks, cost: Math.round(a.cost * 100) / 100, tokens: a.tokens,
        savedHours: Math.round(savedHours * 10) / 10, estimatedValue: Math.round(value), roi,
      }
    }).sort((x, y) => y.estimatedValue - x.estimatedValue)
    const total = rows.reduce((acc, r) => ({
      tasks: acc.tasks + r.tasks, cost: acc.cost + r.cost, value: acc.value + r.estimatedValue,
      savedHours: acc.savedHours + r.savedHours,
    }), { tasks: 0, cost: 0, value: 0, savedHours: 0 })
    return { range, total: { ...total, roi: total.cost > 0 ? Math.round(total.value / total.cost) : 0 }, byEmployee: rows }
  })
}
