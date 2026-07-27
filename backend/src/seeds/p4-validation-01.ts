// ============================================================
// P4-Validation-01: Talent Matching Engine Reality Test
// 验证目标：
//   1. Score 确定性：固定输入 → 固定输出
//   2. 维度计算正确性：Skill / Experience / Education / Career
//   3. 证据链完整性：每个结论指向 Candidate Domain
//   4. 风险标记正确性
//   5. 数据边界：Matching Domain 只读引用 Candidate Domain
// ============================================================

import {
  calculateSkillMatch,
  calculateExperienceMatch,
  calculateEducationMatch,
  calculateCareerMatch,
  calculateOverallScore,
  matchCandidate,
  type CandidateData,
  type JobRequirementData,
} from '../services/matching/services/talent-matching.service.js';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.error(`  ❌ ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
  if (isEqual) {
    passed++;
  } else {
    failed++;
    failures.push(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    console.error(`  ❌ ${message}`);
    console.error(`     expected: ${JSON.stringify(expected)}`);
    console.error(`     actual:   ${JSON.stringify(actual)}`);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, message: string) {
  if (Math.abs(actual - expected) <= tolerance) {
    passed++;
  } else {
    failed++;
    failures.push(`${message}: expected ~${expected} (±${tolerance}), got ${actual}`);
    console.error(`  ❌ ${message}`);
    console.error(`     expected: ~${expected} (±${tolerance})`);
    console.error(`     actual:   ${actual}`);
  }
}

// ── 测试数据 ──

const sampleCandidate: CandidateData = {
  profileId: 'prof-001',
  candidateId: 'cand-001',
  yearsExperience: 5,
  currentLevel: 'senior',
  currentCity: '深圳',
  currentCompany: '腾讯科技',
  openToOpportunity: true,
  careerDirection: '前端架构',
  industries: ['互联网', '金融科技'],
  skills: [
    { skillId: 'sk-001', skillName: 'Vue3', level: 'expert', confidence: 0.95 },
    { skillId: 'sk-002', skillName: 'TypeScript', level: 'advanced', confidence: 0.9 },
    { skillId: 'sk-003', skillName: 'Node.js', level: 'intermediate', confidence: 0.7 },
    { skillId: 'sk-004', skillName: 'React', level: 'intermediate', confidence: 0.6 },
  ],
  workExperiences: [
    {
      id: 'we-001',
      company: '腾讯科技',
      title: '前端架构师',
      startDate: new Date('2021-01-01'),
      endDate: null,
      isCurrent: true,
      location: '深圳',
      skillsUsed: ['Vue3', 'TypeScript', 'Node.js'],
    },
    {
      id: 'we-002',
      company: '字节跳动',
      title: '高级前端工程师',
      startDate: new Date('2018-06-01'),
      endDate: new Date('2020-12-31'),
      isCurrent: false,
      location: '北京',
      skillsUsed: ['React', 'TypeScript'],
    },
  ],
  educations: [
    {
      id: 'edu-001',
      school: '华中科技大学',
      degree: '本科',
      major: '计算机科学与技术',
    },
  ],
};

const sampleRequirement: JobRequirementData = {
  id: 'req-001',
  requiredSkills: [
    { skillId: 'sk-001', skillName: 'Vue3', minLevel: 'advanced' },
    { skillId: 'sk-002', skillName: 'TypeScript', minLevel: 'intermediate' },
  ],
  preferredSkills: [
    { skillId: 'sk-003', skillName: 'Node.js' },
  ],
  experienceMin: 3,
  experienceMax: 8,
  educationMin: '本科',
  preferredMajors: ['计算机科学', '软件工程'],
  industries: ['互联网'],
  location: '深圳',
  remoteOption: 'hybrid',
  weights: { skill: 0.40, experience: 0.30, education: 0.15, career: 0.15 },
};

// ── 开始测试 ──

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log(' P4-Validation-01: Talent Matching Engine');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// ═══════════════════════════════════════════════════════════
// Case 1: Score 确定性测试（Constraint-2）
// ═══════════════════════════════════════════════════════════
console.log('── Case 1: Score 确定性测试 ──');

{
  // 相同输入，多次计算，结果必须一致
  const result1 = matchCandidate(sampleCandidate, sampleRequirement);
  const result2 = matchCandidate(sampleCandidate, sampleRequirement);
  const result3 = matchCandidate(sampleCandidate, sampleRequirement);

  assertEqual(result1.score, result2.score, 'Score 确定性：第1次 vs 第2次');
  assertEqual(result2.score, result3.score, 'Score 确定性：第2次 vs 第3次');
  assertEqual(result1.breakdown, result2.breakdown, 'Breakdown 确定性');
  assertEqual(result1.matchedSkills.length, result2.matchedSkills.length, 'MatchedSkills 数量确定性');
  assertEqual(result1.riskFlags.length, result2.riskFlags.length, 'RiskFlags 数量确定性');
}

{
  // 固定输入 → 固定输出（具体数值验证）
  const result = matchCandidate(sampleCandidate, sampleRequirement);
  assert(result.score >= 0 && result.score <= 100, 'Score 范围：0-100');
  assert(result.breakdown.skill >= 0 && result.breakdown.skill <= 100, 'Skill 维度范围');
  assert(result.breakdown.experience >= 0 && result.breakdown.experience <= 100, 'Experience 维度范围');
  assert(result.breakdown.education >= 0 && result.breakdown.education <= 100, 'Education 维度范围');
  assert(result.breakdown.career >= 0 && result.breakdown.career <= 100, 'Career 维度范围');
}

// ═══════════════════════════════════════════════════════════
// Case 2: Skill Match 维度计算
// ═══════════════════════════════════════════════════════════
console.log('── Case 2: Skill Match 维度计算 ──');

{
  // 全部匹配
  const result = calculateSkillMatch(
    sampleCandidate.skills,
    sampleRequirement.requiredSkills,
    sampleRequirement.preferredSkills,
  );
  assert(result.score > 80, 'Skill 高匹配：分数应 > 80');
  assert(result.matched.length >= 3, 'Skill 高匹配：至少匹配 3 个技能');
  assert(result.missing.length === 0, 'Skill 高匹配：无缺失技能');
}

{
  // 部分匹配
  const result = calculateSkillMatch(
    sampleCandidate.skills,
    [
      { skillId: 'sk-001', skillName: 'Vue3', minLevel: 'advanced' },
      { skillId: 'sk-999', skillName: 'Rust', minLevel: 'intermediate' },
    ],
  );
  assert(result.score > 0 && result.score < 100, 'Skill 部分匹配：分数应在 0-100 之间');
  assert(result.missing.length === 1, 'Skill 部分匹配：缺失 1 个技能');
  assert(result.missing[0].skillName === 'Rust', 'Skill 部分匹配：缺失的是 Rust');
}

{
  // 无要求
  const result = calculateSkillMatch(sampleCandidate.skills, [], []);
  assertEqual(result.score, 100, 'Skill 无要求：满分');
}

{
  // 全部不匹配
  const result = calculateSkillMatch(
    sampleCandidate.skills,
    [{ skillId: 'sk-999', skillName: 'COBOL', minLevel: 'expert' }],
  );
  assert(result.score === 0, 'Skill 全不匹配：0 分');
  assert(result.missing.length === 1, 'Skill 全不匹配：缺失 1 个');
}

// ═══════════════════════════════════════════════════════════
// Case 3: Experience Match 维度计算
// ═══════════════════════════════════════════════════════════
console.log('── Case 3: Experience Match 维度计算 ──');

{
  // 经验超出要求
  const result = calculateExperienceMatch(
    sampleCandidate.yearsExperience, // 5 年
    sampleCandidate.industries,
    sampleCandidate.workExperiences,
    3, // 要求 3 年
    8,
    ['互联网'],
  );
  assert(result.score >= 80, 'Experience 超出：分数应 >= 80');
}

{
  // 经验不足
  const result = calculateExperienceMatch(
    1, // 1 年
    ['互联网'],
    [],
    5, // 要求 5 年
    undefined,
    ['互联网'],
  );
  assert(result.score < 50, 'Experience 不足：分数应 < 50');
}

{
  // 无经验要求
  const result = calculateExperienceMatch(
    5,
    ['互联网'],
    [],
    0,
    undefined,
    [],
  );
  assertEqual(result.score, 100, 'Experience 无要求：满分');
}

// ═══════════════════════════════════════════════════════════
// Case 4: Education Match 维度计算
// ═══════════════════════════════════════════════════════════
console.log('── Case 4: Education Match 维度计算 ──');

{
  // 学历达标 + 专业匹配
  const result = calculateEducationMatch(
    sampleCandidate.educations,
    '本科',
    ['计算机科学'],
  );
  assert(result.score >= 80, 'Education 达标：分数应 >= 80');
  assertEqual(result.degreeScore, 100, 'Education 学历达标：100');
}

{
  // 学历不达标
  const result = calculateEducationMatch(
    sampleCandidate.educations, // 本科
    '博士',
    [],
  );
  assert(result.score < 50, 'Education 不达标：分数应 < 50');
}

{
  // 无学历要求
  const result = calculateEducationMatch(sampleCandidate.educations, undefined, undefined);
  assert(result.score >= 50, 'Education 无要求：基础分 >= 50');
}

// ═══════════════════════════════════════════════════════════
// Case 5: Career Match 维度计算
// ═══════════════════════════════════════════════════════════
console.log('── Case 5: Career Match 维度计算 ──');

{
  // 地点匹配 + 开放求职
  const result = calculateCareerMatch(
    '前端架构',
    '深圳',
    true,
    '深圳',
    'hybrid',
  );
  assert(result.score >= 80, 'Career 匹配：分数应 >= 80');
  assertEqual(result.locationScore, 100, 'Career 地点匹配：100');
  assertEqual(result.availabilityScore, 100, 'Career 开放求职：100');
}

{
  // 地点不匹配 + 不开放求职
  const result = calculateCareerMatch(
    '前端架构',
    '成都',
    false,
    '深圳',
    'onsite',
  );
  assert(result.score < 70, 'Career 不匹配：分数应 < 70');
  assertEqual(result.availabilityScore, 50, 'Career 不开放：50');
}

// ═══════════════════════════════════════════════════════════
// Case 6: 综合分计算
// ═══════════════════════════════════════════════════════════
console.log('── Case 6: 综合分计算 ──');

{
  // 手动验证：skill=90, exp=80, edu=70, career=90, 默认权重
  const score = calculateOverallScore(
    { skill: 90, experience: 80, education: 70, career: 90 },
    { skill: 0.40, experience: 0.30, education: 0.15, career: 0.15 },
  );
  // 90*0.4 + 80*0.3 + 70*0.15 + 90*0.15 = 36 + 24 + 10.5 + 13.5 = 84
  assertEqual(score, 84, 'Overall 手动验证：84');
}

{
  // 全满分
  const score = calculateOverallScore(
    { skill: 100, experience: 100, education: 100, career: 100 },
  );
  assertEqual(score, 100, 'Overall 全满分：100');
}

{
  // 全零分
  const score = calculateOverallScore(
    { skill: 0, experience: 0, education: 0, career: 0 },
  );
  assertEqual(score, 0, 'Overall 全零分：0');
}

// ═══════════════════════════════════════════════════════════
// Case 7: 风险标记
// ═══════════════════════════════════════════════════════════
console.log('── Case 7: 风险标记 ──');

{
  // 技能缺失 → HIGH 风险
  const weakCandidate: CandidateData = {
    ...sampleCandidate,
    skills: [], // 无技能
  };
  const result = matchCandidate(weakCandidate, sampleRequirement);
  const highRisks = result.riskFlags.filter((r: any) => r.severity === 'high');
  assert(highRisks.length > 0, 'Risk 技能缺失：应有 HIGH 风险');
}

{
  // 不开放求职 → MEDIUM 风险
  const closedCandidate: CandidateData = {
    ...sampleCandidate,
    openToOpportunity: false,
  };
  const result = matchCandidate(closedCandidate, sampleRequirement);
  const notOpenRisk = result.riskFlags.find((r: any) => r.type === 'not_open');
  assert(notOpenRisk !== undefined, 'Risk 不开放求职：应有 MEDIUM 风险');
}

{
  // 完美候选人 → 无 HIGH 风险
  const result = matchCandidate(sampleCandidate, sampleRequirement);
  const highRisks = result.riskFlags.filter((r: any) => r.severity === 'high');
  assert(highRisks.length === 0, 'Risk 完美候选：无 HIGH 风险');
}

// ═══════════════════════════════════════════════════════════
// Case 8: 证据链完整性
// ═══════════════════════════════════════════════════════════
console.log('── Case 8: 证据链完整性 ──');

{
  const result = matchCandidate(sampleCandidate, sampleRequirement);
  assert(result.evidence.length > 0, 'Evidence 非空');

  for (const ev of result.evidence) {
    assert(ev.claim.length > 0, 'Evidence claim 非空');
    assert(ev.sourceType.length > 0, 'Evidence sourceType 非空');
    assert(ev.sourceId.length > 0, 'Evidence sourceId 非空');
    assert(ev.confidence >= 0 && ev.confidence <= 1, 'Evidence confidence 范围');
  }
}

{
  // 技能匹配证据
  const result = matchCandidate(sampleCandidate, sampleRequirement);
  const skillEvidence = result.evidence.filter((e) => e.evidenceType === 'skill_match');
  assert(skillEvidence.length > 0, 'Evidence 技能匹配：至少 1 条');
}

// ═══════════════════════════════════════════════════════════
// Case 9: 数据边界验证
// ═══════════════════════════════════════════════════════════
console.log('── Case 9: 数据边界验证 ──');

{
  // matchCandidate 不修改 Candidate Domain
  const candidateCopy = JSON.parse(JSON.stringify(sampleCandidate));
  matchCandidate(sampleCandidate, sampleRequirement);
  assertEqual(
    JSON.stringify(sampleCandidate),
    JSON.stringify(candidateCopy),
    'Boundary：matchCandidate 不修改输入数据',
  );
}

{
  // 证据 sourceId 指向 Candidate Domain 记录
  const result = matchCandidate(sampleCandidate, sampleRequirement);
  const workExpEvidence = result.evidence.filter((e) => e.sourceType === 'work_experience');
  for (const ev of workExpEvidence) {
    const found = sampleCandidate.workExperiences.find((we) => we.id === ev.sourceId);
    assert(found !== undefined, 'Evidence sourceId 指向真实 WorkExperience');
  }
}

// ═══════════════════════════════════════════════════════════
// Case 10: 边界条件
// ═══════════════════════════════════════════════════════════
console.log('── Case 10: 边界条件 ──');

{
  // 空候选人 + 空要求
  const emptyCandidate: CandidateData = {
    profileId: 'prof-empty',
    candidateId: 'cand-empty',
    yearsExperience: 0,
    currentLevel: null,
    currentCity: null,
    currentCompany: null,
    openToOpportunity: false,
    careerDirection: null,
    industries: [],
    skills: [],
    workExperiences: [],
    educations: [],
  };
  const emptyReq: JobRequirementData = {
    id: 'req-empty',
    requiredSkills: [],
    experienceMin: 0,
  };
  const result = matchCandidate(emptyCandidate, emptyReq);
  assert(result.score >= 0 && result.score <= 100, 'Edge 空数据：Score 在范围内');
}

{
  // 极端权重
  const score = calculateOverallScore(
    { skill: 100, experience: 0, education: 0, career: 0 },
    { skill: 1.0, experience: 0, education: 0, career: 0 },
  );
  assertEqual(score, 100, 'Edge 极端权重：只看 Skill');
}

// ═══════════════════════════════════════════════════════════
// 汇总
// ═══════════════════════════════════════════════════════════
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════');

if (failures.length > 0) {
  console.log('');
  console.log('Failures:');
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
} else {
  console.log('');
  console.log('  ✅ ALL PASSED');
  process.exit(0);
}
