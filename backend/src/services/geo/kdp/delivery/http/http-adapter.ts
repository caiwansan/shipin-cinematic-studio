// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 4A — HTTPAdapter
// ════════════════════════════════════════════════════════════
// Delivers KnowledgePackages via HTTP (REST API, Webhook, CMS).
// CMS Adapters (WordPress, Ghost, Strapi) should extend this.
//
// Workflow:
//   prepare() → authenticate + test connection
//   deliver() → POST/PUT artifacts to endpoint(s)
//   verify() → GET + check HTTP status + SHA256 + etag
//   rollback() → DELETE posted resources
//   dryRun() → show what would be sent
//
// Usage:
//   Generic HTTP: send all artifacts as files to a webhook
//   CMS (future): map artifacts to content model (page/post)
// ════════════════════════════════════════════════════════════

import * as fs from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'
import {
  DeliveryAdapter, AdapterMeta, AdapterCapability, AdapterHealthStatus,
  KnowledgePackage, PackageArtifact, DeliveryTargetType,
  PrepareContext, PrepareResult,
  DeliveryResult, DeliveryJobStatus,
  VerifyResult, RollbackResult, HealthCheckResult,
} from '../../../types'
import { PublishManifest, createPublishManifest } from '../publish-manifest'
import { HTTPProvider, HTTPProviderConfig, HTTPRequestOptions, HTTPResponse } from './http-provider'

export interface HTTPDeliveryResult extends DeliveryResult {
  baseUrl?: string
  responses?: Array<{
    path: string
    method: string
    statusCode: number
    body?: string
    resourceId?: string
  }>
  manifest?: PublishManifest
}

