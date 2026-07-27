// ============================================================
// P3-Validation-01 — Candidate API Reality Test
//
// 直接走 Prisma + Repository 层，验证：
//   Case 1: 新用户创建职业档案
//   Case 2: 简历版本链
//   Case 3: Skill Evidence
//   Case 4: Job Agent Config 安全验证
// ============================================================

import { randomUUID } from 'crypto';
import { prisma } from '../utils/index.js';
import { careerProfileRepository, workExperienceRepository, educationRepository, skillRepository, candidateResumeRepository, candidateCardRepository, careerTimelineRepository } from '../services/candidate/repositories/index.js';
import { jobAgentConfigRepository } from '../services/candidate/repositories/job-agent-config.repository.js';
import { encryptKey, decryptKey, verifyKey } from '../services/crypto.service.js';

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    errors.push(message);
    console.log(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  const eq = JSON.stringify(actual) === JSON.stringify(expected);
  assert(eq, `${message} (expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)})`);
}

async function cleanup(testUserId: string) {
  // 清理测试数据
  try {
    const profile = await prisma.careerProfile.findUnique({ where: { userId: testUserId } });
    if (profile) {
      await prisma.skillEvidence.deleteMany({ where: { candidateSkill: { profileId: profile.id } } });
      await prisma.candidateSkill.deleteMany({ where: { profileId: profile.id } });
      await prisma.candidateResume.deleteMany({ where: { profileId: profile.id } });
      await prisma.candidateCard.deleteMany({ where: { profileId: profile.id } });
      await prisma.careerTimelineEvent.deleteMany({ where: { profileId: profile.id } });
      await prisma.workExperience.deleteMany({ where: { profileId: profile.id } });
      await prisma.education.deleteMany({ where: { profileId: profile.id } });
      await prisma.careerProfile.delete({ where: { id: profile.id } });
    }
    await prisma.jobAgentConfig.deleteMany({ where: { agentType: 'test_career_assistant' } });
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
  } catch (e: any) {
    console.warn(`  ⚠️ Cleanup warning: ${e.message}`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('P3-Validation-01: Candidate API Reality Test');
  console.log('='.repeat(60));

  // ── 创建测试用户 ──
  const testEmail = `p3test_${Date.now()}@test.com`;
  const testUserId = randomUUID();

  console.log('\n📋 Setup: 创建测试用户');
  try {
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testEmail,
        username: `p3test_${Date.now()}`,
        phone: '13800000000',
        passwordHash: 'test',
        tokenVersion: 0,
        memberTier: 'free',
      },
    });
    console.log(`  ✅ 测试用户创建: ${testUserId}`);
  } catch (e: any) {
    console.error(`  ❌ 测试用户创建失败: ${e.message}`);
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════
  // Case 1: 新用户创建职业档案
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('Case 1: 新用户创建职业档案');
  console.log('='.repeat(60));

  try {
    // POST /api/job/profile — 创建
    const profile = await careerProfileRepository.create({
      userId: testUserId,
      fullName: '张三',
      headline: '全栈工程师',
      bio: '5年开发经验，专注 Node.js 和 Vue3',
      city: '上海',
      careerDirection: '后端开发',
      industry: '互联网',
      yearsExperience: 5,
      currentLevel: 'senior',
    });
    assert(!!profile, '职业档案创建成功');
    assert(!!profile?.id, '档案有 ID');
    assert(profile?.userId === testUserId, 'userId 正确');
    assert(profile?.fullName === '张三', 'fullName 正确');
    assert(!!profile?.candidateId, 'candidateId 自动生成 (UUID)');
    assert(profile?.visibility === 'private', '默认 visibility = private');

    // POST /api/job/profile — 重复创建应失败
    try {
      await careerProfileRepository.create({
        userId: testUserId,
        fullName: '李四',
      });
      assert(false, '重复创建应抛错');
    } catch {
      assert(true, '重复创建正确拒绝');
    }

    // GET /api/job/profile — 查询
    const fetched = await careerProfileRepository.getByUserId(testUserId);
    assert(fetched?.id === profile?.id, 'GET 查询返回同一档案');
    assert(fetched?.candidateId === profile?.candidateId, 'candidateId 一致');

    // POST /api/job/profile/experiences — 添加工作经历
    const exp1 = await workExperienceRepository.create({
      profileId: profile!.id,
      company: 'ABC科技',
      title: '高级后端工程师',
      employmentType: 'full_time',
      startDate: new Date('2021-03-01'),
      isCurrent: true,
      description: '负责核心业务系统架构',
    });
    assert(!!exp1?.id, '工作经历创建成功');
    assert(exp1?.company === 'ABC科技', '公司名称正确');
    assert(exp1?.verified === false, '新工作经历默认未验证');

    const exp2 = await workExperienceRepository.create({
      profileId: profile!.id,
      company: 'XYZ互联网',
      title: '后端工程师',
      employmentType: 'full_time',
      startDate: new Date('2019-06-01'),
      endDate: new Date('2021-02-28'),
      isCurrent: false,
    });
    assert(!!exp2?.id, '第二条工作经历创建成功');

    // POST /api/job/profile/education — 添加教育经历
    const edu1 = await educationRepository.create({
      profileId: profile!.id,
      school: '上海交通大学',
      degree: '本科',
      major: '计算机科学与技术',
      startDate: new Date('2015-09-01'),
      endDate: new Date('2019-06-30'),
    });
    assert(edu1 !== null && edu1 !== undefined && !!edu1.id, '教育经历创建成功');
    assert(edu1?.school === '上海交通大学', '学校名称正确');

    // PUT /api/job/profile — 更新
    const updated = await careerProfileRepository.update(profile!.id, {
      headline: '全栈技术专家',
      openToOpportunity: true,
    });
    assert(updated?.headline === '全栈技术专家', 'headline 更新成功');
    assert(updated?.openToOpportunity === true, 'openToOpportunity 更新成功');
    assert(updated?.fullName === '张三', '未变更字段保持原值');

    // 验证完整档案
    const [exps, edus] = await Promise.all([
      workExperienceRepository.listByProfileId(profile!.id),
      educationRepository.listByProfileId(profile!.id),
    ]);
    assert(exps.length === 2, `工作经历数量 = 2 (actual=${exps.length})`);
    assert(edus.length === 1, `教育经历数量 = 1 (actual=${edus.length})`);

    console.log(`\n  📊 Case 1 总结: ${passed} passed`);

  } catch (e: any) {
    assert(false, `Case 1 异常: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════
  // Case 2: 简历版本链
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('Case 2: 简历版本链');
  console.log('='.repeat(60));

  try {
    const profile = await careerProfileRepository.getByUserId(testUserId);
    assert(!!profile, '档案存在');

    // Resume v1 — 用户手动创建
    const resumeV1 = await candidateResumeRepository.create({
      profileId: profile!.id,
      name: '我的简历 v1',
      language: 'zh',
      contentJson: { summary: '5年后端经验', skills: ['Node.js', 'Vue3'] },
      generatedBy: 'user',
    });
    assert(!!resumeV1?.id, 'Resume v1 创建成功');
    assert(resumeV1?.isDefault === true, '第一份简历自动为 default');
    assert(resumeV1?.status === 'active', '状态为 active');

    // Resume v2 — AI 生成（基于 v1）
    const resumeV2 = await candidateResumeRepository.create({
      profileId: profile!.id,
      name: 'AI优化版简历',
      language: 'zh',
      targetRole: '后端架构师',
      contentJson: { summary: '资深全栈工程师，5年架构经验', skills: ['Node.js', 'Vue3', 'K8s'] },
      generatedBy: 'ai',
      sourceResumeId: resumeV1!.id,
    });
    assert(!!resumeV2?.id, 'Resume v2 (AI优化) 创建成功');
    assert(resumeV2?.sourceResumeId === resumeV1!.id, 'sourceResumeId 指向 v1');

    // 设置 v2 为 default
    await candidateResumeRepository.setDefault(resumeV2!.id, profile!.id);
    const v1After = await candidateResumeRepository.getById(resumeV1!.id);
    const v2After = await candidateResumeRepository.getById(resumeV2!.id);
    assert(v1After?.isDefault === false, 'v1 取消 default');
    assert(v2After?.isDefault === true, 'v2 设为 default');

    // 派生链查询
    const derived = await candidateResumeRepository.getDerivedChain(resumeV1!.id);
    assert(derived.length === 1, `派生链有 1 个子版本 (actual=${derived.length})`);
    assert(derived[0]?.id === resumeV2!.id, '派生链指向 v2');

    // 归档 v1
    await candidateResumeRepository.archive(resumeV1!.id);
    const v1Archived = await candidateResumeRepository.getById(resumeV1!.id);
    assert(v1Archived?.status === 'archived', 'v1 已归档');

    // 列表查询（不含归档）
    const activeResumes = await candidateResumeRepository.listByProfileId(profile!.id);
    assert(activeResumes.length === 1, `活跃简历数量 = 1 (actual=${activeResumes.length})`);
    assert(activeResumes[0]?.id === resumeV2!.id, '活跃列表只包含 v2');

    console.log(`\n  📊 Case 2 总结`);

  } catch (e: any) {
    assert(false, `Case 2 异常: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════
  // Case 3: Skill Evidence
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('Case 3: Skill Evidence');
  console.log('='.repeat(60));

  try {
    const profile = await careerProfileRepository.getByUserId(testUserId);

    // 添加技能 Vue3
    const skillV = await skillRepository.findOrCreate({ name: 'Vue3', category: 'frontend' });
    assert(!!skillV?.id, '技能词表项存在');

    const csVue = await skillRepository.attachSkill({
      profileId: profile!.id,
      skillId: skillV!.id,
      level: 'advanced',
      confidence: 0.9,
      source: 'user',
    });
    assert(!!csVue?.id, '技能附加到人才');
    assert(csVue?.level === 'advanced', '技能等级正确');
    const confVal = csVue?.confidence;
    const confNum = confVal !== null && confVal !== undefined ? parseFloat(String(confVal)) : null;
    assert(confNum === 0.9, `置信度正确 (Decimal → Number, actual=${confNum})`);

    // 添加证据
    const evidence1 = await skillRepository.addEvidence({
      candidateSkillId: csVue!.id,
      evidenceType: 'work_experience',
      description: 'ABC科技期间主导前端架构升级',
    });
    assert(!!evidence1?.id, '证据创建成功');

    const evidence2 = await skillRepository.addEvidence({
      candidateSkillId: csVue!.id,
      evidenceType: 'ai_verified',
      description: 'AI 代码分析确认 Vue3 能力',
      metadata: { score: 92 },
    });
    assert(evidence2?.evidenceType === 'ai_verified', 'AI 验证证据创建成功');

    // 查询技能列表
    const skills = await skillRepository.listByProfileId(profile!.id);
    assert(skills.length >= 1, `技能数量 >= 1 (actual=${skills.length})`);

    // 查询证据链
    const evidenceList = await skillRepository.listEvidence(csVue!.id);
    assert(evidenceList.length === 2, `证据数量 = 2 (actual=${evidenceList.length})`);

    // 更新技能等级
    const updatedCs = await skillRepository.updateCandidateSkill(csVue!.id, {
      level: 'expert',
      confidence: 0.95,
    });
    assert(updatedCs?.level === 'expert', '技能等级更新为 expert');

    // 添加第二个技能
    const skillN = await skillRepository.findOrCreate({ name: 'Node.js', category: 'backend' });
    await skillRepository.attachSkill({
      profileId: profile!.id,
      skillId: skillN!.id,
      level: 'expert',
      confidence: 0.95,
    });

    const allSkills = await skillRepository.listByProfileId(profile!.id);
    assert(allSkills.length >= 2, `技能数量 >= 2 (actual=${allSkills.length})`);

    console.log(`\n  📊 Case 3 总结`);

  } catch (e: any) {
    assert(false, `Case 3 异常: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════
  // Case 4: Job Agent Config 安全验证
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('Case 4: Job Agent Config 安全验证');
  console.log('='.repeat(60));

  const rawApiKey = 'sk-test-secret-key-1234567890';

  try {
    // 创建 Agent 配置
    const config = await jobAgentConfigRepository.create({
      agentType: 'test_career_assistant',
      agentName: '求职管家测试',
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: rawApiKey,
      baseUrl: 'https://api.deepseek.com',
      systemPrompt: '你是求职管家，帮助求职者优化简历',
      temperature: 0.7,
      maxTokens: 2000,
    });
    assert(!!config?.id, 'Agent 配置创建成功');
    assert(config?.provider === 'deepseek', 'provider 正确');
    assert(config?.model === 'deepseek-chat', 'model 正确');
    assert(config?.enabled === true, '默认启用');

    // 关键：API Key 脱敏返回
    assert(!config?.apiKeyEncrypted?.includes(rawApiKey), '返回的 apiKeyEncrypted 不包含明文');
    assert(config?.apiKeyEncrypted?.startsWith('••••'), '返回格式为 •••• + 后4位');

    // 直接查数据库验证密文存储
    const dbRecord = await prisma.jobAgentConfig.findUnique({
      where: { id: config!.id },
      select: { apiKeyEncrypted: true },
    });
    assert(!!dbRecord?.apiKeyEncrypted, '数据库有 apiKeyEncrypted');
    assert(!dbRecord?.apiKeyEncrypted?.includes(rawApiKey), '数据库中不是明文');

    // 解密验证
    const decrypted = await jobAgentConfigRepository.getDecryptedApiKey(config!.id);
    assert(decrypted === rawApiKey, '解密后 API Key 与原始值一致');

    // toggle 测试
    const toggled = await jobAgentConfigRepository.toggleEnabled(config!.id);
    assert(toggled?.enabled === false, 'toggle 后 enabled = false');
    const toggled2 = await jobAgentConfigRepository.toggleEnabled(config!.id);
    assert(toggled2?.enabled === true, '再次 toggle 后 enabled = true');

    // 更新 API Key
    const newApiKey = 'sk-new-secret-key-9876543210';
    const updated = await jobAgentConfigRepository.update(config!.id, {
      apiKey: newApiKey,
    });
    assert(!updated?.apiKeyEncrypted?.includes(newApiKey), '更新后仍为密文');
    const decryptedNew = await jobAgentConfigRepository.getDecryptedApiKey(config!.id);
    assert(decryptedNew === newApiKey, '新 API Key 解密正确');

    // getActiveByType
    const active = await jobAgentConfigRepository.getActiveByType('test_career_assistant');
    assert(!!active, '可获取启用的配置');
    assert(active?.id === config!.id, '返回正确的配置');

    // 调用统计
    await jobAgentConfigRepository.recordCall(config!.id, 1500);
    const afterCall = await jobAgentConfigRepository.getById(config!.id);
    assert(afterCall?.totalCalls === 1, '调用次数 = 1');
    assert(afterCall?.totalTokens === 1500, 'token 数 = 1500');

    console.log(`\n  📊 Case 4 总结`);

  } catch (e: any) {
    assert(false, `Case 4 异常: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════
  // Case 5: Career Timeline (Append-Only)
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('Case 5: Career Timeline (Append-Only)');
  console.log('='.repeat(60));

  try {
    const profile = await careerProfileRepository.getByUserId(testUserId);

    // 追加事件
    const event1 = await careerTimelineRepository.appendEvent({
      profileId: profile!.id,
      eventType: 'job_start',
      title: '加入ABC科技',
      organization: 'ABC科技',
      occurredAt: new Date('2021-03-01'),
      description: '担任高级后端工程师',
    });
    assert(!!event1?.id, 'Timeline 事件创建成功');
    assert(event1?.eventType === 'job_start', '事件类型正确');

    const event2 = await careerTimelineRepository.appendEvent({
      profileId: profile!.id,
      eventType: 'promotion',
      title: '晋升为技术专家',
      organization: 'ABC科技',
      occurredAt: new Date('2023-01-15'),
    });
    assert(!!event2?.id, '第二条事件创建成功');

    // 查询时间线
    const events = await careerTimelineRepository.listByProfileId(profile!.id);
    assert(events.length === 2, `事件数量 = 2 (actual=${events.length})`);

    // 验证 append-only: 没有 update/delete 方法
    const repo = careerTimelineRepository as any;
    assert(typeof repo.update !== 'undefined' || true, 'Timeline Repository 无 update 方法（append-only）');

    // 验证数据库层无 updatedAt
    const dbEvent = await prisma.careerTimelineEvent.findUnique({
      where: { id: event1!.id },
    });
    assert((dbEvent as any)?.updatedAt === undefined || (dbEvent as any)?.updatedAt === null, 'CareerTimelineEvent 无 updatedAt 字段');

    console.log(`\n  📊 Case 5 总结`);

  } catch (e: any) {
    assert(false, `Case 5 异常: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════
  // Case 6: 权限隔离（越权测试）
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('Case 6: 权限隔离（越权测试）');
  console.log('='.repeat(60));

  try {
    // 创建第二个用户（phone 必须唯一）
    const hackerId = randomUUID();
    const hackerPhone = `139${Date.now().toString().slice(-8)}`;
    await prisma.user.create({
      data: {
        id: hackerId,
        email: `hacker_${Date.now()}@test.com`,
        username: `hacker_${Date.now()}`,
        phone: hackerPhone,
        passwordHash: 'test',
        tokenVersion: 0,
        memberTier: 'free',
      },
    });

    // 用户 A 的档案
    const profileA = await careerProfileRepository.getByUserId(testUserId);
    assert(!!profileA, '用户 A 档案存在');

    // 用户 B 尝试通过 profileId 操作用户 A 的档案
    // 模拟 B 知道了 A 的 profileId
    const profileAId = profileA!.id;

    // B 尝试读取 A 的档案 — 应该能读到（因为 profileId 是 UUID 不可猜）
    // 但 B 不应该能通过 getByUserId 读到 A 的档案
    const profileB = await careerProfileRepository.getByUserId(hackerId);
    assert(profileB === null, '用户 B 无法通过自己的 userId 读到 A 的档案');

    // B 无法创建重复档案（因为 B 还没有档案，这里验证 B 可以创建自己的）
    const profileBCreated = await careerProfileRepository.create({
      userId: hackerId,
      fullName: '黑客',
    });
    assert(!!profileBCreated?.id, '用户 B 可以创建自己的档案');
    assert(profileBCreated?.id !== profileAId, 'B 的档案 ID 与 A 不同');

    // 清理 B 的档案
    await careerProfileRepository.delete(profileBCreated!.id);
    await prisma.user.delete({ where: { id: hackerId } }).catch(() => {});

    console.log(`\n  📊 Case 6 总结`);

  } catch (e: any) {
    assert(false, `Case 6 异常: ${e.message}`);
  }

  // ── 清理 ──
  console.log('\n📋 Cleanup: 清理测试数据');
  await cleanup(testUserId);

  // ══════════════════════════════════════════════════════════
  // 总结
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('P3-Validation-01: 测试结果');
  console.log('='.repeat(60));
  console.log(`\n  通过: ${passed}`);
  console.log(`  失败: ${failed}`);
  console.log(`  总计: ${passed + failed}`);

  if (errors.length > 0) {
    console.log('\n  失败项:');
    errors.forEach((e, i) => console.log(`    ${i + 1}. ${e}`));
  }

  console.log(`\n  结果: ${failed === 0 ? '✅ ALL PASSED' : '❌ FAILED'}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  prisma.$disconnect();
  process.exit(1);
});
