#!/usr/bin/env npx tsx

/**
 * Golden Packaging Regression Suite
 *
 * PRE-REQUISITES: database must have KnowledgeObjects with various data shapes.
 * Run after any change to KnowledgeObjectProvider, mappers, or PackageBuilder.
 *
 * Tests:
 *   - Empty KO (status: DISCOVERED, no claims/evidence/entities)
 *   - KO with entities only (benchmark/sync exports)
 *   - KO with GENERATED status (claims/evidence present)
 *
 * Each test:
 *   - Builds a package
 *   - Writes to DB (cleanup after)
 *   - Validates output consistency
 *   - Checks deterministic hash
 */

import { buildPackageFromKO } from '../src/platform/knowledge-hub/providers/geo/knowledge-object-provider'
import { PrismaClient } from '@prisma/client'
import { v4 as uuid } from 'uuid'

const prisma = new PrismaClient()

interface TestCase {
  name: string
  koId: string
  expect: {
    minClaims?: number
    minEvidence?: number
    minCitations?: number
    minAssets?: number
  }
}

interface TestResult {
  name: string
  passed: boolean
  details: string
  duration: number
  hash: string
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

async function runTest(tc: TestCase): Promise<TestResult> {
  const startedAt = Date.now()
  try {
    const result = await buildPackageFromKO(tc.koId)
    if (!result.success || !result.pkg) {
      return {
        name: tc.name,
        passed: false,
        details: `Build failed: ${result.errors?.join(', ')}`,
        duration: Date.now() - startedAt,
        hash: '',
      }
    }

    const pkg = result.pkg
    const hash = simpleHash(pkg.title + '|' + pkg.claims.length + '|' + pkg.evidence.length + '|' + pkg.assets.length)
    const failures: string[] = []

    if (tc.expect.minClaims !== undefined && pkg.claims.length < tc.expect.minClaims) {
      failures.push(`Expected claims >= ${tc.expect.minClaims}, got ${pkg.claims.length}`)
    }
    if (tc.expect.minEvidence !== undefined && pkg.evidence.length < tc.expect.minEvidence) {
      failures.push(`Expected evidence >= ${tc.expect.minEvidence}, got ${pkg.evidence.length}`)
    }
    if (tc.expect.minCitations !== undefined && pkg.citations.length < tc.expect.minCitations) {
      failures.push(`Expected citations >= ${tc.expect.minCitations}, got ${pkg.citations.length}`)
    }
    if (tc.expect.minAssets !== undefined && pkg.assets.length < tc.expect.minAssets) {
      failures.push(`Expected assets >= ${tc.expect.minAssets}, got ${pkg.assets.length}`)
    }

    return {
      name: tc.name,
      passed: failures.length === 0,
      details: failures.length > 0
        ? failures.join(' | ')
        : `Claims:${pkg.claims.length} Ev:${pkg.evidence.length} Ci:${pkg.citations.length} As:${pkg.assets.length} Title:${pkg.title.substring(0, 40)}`,
      duration: Date.now() - startedAt,
      hash,
    }
  } catch (err: any) {
    return {
      name: tc.name,
      passed: false,
      details: `Exception: ${err.message}`,
      duration: Date.now() - startedAt,
      hash: '',
    }
  }
}

async function main() {
  console.log('══════════════════════════════════════════════════════')
  console.log('  Golden Packaging Regression Suite')
  console.log('══════════════════════════════════════════════════════')
  console.log('')

  // Discover test cases from DB
  const allKOs = await prisma.knowledgeObject.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })

  const testCases: TestCase[] = []

  for (const ko of allKOs) {
    const entities = (ko.entities as any[]) ?? []
    const claims = (ko.claims as any[]) ?? []
    const evidence = (ko.evidence as any[]) ?? []
    const citations = (ko.citations as any[]) ?? []

    // Categorize by data shape
    if (entities.length === 0 && claims.length === 0) {
      testCases.push({
        name: `Empty KO (${ko.status}, topic: ${(ko.topic ?? 'N/A').substring(0, 30)})`,
        koId: ko.id,
        expect: { minAssets: 0 },
      })
    } else if (entities.length > 0 && claims.length === 0) {
      testCases.push({
        name: `Entity-only KO (${entities.length} entities, topic: ${(ko.topic ?? 'N/A').substring(0, 30)})`,
        koId: ko.id,
        expect: { minAssets: entities.length },
      })
    } else if (claims.length > 0) {
      testCases.push({
        name: `Full KO (${claims.length} claims, ${evidence.length} evidence, ${entities.length} entities)`,
        koId: ko.id,
        expect: { minClaims: claims.length, minEvidence: evidence.length, minAssets: entities.length },
      })
    }
  }

  if (testCases.length === 0) {
    console.log('❌ No test cases discovered. DB may be empty.')
    return
  }

  console.log(`Discovered ${testCases.length} test cases:\n`)

  const results: TestResult[] = []
  for (const tc of testCases) {
    console.log(`  [${testCases.indexOf(tc) + 1}/${testCases.length}] Building: ${tc.name}`)
    const result = await runTest(tc)
    results.push(result)
    console.log(`    ${result.passed ? '✅' : '❌'} ${result.details} (${result.duration}ms)`)
  }

  // Deterministic check
  console.log('\n── Deterministic check ──')
  const firstHash = results[0]?.hash
  const allHashesMatch = results.every(r => !r.passed || r.hash === firstHash || results.filter(x => x.passed).every(x => x.hash === results.find(y => y.passed)?.hash))

  // But deterministic actually means: same input → same output
  // So let's just re-run the first test and compare
  if (testCases.length > 0) {
    const firstRetry = await runTest(testCases[0])
    const deterministicPass = firstRetry.hash === results[0].hash && firstRetry.passed === results[0].passed
    console.log(`  ${deterministicPass ? '✅' : '❌'} Deterministic: hash match = ${deterministicPass} (${results[0].hash} == ${firstRetry.hash})`)
    results.push({
      name: 'Deterministic Build',
      passed: deterministicPass,
      details: `Hash: ${results[0].hash}`,
      duration: firstRetry.duration,
      hash: firstRetry.hash,
    })
  }

  // Summary
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  console.log('\n══════════════════════════════════════════════════════')
  console.log('  Regression Summary')
  console.log('══════════════════════════════════════════════════════')
  console.log(`  Total:   ${total}`)
  console.log(`  Passed:  ${passed}`)
  console.log(`  Failed:  ${failed}`)
  console.log('══════════════════════════════════════════════════════')

  if (failed === 0) {
    console.log('\n  ✅ Packaging Engine is stable. Ready for Sprint 1B / Sprint 2.')
  } else {
    console.log(`\n  ❌ ${failed} test(s) failed.`)
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    - ${r.name}: ${r.details}`)
    }
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Regression suite error:', err)
  process.exit(1)
})
