// ============================================================
// P4-Validation-02: API Integration Test
// 验证目标：通过真实 HTTP 请求验证 6 条企业 API
// ============================================================

import { prisma } from '../utils/index.js';

const BASE_URL = 'http://localhost:4002';
const JWT_SECRET = process.env.JWT_SECRET || 'ba0d90a78cf4d20963475a7447d51845383f00ac0b7abed7a1f3372c5310cbe9b2f55dc871cbec0fd6d39ff495ec5a0a0e369d47312aecead31ebd41a2a68e84';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) { passed++; } else { failed++; failures.push(message); console.error(`  ❌ ${message}`); }
}

function assertEqual(actual: any, expected: any, message: string) {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
  if (isEqual) { passed++; } else { failed++; failures.push(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); console.error(`  ❌ ${message}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

function generateToken(userId: string, email: string, tokenVersion: number): string {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ id: userId, email, tokenVersion }, JWT_SECRET, { expiresIn: '7d' });
}

async function apiRequest(method: string, path: string, token: string, body?: any): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const options: RequestInit = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' P4-Validation-02: API Integration Test');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // ── 准备测试数据 ──
  const enterpriseMember = await prisma.enterpriseMember.findFirst({ where: { role: 'OWNER' } });
  assert(enterpriseMember !== null, 'Setup: 找到企业用户');
  if (!enterpriseMember) { printSummary(); return; }

  const userId = enterpriseMember.userId;
  const enterpriseId = enterpriseMember.enterpriseId;

  // 获取 User 信息（需要 email 和 tokenVersion）
  const user = await prisma.user.findUnique({ where: { id: userId } });
  assert(user !== null, 'Setup: 找到 User');
  if (!user) { printSummary(); return; }

  const token = generateToken(userId, user.email, user.tokenVersion);

  // 获取现有 CareerProfile
  const profile = await prisma.careerProfile.findFirst();
  assert(profile !== null, 'Setup: 找到 CareerProfile');
  if (!profile) { printSummary(); return; }

  // 获取现有 Skill
  const skills = await prisma.skill.findMany({ take: 5 });
  assert(skills.length >= 3, 'Setup: 至少 3 个 Skill');

  // ── 补全测试数据 ──
  // 先清理旧的测试数据（避免唯一约束冲突）
  await prisma.candidateSkill.deleteMany({ where: { profileId: profile.id } });
  await prisma.workExperience.deleteMany({ where: { profileId: profile.id } });
  await prisma.education.deleteMany({ where: { profileId: profile.id } });
  await prisma.candidateCard.deleteMany({ where: { profileId: profile.id } });
  await prisma.talentMatchResult.deleteMany({ where: { profileId: profile.id } });

  const candidateSkills = [];
  for (let i = 0; i < Math.min(skills.length, 4); i++) {
    const level = i === 0 ? 'expert' : i === 1 ? 'advanced' : 'intermediate';
    const confidence = i === 0 ? 0.95 : i === 1 ? 0.85 : 0.7;
    const cs = await prisma.candidateSkill.create({
      data: {
        profileId: profile.id,
        skillId: skills[i].id,
        level,
        confidence,
        source: 'self_reported',
      },
    });
    candidateSkills.push(cs);
  }
  assert(candidateSkills.length >= 3, 'Setup: 创建 CandidateSkill');

  const workExp = await prisma.workExperience.create({
    data: {
      profileId: profile.id,
      company: '腾讯科技',
      title: '前端架构师',
      location: '深圳',
      startDate: new Date('2021-01-01'),
      endDate: null,
      isCurrent: true,
      description: '负责前端架构设计',
      skillsUsed: ['Vue3', 'TypeScript', 'Node.js'],
    },
  });
  assert(workExp !== null, 'Setup: 创建 WorkExperience');

  const education = await prisma.education.create({
    data: {
      profileId: profile.id,
      school: '华中科技大学',
      degree: '本科',
      major: '计算机科学与技术',
      startDate: new Date('2014-09-01'),
      endDate: new Date('2018-06-01'),
    },
  });
  assert(education !== null, 'Setup: 创建 Education');

  await prisma.careerProfile.update({
    where: { id: profile.id },
    data: {
      yearsExperience: 5,
      currentLevel: 'senior',
      city: '深圳',
      openToOpportunity: true,
      careerDirection: '前端架构',
      industry: '互联网',
    },
  });

  const candidateCard = await prisma.candidateCard.create({
    data: {
      profileId: profile.id,
      headline: '5年前端架构师 | Vue3/TypeScript',
      summary: '资深前端架构师，专注大型应用架构设计',
      currentCompany: '腾讯科技',
      currentTitle: '前端架构师',
      currentCity: '深圳',
      yearsExperience: 5,
      skillTags: ['Vue3', 'TypeScript', 'Node.js', 'React'],
      visibility: 'public',
    },
  });
  assert(candidateCard !== null, 'Setup: 创建 CandidateCard');

  console.log(`  测试数据准备完成：profile=${profile.id}, enterprise=${enterpriseId}`);
  console.log('');

  let requirementId: string = '';
  let matchResultId: string = '';

  // ═══════════════════════════════════════════════════════════
  // Case 1: 创建岗位要求
  // ═══════════════════════════════════════════════════════════
  console.log('── Case 1: 创建岗位要求 ──');

  {
    const res = await apiRequest('POST', '/api/job/match/requirements', token, {
      jobTitle: '高级前端工程师',
      jobDescription: '负责前端架构设计，要求精通 Vue3 和 TypeScript',
      requiredSkills: [
        { skillId: skills[0].id, skillName: skills[0].name, minLevel: 'advanced' },
        { skillId: skills[2].id, skillName: skills[2].name, minLevel: 'intermediate' },
      ],
      preferredSkills: [
        { skillId: skills[1].id, skillName: skills[1].name },
      ],
      experienceMin: 3,
      experienceMax: 8,
      educationMin: '本科',
      preferredMajors: ['计算机科学', '软件工程'],
      industries: ['互联网'],
      location: '深圳',
      remoteOption: 'hybrid',
      salaryMin: 25000,
      salaryMax: 40000,
    });

    assert(res.status === 200 || res.status === 201, `Case1: 创建成功 (${res.status})`);
    assert(res.data.id !== undefined, 'Case1: 返回 ID');
    assert(res.data.jobTitle === '高级前端工程师', 'Case1: jobTitle 正确');
    assert(res.data.requiredSkills && res.data.requiredSkills.length === 2, 'Case1: requiredSkills 数量正确');
    assert(res.data.status === 'draft' || res.data.status === 'active', `Case1: 默认状态 (${res.data.status})`);

    if (res.data.id) requirementId = res.data.id;
  }

  // ═══════════════════════════════════════════════════════════
  // Case 2: 发起人才匹配
  // ═══════════════════════════════════════════════════════════
  console.log('── Case 2: 发起人才匹配 ──');

  {
    const res = await apiRequest('POST', '/api/job/match/search', token, {
      requirementId,
      minScore: 0,
      limit: 20,
    });

    assert(res.status === 200, `Case2: 搜索成功 (${res.status})`);
    assert(res.data.results !== undefined, 'Case2: 返回 results');
    assert(Array.isArray(res.data.results), 'Case2: results 是数组');
    assert(res.data.results.length > 0, 'Case2: 至少 1 个匹配结果');

    if (res.data.results && res.data.results.length > 0) {
      const first = res.data.results[0];
      assert(first.score >= 0 && first.score <= 100, 'Case2: score 在 0-100');
      assert(first.breakdown !== undefined, 'Case2: 有 breakdown');
      assert(first.candidateId !== undefined, 'Case2: 有 candidateId');
      assert(first.matchedSkills !== undefined, 'Case2: 有 matchedSkills');
      assert(first.missingSkills !== undefined, 'Case2: 有 missingSkills');

      // 验证不暴露 Candidate 原始数据
      assert(first.email === undefined, 'Case2: 不暴露 email');
      assert(first.phone === undefined, 'Case2: 不暴露 phone');
      assert(first.fullName === undefined, 'Case2: 不暴露 fullName');

      // 保存第一个 match result ID
      const matchResults = await prisma.talentMatchResult.findMany({
        where: { jobRequirementId: requirementId },
        orderBy: { score: 'desc' },
        take: 1,
      });
      if (matchResults.length > 0) {
        matchResultId = matchResults[0].id;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Case 3: 查询 Match Result
  // ═══════════════════════════════════════════════════════════
  console.log('── Case 3: 查询 Match Result ──');

  {
    if (matchResultId) {
      const res = await apiRequest('GET', `/api/job/match/results/${matchResultId}`, token);

      assert(res.status === 200, `Case3: 查询成功 (${res.status})`);
      assert(res.data.id === matchResultId, 'Case3: ID 一致');
      assert(res.data.score >= 0 && res.data.score <= 100, 'Case3: score 范围');
      assert(res.data.breakdown !== undefined, 'Case3: 有 breakdown');
      assert(res.data.evidence !== undefined, 'Case3: 有 evidence');

      // 验证 Candidate Card 投影
      assert(res.data.candidate !== undefined, 'Case3: 有 candidate 投影');
      assert(res.data.candidate.headline !== undefined, 'Case3: candidate 有 headline');
      assert(res.data.candidate.email === undefined, 'Case3: candidate 不暴露 email');
    } else {
      assert(false, 'Case3: 无 matchResultId 可查询');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Case 4: Evidence 查询
  // ═══════════════════════════════════════════════════════════
  console.log('── Case 4: Evidence 查询 ──');

  {
    if (matchResultId) {
      const res = await apiRequest('GET', `/api/job/match/evidence/${matchResultId}`, token);

      assert(res.status === 200, `Case4: 查询成功 (${res.status})`);
      assert(res.data.resultId === matchResultId, 'Case4: resultId 一致');
      assert(Array.isArray(res.data.evidence), 'Case4: evidence 是数组');
      assert(res.data.evidence.length > 0, 'Case4: 至少 1 条证据');

      for (const ev of res.data.evidence) {
        assert(ev.claim !== undefined && ev.claim.length > 0, 'Case4: evidence claim 非空');
        assert(ev.sourceType !== undefined && ev.sourceType.length > 0, 'Case4: evidence sourceType 非空');
        assert(ev.sourceId !== undefined && ev.sourceId.length > 0, 'Case4: evidence sourceId 非空');
        assert(ev.confidence >= 0 && ev.confidence <= 1, 'Case4: evidence confidence 范围');
      }
    } else {
      assert(false, 'Case4: 无 matchResultId 可查询');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Case 5: 企业权限隔离
  // ═══════════════════════════════════════════════════════════
  console.log('── Case 5: 企业权限隔离 ──');

  {
    // 创建一个孤立用户（无企业关联）
    const otherUser = await prisma.user.create({
      data: {
        email: `isolation_test_${Date.now()}@test.local`,
        username: 'isolation_tester',
        passwordHash: 'fake_hash',
        tokenVersion: 0,
      },
    });

    const otherToken = generateToken(otherUser.id, otherUser.email, otherUser.tokenVersion);

    // 无企业用户尝试创建岗位要求 → 应被拒绝
    const res1 = await apiRequest('POST', '/api/job/match/requirements', otherToken, {
      jobTitle: '测试岗位',
      requiredSkills: [],
    });
    assert(res1.status === 403, `Case5: 无企业用户创建岗位要求 → 403 (${res1.status})`);

    // 无企业用户尝试搜索 → 应被拒绝（因为 requirementId 属于其他企业）
    const res2 = await apiRequest('POST', '/api/job/match/search', otherToken, {
      requirementId,
      minScore: 0,
      limit: 20,
    });
    assert(res2.status === 403 || res2.status === 404, `Case5: 无企业用户搜索 → 403/404 (${res2.status})`);

    // 清理
    await prisma.user.delete({ where: { id: otherUser.id } });
  }

  // ═══════════════════════════════════════════════════════════
  // Case 6: P3 边界验证
  // ═══════════════════════════════════════════════════════════
  console.log('── Case 6: P3 边界验证 ──');

  {
    const profileBefore = await prisma.careerProfile.findUnique({ where: { id: profile.id } });
    const skillsBefore = await prisma.candidateSkill.count({ where: { profileId: profile.id } });
    const workBefore = await prisma.workExperience.count({ where: { profileId: profile.id } });
    const eduBefore = await prisma.education.count({ where: { profileId: profile.id } });

    // 再次执行匹配
    await apiRequest('POST', '/api/job/match/search', token, {
      requirementId,
      minScore: 0,
      limit: 20,
    });

    const profileAfter = await prisma.careerProfile.findUnique({ where: { id: profile.id } });
    const skillsAfter = await prisma.candidateSkill.count({ where: { profileId: profile.id } });
    const workAfter = await prisma.workExperience.count({ where: { profileId: profile.id } });
    const eduAfter = await prisma.education.count({ where: { profileId: profile.id } });

    assertEqual(profileBefore?.updatedAt, profileAfter?.updatedAt, 'Case6: CareerProfile 未被修改');
    assertEqual(skillsBefore, skillsAfter, 'Case6: CandidateSkill 数量不变');
    assertEqual(workBefore, workAfter, 'Case6: WorkExperience 数量不变');
    assertEqual(eduBefore, eduAfter, 'Case6: Education 数量不变');
  }

  // ═══════════════════════════════════════════════════════════
  // Case 7: 认证失败测试
  // ═══════════════════════════════════════════════════════════
  console.log('── Case 7: 认证失败测试 ──');

  {
    const res1 = await fetch(`${BASE_URL}/api/job/match/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobTitle: 'test' }),
    });
    assert(res1.status === 401, `Case7: 无 token → 401 (${res1.status})`);

    const res2 = await apiRequest('POST', '/api/job/match/requirements', 'invalid_token', { jobTitle: 'test' });
    assert(res2.status === 401, `Case7: 错误 token → 401 (${res2.status})`);
  }

  // ═══════════════════════════════════════════════════════════
  // Case 8: 参数校验
  // ═══════════════════════════════════════════════════════════
  console.log('── Case 8: 参数校验 ──');

  {
    const res1 = await apiRequest('POST', '/api/job/match/requirements', token, { requiredSkills: [] });
    assert(res1.status === 400, `Case8: 缺少 jobTitle → 400 (${res1.status})`);

    const res2 = await apiRequest('POST', '/api/job/match/requirements', token, { jobTitle: 'test' });
    assert(res2.status === 400, `Case8: 缺少 requiredSkills → 400 (${res2.status})`);

    const res3 = await apiRequest('POST', '/api/job/match/search', token, {});
    assert(res3.status === 400, `Case8: 缺少 requirementId → 400 (${res3.status})`);
  }

  printSummary();
}

function printSummary() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  RESULT: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════');

  if (failures.length > 0) {
    console.log('');
    console.log('Failures:');
    for (const f of failures) { console.log(`  - ${f}`); }
    process.exit(1);
  } else {
    console.log('');
    console.log('  ✅ ALL PASSED');
    process.exit(0);
  }
}

main().catch((e) => { console.error('Fatal error:', e); process.exit(1); });
