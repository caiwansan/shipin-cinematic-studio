// ============================================================
// P3-Validation-02 — Candidate Card Projection + Career Timeline
// Integration Test
//
// 验证核心：
//   Case 1: Candidate Card Projection — 完整投影计算
//   Case 2: Visibility Boundary — 可见性过滤
//   Case 3: AI Summary Projection — 摘要生成
//   Case 4: Timeline Statistics — 事件统计
//   Case 5: Correction Chain — 修正链（Append-Only）
// ============================================================

import { randomUUID } from 'crypto';
import { prisma } from '../utils/index.js';
import { careerProfileRepository, workExperienceRepository, educationRepository, skillRepository, candidateResumeRepository, candidateCardRepository, careerTimelineRepository } from '../services/candidate/repositories/index.js';
import { candidateCardProjectionService } from '../services/candidate/services/candidate-card-projection.service.js';
import { careerTimelineService } from '../services/candidate/services/career-timeline.service.js';

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

async function cleanup(testUserId: string) {
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
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
  } catch (e: any) {
    console.warn(`  ⚠️ Cleanup warning: ${e.message}`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('P3-Validation-02: Projection + Timeline Integration Test');
  console.log('='.repeat(60));

  // ── 创建测试用户 ──
  const testEmail = `p3v2_${Date.now()}@test.com`;
  const testUserId = randomUUID();

  console.log('\n📋 Setup: 创建测试用户');
  await prisma.user.create({
    data: {
      id: testUserId,
      email: testEmail,
      username: `p3v2_${Date.now()}`,
      phone: '13800000000',
      passwordHash: 'test',
      tokenVersion: 0,
      memberTier: 'free',
    },
  });
  console.log(`  ✅ 测试用户: ${testUserId}`);

  // ══════════════════════════════════════════════════════════
  // Case 1: Candidate Card Projection 完整投影
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('Case 1: Candidate Card Projection 完整投影');
  console.log('='.repeat(60));

  try {
    // 创建完整职业档案
    const profile = await careerProfileRepository.create({
      userId: testUserId,
      fullName: '李四',
      headline: '资深前端架构师',
      bio: '8年前端经验，专注 Vue3 和 TypeScript',
      city: '深圳',
      careerDirection: '前端开发',
      industry: '互联网',
      yearsExperience: 8,
      currentLevel: 'expert',
    });
    // 通过 update 设置 openToOpportunity 和 visibility
    const updatedProfile = await careerProfileRepository.update(profile!.id, {
      openToOpportunity: true,
      visibility: 'public',
    });
    assert(!!profile?.id, '职业档案创建成功');
    assert(updatedProfile?.visibility === 'public', 'visibility = public');

    // 添加工作经历（3段）
    const exp1 = await workExperienceRepository.create({
      profileId: profile!.id,
      company: '腾讯科技',
      title: '前端架构师',
      employmentType: 'full_time',
      startDate: new Date('2020-01-01'),
      isCurrent: true,
      description: '负责企业级前端架构设计',
      location: '深圳',
    });
    assert(!!exp1?.id, '工作经历1（腾讯）创建成功');

    const exp2 = await workExperienceRepository.create({
      profileId: profile!.id,
      company: '字节跳动',
      title: '高级前端工程师',
      employmentType: 'full_time',
      startDate: new Date('2018-06-01'),
      endDate: new Date('2019-12-31'),
      isCurrent: false,
      description: '参与抖音前端开发',
      location: '北京',
    });
    assert(!!exp2?.id, '工作经历2（字节）创建成功');

    const exp3 = await workExperienceRepository.create({
      profileId: profile!.id,
      company: '初创公司',
      title: '前端工程师',
      employmentType: 'full_time',
      startDate: new Date('2016-07-01'),
      endDate: new Date('2018-05-31'),
      isCurrent: false,
      location: '广州',
    });
    assert(!!exp3?.id, '工作经历3（初创）创建成功');

    // 添加教育经历
    const edu1 = await educationRepository.create({
      profileId: profile!.id,
      school: '华中科技大学',
      degree: '本科',
      major: '计算机科学与技术',
      startDate: new Date('2012-09-01'),
      endDate: new Date('2016-06-30'),
    });
    assert(edu1?.id != null, '教育经历创建成功');

    // 添加技能（含不同置信度）
    const skillVue = await skillRepository.findOrCreate({ name: 'Vue3', category: 'frontend' });
    await skillRepository.attachSkill({
      profileId: profile!.id,
      skillId: skillVue!.id,
      level: 'expert',
      confidence: 0.95,
      source: 'user',
    });

    const skillTS = await skillRepository.findOrCreate({ name: 'TypeScript', category: 'frontend' });
    await skillRepository.attachSkill({
      profileId: profile!.id,
      skillId: skillTS!.id,
      level: 'advanced',
      confidence: 0.88,
      source: 'user',
    });

    const skillReact = await skillRepository.findOrCreate({ name: 'React', category: 'frontend' });
    await skillRepository.attachSkill({
      profileId: profile!.id,
      skillId: skillReact!.id,
      level: 'intermediate',
      confidence: 0.6,
      source: 'ai_suggested',
    });

    // 添加低置信度技能（应被过滤）
    const skillGo = await skillRepository.findOrCreate({ name: 'Go', category: 'backend' });
    await skillRepository.attachSkill({
      profileId: profile!.id,
      skillId: skillGo!.id,
      level: 'beginner',
      confidence: 0.3,
      source: 'ai_suggested',
    });

    // ── 执行投影 ──
    const projection = await candidateCardProjectionService.projectCard(profile!.id);
    assert(!!projection.card, 'Card 投影生成成功');
    assert(projection.workExperiences.length === 3, `工作经历 = 3 (actual=${projection.workExperiences.length})`);
    assert(projection.educations.length === 1, `教育经历 = 1 (actual=${projection.educations.length})`);
    assert(projection.candidateSkills.length === 4, `技能总数 = 4 (actual=${projection.candidateSkills.length})`);

    // 验证计算字段
    const card = projection.card;
    assert(card.yearsExperience >= 8, `工作年限 >= 8 (actual=${card.yearsExperience})`);
    assert(card.currentCompany === '腾讯科技', `当前公司 = 腾讯科技 (actual=${card.currentCompany})`);
    assert(card.currentTitle === '前端架构师', `当前职位 = 前端架构师 (actual=${card.currentTitle})`);
    assert(card.currentCity === '深圳', `当前城市 = 深圳 (actual=${card.currentCity})`);
    assert(card.openToOpportunity === true, 'openToOpportunity = true');
    assert(card.headline === '资深前端架构师', `headline 同步正确 (actual=${card.headline})`);

    // 验证 skillTags（置信度 >= 0.5 的技能，最多 10 个）
    assert(card.skillTags.length === 3, `skillTags 数量 = 3 (过滤低置信度, actual=${card.skillTags.length})`);
    assert(card.skillTags.includes('Vue3'), 'skillTags 包含 Vue3');
    assert(card.skillTags.includes('TypeScript'), 'skillTags 包含 TypeScript');
    assert(card.skillTags.includes('React'), 'skillTags 包含 React');
    assert(!card.skillTags.includes('Go'), 'skillTags 不包含 Go（置信度 0.3 < 0.5）');

    console.log(`\n  📊 Case 1 总结: 投影计算字段完整，skillTags 过滤正确`);

  } catch (e: any) {
    assert(false, `Case 1 异常: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════
  // Case 2: Visibility Boundary 可见性过滤
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('Case 2: Visibility Boundary 可见性过滤');
  console.log('='.repeat(60));

  try {
    const profile = await careerProfileRepository.getByUserId(testUserId);

    // 设置隐藏字段
    await candidateCardRepository.updateVisibility(profile!.id, {
      hiddenFields: ['aiSummary', 'viewCount', 'summary'],
      visibility: 'public',
    });

    // Owner 视角 — 所有字段可见
    const ownerCard = await candidateCardProjectionService.getCard(profile!.id, { viewer: 'owner' });
    assert(ownerCard._visibleFields.includes('headline'), 'Owner: headline 可见');
    assert(ownerCard._visibleFields.includes('aiSummary'), 'Owner: aiSummary 可见（即使 hidden）');
    assert(ownerCard._visibleFields.includes('viewCount'), 'Owner: viewCount 可见（即使 hidden）');
    assert(ownerCard._hiddenFields.length === 0, `Owner: 无隐藏字段 (actual=${ownerCard._hiddenFields.length})`);

    // Enterprise 视角 — 隐藏字段应被过滤
    const enterpriseCard = await candidateCardProjectionService.getCard(profile!.id, { viewer: 'enterprise' });
    assert(enterpriseCard._visibleFields.includes('headline'), 'Enterprise: headline 可见');
    assert(enterpriseCard._visibleFields.includes('skillTags'), 'Enterprise: skillTags 可见');
    assert(!enterpriseCard._visibleFields.includes('aiSummary'), 'Enterprise: aiSummary 不可见（hidden）');
    assert(!enterpriseCard._visibleFields.includes('viewCount'), 'Enterprise: viewCount 不可见（hidden）');
    assert(!enterpriseCard._visibleFields.includes('summary'), 'Enterprise: summary 不可见（hidden）');
    assert(enterpriseCard._hiddenFields.length === 3, `Enterprise: 3 个隐藏字段 (actual=${enterpriseCard._hiddenFields.length})`);

    // Public 视角 — 与 enterprise 相同
    const publicCard = await candidateCardProjectionService.getCard(profile!.id, { viewer: 'public' });
    assert(!publicCard._visibleFields.includes('aiSummary'), 'Public: aiSummary 不可见');
    assert(publicCard._visibleFields.includes('skillTags'), 'Public: skillTags 可见');
    assert(publicCard._visibleFields.includes('currentCompany'), 'Public: currentCompany 可见');

    console.log(`\n  📊 Case 2 总结: Owner 全可见 / Enterprise+Public 隐藏字段正确过滤`);

  } catch (e: any) {
    assert(false, `Case 2 异常: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════
  // Case 3: AI Summary Projection 摘要生成
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('Case 3: AI Summary Projection 摘要生成');
  console.log('='.repeat(60));

  try {
    const profile = await careerProfileRepository.getByUserId(testUserId);

    // 生成摘要
    const summary = await candidateCardProjectionService.generateSummary(profile!.id);
    assert(summary.totalYears >= 8, `总工作年限 >= 8 (actual=${summary.totalYears})`);
    assert(summary.topSkills.length >= 2, `topSkills >= 2 (actual=${summary.topSkills.length})`);
    assert(summary.topSkills.includes('Vue3'), 'topSkills 包含 Vue3（置信度 >= 0.7）');
    assert(summary.topSkills.includes('TypeScript'), 'topSkills 包含 TypeScript（置信度 >= 0.7）');
    assert(summary.currentRole != null, 'currentRole 不为空');
    assert(summary.currentRole!.includes('前端架构师'), `currentRole 包含职位 (actual=${summary.currentRole})`);
    assert(summary.currentRole!.includes('腾讯科技'), `currentRole 包含公司 (actual=${summary.currentRole})`);
    assert(summary.educationLevel != null, 'educationLevel 不为空');
    assert(summary.educationLevel!.includes('华中科技大学'), `educationLevel 正确 (actual=${summary.educationLevel})`);
    assert(summary.careerHighlights.length >= 3, `careerHighlights >= 3 (actual=${summary.careerHighlights.length})`);

    // 验证 AI Summary 不污染原始 Profile
    const rawProfile = await prisma.careerProfile.findUnique({ where: { id: profile!.id } });
    assert(rawProfile?.fullName === '李四', '原始 Profile fullName 未被修改');
    assert(rawProfile?.headline === '资深前端架构师', '原始 Profile headline 未被修改');

    console.log(`\n  📊 Case 3 总结: 摘要数据准确，不污染原始 Profile`);

  } catch (e: any) {
    assert(false, `Case 3 异常: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════
  // Case 4: Timeline Statistics 事件统计
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('Case 4: Timeline Statistics 事件统计');
  console.log('='.repeat(60));

  try {
    const profile = await careerProfileRepository.getByUserId(testUserId);

    // 手动追加事件
    const evt1 = await careerTimelineService.appendEvent({
      profileId: profile!.id,
      eventType: 'job_start',
      title: '加入腾讯科技',
      organization: '腾讯科技',
      occurredAt: new Date('2020-01-01'),
      granularity: 'day',
      source: 'user',
    });
    assert(!!evt1?.id, '事件1（job_start）追加成功');

    const evt2 = await careerTimelineService.appendEvent({
      profileId: profile!.id,
      eventType: 'promotion',
      title: '晋升为架构师',
      organization: '腾讯科技',
      occurredAt: new Date('2022-06-01'),
      granularity: 'day',
      source: 'user',
    });
    assert(!!evt2?.id, '事件2（promotion）追加成功');

    const evt3 = await careerTimelineService.appendEvent({
      profileId: profile!.id,
      eventType: 'certification',
      title: '获得 AWS 认证',
      occurredAt: new Date('2023-03-15'),
      granularity: 'day',
      source: 'user',
    });
    assert(!!evt3?.id, '事件3（certification）追加成功');

    const evt4 = await careerTimelineService.appendEvent({
      profileId: profile!.id,
      eventType: 'skill_acquired',
      title: '掌握 Rust',
      occurredAt: new Date('2024-01-10'),
      granularity: 'day',
      source: 'ai_suggested',
    });
    assert(!!evt4?.id, '事件4（skill_acquired）追加成功');

    // 查询时间线
    const timeline = await careerTimelineService.queryTimeline({ profileId: profile!.id });
    assert(timeline.total === 4, `事件总数 = 4 (actual=${timeline.total})`);
    assert(timeline.events.length === 4, `返回事件数 = 4 (actual=${timeline.events.length})`);

    // 按类型筛选
    const jobStartOnly = await careerTimelineService.queryTimeline({
      profileId: profile!.id,
      eventType: 'job_start',
    });
    assert(jobStartOnly.total === 1, `job_start 类型 = 1 (actual=${jobStartOnly.total})`);

    // 统计
    const stats = await careerTimelineService.getEventStats(profile!.id);
    assert(stats['job_start'] === 1, `stats.job_start = 1 (actual=${stats['job_start']})`);
    assert(stats['promotion'] === 1, `stats.promotion = 1 (actual=${stats['promotion']})`);
    assert(stats['certification'] === 1, `stats.certification = 1 (actual=${stats['certification']})`);
    assert(stats['skill_acquired'] === 1, `stats.skill_acquired = 1 (actual=${stats['skill_acquired']})`);

    // 自动同步：从 Work Experience 生成事件
    const workExps = await workExperienceRepository.listByProfileId(profile!.id);
    assert(workExps.length > 0, '有工作经历可同步');
    const syncedEvents = await careerTimelineService.syncFromWorkExperience(profile!.id, workExps[0]!.id);
    assert(syncedEvents.length >= 1, `自动同步生成 >= 1 事件 (actual=${syncedEvents.length})`);

    // 自动同步：从 Education 生成事件
    const edus = await educationRepository.listByProfileId(profile!.id);
    assert(edus.length > 0, '有教育经历可同步');
    const eduEvents = await careerTimelineService.syncFromEducation(profile!.id, edus[0]!.id);
    assert(eduEvents.length >= 1, `教育同步生成 >= 1 事件 (actual=${eduEvents.length})`);

    console.log(`\n  📊 Case 4 总结: 事件追加/查询/统计/自动同步全部正确`);

  } catch (e: any) {
    assert(false, `Case 4 异常: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════
  // Case 5: Correction Chain 修正链（Append-Only）
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('Case 5: Correction Chain 修正链（Append-Only）');
  console.log('='.repeat(60));

  try {
    const profile = await careerProfileRepository.getByUserId(testUserId);

    // 原始事件
    const originalEvent = await careerTimelineService.appendEvent({
      profileId: profile!.id,
      eventType: 'job_start',
      title: '加入字节跳动',
      organization: '字节跳动',
      occurredAt: new Date('2018-06-01'),
      granularity: 'day',
      source: 'user',
    });
    assert(!!originalEvent?.id, '原始事件创建成功');

    // 追加 Correction（不修改原始事件）
    const correction = await careerTimelineService.appendCorrection(
      profile!.id,
      {
        originalEventId: originalEvent!.id,
        eventType: 'job_start',
        title: '加入字节跳动（修正）',
        organization: '字节跳动',
        occurredAt: new Date('2018-07-01'),
        granularity: 'day',
        description: '实际入职时间是 2018-07-01，之前记错了',
        source: 'user_correction',
      },
    );
    assert(!!correction?.id, 'Correction 事件创建成功');
    assert(correction?.relatedEventId === originalEvent!.id, 'Correction 链接到原始事件');
    assert(correction?.source === 'user_correction', 'Correction 来源标记正确');

    // 验证原始事件未被修改（Append-Only）
    const originalAfter = await careerTimelineService.getEvent(originalEvent!.id);
    assert(originalAfter?.title === '加入字节跳动', '原始事件标题未被修改');
    assert(originalAfter?.occurredAt === originalEvent!.occurredAt, '原始事件时间未被修改');

    // 获取 Correction 链
    const corrections = await careerTimelineService.getCorrections(originalEvent!.id);
    assert(corrections.length === 1, `Correction 链长度 = 1 (actual=${corrections.length})`);
    assert(corrections[0]?.id === correction!.id, 'Correction 链指向正确事件');

    // 获取事件 + Correction 完整视图
    const eventWithCorrections = await careerTimelineService.getEventWithCorrections(originalEvent!.id);
    assert(eventWithCorrections.event?.id === originalEvent!.id, '事件详情正确');
    assert(eventWithCorrections.corrections.length === 1, 'Correction 链完整');

    // 获取完整时间线（含 Correction 标记）
    const fullTimeline = await careerTimelineService.getFullTimeline(profile!.id);
    const originalInTimeline = fullTimeline.events.find((e: any) => e.id === originalEvent!.id);
    assert(!!originalInTimeline, '原始事件在时间线中');
    assert((originalInTimeline as any)?.hasCorrections === true, '原始事件标记 hasCorrections = true');
    assert((originalInTimeline as any)?.correctionCount === 1, `correctionCount = 1 (actual=${(originalInTimeline as any)?.correctionCount})`);

    // 验证时间线中无 Correction 事件的 hasCorrections（Correction 本身不会再被修正）
    const correctionInTimeline = fullTimeline.events.find((e: any) => e.id === correction!.id);
    assert(!!correctionInTimeline, 'Correction 事件也在时间线中');
    assert((correctionInTimeline as any)?.hasCorrections === false, 'Correction 事件本身无进一步修正');

    console.log(`\n  📊 Case 5 总结: 修正链完整，原始事件未被修改（Append-Only 验证通过）`);

  } catch (e: any) {
    assert(false, `Case 5 异常: ${e.message}`);
  }

  // ── 清理 ──
  console.log('\n📋 Cleanup: 清理测试数据');
  await cleanup(testUserId);

  // ══════════════════════════════════════════════════════════
  // 总结
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60));
  console.log('P3-Validation-02: 测试结果');
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
