// ════════════════════════════════════════════════════════════
// P2B-001 + P2B-002 — Distribution API
// ════════════════════════════════════════════════════════════
// 注册三个端点：
//   POST   /api/v1/packages/:id/distribute  — 分发 Package
//   GET    /api/v1/packages/:id/publishes   — 发布历史
//   POST   /api/v1/packages/:id/republish   — 重新发布
// ════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { v4 as uuid } from 'uuid'
import { EvidenceCollector } from '../evidence/collector'

interface Publisher {
  name: string
  type: string
  publish(packageId: string): Promise<{ fileName: string; filePath: string; mimeType: string; content: string; size: number; contentHash: string }[]>
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

export function distributionAPIRoutes(
  fastify: FastifyInstance,
  opts: {
    prisma: PrismaClient
    publishers: Publisher[]
    collector: EvidenceCollector
  },
) {
  const { prisma, publishers, collector } = opts

  /**
   * ── POST /api/v1/packages/:id/distribute ──
   *
   * 对指定 Package 执行分发。支持选择性指定 targets。
   * 每个 target 调用对应的 Publisher，生成 PublishFile[]，写入 PublishRecord。
   *
   * Body:
   *   { targets?: string[] }
   *   不传 targets 则分发到所有已注册 Publisher。
   *
   * 返回：
   *   每个 target 的 Publisher 执行结果 + PublishRecord
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/v1/packages/:id/distribute',
    async (request, reply) => {
      const { id: packageId } = request.params
      const body = request.body as { targets?: string[] } | undefined
      const requestedTargets = body?.targets

      // 1. 验证 Package 存在
      const dbPackage = await prisma.knowledgePackage.findUnique({ where: { id: packageId } })
      if (!dbPackage) {
        return reply.status(404).send({ success: false, error: 'Package not found' })
      }

      // 2. 确定要分发的 targets
      let activePublishers = publishers
      if (requestedTargets && requestedTargets.length > 0) {
        activePublishers = publishers.filter(p => requestedTargets.includes(p.name))
        if (activePublishers.length === 0) {
          return reply.status(400).send({
            success: false,
            error: `No matching targets found. Available: ${publishers.map(p => p.name).join(', ')}`,
          })
        }
      }

      // 3. 执行每个 Publisher
      const results: any[] = []
      const recordIds: string[] = []

      for (const publisher of activePublishers) {
        const startedAt = Date.now()
        try {
          const files = await publisher.publish(packageId)
          const duration = Date.now() - startedAt
          const artifactHash = simpleHash(files.map(f => f.contentHash).join('|'))

          // 写入 PublishRecord
          const recordId = uuid()
          await prisma.publishRecord.create({
            data: {
              id: recordId,
              packageId,
              target: publisher.name,
              status: 'success',
              startedAt: new Date(startedAt),
              finishedAt: new Date(),
              duration,
              outputPath: `/distribution/${packageId}/${publisher.name}/`,
              artifactHash,
              publisherVersion: '1.0.0',
              warnings: '[]',
              errors: '[]',
            },
          })
          recordIds.push(recordId)

          // Evidence auto-collect (success) — fire-and-forget
          if (typeof collector.collectFromDistribution === 'function') {
            collector.collectFromDistribution(packageId, recordId, publisher.name, 'success', duration)
          }

          results.push({
            status: 'success',
            duration,
            files: files.map(f => ({
              fileName: f.fileName,
              mimeType: f.mimeType,
              size: f.size,
              contentHash: f.contentHash,
            })),
            artifactHash,
          })
        } catch (err: any) {
          const duration = Date.now() - startedAt
          const recordId = uuid()
          await prisma.publishRecord.create({
            data: {
              id: recordId,
              packageId,
              target: publisher.name,
              status: 'failed',
              startedAt: new Date(startedAt),
              finishedAt: new Date(),
              duration,
              errors: JSON.stringify([err.message]),
            },
          })
          recordIds.push(recordId)

          results.push({
            target: publisher.name,
            status: 'failed',
            duration,
            error: err.message,
          })
        }
      }

      return {
        success: true,
        data: {
          packageId,
          results,
          recordIds,
          totalTargets: activePublishers.length,
          succeeded: results.filter(r => r.status === 'success').length,
          failed: results.filter(r => r.status === 'failed').length,
        },
      }
    },
  )

  /**
   * ── GET /api/v1/packages/:id/publishes ──
   *
   * 返回指定 Package 的所有发布记录。
   * 按时间倒序排列。
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/packages/:id/publishes',
    async (request, reply) => {
      const { id: packageId } = request.params

      // 验证 Package 存在
      const dbPackage = await prisma.knowledgePackage.findUnique({ where: { id: packageId } })
      if (!dbPackage) {
        return reply.status(404).send({ success: false, error: 'Package not found' })
      }

      const records = await prisma.publishRecord.findMany({
        where: { packageId },
        orderBy: { startedAt: 'desc' },
        take: 50,
      })

      return {
        success: true,
        data: {
          packageId,
          total: records.length,
          records: records.map(r => ({
            id: r.id,
            target: r.target,
            status: r.status,
            duration: r.duration,
            artifactHash: r.artifactHash,
            outputPath: r.outputPath,
            publisherVersion: r.publisherVersion,
            startedAt: r.startedAt,
            finishedAt: r.finishedAt,
            warnings: r.warnings,
            errors: r.errors,
          })),
        },
      }
    },
  )

  /**
   * ── POST /api/v1/packages/:id/republish ──
   *
   * 对指定 Package 重新执行分发。
   * 可指定只重新分发特定 target（默认为全部）。
   *
   * Body:
   *   { targets?: string[] }
   *
   * 本质上是调用 /distribute 的完整逻辑，但语义明确为 "重新发布"。
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/v1/packages/:id/republish',
    async (request, reply) => {
      const { id: packageId } = request.params
      const body = request.body as { targets?: string[] } | undefined

      // 复用 distribute 逻辑
      const dbPackage = await prisma.knowledgePackage.findUnique({ where: { id: packageId } })
      if (!dbPackage) {
        return reply.status(404).send({ success: false, error: 'Package not found' })
      }

      let activePublishers = publishers
      if (body?.targets && body.targets.length > 0) {
        activePublishers = publishers.filter(p => body.targets!.includes(p.name))
        if (activePublishers.length === 0) {
          return reply.status(400).send({
            success: false,
            error: `No matching targets found. Available: ${publishers.map(p => p.name).join(', ')}`,
          })
        }
      }

      const results: any[] = []
      const recordIds: string[] = []

      for (const publisher of activePublishers) {
        const startedAt = Date.now()
        try {
          const files = await publisher.publish(packageId)
          const duration = Date.now() - startedAt
          const artifactHash = simpleHash(files.map(f => f.contentHash).join('|'))

          const recordId = uuid()
          await prisma.publishRecord.create({
            data: {
              id: recordId,
              packageId,
              target: publisher.name,
              status: 'success',
              startedAt: new Date(startedAt),
              finishedAt: new Date(),
              duration,
              outputPath: `/distribution/${packageId}/${publisher.name}/`,
              artifactHash,
              publisherVersion: '1.0.0',
              warnings: '[]',
              errors: '[]',
            },
          })
          recordIds.push(recordId)
          // Evidence auto-collect (success)
          collector.collectFromDistribution(packageId, recordId, publisher.name, 'success', duration)
            .catch((err: any) => console.warn('[evidence] collectFromDistribution:', err.message))


          results.push({
            target: publisher.name,
            status: 'success',
            duration,
            artifactHash,
          })
        } catch (err: any) {
          const duration = Date.now() - startedAt
          const recordId = uuid()
          await prisma.publishRecord.create({
            data: {
              id: recordId,
              packageId,
              target: publisher.name,
              status: 'failed',
              startedAt: new Date(startedAt),
              finishedAt: new Date(),
              duration,
              errors: JSON.stringify([err.message]),
            },
          })
          recordIds.push(recordId)

          results.push({
            target: publisher.name,
            status: 'failed',
            duration,
            error: err.message,
          })
        }
      }

      return {
        success: true,
        data: {
          packageId,
          republished: true,
          results,
          recordIds,
          totalTargets: activePublishers.length,
          succeeded: results.filter(r => r.status === 'success').length,
          failed: results.filter(r => r.status === 'failed').length,
        },
      }
    },
  )
}
