// ============================================================
// 多 Provider Contract Test — DeepSeek + ChatGPT 通过相同测试
// 运行: npx tsx tests/discovery/multi-contract-test.ts
// ============================================================

import { GOLDEN_DATASET, type GoldenSample } from '../../src/services/geo/discovery/contracts/golden-dataset'
import type { DiscoverySignal } from '../../src/services/geo/domain/discovery-signal'
import type { SignalMapper } from '../../src/services/geo/discovery/adapters/signal-mapper'
import { DeepSeekSignalMapper } from '../../src/services/geo/discovery/adapters/deepseek-mapper'
import { ChatGPTMapper } from '../../src/services/geo/discovery/adapters/chatgpt-mapper'

function generateMock(sample: GoldenSample): string {
  const baseConf = (() => {
    switch (sample.category) {
      case 'global-brand': return 85
      case 'china-brand': return 80
      case 'sme': return 30
      case 'new-brand': return 20
      case 'non-existent': return 5
      case 'ambiguous': return 70
      default: return 50
    }
  })()
  const visibility = baseConf >= 70 ? 'visible' : baseConf >= 30 ? 'partial' : 'missing'
  return JSON.stringify({
    visibility,
    score: baseConf,
    confidence: baseConf,
    knowledgeQuality: baseConf,
    evidenceCount: baseConf >= 50 ? 3 : 1,
    summary: `${sample.entityName} 分析结果`,
    recommendations: ['优化线上内容'],
    competitors: baseConf >= 50 ? ['竞品A', '竞品B'] : [],
  })
}

function runContract(mapper: SignalMapper, sample: GoldenSample): { passed: boolean; details: string[] } {
  const details: string[] = []
  const mock = generateMock(sample)

  if (!mapper.canMap(mock)) return { passed: false, details: ['canMap 失败'] }

  const signals = mapper.map(mock, {
    entityId: sample.entityId, entityName: sample.entityName,
    projectId: 'ct', executionId: `ct-${Date.now()}`,
    provider: mapper.provider, tokensIn: 10, tokensOut: 20, latencyMs: 300,
  })

  // 类型覆盖
  const types = new Set(signals.map(s => s.type))
  const missingTypes = sample.expectedSignalTypes.filter(t => !types.has(t))
  if (missingTypes.length > 0) details.push(`缺少类型: ${missingTypes.join(',')}`)

  // 置信度范围
  if (signals.some(s => s.confidence < sample.minConfidence || s.confidence > sample.maxConfidence))
    details.push('confidence 越界')

  // Schema 版本
  if (signals.some(s => s.schemaVersion !== '1.0'))
    details.push('缺少 schemaVersion')

  // Evidence 非空校验
  const emptyEvidences = signals.filter(s => s.evidence.length === 0)
  if (emptyEvidences.length > 0)
    details.push(`${emptyEvidences.length} 个 signal 无 evidence`)

  return { passed: details.length === 0, details }
}

async function main() {
  const mappers: SignalMapper[] = [new DeepSeekSignalMapper(), new ChatGPTMapper()]

  console.log('\n╔═══════════════════════════════════════════════════╗')
  console.log('║    多 Provider Contract Test (15 样本)           ║')
  console.log('╚═══════════════════════════════════════════════════╝')

  for (const mapper of mappers) {
    let passed = 0, failed = 0
    console.log(`\n── ${mapper.provider} ──`)
    for (const sample of GOLDEN_DATASET) {
      const result = runContract(mapper, sample)
      if (result.passed) { passed++; console.log(`  ✅ ${sample.name}`) }
      else { failed++; console.log(`  ❌ ${sample.name}: ${result.details.join(';')}`) }
    }
    const rate = ((passed / (passed + failed)) * 100).toFixed(1)
    console.log(`  ── ${passed}/${passed + failed} (${rate}%) ──`)
  }

  // Capability Matrix 验证
  console.log('\n── Capability Matrix ──')
  const { capabilityResolver } = await import('../../src/services/geo/discovery/contracts/capability-matrix')
  const caps = capabilityResolver.getProvidersWithCapability('presence-scan')
  console.log(`  支持 presence-scan: ${caps.join(', ')}`)
  const compCaps = capabilityResolver.getProvidersWithCapability('competitor-scan')
  console.log(`  支持 competitor-scan: ${compCaps.join(', ')}`)
  console.log(`  ChatGPT 能力数: ${capabilityResolver.getCapabilities('chatgpt').length}`)

  // Signal Quality 验证
  console.log('\n── Signal Quality Score ──')
  const { calculateSignalQuality } = await import('../../src/services/geo/discovery/contracts/signal-quality')
  const mockSig = (await new DeepSeekSignalMapper().map(
    JSON.stringify({ visibility: 'visible', knowledgeQuality: 85, confidence: 90, evidenceCount: 3, summary: 'test', recommendations: [] }),
    { entityId: 'e', entityName: 'test', projectId: 'p', executionId: 'e1', provider: 'deepseek', tokensIn: 50, tokensOut: 100, latencyMs: 800 },
  ))[0]
  const q = calculateSignalQuality(mockSig)
  console.log(`  confidence: ${q.confidence}, completeness: ${q.completeness}, freshness: ${q.freshness}, costEfficiency: ${q.costEfficiency}, overall: ${q.overall}`)
}

main().catch(console.error)
