/**
 * evaluateDataset — run benchmark samples against the live GEO Entity Discovery API.
 *
 * Calls REST endpoints on localhost:4002 using the GLOBAL_TOKEN environment variable.
 * Uses fetch() (Node 18+) to make HTTP requests.
 */

import { calculateMetrics, type EntityMetrics } from './metrics'
import { calculateQualityScore, type QualityScore } from './scorer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SampleResult {
  sample: any
  metrics: EntityMetrics
  score: QualityScore
  rawResult?: any
  error?: string
}

export interface RunResult {
  timestamp: string
  provider: string
  model: string
  promptVersion: string
  totalSamples: number
  summary: {
    avgEntityCount: number
    avgRelationCount: number
    avgTypeCoverage: number
    avgExpectedFound: number
    avgRuntimeMs: number
    avgTotalTokens: number
    avgCost: number
    avgScore: number
    gradeDistribution: { A: number; B: number; C: number; D: number }
  }
  samples: SampleResult[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  return process.env.BASE_URL ?? 'http://localhost:4002'
}

function getToken(): string {
  const t = process.env.GLOBAL_TOKEN ?? process.env.TOKEN
  if (!t) {
    throw new Error(
      'GLOBAL_TOKEN environment variable is required. Set it to the auth token.',
    )
  }
  return t
}

async function apiPost(path: string, body: any): Promise<any> {
  const baseUrl = getBaseUrl()
  const token = getToken()
  const url = `${baseUrl}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${url} → ${res.status}: ${text.slice(0, 500)}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// evaluateDataset
// ---------------------------------------------------------------------------

export async function evaluateDataset(
  dataset: { samples: any[] },
  options: { provider?: string; model?: string; sample?: number; category?: string },
): Promise<RunResult> {
  const startTime = Date.now()

  // 1. Filter samples
  let samples = dataset.samples ?? []

  if (options.category) {
    const cat = options.category.toLowerCase()
    samples = samples.filter((s: any) => (s.category ?? '').toLowerCase() === cat)
  }

  if (options.sample && options.sample > 0 && options.sample < samples.length) {
    samples = samples.slice(0, options.sample)
  }

  console.log(`[evaluator] Running ${samples.length} samples...`)

  // 2. Evaluate each sample
  const sampleResults: SampleResult[] = []

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    const sampleId = sample.id ?? `sample-${i}`
    console.log(`[evaluator] [${i + 1}/${samples.length}] ${sampleId} (${sample.category})`)

    let sampleResult: SampleResult

    try {
      // 2a. Create project
      console.log(`  → Creating project for "${sampleId}"...`)
      const projectBody = { name: `benchmark-${sampleId}-${Date.now()}` }
      const project = await apiPost('/api/geo/projects', projectBody)
      const projectId: string = project?.id ?? project?.data?.id
      if (!projectId) {
        throw new Error(`Create project returned no id: ${JSON.stringify(project).slice(0, 200)}`)
      }

      // 2b. Run discover
      const runStart = performance.now()
      const discoverBody = {
        topic: sample.url ?? '',
        benchmarkMode: true,
      }
      const discoverResult = await apiPost(`/api/geo/projects/${projectId}/discover`, discoverBody)
      const runEnd = performance.now()
      const runtimeMs = Math.round(runEnd - runStart)

      // 2c. Extract usage info — query DB after API returns
      let promptTokens = 0, completionTokens = 0, totalTokens = 0
      try {
        // Query the latest llm_usage_records for geo.entity agent
        const usageRes = await fetch(getBaseUrl().replace('http://localhost:4002', 'http://localhost:5432') + '...', { method: 'HEAD' })
        // Bypass: use pg directly via simple CLI call
        const { execSync } = await import('child_process')
        const pgOut = execSync(
          `PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d aigc_scs -t -A -c "SELECT prompt_tokens, completion_tokens, total_tokens FROM llm_usage_records WHERE agent = 'geo.entity' ORDER BY created_at DESC LIMIT 1;"`,
          { encoding: 'utf8', timeout: 5000 }
        ).trim()
        if (pgOut) {
          const [pt, ct, tt] = pgOut.split('|').map(Number)
          promptTokens = pt; completionTokens = ct; totalTokens = tt
        }
      } catch (e) {
        // Non-fatal: usage query failed, tokens stay 0
      }
      const usage = {
        runtimeMs,
        promptTokens,
        completionTokens,
        totalTokens,
      }

      // 2d. Calculate metrics & score
      const metrics = calculateMetrics(sample, discoverResult, usage)
      const score = calculateQualityScore(metrics)

      sampleResult = {
        sample,
        metrics,
        score,
        rawResult: discoverResult,
      }
    } catch (err: any) {
      console.error(`  ✗ Error: ${err.message}`)
      // Create a minimal failure result
      const metrics: EntityMetrics = {
        sampleId,
        entityCount: 0,
        relationCount: 0,
        entityTypes: [],
        typeCoverage: 0,
        expectedFound: 0,
        expectedTotal: sample.expected_primary_entities?.length ?? 0,
        duplicateRate: 0,
        runtimeMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        schemaErrorRate: 1,
      }
      const score = calculateQualityScore(metrics)
      sampleResult = {
        sample,
        metrics,
        score,
        error: err.message,
      }
    }

    sampleResults.push(sampleResult)
  }

  // 3. Compute summary
  const n = sampleResults.length
  const validResults = sampleResults.filter((r) => !r.error)

  const avgEntityCount = n > 0
    ? Number((sampleResults.reduce((s, r) => s + r.metrics.entityCount, 0) / n).toFixed(2))
    : 0
  const avgRelationCount = n > 0
    ? Number((sampleResults.reduce((s, r) => s + r.metrics.relationCount, 0) / n).toFixed(2))
    : 0
  const avgTypeCoverage = n > 0
    ? Number((sampleResults.reduce((s, r) => s + r.metrics.typeCoverage, 0) / n).toFixed(2))
    : 0
  const avgExpectedFound = n > 0
    ? Number((sampleResults.reduce((s, r) => s + r.metrics.expectedFound, 0) / n).toFixed(2))
    : 0
  const avgRuntimeMs = n > 0
    ? Number((sampleResults.reduce((s, r) => s + r.metrics.runtimeMs, 0) / n).toFixed(2))
    : 0
  const avgTotalTokens = n > 0
    ? Number((sampleResults.reduce((s, r) => s + r.metrics.totalTokens, 0) / n).toFixed(2))
    : 0
  const avgCost = n > 0
    ? Number((sampleResults.reduce((s, r) => s + r.metrics.estimatedCost, 0) / n).toFixed(6))
    : 0
  const avgScore = n > 0
    ? Number((sampleResults.reduce((s, r) => s + r.score.overall, 0) / n).toFixed(2))
    : 0

  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0 }
  for (const r of sampleResults) {
    gradeDistribution[r.score.grade]++
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log(`[evaluator] Done in ${elapsed}s. ${validResults.length}/${n} succeeded.`)

  return {
    timestamp: new Date().toISOString(),
    provider: options.provider ?? 'default',
    model: options.model ?? 'default',
    promptVersion: '1.0.0',
    totalSamples: n,
    summary: {
      avgEntityCount,
      avgRelationCount,
      avgTypeCoverage,
      avgExpectedFound,
      avgRuntimeMs,
      avgTotalTokens,
      avgCost,
      avgScore,
      gradeDistribution,
    },
    samples: sampleResults,
  }
}
