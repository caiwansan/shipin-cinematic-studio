// ============================================================
// Discovery Benchmark Script
// RC2-T002: DeepSeek Discovery Provider
//
// Runs discovery for a list of test entities and collects:
// - Hit rate (successful responses)
// - Average latency
// - Token count
// - JSON valid rate
// - Coverage scores
//
// Usage: npx tsx scripts/benchmark-discovery.ts [--deepseek] [--mock]
//        --deepseek: test DeepSeek provider (requires API key)
//        --mock:     test Mock provider (default)
//        --shadow:   test both in shadow mode
// ============================================================

import 'dotenv/config'
import { MockScanner } from '../src/benchmark/discovery/mock-scanner'
import { GeoProviderRegistry } from '../src/services/geo/provider/provider-registry'
import { MockProvider } from '../src/services/geo/provider/mock-provider'
import { DeepSeekProvider } from '../src/services/geo/provider/deepseek-provider'
import { DiscoveryRequest, DiscoveryResult, ProviderName } from '../src/services/geo/provider/types'

// ─── Test Entities ───

interface TestEntity {
  name: string
  industry?: string
  description?: string
  website?: string
  matchConfidences: Record<string, number>
}

const TEST_ENTITIES: TestEntity[] = [
  {
    name: 'Apple',
    industry: 'technology',
    description: 'Consumer electronics and software company',
    website: 'https://apple.com',
    matchConfidences: { 'brand-discovery': 0.85, 'product-research': 0.75, 'brand-positioning': 0.80 },
  },
  {
    name: 'Nike',
    industry: 'sports',
    description: 'Global sportswear and footwear brand',
    website: 'https://nike.com',
    matchConfidences: { 'brand-discovery': 0.75, 'brand-trust': 0.70, 'product-comparison': 0.65 },
  },
  {
    name: 'Starbucks',
    industry: 'food-beverage',
    description: 'Global coffee house chain',
    website: 'https://starbucks.com',
    matchConfidences: { 'brand-discovery': 0.65, 'brand-positioning': 0.70, 'product-purchase': 0.60 },
  },
  {
    name: 'Tesla',
    industry: 'automotive',
    description: 'Electric vehicle and clean energy company',
    website: 'https://tesla.com',
    matchConfidences: { 'brand-discovery': 0.90, 'product-comparison': 0.85, 'brand-positioning': 0.88, 'product-alternative': 0.80 },
  },
  {
    name: 'Coca-Cola',
    industry: 'food-beverage',
    description: 'Global beverage company',
    website: 'https://coca-cola.com',
    matchConfidences: { 'brand-discovery': 0.70, 'brand-trust': 0.65, 'product-purchase': 0.75 },
  },
]

// ─── Benchmark Runner ───

interface BenchmarkResult {
  entity: string
  provider: string
  success: boolean
  latencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  coverage: number
  share: number
  position: number
  scenarioCount: number
  jsonValid: boolean
  error?: string
}

async function runBenchmark(providerName: ProviderName): Promise<BenchmarkResult[]> {
  console.log(`\n=== Benchmark: ${providerName.toUpperCase()} Provider ===\n`)

  const registry = new GeoProviderRegistry({ provider: providerName })

  // Ensure the provider is registered
  let provider = registry.getProvider(providerName)
  if (!provider) {
    console.error(`Provider "${providerName}" not found. Registering...`)
    if (providerName === 'deepseek') {
      registry.register(new DeepSeekProvider())
    } else {
      registry.register(new MockProvider())
    }
    provider = registry.getProvider(providerName)
  }

  const results: BenchmarkResult[] = []

  for (const entity of TEST_ENTITIES) {
    const request: DiscoveryRequest = {
      entity: entity.name,
      industry: entity.industry,
      description: entity.description,
      website: entity.website,
      matchConfidences: entity.matchConfidences,
    }

    const startTime = Date.now()
    let result: BenchmarkResult

    try {
      const discoveryResult = await registry.discover(request, providerName)
      const latencyMs = Date.now() - startTime

      result = {
        entity: entity.name,
        provider: providerName,
        success: true,
        latencyMs,
        inputTokens: discoveryResult.meta.tokenUsage?.prompt || 0,
        outputTokens: discoveryResult.meta.tokenUsage?.completion || 0,
        totalTokens: discoveryResult.meta.tokenUsage?.total || 0,
        coverage: discoveryResult.coverage,
        share: discoveryResult.share,
        position: discoveryResult.position,
        scenarioCount: discoveryResult.scenarios.length,
        jsonValid: true,
      }

      console.log(`  ✅ ${entity.name.padEnd(15)} coverage: ${discoveryResult.coverage.toString().padStart(3)} share: ${discoveryResult.share.toString().padStart(3)} | ${latencyMs}ms | ${result.totalTokens} tokens`)
    } catch (err: any) {
      const latencyMs = Date.now() - startTime
      result = {
        entity: entity.name,
        provider: providerName,
        success: false,
        latencyMs,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        coverage: 0,
        share: 0,
        position: 0,
        scenarioCount: 0,
        jsonValid: false,
        error: err.message || 'Unknown error',
      }

      console.error(`  ❌ ${entity.name.padEnd(15)} FAILED: ${err.message}`)
    }

    results.push(result)
  }

  return results
}

// ─── Compare Results ───

interface ComparisonResult {
  entity: string
  mockCoverage: number
  deepseekCoverage: number
  coverageDiff: number
  mockLatency: number
  deepseekLatency: number
  latencyDiff: number
  mockTokens: number
  deepseekTokens: number
  tokensDiff: number
}

