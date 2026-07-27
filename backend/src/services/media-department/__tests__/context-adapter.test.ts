#!/usr/bin/env tsx
/**
 * M1-A1 Context Adapter — Acceptance Tests
 * 
 * Cases:
 *   Case 1 — 正常企业用户 → 返回完整上下文
 *   Case 2 — 无企业归属 → ORGANIZATION_REQUIRED
 *   Case 3 — 无订阅 → SUBSCRIPTION_REQUIRED
 *   Case 4 — 无 Media Capability → CAPABILITY_REQUIRED
 *   Case 5 — Audit Trace — context_resolved 已记录
 * 
 * Run: npx tsx src/services/media-department/__tests__/context-adapter.test.ts
 */

import { MediaDepartmentContextService, ContextResolutionError } from '../index.js'
import { prisma } from '../../../utils/index.js'

// ─── 测试框架 ───

let passed = 0
let failed = 0
const failures: string[] = []

function test(name: string, fn: () => Promise<void>) {
  return fn()
    .then(() => {
      console.log(`  ✅ ${name}`)
      passed++
    })
    .catch((e) => {
      console.log(`  ❌ ${name}: ${(e as Error).message}`)
      failures.push(`${name}: ${(e as Error).message}`)
      failed++
    })
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`)
}

function assertEqual<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) throw new Error(`${msg}: expected ${expected}, got ${actual}`)
}

// ─── 测试数据准备 ───

const TEST_RUN_ID = Date.now().toString(36)

async function setupTestData() {
  console.log('\n  📋 Setting up test data...\n')

  // Clean previous test data for these specific test users
  const testTenant = await prisma.tenant.create({
    data: {
      name: `TEST-TENANT-${TEST_RUN_ID}`,
      type: 'enterprise',
      status: 'active',
      schemaVersion: 1,
    },
  })

  const testOrg = await prisma.govOrganization.create({
    data: {
      tenantId: testTenant.id,
      name: `TEST-ORG-${TEST_RUN_ID}`,
      type: 'enterprise',
      status: 'active',
    },
  })

  const testGovUser = await prisma.govUser.create({
    data: {
      tenantId: testTenant.id,
      email: `test-${TEST_RUN_ID}@media-dept.test`,
      name: 'Test User',
      status: 'active',
    },
  })

  const testUser = await prisma.user.create({
    data: {
      email: `test-${TEST_RUN_ID}@media-dept.test`,
      username: `testuser_${TEST_RUN_ID}`,
      passwordHash: 'test_hash',
    },
  })

  const testPlan = await prisma.subscriptionPlan.create({
    data: {
      code: `TEST-PLAN-${TEST_RUN_ID}`,
      name: 'Test Media Plan',
      productType: 'MEDIA_DEPARTMENT',
      billingCycle: 'monthly',
      capabilities: JSON.stringify({
        'media.department.access': true,
        'media.content.generate': { limit: 100 },
        'media.calendar.enabled': true,
      }),
      schemaVersion: 1,
      status: 'active',
    },
  })

  // 创建 grant
  await prisma.capabilityGrant.create({
    data: {
      planId: testPlan.id,
      capability: 'media.department.access',
      limits: JSON.stringify({ maxChannels: 10 }),
    },
  })

  const testSubscription = await prisma.subscription.create({
    data: {
      tenantId: testTenant.id,
      planId: testPlan.id,
      status: 'active',
      startDate: new Date(),
      autoRenew: true,
    },
  })

  // Enterprise subscription for the organization
  await prisma.enterpriseSubscription.create({
    data: {
      organizationId: testOrg.id,
      planId: testPlan.id,
      status: 'active',
      startAt: new Date(),
      expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      snapshotName: 'Test Media Plan',
      snapshotMaxEmployees: 5,
      snapshotMaxChannels: 10,
      snapshotMaxMembers: 10,
      snapshotFeatures: JSON.stringify(['ai_employee', 'content_calendar', 'channel_publish']),
    },
  })

  // Agent profile + instance
  const testAgentProfile = await prisma.enterpriseAgentProfile.create({
    data: {
      tenantId: testOrg.id,
      name: 'Test Agent',
      role: 'Content Creator',
      agentType: 'content_creator',
      status: 'active',
    },
  })

  await prisma.enterpriseAgentInstance.create({
    data: {
      tenantId: testOrg.id,
      employeeId: testAgentProfile.id,
      agentId: `agent_${TEST_RUN_ID}_001`,
      runtime: 'openclaw',
      status: 'active',
      runtimeStatus: 'active',
    },
  })

  // Create a "no-org" user (no GovUser)
  const noOrgUser = await prisma.user.create({
    data: {
      email: `noorg-${TEST_RUN_ID}@media-dept.test`,
      username: `noorg_${TEST_RUN_ID}`,
      passwordHash: 'test_hash',
    },
  })

  // Create a "no-subscription" tenant with org but no subscription
  const noSubTenant = await prisma.tenant.create({
    data: {
      name: `TEST-NOSUB-${TEST_RUN_ID}`,
      type: 'enterprise',
      status: 'active',
      schemaVersion: 1,
    },
  })

  const noSubOrg = await prisma.govOrganization.create({
    data: {
      tenantId: noSubTenant.id,
      name: `TEST-NOSUB-ORG-${TEST_RUN_ID}`,
      type: 'enterprise',
      status: 'active',
    },
  })

  const noSubGovUser = await prisma.govUser.create({
    data: {
      tenantId: noSubTenant.id,
      email: `nosub-${TEST_RUN_ID}@media-dept.test`,
      name: 'No Sub User',
      status: 'active',
    },
  })

  const noSubUser = await prisma.user.create({
    data: {
      email: `nosub-${TEST_RUN_ID}@media-dept.test`,
      username: `nosub_${TEST_RUN_ID}`,
      passwordHash: 'test_hash',
    },
  })

  // Create a "no-capability" plan without media.department.access
  const noCapPlan = await prisma.subscriptionPlan.create({
    data: {
      code: `TEST-NOCAP-${TEST_RUN_ID}`,
      name: 'Test No-Cap Plan',
      productType: 'MEDIA_DEPARTMENT',
      billingCycle: 'monthly',
      capabilities: JSON.stringify({
        'geo.optimize': true,  // no media capability
      }),
      schemaVersion: 1,
      status: 'active',
    },
  })

  const noCapTenant = await prisma.tenant.create({
    data: {
      name: `TEST-NOCAP-${TEST_RUN_ID}`,
      type: 'enterprise',
      status: 'active',
      schemaVersion: 1,
    },
  })

  const noCapOrg = await prisma.govOrganization.create({
    data: {
      tenantId: noCapTenant.id,
      name: `TEST-NOCAP-ORG-${TEST_RUN_ID}`,
      type: 'enterprise',
      status: 'active',
    },
  })

  await prisma.subscription.create({
    data: {
      tenantId: noCapTenant.id,
      planId: noCapPlan.id,
      status: 'active',
      startDate: new Date(),
      autoRenew: true,
    },
  })

  await prisma.enterpriseSubscription.create({
    data: {
      organizationId: noCapOrg.id,
      planId: noCapPlan.id,
      status: 'active',
      startAt: new Date(),
      expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      snapshotName: 'Test No-Cap Plan',
      snapshotMaxEmployees: 2,
      snapshotMaxChannels: 3,
      snapshotMaxMembers: 5,
      snapshotFeatures: JSON.stringify(['basic_features']),
    },
  })

  const noCapGovUser = await prisma.govUser.create({
    data: {
      tenantId: noCapTenant.id,
      email: `nocap-${TEST_RUN_ID}@media-dept.test`,
      name: 'No Cap User',
      status: 'active',
    },
  })

  const noCapUser = await prisma.user.create({
    data: {
      email: `nocap-${TEST_RUN_ID}@media-dept.test`,
      username: `nocap_${TEST_RUN_ID}`,
      passwordHash: 'test_hash',
    },
  })

  return {
    testUser,
    testGovUser,
    testOrg,
    testTenant,
    testSubscription,
    testPlan,
    testAgentProfile,
    noOrgUser,
    noSubUser,
    noSubGovUser,
    noSubOrg,
    noSubTenant,
    noCapUser,
  }
}

// ─── 测试执行 ───

async function runTests() {
  const service = new MediaDepartmentContextService()
  const data = await setupTestData()

  console.log('\n=== M1-A1: Context Adapter Acceptance Tests ===\n')

  // ── Case 1: 正常企业用户 ──
  await test('Case 1 — 正常企业用户返回完整上下文', async () => {
    const ctx = await service.resolve(data.testUser.id)

    assertEqual(ctx.userId, data.testUser.id, 'userId')
    assertEqual(ctx.organizationId, data.testOrg.id, 'organizationId')
    assertEqual(ctx.tenantId, data.testGovUser.tenantId, 'tenantId')
    assertEqual(ctx.subscriptionStatus, 'active', 'subscriptionStatus')
    assert(ctx.entitlement.planCode.length > 0, 'entitlement.planCode should not be empty')
    assert(ctx.capabilities.length > 0, 'capabilities should not be empty')
    assert(ctx.capabilities.includes('media.department.access'), 'should include media.department.access')
    assertEqual(ctx.agentAccess.enabled, true, 'agentAccess.enabled')
    assert(ctx.agentAccess.maxAgents > 0, 'agentAccess.maxAgents should be > 0')
    assertEqual(ctx.agentAccess.activeAgents, 1, 'agentAccess.activeAgents')
  })

  // ── Case 2: 无企业归属 ──
  await test('Case 2 — 无企业归属 → ORGANIZATION_REQUIRED', async () => {
    try {
      await service.resolve(data.noOrgUser.id)
      throw new Error('Should have thrown ContextResolutionError')
    } catch (err) {
      assert(err instanceof ContextResolutionError, 'Error should be ContextResolutionError')
      assertEqual(err.code, 'ORGANIZATION_REQUIRED', 'error code')
    }
  })

  // ── Case 3: 无订阅 ──
  await test('Case 3 — 无有效订阅 → SUBSCRIPTION_REQUIRED', async () => {
    try {
      await service.resolve(data.noSubUser.id)
      throw new Error('Should have thrown ContextResolutionError')
    } catch (err) {
      assert(err instanceof ContextResolutionError, 'Error should be ContextResolutionError')
      assertEqual(err.code, 'SUBSCRIPTION_REQUIRED', 'error code')
    }
  })

  // ── Case 4: 无 Media Capability ──
  await test('Case 4 — 无 Media Capability → CAPABILITY_REQUIRED', async () => {
    try {
      await service.resolve(data.noCapUser.id)
      throw new Error('Should have thrown ContextResolutionError')
    } catch (err) {
      assert(err instanceof ContextResolutionError, 'Error should be ContextResolutionError')
      assertEqual(err.code, 'CAPABILITY_REQUIRED', 'error code')
    }
  })

  // ── Case 5: Audit Trace ──
  await test('Case 5 — Audit Trace 已记录 context_resolved', async () => {
    // 重新 resolve 以确保有审计记录
    await service.resolve(data.testUser.id)

    const auditHistory = await service.getAuditHistory(data.testUser.id)
    assert(auditHistory.length > 0, 'audit history should have entries')

    const latestEntry = auditHistory[0]
    assertEqual(latestEntry.userId, data.testUser.id, 'audit userId')
    assertEqual(latestEntry.organizationId, data.testOrg.id, 'audit organizationId')
    assertEqual(latestEntry.tenantId, data.testTenant.id, 'audit tenantId')
    assertEqual(latestEntry.action, 'context_resolved', 'audit action')
    assert(latestEntry.resolutionTimeMs > 0, 'resolutionTimeMs should be > 0')
    assert(latestEntry.timestamp instanceof Date, 'timestamp should be Date')
  })

  // ── 输出结果 ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failures.length > 0) {
    console.log('Failures:')
    failures.forEach(f => console.log(`  - ${f}`))
    process.exitCode = 1
  } else {
    console.log('🎉 All acceptance tests PASSED → M1-A1 Context Adapter CLEARED for M1-A2\n')
  }
}

runTests().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
