// ════════════════════════════════════════════════════════════
// KDP K4 RC1 — Golden Regression: Static Delivery
// ════════════════════════════════════════════════════════════
// Validates:
//   1. Static site built from K2 packages
//   2. All expected directories exist
//   3. Each file has content, checksums match
//   4. Manifest.json is self-consistent
//   5. .sha256sums matches all files
//   6. Verification passes full integrity check
//
// This is a complete deployable static site — ready for any
// static hosting (nginx, CDN, S3, Cloudflare Pages, etc.)
// ════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client'
import { StaticDelivery } from '../src/services/geo/kdp/delivery/static-delivery'
import * as fs from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'

const prisma = new PrismaClient()

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}`)
    failed++
  }
}

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('KDP K4 RC1 — Golden Regression: Static Delivery')
  console.log('═══════════════════════════════════════════\n')

  const staticDelivery = new StaticDelivery(prisma)

  // Find packages
  const projects = await prisma.knowledgePackage.findMany({
    select: { projectId: true },
    distinct: ['projectId'],
  })

  if (projects.length === 0) {
    console.log('\n❌ No projects with packages found')
    process.exit(1)
  }

  const projectId = projects[0].projectId

  // ── Phase 1: Build ──
  console.log('📦 Phase 1: Static Site Build')
  console.log('──────────────────────')

  const outputPath = './k4-output'

  const result = await staticDelivery.buildStaticSite(projectId, {
    outputPath,
    siteName: 'Test Brand',
    siteUrl: 'https://example.com',
    siteDescription: 'A brand knowledge hub for testing.',
    brandName: 'Test Brand',
    generatePages: true,
    generateSitemap: true,
    generateRss: true,
    generateAiFeed: true,
    generateSchema: true,
  })

  assert(result.rootPath === outputPath, `Root path set: ${result.rootPath}`)
  assert(result.fileCount > 0, `Files generated: ${result.fileCount}`)
  assert(result.totalBytes > 0, `Total bytes: ${result.totalBytes}`)
  assert(result.checksum.length > 0, 'Checksum computed')
  assert(result.directories.length > 0, 'Directories created')
  assert(result.files.length === result.fileCount, 'File count matches manifest')

  // ── Phase 2: Directory Structure ──
  console.log('\n📦 Phase 2: Directory Structure')
  console.log('──────────────────────')

  const rootExists = fs.existsSync(outputPath)
  assert(rootExists, 'Root output directory exists')

  if (!rootExists) { process.exit(1) }

  const rootContents = fs.readdirSync(outputPath)
  const hasManifest = rootContents.includes('manifest.json')
  const hasChecksums = rootContents.includes('.sha256sums')
  const hasIndex = rootContents.includes('index.html')
  const hasSchema = rootContents.includes('schema.json')

  assert(hasManifest, 'manifest.json present')
  assert(hasChecksums, '.sha256sums present')
  assert(hasIndex, 'index.html present')
  assert(hasSchema, 'schema.json present')

  // Check subdirectories
  const aboutExists = fs.existsSync(path.join(outputPath, 'about'))
  const faqExists = fs.existsSync(path.join(outputPath, 'faq'))
  const aiFeedExists = fs.existsSync(path.join(outputPath, 'ai-feed'))

  assert(aboutExists, 'about/ directory present')
  assert(faqExists, 'faq/ directory present')
  assert(aiFeedExists, 'ai-feed/ directory present')

  const aboutIndexExists = fs.existsSync(path.join(outputPath, 'about', 'index.html'))
  const faqIndexExists = fs.existsSync(path.join(outputPath, 'faq', 'index.html'))
  assert(aboutIndexExists, 'about/index.html present')
  assert(faqIndexExists, 'faq/index.html present')

  // ── Phase 3: Content Verification ──
  console.log('\n📦 Phase 3: Content Verification')
  console.log('──────────────────────')

  const indexContent = fs.readFileSync(path.join(outputPath, 'index.html'), 'utf8')
  assert(indexContent.includes('<title>'), 'index.html has <title>')
  assert(indexContent.includes('Brand Knowledge Hub'), 'index.html contains Brand Knowledge Hub')
  assert(indexContent.includes('sitemap-entry.xml'), 'index.html links to sitemap')
  assert(indexContent.includes('feed.xml'), 'index.html links to RSS')

  const aboutContent = fs.readFileSync(path.join(outputPath, 'about', 'index.html'), 'utf8')
  assert(aboutContent.includes('About'), 'about/index.html has content')
  assert(aboutContent.includes('Test Brand'), 'about/index.html mentions brand')

  const schemaContent = fs.readFileSync(path.join(outputPath, 'schema.json'), 'utf8')
  const schema = JSON.parse(schemaContent)
  assert(schema['@type'] === 'Organization', 'schema.json is Organization type')
  assert(schema.name === 'Test Brand', 'schema.json has brand name')

  // ── Phase 4: SHA256 Verification ──
  console.log('\n📦 Phase 4: SHA256 Verification')
  console.log('──────────────────────')

  const shaContent = fs.readFileSync(path.join(outputPath, '.sha256sums'), 'utf8')
  const shaLines = shaContent.trim().split('\n')

  // Every file in result should be in .sha256sums
  const sha256Files = new Map<string, string>()
  for (const line of shaLines) {
    const [hash, name] = line.split('  ')
    sha256Files.set(name, hash)
  }

  for (const file of result.files) {
    const relativePath = file.relativePath
    if (relativePath.includes('.sha256sums') || relativePath.includes('manifest.json')) continue

    const hasEntry = sha256Files.has(relativePath)
    assert(hasEntry, `.sha256sums contains ${relativePath}`)

    if (hasEntry) {
      const matches = sha256Files.get(relativePath) === file.sha256
      assert(matches, `${relativePath} checksum matches`)
    }
  }

  // ── Phase 5: Manifest Verification ──
  console.log('\n📦 Phase 5: Manifest Verification')
  console.log('──────────────────────')

  const manifestContent = fs.readFileSync(path.join(outputPath, 'manifest.json'), 'utf8')
  const manifest = JSON.parse(manifestContent)

  assert(manifest.siteName === 'Test Brand', 'Manifest siteName correct')
  assert(manifest.totalFiles === result.fileCount - 1, `Manifest totalFiles (${manifest.totalFiles}) = result (${result.fileCount}) - 1  (manifest.json not included in itself)`)
  assert(manifest.totalBytes < result.totalBytes, `Manifest totalBytes (${manifest.totalBytes}) < result totalBytes (${result.totalBytes})`)
  assert(manifest.checksum !== result.checksum, 'Manifest checksum differs from result (one less file)')
  assert(manifest.generatedAt !== undefined, 'Manifest has generatedAt')

  // ── Phase 6: StaticDelivery Verify ──
  console.log('\n📦 Phase 6: StaticDelivery Verify')
  console.log('──────────────────────')

  const verification = staticDelivery.verifyStaticSite(result)
  assert(verification.valid === true, 'StaticDelivery.verifyStaticSite PASSED')
  assert(verification.errors.length === 0, 'Zero verification errors')

  // ── Phase 7: Re-build (idempotency) ──
  console.log('\n📦 Phase 7: Re-build (Idempotency)')
  console.log('──────────────────────')

  const result2 = await staticDelivery.buildStaticSite(projectId, {
    outputPath,
    siteName: 'Test Brand Rebuilt',
    siteUrl: 'https://example.com',
    siteDescription: 'Rebuilt for idempotency test.',
    brandName: 'Test Brand Rebuilt',
    generatePages: true,
    generateSitemap: true,
    generateRss: true,
    generateAiFeed: true,
    generateSchema: true,
  })

  assert(result2.fileCount > 0, 'Rebuild succeeded')
  assert(result2.checksum !== result.checksum, 'Second build has different checksum (expected — content changed)')

  const index2 = fs.readFileSync(path.join(outputPath, 'index.html'), 'utf8')
  assert(index2.includes('Test Brand Rebuilt'), 'Rebuilt page shows new brand name')

  // Cleanup
  fs.rmSync(outputPath, { recursive: true, force: true })

  // ── Results ──
  console.log('\n═══════════════════════════════════════════')
  console.log(`📊 Results: ${passed} passed, ${failed} failed`)
  console.log('═══════════════════════════════════════════')

  if (failed > 0) {
    console.error('\n❌ K4 RC1 Regression FAILED\n')
    process.exit(1)
  }

  console.log('\n✅ KDP K4 RC1 Golden Regression PASSED — Static Delivery ready\n')
}

main().catch(e => {
  console.error('\n❌ K4 RC1 Regression error:', e.message)
  process.exit(1)
})
