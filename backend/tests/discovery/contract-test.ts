// ============================================================
// ContractTest — Golden Dataset Contract Test Runner
//
// 每个 Mapper 必须通过完全相同的 Contract Test
// 测试不固定 LLM 具体文案，只检查结构 + 语义约束
//
// 运行: npx tsx tests/discovery/contract-test.ts
// ============================================================

import { GOLDEN_DATASET, type GoldenSample } from '../../src/services/geo/discovery/contracts/golden-dataset'
import type { DiscoverySignal } from '../../src/services/geo/domain/discovery-signal'
import type { SignalMapper } from '../../src/services/geo/discovery/adapters/signal-mapper'
import { DeepSeekSignalMapper } from '../../src/services/geo/discovery/adapters/deepseek-mapper'
import { discoveryValidator } from '../../src/services/geo/discovery/services/discovery-validator'

interface ContractResult {
  sample: GoldenSample
  passed: boolean
  checks: ContractCheck[]
  signals: DiscoverySignal[]
}

interface ContractCheck {
  name: string
  passed: boolean
  message: string
}

function generateMockResponse(sample: GoldenSample): string {
  // 根据 category 生成合理的 Mock 值
  const baseConf = (() => {
    switch (sample.category) {
      case 'global-brand': return 85  // 知名品牌 → 高置信度
      case 'china-brand': return 80
      case 'sme': return 30          // 中小企业 → 中等偏低
      case 'new-brand': return 20    // 新品牌 → 低
      case 'non-existent': return 5  // 不存在 → 极低
      case 'ambiguous': return 70    // 多义 → 中高
      default: return 50
    }
  })()

  const visibility = baseConf >= 70 ? 'visible' : baseConf >= 30 ? 'partial' : 'missing'
  const kq = Math.min(95, baseConf + Math.floor(Math.random() * 15))
  const evCount = baseConf >= 50 ? 3 : baseConf >= 20 ? 1 : 0

  return JSON.stringify({
    visibility,
    knowledgeQuality: kq,
    confidence: Math.min(99, baseConf + Math.floor(Math.random() * 10)),
    evidenceCount: evCount,
    summary: `${sample.entityName} 的品牌存在感分析结果`,
    recommendations: ['加强线上内容建设', '提升品牌认知度'],
  })
}

class ContractTestRunner {
  private totalPassed = 0
  private totalFailed = 0
  private results: ContractResult[] = []

  constructor(private mapper: SignalMapper) {}

  async runAll(): Promise<void> {
    console.log(`\n🏁 Golden Contract Test — Mapper: ${this.mapper.provider}`)
    console.log(`   样本数: ${GOLDEN_DATASET.length}\n`)

    for (const sample of GOLDEN_DATASET) {
      const result = await this.runSingle(sample)
      this.results.push(result)
      if (result.passed) {
        this.totalPassed++
        console.log(`  ✅ ${sample.name} (${sample.category})`)
      } else {
        this.totalFailed++
        console.log(`  ❌ ${sample.name} (${sample.category})`)
        for (const check of result.checks.filter((c) => !c.passed)) {
          console.log(`      └─ ${check.name}: ${check.message}`)
        }
      }
    }

    this.printSummary()
  }

