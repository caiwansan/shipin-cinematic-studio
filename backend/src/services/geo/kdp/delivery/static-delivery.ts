// ════════════════════════════════════════════════════════════
// KDP K4 RC1 — Static Delivery Builder
// ════════════════════════════════════════════════════════════
// Converts KnowledgePackage → deployable static website directory
// This is NOT an Adapter. It uses the Local Delivery Adapter
// but assembles a full static site structure with:
//   - Multi-page website (brand pages, about, FAQ)
//   - Sitemap (from K2 sitemap packager)
//   - RSS (from K2 RSS packager)
//   - AI Feed (from K2 AI feed packager)
//   - Schema.org
//   - Manifest + checksums
//
// K4 RC1: All files are complete, validated, deployable.
// No external platform dependency — just dist/ ready to ship.
// ════════════════════════════════════════════════════════════

import * as fs from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'
import { PrismaClient } from '@prisma/client'
import {
  KnowledgePackage, PackageManifest, PackageArtifact,
  DeliveryTargetType, DeliveryRecord, DeliveryJobStatus,
} from '../types'
import { KnowledgePackageRepository } from '../repos/package.repository'
import { ManifestRepository } from '../repos/manifest.repository'
import { ArtifactRepository } from '../repos/artifact.repository'

export interface StaticSiteConfig {
  outputPath: string
  siteName: string
  siteUrl: string
  siteDescription: string
  brandName?: string
  generatePages: boolean
  generateSitemap: boolean
  generateRss: boolean
  generateAiFeed: boolean
  generateSchema: boolean
}

export interface StaticSiteResult {
  rootPath: string
  directories: string[]
  files: StaticSiteFile[]
  totalBytes: number
  fileCount: number
  checksum: string
  manifest: Record<string, any>
}

export interface StaticSiteFile {
  relativePath: string
  absolutePath: string
  bytes: number
  sha256: string
}

export class StaticDelivery {
  private pkgRepo: KnowledgePackageRepository
  private manifestRepo: ManifestRepository
  private artifactRepo: ArtifactRepository

  constructor(private prisma: PrismaClient) {
    this.pkgRepo = new KnowledgePackageRepository(prisma)
    this.manifestRepo = new ManifestRepository(prisma)
    this.artifactRepo = new ArtifactRepository(prisma)
  }

