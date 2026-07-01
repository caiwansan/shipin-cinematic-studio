// ============================================================
// GEO Project Routes — REST API
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectService } from '../services/geo-project.service'
import { geoPersistenceService } from '../services/geo-persistence.service'
import { discoveryService } from '../../../benchmark/discovery/discovery-service'
import { opportunityService } from '../../../benchmark/opportunity'
import { mockScanner } from '../../../benchmark/discovery/mock-scanner'
import { scenarioMatcher } from '../../../benchmark/sie/scenario-matcher'
import { defaultPipeline } from '../../../benchmark/sie/matcher'
import { buildDiscoveryContext } from '../../../benchmark/sie/discovery-context-builder'
import { scenarioStore } from '../../../benchmark/scenario/scenario-store'
import { actionPlanService } from '../../../benchmark/action-plan/action-plan-service'

export default async function geoProjectRoutes(fastify: FastifyInstance) {
  // POST /api/geo/projects — Create project
  fastify.post('/api/geo/projects', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as any
    const user = request.user as any

    if (!body.name) {
      return reply.status(400).send({ success: false, error: 'name is required' })
    }

    try {
      const project = await geoProjectService.createProject({
        name: body.name,
        topic: body.topic,
        userId: user.id,
        language: body.language,
        industry: body.industry,
        website: body.website,
        description: body.description,
        region: body.region,
        companyType: body.companyType,
        primaryLanguage: body.primaryLanguage,
        config: body.config,
      })
      return reply.status(201).send({ success: true, data: project })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects — List projects
  fastify.get('/api/geo/projects', { preHandler: [] }, async (request, reply) => {
    const user = request.user as any
    const tenantId = user?.id || 'anonymous'

    try {
      const projects = await geoProjectService.listProjects(tenantId)
      return { success: true, data: projects }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id — Get project
  fastify.get('/api/geo/projects/:id', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const project = await geoProjectService.getProject(id)
      if (!project) {
        return reply.status(404).send({ success: false, error: 'Project not found' })
      }
      return { success: true, data: project }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT /api/geo/projects/:id — Update project
  fastify.put('/api/geo/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    try {
      const project = await geoProjectService.updateProject(id, body)
      if (!project) {
        return reply.status(404).send({ success: false, error: 'Project not found' })
      }
      return { success: true, data: project }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // DELETE /api/geo/projects/:id — Soft delete project
  fastify.delete('/api/geo/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const deleted = await geoProjectService.deleteProject(id)
      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'Project not found' })
      }
      return { success: true, data: { deleted: true } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/projects/:id/snapshot — Snapshot project
  fastify.post('/api/geo/projects/:id/snapshot', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const snapshot = await geoProjectService.snapshotProject(id)
      return { success: true, data: snapshot }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/versions/:version — Get project version
  fastify.get('/api/geo/projects/:id/versions/:version', { preHandler: [] }, async (request, reply) => {
    const { id, version } = request.params as any

    try {
      const projectVersion = await geoProjectService.getProjectVersion(id, parseInt(version))
      if (!projectVersion) {
        return reply.status(404).send({ success: false, error: 'Version not found' })
      }
      return { success: true, data: projectVersion }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ════════════════════════════════════════════════════════════
  // P1-A: Persistence Layer — Report endpoints
  // ════════════════════════════════════════════════════════════

  // PUT /api/geo/projects/:id/discovery — Save discovery report
  fastify.put('/api/geo/projects/:id/discovery', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    if (!body.entityName || body.adi === undefined || body.adi === null) {
      return reply.status(400).send({ success: false, error: 'entityName and adi are required' })
    }

    try {
      const report = await geoPersistenceService.saveDiscoveryReport(
        id,
        body.entityName,
        {
          adi: body.adi,
          coverageScore: body.coverageScore ?? 0,
          shareScore: body.shareScore ?? 0,
          positionScore: body.positionScore ?? 0,
          reportData: body.reportData ?? {},
        }
      )
      return { success: true, data: report }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/discovery — Get latest discovery report
  fastify.get('/api/geo/projects/:id/discovery', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const report = await geoPersistenceService.getDiscoveryReport(id)
      return { success: true, data: report }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT /api/geo/projects/:id/action-plan — Save action plan
  fastify.put('/api/geo/projects/:id/action-plan', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    if (!body.planData) {
      return reply.status(400).send({ success: false, error: 'planData is required' })
    }

    try {
      const plan = await geoPersistenceService.saveActionPlan(
        id,
        body.planData,
        body.discoveryReportId
      )
      return { success: true, data: plan }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/action-plan — Get latest action plan
  fastify.get('/api/geo/projects/:id/action-plan', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const plan = await geoPersistenceService.getActionPlan(id)
      return { success: true, data: plan }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT /api/geo/projects/:id/verification — Save verification report
  fastify.put('/api/geo/projects/:id/verification', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any

    if (!body.entityName || body.beforeAdi === undefined || body.afterAdi === undefined) {
      return reply.status(400).send({ success: false, error: 'entityName, beforeAdi, and afterAdi are required' })
    }

    try {
      const report = await geoPersistenceService.saveVerificationReport(
        id,
        body.entityName,
        {
          beforeAdi: body.beforeAdi,
          afterAdi: body.afterAdi,
          deltaAdi: body.afterAdi - body.beforeAdi,
          reportData: body.reportData ?? {},
        }
      )
      return { success: true, data: report }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/verification — Get latest verification report
  fastify.get('/api/geo/projects/:id/verification', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const report = await geoPersistenceService.getVerificationReport(id)
      return { success: true, data: report }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/history — Get project history
  fastify.get('/api/geo/projects/:id/history', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const history = await geoPersistenceService.listHistory(id)
      return { success: true, data: history }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/dashboard — Get project dashboard (with all latest reports)
  fastify.get('/api/geo/projects/:id/dashboard', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as any
    request.log.info({ id }, 'Dashboard request start')

    try {
      const dashboard = await geoProjectService.getProjectWithReport(id)
      request.log.info({ hasProject: !!dashboard.project }, 'Dashboard got project')
      if (!dashboard.project) {
        return reply.status(404).send({ success: false, error: 'Project not found' })
      }
      return { success: true, data: dashboard }
    } catch (err: any) {
      request.log.error({ err: err.message, stack: err.stack }, 'Dashboard error')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/health/:id — Project health overview (used by KnowledgePage)
  fastify.get('/api/geo/health/:id', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      const dashboard = await geoProjectService.getProjectWithReport(id)
      if (!dashboard.project) {
        return reply.status(404).send({ success: false, error: 'Project not found' })
      }
      // Build health response expected by frontend
      const project = dashboard.project
      console.log("[Health] project:", project.name, "config:", JSON.stringify(project.config));
      return {
        success: true,
        data: {
          brand: {
            name: project.name,
            website: project.website || '',
            industry: project.industry || '',
            description: '',
            status: project.status,
          },
          healthScore: {
            overall: project.config?.adi || 0,
            change: 0,
            trend: 'stable',
          },
          dimensions: [],
          explanation: {
            summary: `项目「${project.name}」健康状态概览`,
            nextFocus: '执行发现步骤以获取详细数据',
          },
          coverage: {
            evidenceCount: 0,
            entityCount: 0,
            claimCount: 0,
          },
          recentChanges: [],
          quickActions: [
            { id: 'discovery', label: '运行发现', impact: '获取当前品牌覆盖数据' },
          ],
        },
      }
    } catch (err: any) {
      request.log.error({ err: err.message, stack: err.stack }, 'Health error')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/discovery/report — 实体发现评估报告（前端 geoApi baseURL = /api/geo）
  fastify.get('/api/geo/discovery/report', { preHandler: [] }, async (request, reply) => {
    const { entity } = request.query as { entity?: string }

    if (!entity || entity.trim().length === 0) {
      return reply.status(400).send({ success: false, error: '缺少 entity 参数' })
    }

    try {
      const report = await discoveryService.evaluateEntity(entity.trim())
      return { success: true, data: report }
    } catch (err: any) {
      request.log.error({ err: err.message }, 'Discovery report error')
      return reply.status(500).send({ success: false, error: err.message || '发现评估失败' })
    }
  })

  // GET /api/geo/discovery/action-plan — 实体行动方案列表（前端 geoApi baseURL = /api/geo）
  fastify.get('/api/geo/discovery/action-plan', { preHandler: [] }, async (request, reply) => {
    const { entity } = request.query as { entity?: string }

    if (!entity || entity.trim().length === 0) {
      return reply.status(400).send({ success: false, error: '缺少 entity 参数' })
    }

    try {
      const entityName = entity.trim()
      const allScenarios = scenarioStore.listScenarios()
      const matchResults = scenarioMatcher.matchTopK(entityName, allScenarios.length)

      const matchConfidences = new Map<string, number>()
      const matchedIntentCounts = new Map<string, number>()

      for (const result of matchResults) {
        if (result.scenarioId && result.matched) {
          matchConfidences.set(result.scenarioId, result.confidence)
          matchedIntentCounts.set(result.scenarioId, result.confidence > 0.8 ? 4 : result.confidence > 0.5 ? 2 : 1)
        }
      }

      const { scenarios } = mockScanner.scan(entityName, matchConfidences)
      const opportunities = opportunityService.generateOpportunities(scenarios, matchConfidences, matchedIntentCounts)
      const actionPlans = actionPlanService.generatePlans(opportunities, entityName)

      const totalImpact = actionPlans.reduce((sum, ap) => sum + ap.estimatedImpact, 0)
      const highCount = actionPlans.filter((ap) => ap.priority === 'high').length
      const mediumCount = actionPlans.filter((ap) => ap.priority === 'medium').length

      console.log("[QuickDiscovery] adi:", adi, "currentConfig:", JSON.stringify(currentConfig));
      return {
        success: true,
        data: {
          entityName,
          totalActionPlans: actionPlans.length,
          totalEstimatedImpact: totalImpact,
          summary: `为 ${entityName} 生成 ${actionPlans.length} 个行动方案，预计可提升 ADI ${totalImpact} 分（其中高优先级 ${highCount} 个，中优先级 ${mediumCount} 个）`,
          actionPlans,
          generatedAt: new Date().toISOString(),
        },
      }
    } catch (err: any) {
      request.log.error({ err: err.message }, 'Action plan error')
      return reply.status(500).send({ success: false, error: err.message || '行动方案生成失败' })
    }
  })

  // POST /api/geo/projects/:id/quick-discovery — Quick Discovery（一键出分）
  fastify.post('/api/geo/projects/:id/quick-discovery', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    try {
      // 1. 获取项目信息
      const project = await geoProjectService.getProject(id)
      if (!project || project.deletedAt) {
        return reply.status(404).send({ success: false, error: '项目未找到' })
      }

      const entityName = project.name || ''

      // 2. 构建 DiscoveryContext（集成 SIE-02）
      const source = {
        name: entityName,
        industry: project.industry || project.topic || undefined,
        description: (project.config as any)?.description || undefined,
        website: project.website || undefined,
      }
      const context = buildDiscoveryContext(source)

      // 3. SIE Pipeline 匹配
      const allScenarios = scenarioStore.listScenarios()
      const matchResults = defaultPipeline.matchTopK(context, allScenarios.length)

      const matchConfidences = new Map<string, number>()
      const matchedIntentCounts = new Map<string, number>()

      for (const result of matchResults) {
        if (result.scenarioId && result.matched) {
          matchConfidences.set(result.scenarioId, result.confidence)
          matchedIntentCounts.set(
            result.scenarioId,
            result.confidence > 0.8 ? 4 : result.confidence > 0.5 ? 2 : 1,
          )
        }
      }

      // 4. Mock 发现扫描
      const { scenarios, coverage, share, position } = mockScanner.scan(entityName, matchConfidences)

      // 5. 计算 ADI
      const adi = Math.round(coverage * 0.35 + share * 0.35 + position * 0.30)

      // 6. 生成 Opportunities
      const opportunities = opportunityService.generateOpportunities(
        scenarios,
        matchConfidences,
        matchedIntentCounts,
      )

      // 7. 生成 Action Plans
      const actionPlans = actionPlanService.generatePlans(opportunities, entityName)

      // 8. 保存 Discovery Report
      const report = {
        adi,
        coverageScore: coverage,
        shareScore: share,
        positionScore: position,
        reportData: {
          scenarios,
          opportunities,
          actionPlans,
          generatedAt: new Date().toISOString(),
        },
      }
      await geoPersistenceService.saveDiscoveryReport(id, entityName, report)

      // 9. 更新 Project.config.adi
      const currentConfig = project.config || {}
      await geoProjectService.updateProject(id, {
        config: { ...(typeof currentConfig === 'object' ? currentConfig : {}), adi },
      })

      // 10. 生成用户友好的摘要
      const highCount = actionPlans.filter((ap: any) => ap.priority === 'high').length
      const mediumCount = actionPlans.filter((ap: any) => ap.priority === 'medium').length
      const issues: string[] = []
      if (highCount > 0) issues.push(`${highCount} 个高优先级问题`)
      if (mediumCount > 0) issues.push(`${mediumCount} 个中优先级问题`)
      const summary = issues.length > 0
        ? `发现 ${issues.join('、')} 待优化`
        : '品牌表现良好，暂无突出问题'

      return {
        success: true,
        data: {
          adi,
          dimensions: { coverage, share, position },
          summary,
          opportunityCount: opportunities.length,
          actionPlanCount: actionPlans.length,
        },
      }
    } catch (err: any) {
      request.log.error({ err: err.message, stack: err.stack }, 'Quick discovery error')
      return reply.status(500).send({ success: false, error: err.message || '快速分析失败' })
    }
  })
}
