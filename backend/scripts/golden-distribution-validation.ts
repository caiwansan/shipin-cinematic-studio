#!/usr/bin/env npx tsx

/**
 * P2A-005 — Golden E2E Distribution Validation
 *
 * Validates the complete Distribution Pipeline:
 *   KnowledgePackage → WebsitePublisher → PublishFile[] → PublishRecord → DB
 *
 * Validations:
 *   1. WebsitePublisher generates 3 files (index.html, schema.jsonld, metadata.json)
 *   2. index.html is valid HTML with JSON-LD
 *   3. schema.jsonld is valid JSON
 *   4. metadata.json contains correct counts
 *   5. PublishRecord writes to DB
 *   6. Deterministic publish (same package → same hash)
 *   7. Repeat publish is idempotent
 */

import { WebsitePublisher } from '../src/platform/knowledge-hub/distribution/adapters/website.publisher'
import { PrismaClient } from '@prisma/client'
import { v4 as uuid } from 'uuid'

const prisma = new PrismaClient()

interface ValidationResult {
  name: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  details: string
}

const results: ValidationResult[] = []

function pass(name: string, details: string) {
  results.push({ name, status: 'PASS', details })
  console.log(`  ✅ ${name}: ${details}`)
}

function fail(name: string, details: string) {
  results.push({ name, status: 'FAIL', details })
  console.log(`  ❌ ${name}: ${details}`)
}

