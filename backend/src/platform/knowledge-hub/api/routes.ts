// ════════════════════════════════════════════════════════════
// KH1-T006 — Knowledge Hub Runtime API
// ════════════════════════════════════════════════════════════
// All endpoints return Canonical DTO only.
// No internal ORM models are exposed.
// ════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { PackageBuilder } from '../core/package-builder'
import { PackageValidator } from '../core/package-validator'
import { KnowledgePackageRepository } from '../repository/package-repository'
import { VersionEngine } from '../core/version-engine'
import { ProviderRuntime } from '../core/provider-runtime'

export function registerKnowledgeHubRoutes(
  fastify: FastifyInstance,
  opts: {
    versionEngine: VersionEngine
    providerRuntime: ProviderRuntime
  },
) {
  const prisma = new PrismaClient()
  const validator = new PackageValidator()
  const builder = new PackageBuilder(validator)
  const repo = new KnowledgePackageRepository(prisma)

  // ── POST /knowledge/packages — 创建 Package ──
  fastify.post('/api/knowledge/packages', async (request, reply) => {
    const body = request.body as any
    const provider = opts.providerRuntime.findProvider(body.entityType, body.entityId)
    if (!provider) {
      return reply.status(400).send({ success: false, error: `No provider for ${body.entityType}` })
    }

    const result = await builder.build(provider, {
      workspace: provider.workspace,
      entityType: body.entityType,
      entityId: body.entityId,
      title: body.title,
      description: body.description,
    })

    if (!result.success || !result.pkg) {
      return reply.status(422).send({ success: false, error: result.errors?.join('; ') })
    }

    // Store
    await repo.create(result.pkg)

    // Version snapshot
    await opts.versionEngine.createSnapshot(
      result.pkg.id,
      result.pkg.version,
      'draft',
      result.pkg as unknown as object,
      'api',
    )

    return { success: true, data: result.pkg }
  })

  // ── GET /knowledge/packages — 列表 ──
  fastify.get('/api/knowledge/packages', async (request, reply) => {
    const query = request.query as any
    const result = await repo.list({
      workspace: query.workspace,
      status: query.status,
      page: query.page ? parseInt(query.page) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
    })
    return { success: true, data: result }
  })

  // ── GET /knowledge/packages/:id — 详情 ──
  fastify.get('/api/knowledge/packages/:id', async (request, reply) => {
    const { id } = request.params as any
    const pkg = await repo.findById(id)
    if (!pkg) {
      return reply.status(404).send({ success: false, error: 'Package not found' })
    }
    return { success: true, data: pkg }
  })

  // ── POST /knowledge/packages/:id/validate — 校验 ──
  fastify.post('/api/knowledge/packages/:id/validate', async (request, reply) => {
    const { id } = request.params as any
    const pkg = await repo.findById(id)
    if (!pkg) {
      return reply.status(404).send({ success: false, error: 'Package not found' })
    }
    const validation = validator.validate(pkg)
    return { success: true, data: validation }
  })

  // ── POST /knowledge/packages/:id/version — 创建新版本 ──
  fastify.post('/api/knowledge/packages/:id/version', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const pkg = await repo.findById(id)
    if (!pkg) {
      return reply.status(404).send({ success: false, error: 'Package not found' })
    }

    const snapshot = await opts.versionEngine.createSnapshot(
      id,
      body.version || pkg.version,
      body.stage || 'draft',
      pkg as unknown as object,
      body.createdBy || 'api',
    )

    return { success: true, data: snapshot }
  })

  // ── GET /knowledge/packages/:id/history — 版本历史 ──
  fastify.get('/api/knowledge/packages/:id/history', async (request, reply) => {
    const { id } = request.params as any
    const history = await opts.versionEngine.getHistory(id)
    return { success: true, data: history }
  })

  // ── GET /knowledge/providers — 已注册 Provider 列表 ──
  fastify.get('/api/knowledge/providers', async (request, _reply) => {
    const providers = opts.providerRuntime.getAll().map(p => ({
      workspace: p.workspace,
      name: p.name,
    }))
    return { success: true, data: providers }
  })
}