  private async runSingle(sample: GoldenSample): Promise<ContractResult> {
    const signals: DiscoverySignal[] = []
    const checks: ContractCheck[] = []

    const mockResponse = generateMockResponse(sample)

    // check 1: canMap
    const canMap = this.mapper.canMap(mockResponse)
    checks.push({
      name: 'canMap',
      passed: canMap,
      message: canMap ? '可正常解析' : `无法解析响应: ${mockResponse.slice(0, 100)}`,
    })

    if (!canMap) return { sample, passed: false, checks, signals }

    // check 2: map
    const mapped = this.mapper.map(mockResponse, {
      entityId: sample.entityId,
      entityName: sample.entityName,
      projectId: 'contract-test',
      executionId: `ct-${Date.now()}`,
      provider: this.mapper.provider,
      tokensIn: 50,
      tokensOut: 100,
      latencyMs: 1000,
    })
    signals.push(...mapped)

    // check 3: Expected Signal Types
    const actualTypes = new Set(mapped.map((s) => s.type))
    const missingTypes = sample.expectedSignalTypes.filter((t) => !actualTypes.has(t))
    checks.push({
      name: 'expectedSignalTypes',
      passed: missingTypes.length === 0,
      message:
        missingTypes.length === 0
          ? `包含预期类型: ${sample.expectedSignalTypes.join(', ')}`
          : `缺少类型: ${missingTypes.join(', ')}`,
    })

    // check 4: Confidence Range
    const allConfidences = mapped.map((s) => s.confidence)
    const inRange = allConfidences.every((c) => c >= sample.minConfidence && c <= sample.maxConfidence)
    checks.push({
      name: 'confidenceRange',
      passed: inRange,
      message: inRange
        ? `置信度 ${allConfidences.map((c) => c.toFixed(3)).join(', ')} 在 [${sample.minConfidence}, ${sample.maxConfidence}] 范围内`
        : `置信度越界: ${allConfidences.map((c) => c.toFixed(3)).join(', ')} (预期 [${sample.minConfidence}, ${sample.maxConfidence}])`,
    })

    // check 5: Evidence Count
    const totalEvidence = mapped.reduce((sum, s) => sum + s.evidence.length, 0)
    checks.push({
      name: 'evidenceCount',
      passed: totalEvidence >= sample.minEvidenceCount,
      message: `证据数 ${totalEvidence} >= ${sample.minEvidenceCount}`,
    })

    // check 6: Signal Shape
    const shapeValid = mapped.every(
      (s) =>
        typeof s.id === 'string' &&
        typeof s.type === 'string' &&
        typeof s.provider === 'string' &&
        typeof s.confidence === 'number' &&
        typeof s.timestamp === 'string' &&
        Array.isArray(s.evidence),
    )
    checks.push({
      name: 'signalShape',
      passed: shapeValid,
      message: shapeValid ? '所有 Signal 结构正确' : '存在结构异常的 Signal',
    })

    // check 7: Evidence Shape
    const evidenceValid = mapped.every((s) =>
      s.evidence.every((e) => typeof e.summary === 'string' && typeof e.source === 'string' && typeof e.confidence === 'number'),
    )
    checks.push({
      name: 'evidenceShape',
      passed: evidenceValid,
      message: evidenceValid ? '所有 Evidence 结构正确' : '存在结构异常的 Evidence',
    })

    // check 8: Cost Shape
    const costValid = mapped.every(
      (s) =>
        typeof s.cost.tokensIn === 'number' &&
        typeof s.cost.tokensOut === 'number' &&
        typeof s.cost.latencyMs === 'number',
    )
    checks.push({
      name: 'costShape',
      passed: costValid,
      message: costValid ? '所有 Cost 字段正确' : '存在 Cost 异常',
    })

    // check 9: each signal has a valid type
    const knownTypes = ['presence', 'search', 'knowledge', 'sentiment', 'competition']
    const typesValid = mapped.every((s) => knownTypes.includes(s.type))
    checks.push({
      name: 'knownSignalTypes',
      passed: typesValid,
      message: typesValid ? '所有 Signal type 在已知类型范围内' : `存在未知 Signal type: ${mapped.map((s) => s.type).filter((t) => !knownTypes.includes(t)).join(', ')}`,
    })

    const passed = checks.every((c) => c.passed)
    return { sample, passed, checks, signals }
  }

  private printSummary(): void {
    const total = this.totalPassed + this.totalFailed
    const passRate = total > 0 ? ((this.totalPassed / total) * 100).toFixed(1) : '0'
    console.log(`\n${'='.repeat(50)}`)
    console.log(`📊 Contract Test Summary — Mapper: ${this.mapper.provider}`)
    console.log(`   Total: ${total}`)
    console.log(`   ✅ Passed: ${this.totalPassed}`)
    console.log(`   ❌ Failed: ${this.totalFailed}`)
    console.log(`   Pass Rate: ${passRate}%`)
    console.log(`${'='.repeat(50)}`)
  }
}

// ── Main ──
async function main() {
  const runner = new ContractTestRunner(new DeepSeekSignalMapper())
  await runner.runAll()
}

main().catch(console.error)
