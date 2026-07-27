/**
 * P4-04 Reality Test — Batch Matching + Ranking
 *
 * 端到端验证：
 *   1. 准备测试数据（激活岗位要求 + 多个候选人）
 *   2. 触发批量匹配
 *   3. 验证排名结果
 *   4. 验证 BatchJob 状态
 *   5. 验证 5 个 API 端点
 *
 * 用法：
 *   npx tsx src/seeds/p4-validation-05.ts
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const API_BASE = process.env.API_BASE || 'http://localhost:4002';
const TEST_TOKEN = process.env.TEST_TOKEN || '';
const prisma = new PrismaClient();

// ============================================================
// Test Data
// ============================================================

const ENTERPRISE_ID = '5ba4891a-511f-4620-8862-7dc83f37ea75';
const USER_ID = '4e2f6062-956f-4d9e-96c2-2d266ec8efa8';

// ============================================================
// Helpers
// ============================================================

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n${'━'.repeat(50)}`);
  console.log(title);
  console.log('━'.repeat(50));
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('='.repeat(60));
  console.log('P4-04 Reality Test: Batch Matching + Ranking');
  console.log('='.repeat(60));

  // ── Group 1: Test Data Preparation ──
  section('Group 1: Test Data Preparation');

  // 1.1 激活一个岗位要求
  let activeReqId = '';
  const existingReq = await prisma.jobRequirementProfile.findFirst({
    where: { enterpriseId: ENTERPRISE_ID, status: 'active' },
  });

  if (existingReq) {
    activeReqId = existingReq.id;
    console.log(`  ℹ️  Using existing active requirement: ${activeReqId.substring(0, 8)}`);
  } else {
    // 激活一个 draft 岗位要求
    const draftReq = await prisma.jobRequirementProfile.findFirst({
      where: { enterpriseId: ENTERPRISE_ID, status: 'draft' },
    });
    if (draftReq) {
      const updated = await prisma.jobRequirementProfile.update({
        where: { id: draftReq.id },
        data: { status: 'active' },
      });
      activeReqId = updated.id;
      console.log(`  ℹ️  Activated requirement: ${activeReqId.substring(0, 8)}`);
    }
  }

  assert('1.1 Active requirement exists', !!activeReqId, activeReqId.substring(0, 8));

  // 1.2 创建多个测试候选人
  const testProfiles = await prisma.careerProfile.findMany({ take: 10 });
  console.log(`  ℹ️  Found ${testProfiles.length} career profiles`);
  assert('1.2 At least 1 career profile', testProfiles.length >= 1, `count=${testProfiles.length}`);

  // ── Group 2: Batch Matching API ──
  section('Group 2: Batch Matching API');

  let batchId = '';

  if (!TEST_TOKEN || !activeReqId) {
    console.log('  ⏳ Skipped (no token or no active requirement)');
  } else {
    // 2.1 POST /api/job/match/batch — 触发批量匹配
    try {
      const res = await axios.post(
        `${API_BASE}/api/job/match/batch`,
        {
          jobRequirementId: activeReqId,
          threshold: 0,  // 测试时接受所有分数
          maxResults: 20,
        },
        { headers: { Authorization: `Bearer ${TEST_TOKEN}` }, timeout: 30000 },
      );
      assert('2.1 Batch API returns 200', res.status === 200, `status=${res.status}`);
      assert('2.2 Batch returns batchId', typeof res.data.batchId === 'string', `batchId=${res.data.batchId?.substring(0, 8)}`);
      assert('2.3 Batch status is COMPLETED', res.data.status === 'COMPLETED', `status=${res.data.status}`);
      assert('2.4 Batch has totalCandidates', typeof res.data.totalCandidates === 'number', `total=${res.data.totalCandidates}`);
      assert('2.5 Batch has results array', Array.isArray(res.data.results), `count=${res.data.results?.length}`);
      batchId = res.data.batchId;

      // 2.6 验证结果按 rank 排序
      if (res.data.results && res.data.results.length > 1) {
        const ranks = res.data.results.map((r: any) => r.rank);
        const sorted = ranks.every((r: number, i: number) => i === 0 || ranks[i - 1] <= r);
        assert('2.6 Results are sorted by rank', sorted, `ranks=${ranks.join(',')}`);
      }

      // 2.7 验证 rankingVersion 存在
      if (res.data.results && res.data.results.length > 0) {
        assert('2.7 Results have rankingVersion', !!res.data.results[0].rankingVersion, `version=${res.data.results[0].rankingVersion}`);
      }
    } catch (e: any) {
      const status = e.response?.status;
      const error = e.response?.data?.error || e.message;
      assert('2.1 Batch API returns 200', false, `status=${status}: ${error}`);
    }

    // ── Group 3: Batch Status API ──
    section('Group 3: Batch Status API');

    if (batchId) {
      try {
        const res = await axios.get(
          `${API_BASE}/api/job/match/batch/${batchId}`,
          { headers: { Authorization: `Bearer ${TEST_TOKEN}` } },
        );
        assert('3.1 Status API returns 200', res.status === 200, `status=${res.status}`);
        assert('3.2 Status is COMPLETED', res.data.status === 'COMPLETED', `status=${res.data.status}`);
        assert('3.3 Has progress', typeof res.data.progress === 'number', `progress=${res.data.progress}%`);
      } catch (e: any) {
        assert('3.1 Status API returns 200', false, e.response?.data?.error || e.message);
      }
    }

    // ── Group 4: Batch Results API ──
    section('Group 4: Batch Results API');

    if (batchId) {
      try {
        const res = await axios.get(
          `${API_BASE}/api/job/match/batch/${batchId}/results`,
          { headers: { Authorization: `Bearer ${TEST_TOKEN}` } },
        );
        assert('4.1 Results API returns 200', res.status === 200, `status=${res.status}`);
        assert('4.2 Results have batchId', res.data.batchId === batchId);
        assert('4.3 Results have rankingVersion', !!res.data.rankingVersion, `version=${res.data.rankingVersion}`);
        assert('4.4 Results have items', Array.isArray(res.data.results), `count=${res.data.results?.length}`);
      } catch (e: any) {
        assert('4.1 Results API returns 200', false, e.response?.data?.error || e.message);
      }
    }

    // ── Group 5: Batch List API ──
    section('Group 5: Batch List API');

    try {
      const res = await axios.get(
        `${API_BASE}/api/job/match/batch/list`,
        { headers: { Authorization: `Bearer ${TEST_TOKEN}` } },
      );
      assert('5.1 List API returns 200', res.status === 200, `status=${res.status}`);
      assert('5.2 List returns jobs array', Array.isArray(res.data.jobs), `count=${res.data.jobs?.length}`);
      assert('5.3 List includes our batch', res.data.jobs?.some((j: any) => j.id === batchId), `batchId=${batchId?.substring(0, 8)}`);
    } catch (e: any) {
      assert('5.1 List API returns 200', false, e.response?.data?.error || e.message);
    }

    // ── Group 6: Ranking Verification ──
    section('Group 6: Ranking Verification (DB Level)');

    if (batchId) {
      const batchJob = await prisma.batchJob.findUnique({ where: { id: batchId } });
      assert('6.1 BatchJob exists in DB', !!batchJob);
      assert('6.2 BatchJob status is COMPLETED', batchJob?.status === 'COMPLETED', `status=${batchJob?.status}`);
      assert('6.3 BatchJob has processedCount', batchJob?.processedCount >= 0, `processed=${batchJob?.processedCount}`);
      assert('6.4 BatchJob has rankingVersion', batchJob?.rankingVersion === 'v1', `version=${batchJob?.rankingVersion}`);

      // 验证 rank 已写入
      const rankedResults = await prisma.talentMatchResult.findMany({
        where: { jobRequirementId: activeReqId },
        orderBy: { rank: 'asc' },
      });
      if (rankedResults.length > 0) {
        assert('6.5 Results have rank assigned', rankedResults[0].rank !== null, `rank=${rankedResults[0].rank}`);
        assert('6.6 Rank starts from 1', rankedResults[0].rank === 1, `rank=${rankedResults[0].rank}`);
        assert('6.7 Results have rankingVersion', !!rankedResults[0].rankingVersion, `version=${rankedResults[0].rankingVersion}`);
      }
    }

    // ── Group 7: Negative Tests ──
    section('Group 7: Negative Tests');

    // 7.1 无 jobRequirementId → 400
    try {
      await axios.post(
        `${API_BASE}/api/job/match/batch`,
        {},
        { headers: { Authorization: `Bearer ${TEST_TOKEN}` } },
      );
      assert('7.1 Missing jobRequirementId → 400', false, 'no error returned');
    } catch (e: any) {
      assert('7.1 Missing jobRequirementId → 400', e.response?.status === 400, `status=${e.response?.status}`);
    }

    // 7.2 不存在的 jobRequirementId → 404
    try {
      await axios.post(
        `${API_BASE}/api/job/match/batch`,
        { jobRequirementId: '00000000-0000-0000-0000-000000000000' },
        { headers: { Authorization: `Bearer ${TEST_TOKEN}` } },
      );
      assert('7.2 Non-existent requirement → 404', false, 'no error returned');
    } catch (e: any) {
      assert('7.2 Non-existent requirement → 404', e.response?.status === 404, `status=${e.response?.status}`);
    }

    // 7.3 无 Token → 401
    try {
      await axios.post(
        `${API_BASE}/api/job/match/batch`,
        { jobRequirementId: activeReqId },
      );
      assert('7.3 No token → 401', false, 'no error returned');
    } catch (e: any) {
      assert('7.3 No token → 401', e.response?.status === 401, `status=${e.response?.status}`);
    }

    // 7.4 删除 BatchJob
    if (batchId) {
      try {
        const res = await axios.delete(
          `${API_BASE}/api/job/match/batch/${batchId}`,
          { headers: { Authorization: `Bearer ${TEST_TOKEN}` } },
        );
        assert('7.4 Delete batch returns 200', res.status === 200, `status=${res.status}`);
      } catch (e: any) {
        assert('7.4 Delete batch returns 200', false, e.response?.data?.error || e.message);
      }
    }
  }

  // ── Summary ──
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Result: ${passed}/${passed + failed} passed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('❌ Some tests failed');
  } else {
    console.log('✅ ALL PASSED');
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
