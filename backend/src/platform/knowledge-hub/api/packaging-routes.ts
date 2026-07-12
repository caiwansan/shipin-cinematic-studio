import { v4 as uuid } from 'uuid'
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { ProviderRuntime } from '../core/provider-runtime'
import { KnowledgeObjectProvider, buildPackageFromKO } from '../providers/geo/knowledge-object-provider'
import { WebsitePublisher, SitemapPublisher, AIFeedPublisher } from '../distribution/adapters'
import { distributionAPIRoutes } from './distribution-routes'
import { EvidenceCollector } from '../evidence/collector'

/**
 * P1A-004 + P1A-005 — Packaging API
 *
 * 统一的 Package 构建与管理 API。
 * 资源设计：
 *   POST   /api/v1/packages/build    — 构建 Package（输入 koId）
 *   GET    /api/v1/packages/:id      — 获取 Package 详情
 *   GET    /api/v1/packages/:id/manifest  — 获取 Manifest
 *   GET    /api/v1/packages/:id/artifacts — 获取 Artifacts
 *   GET    /api/v1/packages/builds   — 构建历史
 *   POST   /api/v1/packages/:id/distribute  — 分发 Package（Sprint 2B）
 *   GET    /api/v1/packages/:id/publishes    — 发布历史（Sprint 2B）
 *   POST   /api/v1/packages/:id/republish    — 重新发布（Sprint 2B）
 */
