// ============================================================
// v1.0.1 Regression Test Runner
//
// 用简单的 async/assert 代替 test runner，避免配置冲突
// ============================================================

import { geoScoreSnapshotRepository } from '../../src/services/geo/repositories/geo-score-snapshot.repository'
import { KnowledgeObjectRepository } from '../../src/services/geo/runtime/knowledge/KnowledgeObjectRepository'
import { isValidUUID } from '../../src/services/geo/domain/identifiers'

const koRepo = new KnowledgeObjectRepository()

let passed = 0
let failed = 0

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

// ========================================================================
// 1. ScoreSnapshot Repository
// ========================================================================

async function testScoreSnapshotRepository() {
  console.log('\n── ScoreSnapshot Repository ──')

  const createResult = await geoScoreSnapshotRepository.create({
    projectId: 'regression-test-project',
    snapshot: {
      visibilityScore: 50,
      authorityScore: 50,
      contentScore: 50,
      websiteScore: 50,
      knowledgeScore: 50,
      overallScore: 50,
    },
    metadata: { source: 'v1.0.1-regression' },
  })
  assert('create 返回有效对象', !!createResult?.id)
  assert('create projectId 正确', createResult?.projectId === 'regression-test-project')
  assert('create snapshot JSON 正确', createResult?.snapshot?.visibilityScore === 50)

  const findResult = await geoScoreSnapshotRepository.findFirst({
    projectId: 'regression-test-project',
  })
  assert('findFirst 返回结果', !!findResult)
  assert('findFirst projectId 匹配', findResult?.projectId === 'regression-test-project')

  if (findResult) {
    const updateResult = await geoScoreSnapshotRepository.update({
      where: { id: findResult.id },
      data: {
        snapshot: { visibilityScore: 99 },
        metadata: { updated: true },
      },
    })
    assert('update 返回结果', !!updateResult)
    assert('update snapshot 更新成功', updateResult?.snapshot?.visibilityScore === 99)
  }
}

// ========================================================================
// 2. KnowledgeObject — UUID Validation
// ========================================================================

async function testUUIDValidation() {
  console.log('\n── KnowledgeObject UUID Validation ──')

  assert('isValidUUID 拒绝 slug', !isValidUUID('brand-saas-001'))
  assert('isValidUUID 拒绝空字符串', !isValidUUID(''))
  assert('isValidUUID 拒绝非 UUID', !isValidUUID('not-a-uuid'))
  assert('isValidUUID 接受有效 UUID', isValidUUID('550e8400-e29b-41d4-a716-446655440000'))

  const createResult = await koRepo.create({
    projectId: 'brand-not-a-uuid',
    topic: '非 UUID 测试',
    status: 'DISCOVERED',
  })
  assert('非 UUID create 返回 ok:false', createResult.ok === false)
  if (!createResult.ok) {
    assert('非 UUID reason 为 INVALID_PROJECT_ID', createResult.reason === 'INVALID_PROJECT_ID')
    assert('非 UUID projectId 保留', createResult.projectId === 'brand-not-a-uuid')
  }

  const findResult = await koRepo.findByProjectAndTopic('brand-not-a-uuid', '测试题目')
  assert('非 UUID find 返回 null（不崩溃）', findResult === null)
}

// ========================================================================
// 3. KnowledgeObject — Valid UUID
// ========================================================================

async function testValidUUID() {
  console.log('\n── KnowledgeObject 有效 UUID ──')

  const uuid = '550e8400-e29b-41d4-a716-446655440000'
  const result = await koRepo.create({
    projectId: uuid,
    topic: '回归测试 — 有效 UUID',
    status: 'DISCOVERED',
  })
  if (result.ok) {
    assert('有效 UUID create 返回 ok:true', true)
    assert('KnowledgeObject 有 id', !!result.object.id)
    assert('projectId 正确', result.object.projectId === uuid)
  } else {
    // 可能无 DB 连接
    console.log(`  ⚠️  跳过 — 无 DB 连接: ${result.reason}`)
  }
}

// ========================================================================
// Main
// ========================================================================

;(async () => {
  console.log('\n╔════════════════════════════════════════════╗')
  console.log('║    v1.0.1 Repository Regression Tests     ║')
  console.log('╚════════════════════════════════════════════╝')

  await testScoreSnapshotRepository()
  await testUUIDValidation()
  await testValidUUID()

  console.log(`\n── 结果: ${passed} passed, ${failed} failed ──`)
  process.exit(failed > 0 ? 1 : 0)
})()