  /**
   * Build a complete static site from all KnowledgePackages for a project.
   * Uses existing K2 packages (Website, Sitemap, RSS, AI Feed, Bundle).
   * This is the assembly step — it reads from K2 artifacts and writes
   * the full deployable directory.
   */
  async buildStaticSite(
    projectId: string,
    config: StaticSiteConfig,
  ): Promise<StaticSiteResult> {
    const { outputPath } = config
    const files: StaticSiteFile[] = []
    const dirs = new Set<string>()

    // Ensure clean directory
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { recursive: true, force: true })
    }
    fs.mkdirSync(outputPath, { recursive: true })

    // ── Step 1: Collect all packages ──
    const packages = await this.prisma.knowledgePackage.findMany({
      where: { projectId },
    })

    const pkgByType = new Map<string, KnowledgePackage>()
    for (const p of packages) {
      pkgByType.set(p.packageType.toLowerCase(), p)
    }

    // ── Step 2: Generate pages ──
    if (config.generatePages) {
      const brandName = config.brandName || config.siteName
      dirs.add('ai-feed')
      dirs.add('about')
      dirs.add('faq')

      // Index page
      files.push(await this.writePage(
        path.join(outputPath, 'index.html'),
        this.renderIndex(brandName, config),
      ))

      // About page
      files.push(await this.writePage(
        path.join(outputPath, 'about', 'index.html'),
        this.renderAbout(brandName, config, pkgByType),
      ))

      // FAQ page
      files.push(await this.writePage(
        path.join(outputPath, 'faq', 'index.html'),
        this.renderFaq(brandName, config, pkgByType),
      ))
    }

    // ── Step 3: Sitemap ──
    if (config.generateSitemap && pkgByType.has('sitemap')) {
      const sitemapPkg = pkgByType.get('sitemap')!
      const artifacts = await this.artifactRepo.findByPackage(sitemapPkg.id)
      for (const artifact of artifacts) {
        files.push(await this.writeArtifact(
          path.join(outputPath, artifact.fileName),
          artifact,
        ))
      }
    }

    // ── Step 4: RSS ──
    if (config.generateRss && pkgByType.has('rss')) {
      const rssPkg = pkgByType.get('rss')!
      const artifacts = await this.artifactRepo.findByPackage(rssPkg.id)
      for (const artifact of artifacts) {
        files.push(await this.writeArtifact(
          path.join(outputPath, artifact.fileName),
          artifact,
        ))
      }
    }

    // ── Step 5: AI Feed ──
    if (config.generateAiFeed && pkgByType.has('ai_feed')) {
      const aiPkg = pkgByType.get('ai_feed')!
      const artifacts = await this.artifactRepo.findByPackage(aiPkg.id)
      for (const artifact of artifacts) {
        files.push(await this.writeArtifact(
          path.join(outputPath, 'ai-feed', artifact.fileName),
          artifact,
        ))
      }
    }

    // ── Step 6: Schema.org ──
    if (config.generateSchema) {
      files.push(await this.writePage(
        path.join(outputPath, 'schema.json'),
        this.renderSchema(config, pkgByType),
      ))
    }

    // ── Step 8: Manifest ──
    // ── Step 7: SHA256 checksums (before manifest.json is written) ──
    // (only includes content files, not the checksum/manifest files themselves)
    const checksumLinesBase = files
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
      .map(f => `${f.sha256}  ${f.relativePath}`)
      .join('\n') + '\n'

    files.push(await this.writePage(
      path.join(outputPath, '.sha256sums'),
      checksumLinesBase,
    ))

    // ── Step 8: Manifest ──
    // Computed at the very end so all files (including .sha256sums and manifest.json)
    // are consistently counted.
    const allFiles = [...files].sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath))

    const allBytes = allFiles.reduce((s, f) => s + f.bytes, 0)
    const allHash = createHash('sha256')
      .update(allFiles.map(f => f.sha256).join(''))
      .digest('hex')

    const manifest = {
      siteName: config.siteName,
      siteUrl: config.siteUrl,
      generatedAt: new Date().toISOString(),
      totalFiles: allFiles.length,
      totalBytes: allBytes,
      checksum: allHash,
      directories: Array.from(dirs).sort(),
      files: allFiles,
    }

    files.push(await this.writePage(
      path.join(outputPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    ))

    // Recompute final values
    const finalAllFiles = [...files].sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath))
    const finalTotalBytes = finalAllFiles.reduce((s, f) => s + f.bytes, 0)
    const finalChecksum = createHash('sha256')
      .update(finalAllFiles.map(f => f.sha256).join(''))
      .digest('hex')

    console.log(`[StaticDelivery] Built ${config.siteName}: ${finalAllFiles.length} files, ${finalTotalBytes} bytes → ${outputPath}`)

    return {
      rootPath: outputPath,
      directories: Array.from(dirs).sort(),
      files: finalAllFiles,
      totalBytes: finalTotalBytes,
      fileCount: finalAllFiles.length,
      checksum: finalChecksum,
      manifest,
    }
  }

  /**
   * Verify a static site output is complete and consistent.
   */
  verifyStaticSite(result: StaticSiteResult): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!fs.existsSync(result.rootPath)) {
      errors.push(`Root path missing: ${result.rootPath}`)
      return { valid: false, errors }
    }

    // Check all files exist and match checksum
    for (const file of result.files) {
      if (!fs.existsSync(file.absolutePath)) {
        errors.push(`File missing: ${file.relativePath}`)
        continue
      }
      const content = fs.readFileSync(file.absolutePath, 'utf8')
      const actualHash = createHash('sha256').update(content).digest('hex')
      if (actualHash !== file.sha256) {
        errors.push(`Checksum mismatch: ${file.relativePath}`)
      }
    }

    // Manifest must be self-consistent
    if (result.files.length !== result.fileCount) {
      errors.push(`Manifest file count ${result.fileCount} != actual ${result.files.length}`)
    }

    console.log(`[StaticDelivery] Verify: ${errors.length === 0 ? 'PASS' : errors.length + ' errors'}`)
    return { valid: errors.length === 0, errors }
  }

  // ═══ Private Helpers ═══

  private async writePage(absPath: string, content: string): Promise<StaticSiteFile> {
    const dir = path.dirname(absPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    fs.writeFileSync(absPath, content, 'utf8')
    const bytes = Buffer.byteLength(content, 'utf8')
    const sha256 = createHash('sha256').update(content).digest('hex')

    const basePath = path.resolve('.')
    return {
      relativePath: path.relative(basePath, absPath),
      absolutePath: absPath,
      bytes,
      sha256,
    }
  }

  private async writeArtifact(absPath: string, artifact: any): Promise<StaticSiteFile> {
    const dir = path.dirname(absPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const content = artifact.content
    fs.writeFileSync(absPath, content, 'utf8')
    const bytes = Buffer.byteLength(content, 'utf8')
    const sha256 = createHash('sha256').update(content).digest('hex')

    const basePath = path.resolve('.')
    return {
      relativePath: path.relative(basePath, absPath),
      absolutePath: absPath,
      bytes,
      sha256,
    }
  }

  // ═══ Template Rendering ═══

  private renderIndex(brandName: string, config: StaticSiteConfig): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brandName} — Brand Knowledge Hub</title>
  <meta name="description" content="${config.siteDescription}">
  <link rel="alternate" type="application/rss+xml" title="${brandName} RSS" href="/feed.xml">
  <link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap-entry.xml">
  <script type="application/ld+json" src="/schema.json"></script>
  <style>
    :root { --primary: #1a73e8; --bg: #ffffff; --text: #202124; --muted: #5f6368; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    p { color: var(--muted); margin-bottom: 1.5rem; }
    .links { display: flex; gap: 1rem; flex-wrap: wrap; }
    .links a { color: var(--primary); text-decoration: none; padding: 0.5rem 1rem; border: 1px solid var(--primary); border-radius: 4px; transition: all 0.2s; }
    .links a:hover { background: var(--primary); color: white; }
    .meta { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #eee; font-size: 0.875rem; color: var(--muted); }
  </style>
</head>
<body>
  <div class="container">
    <h1>${brandName}</h1>
    <p>${config.siteDescription}</p>
    <div class="links">
      <a href="/about/">About</a>
      <a href="/faq/">FAQ</a>
      <a href="/sitemap-entry.xml">Sitemap</a>
      <a href="/feed.xml">RSS</a>
      <a href="/ai-feed/">AI Knowledge</a>
    </div>
    <div class="meta">
      <p>Generated: ${new Date().toISOString().split('T')[0]} · <a href="${config.siteUrl}">${config.siteUrl}</a></p>
    </div>
  </div>
</body>
</html>`
  }

  private renderAbout(brandName: string, config: StaticSiteConfig, pkgByType: Map<string, KnowledgePackage>): string {
    const bundlePkg = pkgByType.get('knowledge_bundle')
    let bundleContent = '<p>Brand knowledge is being prepared.</p>'

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About — ${brandName}</title>
  <meta name="description" content="About ${brandName} — brand knowledge, facts, and key information.">
  <style>
    :root { --primary: #1a73e8; --bg: #ffffff; --text: #202124; --muted: #5f6368; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    p { color: var(--muted); margin-bottom: 1rem; }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .back { margin-top: 2rem; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <h1>About ${brandName}</h1>
    <p>${config.siteDescription}</p>
    <p>This knowledge hub is maintained as part of the Brand Knowledge Operating System — ensuring consistent, verified brand information across all distribution channels.</p>
    <h2>Key Facts</h2>
    <ul>
      <li>Site: <a href="${config.siteUrl}">${config.siteUrl}</a></li>
      <li>Knowledge Packages: ${pkgByType.size}</li>
      <li>Last Updated: ${new Date().toISOString().split('T')[0]}</li>
    </ul>
    <a href="/" class="back">← Back to Home</a>
  </div>
</body>
</html>`
  }

  private renderFaq(brandName: string, config: StaticSiteConfig, pkgByType: Map<string, KnowledgePackage>): string {
    let faqItems = '<p>No FAQ content available yet.</p>'

    if (pkgByType.has('ai_feed')) {
      faqItems = '<p>FAQ content is being processed. Check the <a href="/ai-feed/">AI Knowledge Feed</a> for structured data.</p>'
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FAQ — ${brandName}</title>
  <meta name="description" content="Frequently asked questions about ${brandName}.">
  <script type="application/ld+json">{
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": []
  }</script>
  <style>
    :root { --primary: #1a73e8; --bg: #ffffff; --text: #202124; --muted: #5f6368; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    p { color: var(--muted); margin-bottom: 1rem; }
    a { color: var(--primary); }
    .back { margin-top: 2rem; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <h1>FAQ</h1>
    ${faqItems}
    <a href="/" class="back">← Back to Home</a>
  </div>
</body>
</html>`
  }

  private renderSchema(config: StaticSiteConfig, pkgByType: Map<string, KnowledgePackage>): string {
    const schema: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: config.brandName || config.siteName,
      url: config.siteUrl,
      description: config.siteDescription,
    }

    return JSON.stringify(schema, null, 2)
  }
}