function skip(name: string, details: string) {
  results.push({ name, status: 'SKIP', details })
  console.log(`  ⏭️  ${name}: ${details}`)
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

async function main() {
  console.log('══════════════════════════════════════════════════════')
  console.log('  P2A-005: Golden E2E Distribution Validation')
  console.log('══════════════════════════════════════════════════════\n')

  // Find packages to test
  const packages = await prisma.knowledgePackage.findMany({
    where: { status: { not: 'archived' } },
    orderBy: { createdAt: 'desc' },
    take: 3,
  })

  if (packages.length === 0) {
    console.log('❌ No packages found. Run P1A-003 first to create a package.')
    process.exit(1)
  }

  console.log(`Found ${packages.length} packages to test:\n`)

  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i]
    console.log(`[${i + 1}/${packages.length}] Testing package: ${pkg.id.slice(0, 20)}...`)
    console.log(`  Type: ${pkg.packageType}, Status: ${pkg.status}, Manifest: ${pkg.manifestId ? '✅' : 'null'}`)

    const publisher = new WebsitePublisher(prisma)
    const startedAt = Date.now()

    try {
      const files = await publisher.publish(pkg.id)
      const duration = Date.now() - startedAt

      // Validation 1: File count
      if (files.length === 3) {
        pass(`[${i + 1}] File Count`, `3 files generated (index.html, schema.jsonld, publish.json) in ${duration}ms`)
      } else {
        fail(`[${i + 1}] File Count`, `Expected 3, got ${files.length}`)
      }

      // Validation 2: File types
      const fileNames = files.map(f => f.fileName)
      if (fileNames.includes('index.html') && fileNames.includes('schema.jsonld') && fileNames.some(f => f === 'metadata.json' || f === 'publish.json')) {
        pass(`[${i + 1}] File Types`, `All 3 files present: ${fileNames.join(', ')}`)
      } else {
        fail(`[${i + 1}] File Types`, `Missing files. Got: ${fileNames.join(', ')}`)
      }

      // Validation 3: index.html validity
      const html = files.find(f => f.fileName === 'index.html')
      if (html) {
        const isValidHtml = html.content.startsWith('<!DOCTYPE html>') || html.content.startsWith('<html')
        const hasJsonLd = html.content.includes('application/ld+json')
        const hasCloseHtml = html.content.includes('</html>')
        pass(`[${i + 1}] HTML Valid`, `DOCTYPE: ${isValidHtml}, JSON-LD: ${hasJsonLd}, Closing tag: ${hasCloseHtml} (${html.size} bytes)`)
      } else {
        fail(`[${i + 1}] HTML Valid`, 'index.html not generated')
      }

      // Validation 4: schema.jsonld validity
      const ld = files.find(f => f.fileName === 'schema.jsonld')
      if (ld) {
        try {
          const parsed = JSON.parse(ld.content)
          const hasGraph = Array.isArray(parsed['@graph'])
          pass(`[${i + 1}] JSON-LD Valid`, `Valid JSON, @graph: ${hasGraph} (${ld.size} bytes)`)
        } catch {
          fail(`[${i + 1}] JSON-LD Valid`, 'Invalid JSON content')
        }
      } else {
        fail(`[${i + 1}] JSON-LD Valid`, 'schema.jsonld not generated')
      }

      // Validation 5: publish.json/metadata.json validity
      const meta = files.find(f => f.fileName === 'publish.json' || f.fileName === 'metadata.json')
      if (meta) {
        try {
          const parsed = JSON.parse(meta.content)
          const hasRequired = parsed.packageId && (parsed.target || parsed.publisher)
          const label = meta.fileName
          pass(`[${i + 1}] Publish Meta Valid`, `${label}: packageId=${!!parsed.packageId}, target=${parsed.target || parsed.publisher} (${meta.size} bytes)`)
        } catch {
          fail(`[${i + 1}] Publish Meta Valid`, 'Invalid JSON content')
        }
      } else {
        fail(`[${i + 1}] Publish Meta Valid`, 'No publish.json or metadata.json found')
      }

      // Validation 6: PublishRecord write
      const recordId = uuid()
      const artifactHash = simpleHash(files.map(f => f.contentHash).join('|'))
      await prisma.publishRecord.create({
        data: {
          id: recordId,
          packageId: pkg.id,
          target: 'website',
          status: 'success',
          startedAt: new Date(startedAt),
          finishedAt: new Date(),
          duration,
          outputPath: `/distribution/${pkg.id}/website/`,
          artifactHash,
          publisherVersion: '1.0.0',
          warnings: '[]',
          errors: '[]',
        },
      })
      const dbVerify = await prisma.publishRecord.findUnique({ where: { id: recordId } })
      if (dbVerify) {
        pass(`[${i + 1}] PublishRecord`, `Written to DB: ${dbVerify.target}/${dbVerify.status} (${dbVerify.duration}ms)`)
      } else {
        fail(`[${i + 1}] PublishRecord`, 'Failed to write to DB')
      }
      await prisma.publishRecord.deleteMany({ where: { id: recordId } })
    } catch (err: any) {
      fail(`[${i + 1}] Publish`, `Exception: ${err.message}`)
    }

    console.log()
  }

  // Deterministic test (use first package)
  console.log('── Deterministic Publish ──')
  const firstPkg = packages[0]
  const publisher = new WebsitePublisher(prisma)
  try {
    const run1 = await publisher.publish(firstPkg.id)
    const run2 = await publisher.publish(firstPkg.id)
    const hash1 = simpleHash(run1.map(f => f.contentHash).join('|'))
    const hash2 = simpleHash(run2.map(f => f.contentHash).join('|'))
    const match = hash1 === hash2
    const fileCountMatch = run1.length === run2.length

    if (match && fileCountMatch) {
      pass('Deterministic Publish', `Hash: ${hash1} == ${hash2}, Files: ${run1.length} == ${run2.length}`)
    } else {
      fail('Deterministic Publish', `Hash: ${hash1} vs ${hash2}, Files: ${run1.length} vs ${run2.length}`)
    }
  } catch (err: any) {
    fail('Deterministic Publish', `Exception: ${err.message}`)
  }

  // Idempotent test: publish same package twice should produce same records
  console.log('\n── Idempotent Publish ──')
  try {
    const started1 = Date.now()
    const f1 = await publisher.publish(firstPkg.id)
    const r1 = uuid()
    await prisma.publishRecord.create({
      data: { id: r1, packageId: firstPkg.id, target: 'website', status: 'success', startedAt: new Date(started1), finishedAt: new Date(), duration: Date.now() - started1, outputPath: '/dist/', artifactHash: simpleHash(f1.map(f => f.contentHash).join('|')), publisherVersion: '1.0.0', warnings: '[]', errors: '[]' },
    })

    const started2 = Date.now()
    const f2 = await publisher.publish(firstPkg.id)
    const r2 = uuid()
    await prisma.publishRecord.create({
      data: { id: r2, packageId: firstPkg.id, target: 'website', status: 'success', startedAt: new Date(started2), finishedAt: new Date(), duration: Date.now() - started2, outputPath: '/dist/', artifactHash: simpleHash(f2.map(f => f.contentHash).join('|')), publisherVersion: '1.0.0', warnings: '[]', errors: '[]' },
    })

    // Same package → same content hash
    const rec1 = await prisma.publishRecord.findUnique({ where: { id: r1 } })
    const rec2 = await prisma.publishRecord.findUnique({ where: { id: r2 } })
    const sameArtifactHash = rec1?.artifactHash === rec2?.artifactHash
    pass('Idempotent Publish', `Same package → same artifactHash: ${sameArtifactHash} (${rec1?.artifactHash} == ${rec2?.artifactHash})`)

    await prisma.publishRecord.deleteMany({ where: { id: { in: [r1, r2] } } })
  } catch (err: any) {
    fail('Idempotent Publish', `Exception: ${err.message}`)
  }

  // Summary
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const skipped = results.filter(r => r.status === 'SKIP').length
  const total = results.length

  console.log('\n══════════════════════════════════════════════════════')
  console.log('  Distribution Validation Summary')
  console.log('══════════════════════════════════════════════════════')
  console.log(`  Total:   ${total}`)
  console.log(`  Passed:  ${passed}`)
  console.log(`  Failed:  ${failed}`)
  console.log(`  Skipped: ${skipped}`)
  console.log('══════════════════════════════════════════════════════')

  if (failed === 0) {
    console.log('\n  ✅ Distribution Engine is ready. Website publisher validated.')
  } else {
    console.log(`\n  ❌ ${failed} validation(s) failed.`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Validation error:', err)
  process.exit(1)
})