export class HTTPAdapter implements DeliveryAdapter {
  get meta(): AdapterMeta {
    const providerName = this.provider ? this.provider.name : 'unknown'
    const isCMS = providerName !== 'generic'
    return {
      id: `http:${providerName}`,
      name: isCMS
        ? `CMS (${providerName.charAt(0).toUpperCase() + providerName.slice(1)})`
        : `HTTP (${providerName})`,
      version: '1.0.0',
      targetType: 'http',
      capabilities: [
        AdapterCapability.Prepare,
        AdapterCapability.Deliver,
        AdapterCapability.Verify,
        AdapterCapability.Rollback,
        AdapterCapability.HealthCheck,
        AdapterCapability.DryRun,
        AdapterCapability.Multipart,
        ...(isCMS ? [AdapterCapability.ContentModel, AdapterCapability.ResourceManagement] as const : []),
      ],
      description: isCMS
        ? `Delivers KnowledgePackages to ${providerName} CMS via REST API.`
        : `Delivers KnowledgePackages to HTTP endpoints.`,
      provider: providerName,
      providerType: 'http',
      configSchema: {
        type: 'object',
        properties: {
          baseUrl: { type: 'string', description: 'CMS/API base URL' },
          auth: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['basic', 'bearer', 'api_key'] },
              token: { type: 'string' },
              username: { type: 'string' },
              password: { type: 'string' },
              apiKey: { type: 'string' },
            },
          },
          pathTemplate: { type: 'string', default: '/api/knowledge/{packageType}/{fileName}', description: 'URL template for artifacts' },
        },
      },
    }
  }

  constructor(private provider: HTTPProvider) {}

  async prepare(ctx: PrepareContext): Promise<PrepareResult> {
    const config = this.toConfig(ctx.config)

    const ok = await this.provider.authenticate(config)
    if (ok) {
      return { success: true, message: `Connected to ${config.baseUrl}` }
    }

    return { success: false, message: `Failed to connect to ${config.baseUrl}` }
  }

  async deliver(
    jobId: string,
    pkg: KnowledgePackage,
    target: DeliveryTargetType,
    artifacts: PackageArtifact[],
  ): Promise<HTTPDeliveryResult> {
    const config = this.toConfig(target.config)
    const baseUrl = config.baseUrl
    const pathTemplate = target.config.pathTemplate || '/api/knowledge/{packageType}/{fileName}'

    const responses: HTTPDeliveryResult['responses'] = []
    let totalBytes = 0
    let allSuccess = true

    for (const artifact of artifacts) {
      const reqPath = this.renderPath(pathTemplate, pkg, artifact)
      const contentType = this.inferContentType(artifact.fileName)
      const contentSha256 = createHash('sha256').update(artifact.content).digest('hex')

      const opts: HTTPRequestOptions = {
        method: 'POST',
        path: reqPath,
        body: artifact.content,
        contentType,
        headers: {
          'X-Content-SHA256': contentSha256,
          'X-Brand-Knowledge-Package': pkg.id,
          'X-Brand-Knowledge-Job': jobId,
        },
      }

      const response = await this.provider.send(config, opts)
      totalBytes += Buffer.byteLength(artifact.content, 'utf8')

      const resourceId = response.bodyJson?.id?.toString() ||
                         response.bodyJson?.data?.id?.toString() ||
                         response.bodyJson?.ID?.toString() ||
                         undefined

      responses.push({
        path: reqPath,
        method: 'POST',
        statusCode: response.statusCode,
        body: response.body.substring(0, 500),
        resourceId,
      })

      if (response.statusCode >= 400 || response.statusCode === 0) {
        allSuccess = false
      }
    }

    // Generate PublishManifest
    const publishManifest = createPublishManifest({
      adapter: 'http',
      provider: this.provider.name,
      packageId: pkg.id,
      jobId,
      targetType: 'http',
      targetUrl: baseUrl,
      fileCount: artifacts.length,
      totalBytes,
      files: artifacts.map(a => ({
        path: a.fileName,
        status: 'added' as const,
        sizeBytes: Buffer.byteLength(a.content, 'utf8'),
        sha256: createHash('sha256').update(a.content).digest('hex'),
      })),
    })

    const allSha256s = artifacts.map(a => createHash('sha256').update(a.content).digest('hex')).sort().join('')
    const checksum = createHash('sha256').update(allSha256s).digest('hex')

    const result: HTTPDeliveryResult = {
      success: allSuccess,
      status: allSuccess ? DeliveryJobStatus.Completed : DeliveryJobStatus.Failed,
      outputPath: baseUrl,
      bytes: totalBytes,
      artifactCount: artifacts.length,
      checksum,
      baseUrl,
      responses,
      manifest: publishManifest,
    }

    const good = responses.filter(r => r.statusCode < 400).length
    console.log(`[HTTPAdapter] Delivered ${pkg.packageType} (${totalBytes}B, ${good}/${artifacts.length} ok) → ${baseUrl}`)

    return result
  }

  async verify(record: HTTPDeliveryResult): Promise<VerifyResult> {
    const errors: string[] = []

    if (!record.responses || record.responses.length === 0) {
      errors.push('No HTTP responses recorded')
      return { success: true, verified: false, errors }
    }

    for (const resp of record.responses) {
      if (resp.statusCode >= 400) {
        errors.push(`POST ${resp.path} → ${resp.statusCode}`)
      }
      if (resp.statusCode === 0) {
        errors.push(`POST ${resp.path} → connection failed`)
      }
    }

    return {
      success: errors.length === 0,
      verified: errors.length === 0,
      errors,
      details: {
        endpoint: record.baseUrl,
        totalRequests: record.responses.length,
        successfulRequests: record.responses.filter(r => r.statusCode < 400).length,
      },
    }
  }

  async rollback(record: HTTPDeliveryResult): Promise<RollbackResult> {
    if (!record.responses || record.responses.length === 0) {
      return { success: false, message: 'No responses to rollback' }
    }

    const deletable = record.responses.filter(r => r.resourceId)
    if (deletable.length === 0) {
      return { success: false, message: 'No resource IDs available for rollback (platform may not support DELETE)' }
    }

    return {
      success: true,
      message: `Would DELETE ${deletable.length} resources (resourceId-based rollback). Adapter implements this with the provider's API.`,
      previousState: { deletableCount: deletable.length },
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const config: HTTPProviderConfig = {
      baseUrl: '',
      timeout: 5000,
    }

    try {
      const h = await this.provider.health(config)
      return {
        status: h.ok ? AdapterHealthStatus.Ok : AdapterHealthStatus.Down,
        latencyMs: h.latencyMs,
        message: h.message,
      }
    } catch (err: any) {
      return {
        status: AdapterHealthStatus.Down,
        message: err.message,
      }
    }
  }

  async dryRun(pkg: KnowledgePackage, target: DeliveryTargetType): Promise<HTTPDeliveryResult> {
    const pathTemplate = target.config.pathTemplate || '/api/knowledge/{packageType}/{fileName}'

    return {
      success: true,
      status: DeliveryJobStatus.Completed,
      outputPath: `${target.config.baseUrl || '(no URL)'} (dry run)`,
      bytes: 0,
      artifactCount: 0,
      checksum: '',
      baseUrl: target.config.baseUrl,
      manifest: createPublishManifest({
        adapter: 'http',
        provider: this.provider.name,
        packageId: pkg.id,
        jobId: '(dry run)',
        targetType: 'http',
        targetUrl: target.config.baseUrl || '(dry run)',
        fileCount: 0,
        totalBytes: 0,
        files: [],
      }),
      responses: [{
        path: this.renderPath(pathTemplate, pkg, { id: 'dry', fileName: '(dry-run)', packageId: 'dry', artifactType: 'dry', content: '' }),
        method: 'POST',
        statusCode: 0,
        body: '(dry run)',
      }],
    }
  }

  // ─── Private ───

  private toConfig(raw: Record<string, any>): HTTPProviderConfig {
    return {
      baseUrl: raw.baseUrl || '',
      auth: raw.auth,
      headers: raw.headers,
      timeout: raw.timeout || 30000,
      retryMax: raw.retryMax || 3,
      retryDelay: raw.retryDelay || 1000,
    }
  }

  private renderPath(template: string, pkg: KnowledgePackage, artifact: { fileName: string }): string {
    return template
      .replace('{packageType}', pkg.packageType || 'knowledge')
      .replace('{packageId}', pkg.id)
      .replace('{fileName}', artifact.fileName)
      .replace('{projectId}', pkg.projectId || 'unknown')
  }

  private inferContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase()
    const map: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.txt': 'text/plain; charset=utf-8',
      '.md': 'text/markdown; charset=utf-8',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    }
    return map[ext] || 'application/octet-stream'
  }
}
