// ============================================================
// AG-2: Pipeline Replay Regression Test
// 验证：同一输入得到一致的 DiscoveryResult
// 运行：npx tsx tests/replay/pipeline-replay.test.ts
// ============================================================

const { DiscoveryPipeline } = require('../../src/services/geo/discovery/pipeline/pipeline')
const { providerRegistry } = require('../../src/services/geo/discovery/registry/provider-registry')
const { DiscoveryPresenceStage } = require('../../src/services/geo/discovery/pipeline/stages/presence-stage')

// ── Fixtures ──
const FIXTURES = [
  {
    name: 'brand-a',
    ctx: {
      projectId: 'proj-a',
      entityId: 'entity-a',
      entityName: '昆仑镜',
      currentStage: '',
      stageResults: {},
      startedAt: '2026-07-04T00:00:00.000Z',
      errors: [],
    },
  },
  {
    name: 'brand-b',
    ctx: {
      projectId: 'proj-b',
      entityId: 'entity-b',
      entityName: '抖音短剧工场',
      currentStage: '',
      stageResults: {},
      startedAt: '2026-07-04T00:00:00.000Z',
      errors: [],
    },
  },
  {
    name: 'brand-c',
    ctx: {
      projectId: 'proj-c',
      entityId: 'entity-c',
      entityName: '腾讯视频号创作',
      currentStage: '',
      stageResults: {},
      startedAt: '2026-07-04T00:00:00.000Z',
      errors: [],
    },
  },
]

async function main() {
  // 注册 Provider（全部禁用，所有 Stage 返回 0）
  providerRegistry.register({ name: 'DeepSeek', adapter: 'presence', enabled: false, config: {} })

  const pipeline = new DiscoveryPipeline()
  pipeline.addStages([new DiscoveryPresenceStage()])
  const providers = []

  let allPassed = true
  let passCount = 0
  let failCount = 0

  for (const fixture of FIXTURES) {
    // 第一次执行
    const result1 = await pipeline.execute(
      { ...fixture.ctx, stageResults: {}, errors: [] },
      providers,
      `run1-${fixture.name}`,
    )

    // 第二次执行
    const result2 = await pipeline.execute(
      { ...fixture.ctx, stageResults: {}, errors: [] },
      providers,
      `run2-${fixture.name}`,
    )

    // 比较：metadata.executionId 和 discoveredAt 是预期变化的，排除
    const keyFields = ['version', 'entity', 'presence', 'knowledge', 'competitors', 'evidence']
    let match = true
    for (const field of keyFields) {
      const s1 = JSON.stringify(result1[field])
      const s2 = JSON.stringify(result2[field])
      if (s1 !== s2) {
        console.log(`[${fixture.name}] Field '${field}' differs:`)
        console.log(`  1: ${s1.slice(0, 200)}`)
        console.log(`  2: ${s2.slice(0, 200)}`)
        match = false
      }
    }

    if (match) {
      passCount++
      console.log(`✅ PASS: ${fixture.name}`)
    } else {
      failCount++
      allPassed = false
      console.log(`❌ FAIL: ${fixture.name}`)
    }
  }

  console.log(`\n${'='.repeat(40)}`)
  console.log(`Replay Results: ${passCount} passed, ${failCount} failed`)
  console.log(allPassed ? '✅ ALL REPLAY TESTS PASSED' : '❌ SOME REPLAY TESTS FAILED')

  process.exit(allPassed ? 0 : 1)
}

main().catch((err) => {
  console.error('Replay error:', err)
  process.exit(1)
})
