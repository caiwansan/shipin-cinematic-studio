/**
 * benchmark/cli/run.ts — Benchmark CLI 入口
 *
 * 用法: npx tsx src/benchmark/cli/run.ts --entity "华为" --model deepseek-chat
 *
 * 验证 DeepSeek Provider + Benchmark Runner + Judge + Calculator 完整链路。
 * 输出 Benchmark Report JSON。
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { BenchmarkRegistry } from '../registry/benchmark-registry'
import { DeepSeekAdapter } from '../provider/deepseek-adapter'
import { BenchmarkJob, BenchmarkQuestion, ClaimEvaluation, BIIDimension } from '../types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from backend root
config({ path: resolve(__dirname, '..', '..', '..', '.env') })

async function main() {
  const args = process.argv.slice(2)
  const entityName = parseArg(args, '--entity') || parseArg(args, '--brand') || '华为'
  const model = parseArg(args, '--model') || 'deepseek-chat'
  const datasetVersion = parseArg(args, '--dataset') || 'v1'
  const limit = parseInt(parseArg(args, '--limit') || '0', 10)

  // entityId: use entity name as slug-based ID for simple CLI runs
  const entityId = `entity:${entityName.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '-')}`
  const brandName = entityName

  console.log(`\n🔬 GEO Benchmark Run`)
  console.log(`   Entity: ${entityName}`)
  console.log(`   EntityId: ${entityId}`)
  console.log(`   Model: ${model}`)
  console.log(`   Dataset: ${datasetVersion}\n`)

  // ── Init ──
  const registry = new BenchmarkRegistry()

  // Register DeepSeek Provider
  registry.registerProvider(new DeepSeekAdapter())

  // Load dataset
  const dataset = registry.datasets.load(datasetVersion)
  const questions = limit > 0 ? dataset.questions.slice(0, limit) : dataset.questions
  console.log(`📋 Loaded ${questions.length} questions from ${dataset.meta.version}${limit > 0 ? ` (limited to ${limit})` : ''}\n`)

  // Create job
  const job: BenchmarkJob = {
    id: `bm-${Date.now()}`,
    entityId,
    brandName,
    datasetVersion,
    promptPackVersion: 'pp-v1.0',
    providerName: 'deepseek',
    model,
    status: 'queued',
    progress: { total: dataset.meta.totalQuestions, completed: 0, failed: 0 },
  }

  // ── Run + Collect responses ──
  const startTime = new Date()
  const responses = new Map<string, string>()
  const errors: string[] = []

  // Override runner delegate
  const originalRun = registry.runner.run.bind(registry.runner)
  registry.runner.run = async (j: BenchmarkJob) => {
    j.status = 'running'
    j.startedAt = new Date()

    const provider = registry.providers.get(j.providerName, j.model)
    for (const question of questions) {
      try {
        const request = {
          messages: [
            { role: 'system' as const, content: question.prompt.system ?? DEFAULT_SYSTEM_PROMPT },
            {
              role: 'user' as const,
              content: question.prompt.user
                .replace(/\{entity\}/g, j.brandName)
                .replace(/\{brand\}/g, j.brandName),
            },
          ],
          temperature: 0.3,
          maxTokens: 2048,
          timeout: 30000,
        }

        const response = await provider.invoke(request)
        responses.set(question.id, response.content)
        j.progress.completed++

        process.stdout.write(`  ✅ [${j.progress.completed}/${j.progress.total}] ${question.id}\r`)
      } catch (err) {
        j.progress.failed++
        errors.push(`Question ${question.id}: ${(err as Error).message}`)
        process.stdout.write(`  ❌ [${j.progress.completed + j.progress.failed}/${j.progress.total}] ${question.id}\r`)
      }
    }

    j.status = 'completed'
    j.completedAt = new Date()
    console.log(`\n`)
  }

  await registry.runner.run(job)

  // ── Judge — Evaluate all responses ──
  console.log('📊 Evaluating responses...')

  const evaluationsByDimension = new Map<BIIDimension, ClaimEvaluation[]>()
  const questionMap = new Map<string, BenchmarkQuestion>()

  for (const question of dataset.questions) {
    questionMap.set(question.id, question)
    const content = responses.get(question.id)
    if (!content) continue

    const evals = registry.claimEvaluator.evaluate(question, content, { entity: { entityId, brandName } })

    const existing = evaluationsByDimension.get(question.evaluation.dimension) || []
    existing.push(...evals)
    evaluationsByDimension.set(question.evaluation.dimension, existing)
  }

  // ── Dimension Scoring ──
  const dimensions = registry.dimensionScorer.score(evaluationsByDimension)

  // ── BII Calculation ──
  const biiResult = registry.biiCalculator.calculate(dimensions)

  // ── Report ──
  const endTime = new Date()
  const report = registry.reportGenerator.generate({
    entityId,
    brandName,
    datasetVersion,
    promptPackVersion: 'pp-v1.0',
    judgeVersion: 'jd-v1.0',
    provider: 'deepseek',
    model,
    biiResult,
    questionMap,
    evaluations: new Map(),
    startTime,
    endTime,
  })

  // Print summary
  console.log(`\n${'='.repeat(50)}`)
  console.log(`📊 Benchmark Report — ${brandName}`)
  console.log(`   EntityId: ${entityId}`)
  console.log(`${'='.repeat(50)}`)
  console.log(`\n  BII Score: ${report.overall.biiScore}/100 (${report.overall.biiGrade})`)
  console.log(`  Confidence: ${(report.overall.confidence * 100).toFixed(0)}%`)
  console.log(`  Duration: ${report.meta.duration}s`)
  console.log(`  Report ID: ${report.meta.reportId}\n`)

  console.log(`  Dimensions:`)
  for (const dim of biiResult.dimensions.sort((a, b) => a.score - b.score)) {
    const bar = '█'.repeat(Math.round(dim.score / 5)) + '░'.repeat(20 - Math.round(dim.score / 5))
    console.log(`    ${dim.dimension.padEnd(24)} ${dim.score.toString().padStart(3)} ${bar}`)
  }

  if (errors.length > 0) {
    console.log(`\n  ⚠️  Errors: ${errors.length}`)
    errors.slice(0, 3).forEach(e => console.log(`    ❌ ${e}`))
  }

  console.log(`\n  Recommendations:`)
  report.recommendations.slice(0, 5).forEach(r => {
    console.log(`    [${r.priority}] ${r.what.slice(0, 80)}`)
  })

  // Output full report JSON
  console.log(`\n${'-'.repeat(50)}`)
  console.log(JSON.stringify(report, null, 2))
}

function parseArg(args: string[], key: string): string | undefined {
  const idx = args.indexOf(key)
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined
}

const DEFAULT_SYSTEM_PROMPT = `你是一个中立的品牌知识问答助手。请基于你训练数据中掌握的知识，如实回答关于品牌的问题。

回答要求：
1. 如果你知道该品牌，请详细回答，包括品牌基本信息、核心业务、主要产品等。
2. 如果你不确定某些信息，请明确说明你的不确定性。
3. 不要编造不存在的品牌或信息。
4. 如果被问及推荐，请基于客观标准给出推荐理由。
5. 回答语言：简体中文。`

main().catch(e => {
  console.error('❌ Benchmark run failed:', e)
  process.exit(1)
})
