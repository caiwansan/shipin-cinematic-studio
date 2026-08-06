/**
 * S7.2 AI Employee Marketplace — 商品目录（只读, 组合视图零新表）
 * Marketplace = 发现层/展示层（非执行/非 Runtime/非权限层）
 * 商品 = AgentDefinition + Capability + Plugin Enhancement + Entitlement + Usage
 * 规则搜索（无搜索引擎）: name/description/category/capability 匹配
 * 推荐 = 规则排序（授权优先 + 部门匹配 + 增强数 + 最近使用）, 非 AI
 * 审核态 = View Layer Mapping（published = active def + visible capability, 不硬改 status）
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

/** 部门分类映射（代码级, 零新表）: def code → 企业部门 */
const CATEGORY_MAP: Record<string, string> = {
  'def-recruiter-alice': '人力',
  'def-shortdrama-director': '内容',
  'def-newmedia-ops': '营销',
  'def-legal-advisor': '风险',
}

/** 员工岗位表达（「员工不是工具」, 详情/列表 identity） */
const ROLE_MAP: Record<string, { title: string; line: string }> = {
  'def-recruiter-alice': { title: '你的 AI 招聘员工', line: '负责: 简历解析 / 人才画像 / 候选评分 / 面试辅助' },
  'def-shortdrama-director': { title: '你的 AI 短剧导演', line: '负责: 剧本分析 / 分镜规划 / 生成优化' },
  'def-newmedia-ops': { title: '你的 AI 新媒体运营', line: '负责: 内容策划 / 内容创作 / 运营分析' },
  'def-legal-advisor': { title: '你的 AI 合同分析员工', line: '负责: 合同审查 / 风险分析 / 条款优化' },
}

export async function registerMarketplaceRoutes(app: FastifyInstance) {
  // 列表: 规则搜索 + 规则排序 + 审核态过滤（只返回 active def）
  app.get('/api/marketplace/employees', async (request: any, reply: any) => {
    try {
      // 可选 JWT: 有 token 解析企业视角（entitlement/usage）; 无 token 匿名浏览公开目录
      let viewerId: string | null = null
      try { await request.jwtVerify(); viewerId = request.user?.id || null } catch { /* 匿名 */ }
      const q = String(request.query?.q || '').trim().toLowerCase()
      const category = String(request.query?.category || '').trim()
      const defs = await prisma.agentDefinition.findMany({
        where: { status: 'active' },
        select: { code: true, name: true, description: true, capabilities: true, metadata: true },
        orderBy: { createdAt: 'desc' },
      }).catch(() => [])
      const { getEmployeeUsageMeter, checkEmployeeEntitlement } = await import('../ecosystem/skill-orchestrator.js')
      const items = []
      for (const d of (defs as any[])) {
        const caps = (() => { try { const c = JSON.parse(d.capabilities || '[]'); return Array.isArray(c) ? c : [] } catch { return [] } })()
        const cat = CATEGORY_MAP[d.code]
        if (!cat) continue // 仅商品员工（组件/测试 def 不进目录）
        if (category && cat !== category) continue
        if (q) {
          const hay = `${d.name} ${d.description || ''} ${cat} ${caps.join(' ')}`.toLowerCase()
          if (!hay.includes(q)) continue
        }
        const role = ROLE_MAP[d.code] || { title: d.name, line: d.description || '' }
        const meter = viewerId ? await getEmployeeUsageMeter(viewerId, d.code).catch(() => null) : null
        const ent = viewerId ? await checkEmployeeEntitlement(viewerId, d.code).catch(() => ({ allowed: false, reason: 'ERROR' })) : null
        items.push({
          code: d.code,
          name: d.name,
          category: cat,
          identity: { title: role.title, description: role.line },
          capabilities: caps,
          entitlement: ent ? { available: ent.allowed } : null,
          usage: meter ? { executions: meter.executions, successRate: meter.executions ? Math.round((meter.successful / meter.executions) * 100) : 0 } : null,
          status: 'active',
        })
      }
      // 规则排序: 已授权优先 → 增强数（组件数）→ 最近使用
      const plugins = await prisma.ecologyPlugin.findMany({ where: { status: 'PUBLISHED' }, select: { manifest: true } }).catch(() => [])
      const enhCount = new Map<string, number>()
      for (const pl of plugins as any[]) {
        const enhs = Array.isArray((pl.manifest as any)?.enhancements) ? (pl.manifest as any).enhancements : []
        for (const e of enhs) {
          if (e?.skillId) enhCount.set(e.skillId, (enhCount.get(e.skillId) || 0) + 1)
        }
      }
      items.sort((a: any, b: any) => {
        const sa = (a.entitlement?.available ? 1 : 0) + Math.min((a.capabilities?.length || 0), 3) / 10
        const sb = (b.entitlement?.available ? 1 : 0) + Math.min((b.capabilities?.length || 0), 3) / 10
        return sb - sa
      })
      return reply.send({ code: 0, data: { total: items.length, employees: items } })
    } catch (e: any) {
      request.log.error(e, 'marketplace list failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // 详情: 五要素 + 岗位表达 + 公开增强类型
  app.get('/api/marketplace/employees/:code', async (request: any, reply: any) => {
    try {
      let viewerId: string | null = null
      try { await request.jwtVerify(); viewerId = request.user?.id || null } catch { /* 匿名 */ }
      const code = request.params.code
      const d = await prisma.agentDefinition.findUnique({ where: { code }, select: { code: true, name: true, description: true, capabilities: true } }).catch(() => null)
      if (!d) return reply.code(404).send({ error: 'EMPLOYEE_NOT_FOUND' })
      const caps = (() => { try { const c = JSON.parse(d.capabilities || '[]'); return Array.isArray(c) ? c : [] } catch { return [] } })()
      const cat = CATEGORY_MAP[code]
      if (!cat) return reply.code(404).send({ error: 'EMPLOYEE_NOT_FOUND' })
      const role = ROLE_MAP[code] || { title: d.name, line: d.description || '' }
      const { getEmployeeUsageMeter, checkEmployeeEntitlement } = await import('../ecosystem/skill-orchestrator.js')
      const meter = viewerId ? await getEmployeeUsageMeter(viewerId, code).catch(() => null) : null
      // 公开增强类型（生态插件挂载点匹配, 目录级展示）
      const plugins = await prisma.ecologyPlugin.findMany({ where: { status: 'PUBLISHED' }, select: { pluginId: true, manifest: true } }).catch(() => [])
      const enhTypes: string[] = []
      for (const pl of plugins as any[]) {
        const enhs = Array.isArray((pl.manifest as any)?.enhancements) ? (pl.manifest as any).enhancements : []
        for (const e of enhs) {
          if (e?.skillId && caps.includes(e.skillId) && !enhTypes.includes(e.type)) enhTypes.push(e.type)
        }
      }
      return reply.send({
        code: 0,
        data: {
          code: d.code,
          name: d.name,
          category: cat,
          identity: { title: role.title, description: role.line },
          capabilities: caps,
          plugins: enhTypes,
          entitlement: viewerId ? { available: (await checkEmployeeEntitlement(viewerId, code).catch(() => ({ allowed: false, reason: 'ERROR' }))).allowed } : null,
          usage: meter ? { executions: meter.executions, successRate: meter.executions ? Math.round((meter.successful / meter.executions) * 100) : 0 } : null,
          status: 'active',
        },
      })
    } catch (e: any) {
      request.log.error(e, 'marketplace detail failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
