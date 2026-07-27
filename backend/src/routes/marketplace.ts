/**
 * Employee Marketplace Routes — GA-02
 * AI Employee Template Registry + Creation Flow
 *
 * GET  /api/enterprise/marketplace/templates           — 获取所有公开模板
 * GET  /api/enterprise/marketplace/templates/:id        — 获取单个模板
 * GET  /api/enterprise/marketplace/departments          — 获取部门列表
 * POST /api/enterprise/marketplace/create               — 从模板创建 AI 员工
 * POST /api/enterprise/marketplace/seed                 — 初始化系统模板
 * POST /api/enterprise/marketplace/templates            — 创建模板 (管理员)
 * PUT  /api/enterprise/marketplace/templates/:id        — 更新模板 (管理员)
 * DELETE /api/enterprise/marketplace/templates/:id      — 删除模板 (管理员)
 *
 * Identity: JWT → getOrganizationIdForUser() → organizationId
 */
import type { FastifyInstance } from 'fastify'
import { employeeMarketplaceService } from '../services/enterprise/employee-marketplace.service.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export async function marketplaceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * GET /api/enterprise/marketplace/templates
   * 获取所有公开模板 (可按部门筛选)
   */
  app.get('/templates', async (request, reply) => {
    try {
      const { department } = request.query as any
      const templates = department
        ? await employeeMarketplaceService.getTemplatesByDepartment(department)
        : await employeeMarketplaceService.getPublicTemplates()
      return reply.send({ code: 0, data: templates })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/marketplace/templates/:id
   * 获取单个模板
   */
  app.get('/templates/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const template = await employeeMarketplaceService.getTemplate(id)
      if (!template) {
        return reply.status(404).send({ code: 404, message: 'TEMPLATE_NOT_FOUND' })
      }
      return reply.send({ code: 0, data: template })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/marketplace/departments
   * 获取部门列表
   */
  app.get('/departments', async (_request, reply) => {
    try {
      const departments = await employeeMarketplaceService.getDepartments()
      return reply.send({ code: 0, data: departments })
    } catch (error: any) {
      _request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * POST /api/enterprise/marketplace/create
   * 从模板创建 AI 员工
   */
  app.post('/create', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const { templateId, employeeName, customCapabilities } = body

      if (!templateId) {
        return reply.status(400).send({ code: 400, message: 'MISSING_TEMPLATE_ID' })
      }

      const result = await employeeMarketplaceService.createEmployeeFromTemplate({
        organizationId: orgId,
        templateId,
        employeeName,
        customCapabilities,
      })

      if (!result) {
        return reply.status(404).send({ code: 404, message: 'TEMPLATE_NOT_FOUND' })
      }

      return reply.send({ code: 0, data: result })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * POST /api/enterprise/marketplace/seed
   * 初始化系统模板
   */
  app.post('/seed', async (request, reply) => {
    try {
      const count = await employeeMarketplaceService.seedSystemTemplates()
      return reply.send({ code: 0, data: { seeded: count } })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * POST /api/enterprise/marketplace/templates
   * 创建模板 (管理员)
   */
  app.post('/templates', async (request, reply) => {
    try {
      const body = request.body as any
      const { name, department, role, description, icon, capabilities, defaultTools, requiredChannels, sortOrder } = body

      if (!name || !department || !role || !description) {
        return reply.status(400).send({ code: 400, message: 'MISSING_PARAMS' })
      }

      const template = await employeeMarketplaceService.createTemplate({
        name,
        department,
        role,
        description,
        icon,
        capabilities,
        defaultTools,
        requiredChannels,
        sortOrder,
      })

      return reply.send({ code: 0, data: template })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * PUT /api/enterprise/marketplace/templates/:id
   * 更新模板 (管理员)
   */
  app.put('/templates/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as any

      const template = await employeeMarketplaceService.updateTemplate(id, body)
      if (!template) {
        return reply.status(404).send({ code: 404, message: 'TEMPLATE_NOT_FOUND_OR_SYSTEM' })
      }

      return reply.send({ code: 0, data: template })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * DELETE /api/enterprise/marketplace/templates/:id
   * 删除模板 (仅非系统模板)
   */
  app.delete('/templates/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const success = await employeeMarketplaceService.deleteTemplate(id)
      if (!success) {
        return reply.status(400).send({ code: 400, message: 'TEMPLATE_NOT_FOUND_OR_SYSTEM' })
      }
      return reply.send({ code: 0, message: 'DELETED' })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })
}
