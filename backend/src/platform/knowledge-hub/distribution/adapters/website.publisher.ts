// ════════════════════════════════════════════════════════════
// P2A-001 — Website Publisher
// ════════════════════════════════════════════════════════════
// Reference implementation for the Distribution Engine.
//
// Generates:
//   index.html        — 人类可读的内容页面（Title + Claims + Evidence + Citations + FAQ）
//   schema.jsonld     — JSON-LD 结构化数据
//   metadata.json     — Package 元数据（version, timestamps, entity labels）
//   publish.json      — 发布记录摘要
//
// 所有文件基于 KnowledgePackage + PackageManifest + PackageArtifact 生成。
// Platform 层零修改。
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { PublishFile } from './contract'

export class WebsitePublisher {
  name = 'website'
  type = 'website'

  private prisma: PrismaClient

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? new PrismaClient()
  }

  async publish(packageId: string): Promise<PublishFile[]> {
    // 1. 读取 KnowledgePackage
    const dbPackage = await this.prisma.knowledgePackage.findUnique({
      where: { id: packageId },
    })
    if (!dbPackage) throw new Error(`Package not found: ${packageId}`)

    // 2. 读取 Manifest
    let manifest: any = null
    if (dbPackage.manifestId) {
      manifest = await this.prisma.packageManifest.findUnique({
        where: { id: dbPackage.manifestId },
      })
    }

    // 3. 读取 Artifacts（package.json 中的 claims/evidence/citations/assets）
    const artifacts = await this.prisma.packageArtifact.findMany({
      where: { packageId },
      orderBy: { sortOrder: 'asc' },
    })

    // 4. 解析 package.json
    const mainArtifact = artifacts.find(a => a.fileName === 'package.json')
    let packageData: any = {
      claims: [],
      evidence: [],
      citations: [],
      assets: [],
    }
    if (mainArtifact) {
      try {
        packageData = JSON.parse(mainArtifact.content)
      } catch {
        // 解析失败时使用空数据
      }
    }

    const { claims, evidence, citations, assets } = packageData
    const title = manifest?.title ?? dbPackage.id
    const summary = manifest?.summary ?? ''
    const version = dbPackage.version
    const status = dbPackage.status
    const knowledgeObjectId = dbPackage.assetId

    const files: PublishFile[] = []

    // ── index.html ──
    const html = this.renderIndexHtml({
      title,
      summary,
      version,
      status,
      claims,
      evidence,
      citations,
      assets,
      knowledgeObjectId,
      updatedAt: dbPackage.updatedAt.toISOString(),
    })
    files.push({
      fileName: 'index.html',
      filePath: '/website/index.html',
      mimeType: 'text/html',
      content: html,
      size: html.length,
      contentHash: this.simpleHash(html),
    })

    // ── schema.jsonld ──
    const ldjson = this.renderSchemaJsonLd({
      title,
      summary,
      claims,
      evidence,
      citations,
      assets,
      knowledgeObjectId,
      updatedAt: dbPackage.updatedAt.toISOString(),
    })
    files.push({
      fileName: 'schema.jsonld',
      filePath: '/website/schema.jsonld',
      mimeType: 'application/ld+json',
      content: ldjson,
      size: ldjson.length,
      contentHash: this.simpleHash(ldjson),
    })

    // ── publish.json ──
    const metadata = JSON.stringify({
      packageId,
      title,
      version,
      status,
      knowledgeObjectId,
      manifestId: dbPackage.manifestId,
      claimCount: claims.length,
      evidenceCount: evidence.length,
      citationCount: citations.length,
      assetCount: assets.length,
      // publishedAt is set by PublishRecord, not embedded in the artifact
      // to keep deterministic build
    }, null, 2)
    files.push({
      fileName: 'publish.json',
      filePath: '/website/publish.json',
      mimeType: 'application/json',
      content: metadata,
      size: metadata.length,
      contentHash: this.simpleHash(metadata),
    })

    return files
  }

  private renderIndexHtml(data: {
    title: string
    summary: string
    version: string
    status: string
    claims: { id: string; text: string; confidence?: number; source?: string }[]
    evidence: { id: string; content: string; source?: string; url?: string }[]
    citations: { id: string; title: string; url: string; snippet?: string }[]
    assets: { id: string; type: string; content?: string }[]
    knowledgeObjectId: string
    updatedAt: string
  }): string {
    const safeTitle = this.escapeHtml(data.title)
    const safeSummary = this.escapeHtml(data.summary)

    // 渲染 Claims
    const claimsHtml = data.claims.map(c =>
      `<div class="claim">
        <p class="claim-text">${this.escapeHtml(c.text)}</p>
        ${c.confidence !== undefined ? `<span class="badge">Confidence: ${(c.confidence * 100).toFixed(0)}%</span>` : ''}
        ${c.source ? `<span class="badge badge-source">Source: ${this.escapeHtml(c.source)}</span>` : ''}
      </div>`
    ).join('\n')

    // 渲染 Evidence
    const evidenceHtml = data.evidence.map(e =>
      `<div class="evidence">
        <p>${this.escapeHtml(e.content)}</p>
        ${e.url ? `<a href="${this.escapeHtml(e.url)}" target="_blank" rel="noopener">Source</a>` : ''}
        ${e.source ? `<span class="badge">${this.escapeHtml(e.source)}</span>` : ''}
      </div>`
    ).join('\n')

    // 渲染 Citations
    const citationHtml = data.citations.map(c =>
      `<li>
        ${c.title ? `<a href="${this.escapeHtml(c.url)}" target="_blank" rel="noopener">${this.escapeHtml(c.title)}</a>` : `<a href="${this.escapeHtml(c.url)}">${this.escapeHtml(c.url)}</a>`}
        ${c.snippet ? `<p class="snippet">${this.escapeHtml(c.snippet)}</p>` : ''}
      </li>`
    ).join('\n')

    // 渲染 Assets/Entities
    const entityHtml = data.assets
      .filter(a => a.type === 'structured_data')
      .map(a => {
        try {
          const entity = JSON.parse(a.content ?? '{}')
          return `<div class="entity">
            <h3>${this.escapeHtml(entity.name ?? 'Unknown')}</h3>
            <span class="badge">${this.escapeHtml(entity.type ?? '')}</span>
            ${entity.description ? `<p>${this.escapeHtml(entity.description)}</p>` : ''}
          </div>`
        } catch {
          return ''
        }
      }).filter(Boolean).join('\n')

    // JSON-LD inline in head
    const ldJson = this.buildJsonLd(data)

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <meta name="description" content="${this.escapeHtml(data.summary.substring(0, 200))}">
  <script type="application/ld+json">
${ldJson}
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .meta span { margin-right: 1rem; }
    h2 { font-size: 1.3rem; margin: 1.5rem 0 0.5rem; border-bottom: 1px solid #eee; padding-bottom: 0.3rem; }
    .claim, .evidence, .entity { background: #f8f9fa; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
    .claim-text { font-weight: 500; }
    .badge { display: inline-block; background: #e9ecef; border-radius: 4px; padding: 2px 6px; font-size: 0.75rem; color: #495057; margin-top: 4px; }
    .badge-source { background: #d3d9e0; }
    .snippet { color: #666; margin-top: 4px; font-size: 0.9rem; }
    ul { list-style: none; }
    li { padding: 6px 0; }
    a { color: #1a73e8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.8rem; color: #999; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div class="meta">
    <span>Version: ${this.escapeHtml(data.version)}</span>
    <span>Status: ${this.escapeHtml(data.status)}</span>
    <span>Updated: ${new Date(data.updatedAt).toLocaleDateString('zh-CN')}</span>
  </div>

  ${data.summary ? `<p class="summary">${this.escapeHtml(data.summary)}</p>` : ''}

  ${data.claims.length > 0 ? `
  <h2>Key Claims (${data.claims.length})</h2>
  ${claimsHtml}` : ''}

  ${data.evidence.length > 0 ? `
  <h2>Evidence (${data.evidence.length})</h2>
  ${evidenceHtml}` : ''}

  ${data.citations.length > 0 ? `
  <h2>Citations (${data.citations.length})</h2>
  <ul>${citationHtml}</ul>` : ''}

  ${data.assets.filter(a => a.type === 'structured_data').length > 0 ? `
  <h2>Entities (${data.assets.filter(a => a.type === 'structured_data').length})</h2>
  ${entityHtml}` : ''}

  <div class="footer">
    <p>Built from Package <code>${this.escapeHtml(data.knowledgeObjectId.slice(0, 12))}</code></p>
    <p>Generated by GEO Knowledge Distribution Engine</p>
  </div>
</body>
</html>`
  }

  private renderSchemaJsonLd(data: {
    title: string
    summary: string
    claims: { id: string; text: string; confidence?: number }[]
    evidence: { id: string; content: string; url?: string }[]
    citations: { id: string; title: string; url: string }[]
    assets: { id: string; type: string; content?: string }[]
    knowledgeObjectId: string
    updatedAt: string
  }): string {
    const ld = this.buildJsonLd(data)
    return JSON.stringify(JSON.parse(ld), null, 2)
  }

  private buildJsonLd(data: {
    title: string
    summary: string
    claims: { id: string; text: string; confidence?: number }[]
    evidence: { id: string; content: string; url?: string }[]
    citations: { id: string; title: string; url: string }[]
    assets: { id: string; type: string; content?: string }[]
    knowledgeObjectId: string
    updatedAt: string
  }): string {
    const mainEntities = data.assets
      .filter(a => a.type === 'structured_data')
      .slice(0, 5)
      .map(a => {
        try {
          const e = JSON.parse(a.content ?? '{}')
          return {
            '@type': 'Thing',
            name: e.name ?? '',
            description: e.description ?? '',
          }
        } catch {
          return null
        }
      }).filter(Boolean)

    const graph = [
      {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: data.title,
        description: data.summary,
        version: '1.0.0',
        dateModified: data.updatedAt,
        about: mainEntities.length > 0 ? mainEntities : undefined,
      },
    ]

    // Add claims as potentialAction or mentions
    if (data.claims.length > 0) {
      graph.push({
        '@type': 'ItemList',
        name: 'Knowledge Claims',
        itemListElement: data.claims.slice(0, 20).map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Claim',
            name: c.text.substring(0, 100),
            ...(c.confidence !== undefined ? { confidence: c.confidence } : {}),
          },
        })),
      })
    }

    return JSON.stringify({ '@graph': graph }, null, 2)
  }

  private escapeHtml(s: string): string {
    if (!s) return ''
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return Math.abs(hash).toString(16).padStart(8, '0')
  }
}
