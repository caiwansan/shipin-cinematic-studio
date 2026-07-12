// ════════════════════════════════════════════════════════════
// P2A-002 — Sitemap Publisher
// ════════════════════════════════════════════════════════════
// Follows the same contract as WebsitePublisher (contract.ts).
// 
// Generates:
//   sitemap.xml        — 标准 XML Sitemap（<urlset> + <url> entry）
//   sitemap-entry.json — JSON 格式的 sitemap entry（便于调试 + Observation Engine 使用）
//   publish.json       — 统一发布元数据（与 WebsitePublisher 结构一致）
//
// 所有文件基于 KnowledgePackage + PackageManifest 生成。
// Platform 层零修改。
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { PublishFile } from './contract'

export class SitemapPublisher {
  name = 'sitemap'
  type = 'sitemap'

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

    // 3. 读取 Artifacts（用于获取 entity labels 确认变更频率）
    const artifacts = await this.prisma.packageArtifact.findMany({
      where: { packageId },
    })

    const mainArtifact = artifacts.find(a => a.fileName === 'package.json')
    let packageData: any = { assets: [] }
    if (mainArtifact) {
      try { packageData = JSON.parse(mainArtifact.content) } catch {}
    }

    const entityCount = packageData.assets?.filter((a: any) => a.type === 'structured_data').length ?? 0
    const claimCount = packageData.claims?.length ?? 0
    const title = manifest?.title ?? dbPackage.id
    const version = dbPackage.version
    const status = dbPackage.status
    const knowledgeObjectId = dbPackage.assetId

    // 计算 Sitemap 参数
    const lastMod = dbPackage.updatedAt.toISOString().split('T')[0]
    const changeFreq = claimCount > 3 ? 'weekly' : (claimCount > 0 ? 'weekly' : 'monthly')
    const priority = claimCount > 5 ? '0.9' : (claimCount > 0 ? '0.7' : '0.5')

    const canonicalUrl = `https://aigc.fushtn.com/knowledge/${knowledgeObjectId}`

    const files: PublishFile[] = []

    // ── sitemap.xml ──
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${this.escapeXml(canonicalUrl)}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${changeFreq}</changefreq>
    <priority>${priority}</priority>
  </url>
</urlset>
`
    files.push({
      fileName: 'sitemap.xml',
      filePath: '/sitemap/sitemap.xml',
      mimeType: 'application/xml',
      content: xml,
      size: xml.length,
      contentHash: this.simpleHash(xml),
    })

    // ── sitemap-entry.json ──
    const entry = JSON.stringify({
      loc: canonicalUrl,
      lastmod: lastMod,
      changefreq: changeFreq,
      priority: priority,
      title,
      packageId,
      knowledgeObjectId,
      claimCount,
      entityCount,
    }, null, 2)
    files.push({
      fileName: 'sitemap-entry.json',
      filePath: '/sitemap/sitemap-entry.json',
      mimeType: 'application/json',
      content: entry,
      size: entry.length,
      contentHash: this.simpleHash(entry),
    })

    // ── publish.json ──
    const publishMeta = JSON.stringify({
      publisher: 'sitemap',
      packageId,
      packageVersion: version,
      target: 'sitemap',
      outputPath: `/distribution/${packageId}/sitemap/`,
      // generatedAt is set by PublishRecord, not embedded here
      status,
      knowledgeObjectId,
    }, null, 2)
    files.push({
      fileName: 'publish.json',
      filePath: '/sitemap/publish.json',
      mimeType: 'application/json',
      content: publishMeta,
      size: publishMeta.length,
      contentHash: this.simpleHash(publishMeta),
    })

    return files
  }

  private escapeXml(s: string): string {
    if (!s) return ''
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash).toString(16).padStart(8, '0')
  }
}