function compareResults(mockResults: BenchmarkResult[], deepseekResults: BenchmarkResult[]): ComparisonResult[] {
  const comparisons: ComparisonResult[] = []

  for (const mock of mockResults) {
    const deepseek = deepseekResults.find(d => d.entity === mock.entity)
    if (!deepseek) continue

    comparisons.push({
      entity: mock.entity,
      mockCoverage: mock.coverage,
      deepseekCoverage: deepseek.coverage,
      coverageDiff: deepseek.coverage - mock.coverage,
      mockLatency: mock.latencyMs,
      deepseekLatency: deepseek.latencyMs,
      latencyDiff: deepseek.latencyMs - mock.latencyMs,
      mockTokens: mock.totalTokens,
      deepseekTokens: deepseek.totalTokens,
      tokensDiff: deepseek.totalTokens - mock.totalTokens,
    })
  }

  return comparisons
}

// ─── Report ───

function printReport(results: BenchmarkResult[], title: string): void {
  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)
  const avgLatency = successful.length > 0
    ? Math.round(successful.reduce((sum, r) => sum + r.latencyMs, 0) / successful.length)
    : 0
  const avgTokens = successful.length > 0
    ? Math.round(successful.reduce((sum, r) => sum + r.totalTokens, 0) / successful.length)
    : 0
  const avgCoverage = successful.length > 0
    ? Math.round(successful.reduce((sum, r) => sum + r.coverage, 0) / successful.length)
    : 0

  console.log(`\n─── ${title} ───`)
  console.log(`| Metric            | Value       |`)
  console.log(`|-------------------|-------------|`)
  console.log(`| Total Requests    | ${results.length.toString().padStart(10)} |`)
  console.log(`| Successful        | ${successful.length.toString().padStart(10)} |`)
  console.log(`| Failed            | ${failed.length.toString().padStart(10)} |`)
  console.log(`| Hit Rate          | ${(successful.length / Math.max(1, results.length) * 100).toFixed(1).padStart(10)}% |`)
  console.log(`| Avg Latency (ms)  | ${avgLatency.toString().padStart(10)} |`)
  console.log(`| Avg Tokens        | ${avgTokens.toString().padStart(10)} |`)
  console.log(`| Avg Coverage      | ${avgCoverage.toString().padStart(10)} |`)
  console.log(`| JSON Valid Rate   | ${(successful.length / Math.max(1, results.length) * 100).toFixed(1).padStart(10)}% |`)
}

function printComparisonReport(comparisons: ComparisonResult[]): void {
  console.log(`\n─── Provider Comparison ───`)
  console.log(`| Entity           | Mock Cov | DS Cov | Cov Δ  | Mock ms | DS ms  | ms Δ   |`)
  console.log(`|------------------|----------|--------|--------|---------|--------|--------|`)

  for (const c of comparisons) {
    const covDiff = c.coverageDiff >= 0 ? `+${c.coverageDiff}` : `${c.coverageDiff}`
    const latDiff = c.latencyDiff >= 0 ? `+${c.latencyDiff}` : `${c.latencyDiff}`
    console.log(`| ${c.entity.padEnd(16)} | ${c.mockCoverage.toString().padStart(8)} | ${c.deepseekCoverage.toString().padStart(6)} | ${covDiff.padStart(6)} | ${c.mockLatency.toString().padStart(7)} | ${c.deepseekLatency.toString().padStart(6)} | ${latDiff.padStart(6)} |`)
  }

  const avgCovDiff = comparisons.length > 0
    ? Math.round(comparisons.reduce((s, c) => s + c.coverageDiff, 0) / comparisons.length)
    : 0
  const avgLatDiff = comparisons.length > 0
    ? Math.round(comparisons.reduce((s, c) => s + c.latencyDiff, 0) / comparisons.length)
    : 0

  console.log(`| ${'AVERAGE'.padEnd(16)} | ${''.padStart(8)} | ${''.padStart(6)} | ${(avgCovDiff >= 0 ? '+' : '') + avgCovDiff.toString().padStart(6)} | ${''.padStart(7)} | ${''.padStart(6)} | ${(avgLatDiff >= 0 ? '+' : '') + avgLatDiff.toString().padStart(6)} |`)
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2)
  const testDeepSeek = args.includes('--deepseek')
  const testMock = args.includes('--mock') || args.length === 0
  const testShadow = args.includes('--shadow')

  console.log('\n🔬 GEO AI Discovery Benchmark')
  console.log('==============================')
  console.log(`Entities: ${TEST_ENTITIES.length}`)
  console.log(`Modes:` +
    (testMock ? ' mock' : '') +
    (testDeepSeek ? ' deepseek' : '') +
    (testShadow ? ' shadow' : '')
  )

  let mockResults: BenchmarkResult[] = []
  let deepseekResults: BenchmarkResult[] = []

  if (testMock || testShadow) {
    mockResults = await runBenchmark('mock')
    printReport(mockResults, 'MOCK PROVIDER')
  }

  if (testDeepSeek || testShadow) {
    deepseekResults = await runBenchmark('deepseek')
    printReport(deepseekResults, 'DEEPSEEK PROVIDER')
  }

  if (testShadow && mockResults.length > 0 && deepseekResults.length > 0) {
    const comparisons = compareResults(mockResults, deepseekResults)
    printComparisonReport(comparisons)
  }

  console.log('\n==============================\n')
}

main().catch(console.error)
