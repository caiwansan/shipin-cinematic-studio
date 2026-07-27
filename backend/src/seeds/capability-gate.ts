/**
 * capability-gate.ts — P1 Capability Gate 验收
 * 
 * 覆盖：
 * - Gate-1 授权正确性
 * - Gate-2 中间件链路（模拟）
 * - Gate-3 UsageRecord 记录
 * - Gate-4 Seed 一致性
 * - 负面测试（不存在 Capability、大小写）
 * 
 * 执行：npx tsx src/seeds/capability-gate.ts
 */

import { PrismaClient } from '@prisma/client';
import { CapabilityRepository } from '../repositories/recruitment/capability.repository.js';
import { ALL_CAPABILITIES, PLAN_CAPABILITY_MATRIX, CONSTITUTION_FREE_CAPABILITIES, AI_PAID_CAPABILITIES } from '../constants/capabilities.js';

const prisma = new PrismaClient();
const repo = new CapabilityRepository(prisma);

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
    failures.push(message);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('P1 Capability Gate 验收');
  console.log('='.repeat(60));

  // ─── Gate-4: Seed 一致性 ───
  console.log('\n[Gate-4] Seed 一致性');

  const plans = await prisma.subscriptionPlan.findMany({
    where: { code: { startsWith: 'recruitment_' } },
    include: { grants: true },
  });

  assert(plans.length === 4, `recruitment_* 套餐数量 = 4（实际 ${plans.length}）`);

  const careerPlan = await prisma.subscriptionPlan.findUnique({
    where: { code: 'career_agent' },
    include: { grants: true },
  });
  assert(!!careerPlan, 'career_agent 套餐存在');

  // 检查每个套餐的 Capability 数量
  for (const [code, expectedCaps] of Object.entries(PLAN_CAPABILITY_MATRIX)) {
    const plan = plans.find(p => p.code === code) || careerPlan;
    if (!plan || plan.code !== code) {
      assert(false, `${code}: 套餐不存在`);
      continue;
    }
    const actualCaps = plan.grants.map(g => g.capability);
    const missing = expectedCaps.filter(c => !actualCaps.includes(c));
    const extra = actualCaps.filter(c => !expectedCaps.includes(c as any));
    assert(
      missing.length === 0 && extra.length === 0,
      `${code}: Capability 匹配（期望 ${expectedCaps.length}，实际 ${actualCaps.length}）`
    );
    if (missing.length > 0) console.log(`    缺失: ${missing.join(', ')}`);
    if (extra.length > 0) console.log(`    多余: ${extra.join(', ')}`);
  }

  // 检查重复授权
  for (const plan of plans) {
    const caps = plan.grants.map(g => g.capability);
    const unique = new Set(caps);
    assert(caps.length === unique.size, `${plan.code}: 无重复 CapabilityGrant`);
  }

  // 检查企业侧 Constitution 免费能力在 Free 套餐中存在
  const freePlan = plans.find(p => p.code === 'recruitment_free');
  if (freePlan) {
    const freeCaps = freePlan.grants.map(g => g.capability);
    // 仅检查企业侧免费能力（求职者侧属于 career_agent 套餐）
    const enterpriseFreeCaps = [
      'JOB_CREATE', 'JOB_MANAGE', 'JOB_PUBLISH',
      'CANDIDATE_SEARCH', 'CANDIDATE_VIEW', 'CANDIDATE_CONTACT',
      'OFFER_CREATE', 'OFFER_SEND', 'OFFER_TRACK',
      'NOTIFICATION_SEND',
    ];
    const missingFree = enterpriseFreeCaps.filter(c => !freeCaps.includes(c));
    assert(missingFree.length === 0, `Free 套餐包含全部企业侧 Constitution 免费能力${missingFree.length > 0 ? `（缺失: ${missingFree.join(', ')})` : ''}`);
  }

  // 检查求职者侧免费能力在 career_agent 套餐中存在（基础能力）
  if (careerPlan) {
    const agentCaps = careerPlan.grants.map(g => g.capability);
    const seekerFreeCaps = ['PROFILE_BUILD', 'RESUME_UPLOAD', 'RESUME_MANAGE', 'JOB_APPLY', 'JOB_VIEW', 'JOB_SEARCH'];
    const missingSeekerFree = seekerFreeCaps.filter(c => !agentCaps.includes(c));
    assert(missingSeekerFree.length === 0, `Career Agent 套餐包含全部求职者基础免费能力${missingSeekerFree.length > 0 ? `（缺失: ${missingSeekerFree.join(', ')})` : ''}`);
  }

  // ─── Gate-1: 授权正确性 ───
  console.log('\n[Gate-1] 授权正确性');

  // 创建测试租户 + 订阅
  const testTenantId = `test-tenant-${Date.now()}`;
  
  // 为每个套餐创建测试订阅并验证
  for (const [code, expectedCaps] of Object.entries(PLAN_CAPABILITY_MATRIX)) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code } });
    if (!plan) continue;

    const tenantId = `${testTenantId}-${code}`;
    
    // 先创建 Tenant（Subscription.tenantId 有外键约束）
    await prisma.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: { id: tenantId, name: `Test-${code}`, type: 'enterprise' },
    });

    // 创建订阅
    await prisma.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: 'active',
        startDate: new Date(),
      },
    });

    // 验证每个期望 Capability 都被授权
    for (const cap of expectedCaps) {
      const result = await repo.hasCapability(tenantId, cap);
      assert(result.granted, `${code} → ${cap}: 已授权`);
    }

    // 验证 AI 能力不在 Free 套餐中
    if (code === 'recruitment_free') {
      for (const aiCap of AI_PAID_CAPABILITIES) {
        const result = await repo.hasCapability(tenantId, aiCap);
        assert(!result.granted, `${code} → ${aiCap}: 正确拒绝（AI 收费能力）`);
      }
    }

    // 验证 Enterprise 拥有全部企业 Capability
    if (code === 'recruitment_enterprise') {
      const allEnterpriseCaps = PLAN_CAPABILITY_MATRIX['recruitment_enterprise'];
      for (const cap of allEnterpriseCaps) {
        const result = await repo.hasCapability(tenantId, cap);
        assert(result.granted, `${code} → ${cap}: 已授权`);
      }
    }
  }

  // 无订阅的租户 → 全部拒绝
  const noSubTenantId = `${testTenantId}-no-sub`;
  const noSubResult = await repo.hasCapability(noSubTenantId, 'JOB_CREATE');
  assert(!noSubResult.granted, '无订阅租户 → JOB_CREATE 正确拒绝');

  // ─── Gate-2: 中间件链路（模拟）───
  console.log('\n[Gate-2] 中间件链路（模拟）');

  // 模拟 requireCapability 逻辑
  async function simulateRequireCapability(tenantId: string, capability: string): Promise<{ status: number; body: any }> {
    // 1. requireAuth — 假设已通过
    // 2. requireTenant — 检查租户存在
    if (!tenantId) {
      return { status: 403, body: { error: '无企业上下文' } };
    }
    // 3. requireCapability
    const result = await repo.hasCapability(tenantId, capability);
    if (!result.granted) {
      return { status: 403, body: { capability, error: '能力未授权', message: '当前套餐不支持此功能' } };
    }
    // 4. Handler
    return { status: 200, body: { ok: true, capability } };
  }

  const freeTenantId = `${testTenantId}-recruitment_free`;
  
  // 免费能力 → 200
  const r1 = await simulateRequireCapability(freeTenantId, 'JOB_CREATE');
  assert(r1.status === 200, `Free + JOB_CREATE → 200（实际 ${r1.status}）`);

  // AI 能力 → 403
  const r2 = await simulateRequireCapability(freeTenantId, 'AI_JD_GENERATE');
  assert(r2.status === 403, `Free + AI_JD_GENERATE → 403（实际 ${r2.status}）`);
  assert(r2.body?.capability === 'AI_JD_GENERATE', '403 响应包含 capability 字段');

  // 无租户 → 403
  const r3 = await simulateRequireCapability('', 'JOB_CREATE');
  assert(r3.status === 403, `无租户 + JOB_CREATE → 403（实际 ${r3.status}）`);

  // ─── Gate-3: UsageRecord ───
  console.log('\n[Gate-3] UsageRecord 记录');

  const usageTenantId = `${testTenantId}-usage-test`;
  const usagePlan = await prisma.subscriptionPlan.findUnique({ where: { code: 'recruitment_pro' } });
  if (usagePlan) {
    await prisma.tenant.upsert({
      where: { id: usageTenantId },
      update: {},
      create: { id: usageTenantId, name: 'Test-usage', type: 'enterprise' },
    });
    await prisma.subscription.create({
      data: {
        tenantId: usageTenantId,
        planId: usagePlan.id,
        status: 'active',
        startDate: new Date(),
      },
    });

    // 记录使用
    await repo.recordUsage({
      tenantId: usageTenantId,
      capability: 'AI_JD_GENERATE',
      amount: 1,
      unit: 'count',
      source: 'test',
      sourceId: 'test-user-001',
      metadata: { test: true, scenario: 'gate-verification' },
    });

    // 验证记录存在
    const usageRecord = await prisma.usageRecord.findFirst({
      where: { tenantId: usageTenantId, capability: 'AI_JD_GENERATE' },
    });
    assert(!!usageRecord, 'UsageRecord 已创建');
    assert(usageRecord?.capability === 'AI_JD_GENERATE', `capability 字段正确（${usageRecord?.capability}）`);
    assert(usageRecord?.tenantId === usageTenantId, `tenantId 字段正确`);
    assert(usageRecord?.amount === 1, `amount 字段正确（${usageRecord?.amount}）`);
    assert(usageRecord?.unit === 'count', `unit 字段正确（${usageRecord?.unit}）`);
    assert(usageRecord?.resourceType === 'capability', `resourceType 字段正确（${usageRecord?.resourceType}）`);
    assert(usageRecord?.source === 'test', `source 字段正确（${usageRecord?.source}）`);
    assert(!!usageRecord?.recordedAt, `recordedAt 已设置（${usageRecord?.recordedAt}）`);

    // 验证 metadata 可解析
    if (usageRecord?.metadata) {
      const meta = JSON.parse(usageRecord.metadata);
      assert(meta.test === true, 'metadata JSON 可正确解析');
    }
  }

  // ─── 负面测试 ───
  console.log('\n[负面测试]');

  // 不存在的 Capability
  const nonExistResult = await repo.hasCapability(freeTenantId, 'NON_EXISTENT_CAPABILITY');
  assert(!nonExistResult.granted, '不存在的 Capability → 正确拒绝');

  // 大小写一致性
  const lowerCase = await repo.hasCapability(freeTenantId, 'ai_jd_generate');
  assert(!lowerCase.granted, 'ai_jd_generate（小写）→ 正确拒绝');

  const mixedCase = await repo.hasCapability(freeTenantId, 'Ai_Jd_Generate');
  assert(!mixedCase.granted, 'Ai_Jd_Generate（混合大小写）→ 正确拒绝');

  const correctCase = await repo.hasCapability(freeTenantId, 'JOB_CREATE');
  assert(correctCase.granted, 'JOB_CREATE（正确大写）→ 已授权');

  // 空字符串
  const emptyResult = await repo.hasCapability(freeTenantId, '');
  assert(!emptyResult.granted, '空字符串 Capability → 正确拒绝');

  // ─── 清理测试数据 ───
  console.log('\n[清理] 删除测试数据');
  const testTenantIds = await prisma.subscription.findMany({
    where: { tenantId: { startsWith: testTenantId } },
    select: { tenantId: true },
  });
  const uniqueTestIds = [...new Set(testTenantIds.map(t => t.tenantId))];
  
  for (const tid of uniqueTestIds) {
    await prisma.usageRecord.deleteMany({ where: { tenantId: tid } });
    await prisma.subscription.deleteMany({ where: { tenantId: tid } });
  }
  console.log(`  清理 ${uniqueTestIds.length} 个测试租户`);

  // ─── 结果汇总 ───
  console.log('\n' + '='.repeat(60));
  console.log(`结果：通过 ${passed} / 失败 ${failed} / 总计 ${passed + failed}`);
  if (failed > 0) {
    console.log('\n失败项：');
    failures.forEach(f => console.log(`  ❌ ${f}`));
    console.log('\n❌ P1 Capability Gate: NOT PASSED');
    process.exit(1);
  } else {
    console.log('\n✅ P1 Capability Gate: ALL PASSED');
    console.log('P1 Capability Model = ACCEPTED');
  }
}

main()
  .catch((err) => {
    console.error('[Gate] ❌ 异常:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