export function registerPackagingRoutes(
  fastify: FastifyInstance,
  opts: { providerRuntime: ProviderRuntime },
) {
  const prisma = new PrismaClient()
  const collector = new EvidenceCollector(prisma)

  // ── Register KnowledgeObjectProvider globally ──
  // P1A-005: Provider 注册
  const existing = opts.providerRuntime.get('KnowledgeObjectProvider')
  if (!existing) {
    opts.providerRuntime.register(new KnowledgeObjectProvider())
  }

  // ── POST /api/v1/packages/build ──
  // 构建 Package，输入 koId，构建成功后写入 KnowledgePackage + PackageManifest + PackageArtifact + PackageBuild
  fastify.post('/api/v1/packages/build', async (request, reply) => {
    const body = request.body as {
      knowledgeObjectId: string
      force?: boolean
      tags?: string[]
    }

    if (!body.knowledgeObjectId) {
      return reply.status(400).send({
        success: false,
        error: 'knowledgeObjectId is required',
      })
    }

    const startedAt = Date.now()
    const buildId = uuid()
    const pkgId = uuid()

    try {
      // 1. 构建 Package（调用 P1A-002 的 buildPackageFromKO）
      const result = await buildPackageFromKO(body.knowledgeObjectId, {
        bypassValidation: body.force ?? false,
        tags: body.tags,
      })

      if (!result.success || !result.pkg) {
        // 构建失败，写入 PackageBuild（失败记录）
        await prisma.packageBuild.create({
          data: {
            id: buildId,
            knowledgeObjectId: body.knowledgeObjectId,
            status: 'failed',
            startedAt: new Date(startedAt),
            finishedAt: new Date(),
            duration: Date.now() - startedAt,
            errors: JSON.stringify(result.errors ?? ['Unknown error']),
          },
        })

        return reply.status(422).send({
          success: false,
          error: result.errors?.join('; '),
          buildId,
        })
      }

      const pkg = result.pkg
      const finishedAt = Date.now()
      const duration = finishedAt - startedAt

      // 2. 写入 KnowledgePackage 表
      const dbPackage = await prisma.knowledgePackage.create({
        data: {
          id: pkgId,
          assetId: body.knowledgeObjectId,
          projectId: body.knowledgeObjectId,
          packageType: 'knowledge_object',
          status: pkg.status,
          version: pkg.version,
          artifactHash: '',
        },
      })

      // 3. 创建 Manifest
      const manifestContent = JSON.stringify({
        title: pkg.title,
        description: pkg.description,
        tags: pkg.tags,
        entityCount: pkg.assets.length,
        claimCount: pkg.claims.length,
        evidenceCount: pkg.evidence.length,
        citationCount: pkg.citations.length,
      })
      const manifest = await prisma.packageManifest.create({
        data: {
          sourceAssetId: body.knowledgeObjectId,
          sourceClaimId: body.knowledgeObjectId,
          sourceRecordId: pkg.id,
          sourceProjectId: body.knowledgeObjectId,
          title: pkg.title || '',
          summary: pkg.description || '',
          estimatedSize: manifestContent.length,
          mimeType: 'application/json',
          language: 'zh-CN',
          contentHash: simpleHash(manifestContent),
          timestamp: new Date(),
        },
      })

      // 链接 Manifest 到 Package
      await prisma.knowledgePackage.update({
        where: { id: pkgId },
        data: { manifestId: manifest.id },
      })

      // 4. 创建 Artifact（Package 的完整内容）
      const artifactContent = JSON.stringify({
        claims: pkg.claims,
        evidence: pkg.evidence,
        citations: pkg.citations,
        assets: pkg.assets,
        recommendations: pkg.recommendations,
      })
      await prisma.packageArtifact.create({
        data: {
          packageId: pkgId,
          fileName: 'package.json',
          filePath: '/package.json',
          mimeType: 'application/json',
          content: artifactContent,
          contentHash: simpleHash(artifactContent),
          size: artifactContent.length,
          sortOrder: 0,
        },
      })

      // 5. 写入 PackageBuild（成功记录）
      await prisma.packageBuild.create({
        data: {
          id: buildId,
          knowledgeObjectId: body.knowledgeObjectId,
          packageId: pkgId,
          builderVersion: '1.0.0',
          startedAt: new Date(startedAt),
          finishedAt: new Date(finishedAt),
          duration,
          status: 'success',
          claimCount: pkg.claims.length,
          evidenceCount: pkg.evidence.length,
          citationCount: pkg.citations.length,
          artifactCount: 1,
          log: `Package built successfully in ${duration}ms`,
        },
      })

      // 6. 在返回前异步收集 Evidence
      collector.collectFromBuild(pkgId, body.knowledgeObjectId, buildId, pkg.title || '', pkg.version)
        .catch((err: any) => console.warn('[evidence] collectFromBuild:', err.message))

      // 7. 返回 BuildResult
      return {
        success: true,
        data: {
          build: {
            id: buildId,
            knowledgeObjectId: body.knowledgeObjectId,
            status: 'success',
            duration,
            builderVersion: '1.0.0',
            metrics: {
              claims: pkg.claims.length,
              evidence: pkg.evidence.length,
              citations: pkg.citations.length,
              assets: pkg.assets.length,
            },
          },
          package: {
            id: pkgId,
            title: pkg.title,
            description: pkg.description,
            version: pkg.version,
            status: pkg.status,
            tags: pkg.tags,
          },
          manifest: {
            id: manifest.id,
            schemaVersion: manifest.schemaVersion,
            title: manifest.title,
            summary: manifest.summary,
            language: manifest.language,
            contentHash: manifest.contentHash,
          },
          artifacts: [
            {
              id: artifactContent.length > 0 ? 'generated' : '',
              fileName: 'package.json',
              mimeType: 'application/json',
              size: artifactContent.length,
            },
          ],
        },
      }
    } catch (err: any) {
      // 5a. 写入 PackageBuild（异常记录）
      try {
        await prisma.packageBuild.create({
          data: {
            id: buildId,
            knowledgeObjectId: body.knowledgeObjectId,
            status: 'failed',
            startedAt: new Date(startedAt),
            finishedAt: new Date(),
            duration: Date.now() - startedAt,
            errors: JSON.stringify([err.message]),
          },
        })
      } catch (_) { /* best effort */ }

      return reply.status(500).send({
        success: false,
        error: `Internal error: ${err.message}`,
        buildId,
      })
    }
  })

  // ── GET /api/v1/packages/:id — 获取 Package ──
  fastify.get('/api/v1/packages/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const pkg = await prisma.knowledgePackage.findUnique({ where: { id } })
    if (!pkg) {
      return reply.status(404).send({ success: false, error: 'Package not found' })
    }

    const manifest = pkg.manifestId
      ? await prisma.packageManifest.findUnique({ where: { id: pkg.manifestId } })
      : null

    return {
      success: true,
      data: {
        id: pkg.id,
        assetId: pkg.assetId,
        packageType: pkg.packageType,
        status: pkg.status,
        version: pkg.version,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
        manifestId: pkg.manifestId,
        manifest: manifest
          ? {
              id: manifest.id,
              title: manifest.title,
              summary: manifest.summary,
              language: manifest.language,
              schemaVersion: manifest.schemaVersion,
            }
          : null,
      },
    }
  })

  // ── GET /api/v1/packages/:id/manifest — 获取 Manifest ──
  fastify.get('/api/v1/packages/:id/manifest', async (request, reply) => {
    const { id } = request.params as { id: string }
    const pkg = await prisma.knowledgePackage.findUnique({ where: { id } })
    if (!pkg) {
      return reply.status(404).send({ success: false, error: 'Package not found' })
    }
    if (!pkg.manifestId) {
      return reply.status(404).send({ success: false, error: 'No manifest for this package' })
    }

    const manifest = await prisma.packageManifest.findUnique({ where: { id: pkg.manifestId } })
    if (!manifest) {
      return reply.status(404).send({ success: false, error: 'Manifest not found' })
    }

    return { success: true, data: manifest }
  })

  // ── GET /api/v1/packages/:id/artifacts — 获取 Artifacts ──
  fastify.get('/api/v1/packages/:id/artifacts', async (request, reply) => {
    const { id } = request.params as { id: string }
    const artifacts = await prisma.packageArtifact.findMany({
      where: { packageId: id },
      orderBy: { sortOrder: 'asc' },
    })

    return {
      success: true,
      data: artifacts,
    }
  })

  // ── GET /api/v1/packages/builds — 构建历史 ──
  fastify.get('/api/v1/packages/builds', async (request, reply) => {
    const query = request.query as {
      knowledgeObjectId?: string
      status?: string
      page?: string
      pageSize?: string
    }

    const where: any = {}
    if (query.knowledgeObjectId) where.knowledgeObjectId = query.knowledgeObjectId
    if (query.status) where.status = query.status

    const page = parseInt(query.page ?? '1')
    const pageSize = parseInt(query.pageSize ?? '20')

    const [builds, total] = await Promise.all([
      prisma.packageBuild.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.packageBuild.count({ where }),
    ])

    return {
      success: true,
      data: {
        items: builds,
        total,
        page,
        pageSize,
      },
    }
  })

  // ── GET /api/v1/packages/list — 列出所有 Package ──
  fastify.get('/api/v1/packages', async (request, reply) => {
    const query = request.query as {
      assetId?: string
      status?: string
      packageType?: string
      page?: string
      pageSize?: string
    }

    const where: any = {}
    if (query.assetId) where.assetId = query.assetId
    if (query.status) where.status = query.status
    if (query.packageType) where.packageType = query.packageType

    const page = parseInt(query.page ?? '1')
    const pageSize = parseInt(query.pageSize ?? '20')

    const [packages, total] = await Promise.all([
      prisma.knowledgePackage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.knowledgePackage.count({ where }),
    ])

    return {
      success: true,
      data: {
        items: packages,
        total,
        page,
        pageSize,
      },
    }
  })

  // ── Sprint 2B: Distribution API ──
  distributionAPIRoutes(fastify, {
    prisma,
    publishers: [
      new WebsitePublisher(),
      new SitemapPublisher(),
      new AIFeedPublisher(),
    ],
    collector,
  })
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}
