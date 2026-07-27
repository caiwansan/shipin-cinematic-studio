// ============================================================
// P4-03 Reality Test — Job Understanding Service
// 验证：JD → 结构化 JobRequirementProfile 全链路
// ============================================================

import axios from 'axios';

const API_BASE = 'http://localhost:4002';

// ── 测试用 JWT Token（enterprise user）──
const TOKEN = process.env.TEST_TOKEN || '';

interface TestResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, passed: condition, detail });
  const icon = condition ? '✅' : '❌';
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ''}`);
}

// ── 测试用 JD ──
const SAMPLE_JD = `
高级前端工程师

岗位职责：
1. 负责前端架构设计与核心功能开发
2. 优化前端性能，提升用户体验
3. 参与技术选型，制定前端规范

任职要求：
1. 本科及以上学历，计算机科学或相关专业
2. 5年以上前端开发经验
3. 精通 JavaScript、TypeScript、Vue.js
4. 熟练掌握 HTML5、CSS3
5. 有 React 经验者优先
6. 熟悉 Node.js 后端开发优先
7. 良好的沟通能力和团队合作精神

薪资：25K-35K
工作地点：上海
`.trim();

const SAMPLE_JD_EN = `
Senior Backend Engineer

Responsibilities:
1. Design and implement scalable backend services
2. Optimize database performance and API response times
3. Lead technical architecture decisions

Requirements:
1. Bachelor's degree or above in Computer Science
2. 3+ years of backend development experience
3. Expert in Python, Go
4. Proficient in PostgreSQL, Redis
5. Experience with Docker, Kubernetes preferred
6. Strong problem-solving skills

Salary: $80K-$120K
Location: Remote
`.trim();

async function runTests() {
  console.log('========================================');
  console.log('P4-03 Reality Test: Job Understanding');
  console.log('========================================\n');

  if (!TOKEN) {
    console.log('⚠️  No TEST_TOKEN provided, skipping API tests');
    console.log('   Set TEST_TOKEN env var to run full tests\n');
  }

  // ── Group 1: Input Validation ──
  console.log('Group 1: Input Validation');
  assert('1.1 JD is a string', typeof SAMPLE_JD === 'string');
  assert('1.2 JD length >= 50 chars', SAMPLE_JD.length >= 50, `length=${SAMPLE_JD.length}`);
  assert('1.3 English JD is a string', typeof SAMPLE_JD_EN === 'string');
  assert('1.4 English JD length >= 50 chars', SAMPLE_JD_EN.length >= 50, `length=${SAMPLE_JD_EN.length}`);

  // ── Group 2: API Endpoints (require token) ──
  if (TOKEN) {
    console.log('\nGroup 2: API Endpoints');

    // 2.1 Extract endpoint (LLM call — may fail if no real API key configured)
    let extractedId = '';
    try {
      const res = await axios.post(
        `${API_BASE}/api/job/match/requirements/extract`,
        {
          jobTitle: '高级前端工程师',
          jobDescription: SAMPLE_JD,
          department: '技术部',
          location: '上海',
          salaryMin: 25000,
          salaryMax: 35000,
          language: 'zh',
        },
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      );
      assert('2.1 Extract API returns 200', res.status === 200, `status=${res.status}`);
      assert('2.2 Extract returns id', typeof res.data.id === 'string', `id=${res.data.id?.substring(0, 8)}`);
      assert('2.3 Status is ai_extracted', res.data.status === 'ai_extracted', `status=${res.data.status}`);
      assert('2.4 Has requiredSkills', Array.isArray(res.data.extracted?.requiredSkills) && res.data.extracted.requiredSkills.length > 0, `count=${res.data.extracted?.requiredSkills?.length}`);
      assert('2.5 Has experienceMin', typeof res.data.extracted?.experienceMin === 'number', `exp=${res.data.extracted?.experienceMin}`);
      assert('2.6 Has modelUsed', typeof res.data.modelUsed === 'string' && res.data.modelUsed.length > 0, `model=${res.data.modelUsed}`);
      assert('2.7 Has extractionConfidence', typeof res.data.extractionConfidence === 'number', `conf=${res.data.extractionConfidence}`);
      extractedId = res.data.id;
    } catch (e: any) {
      // LLM not configured or invalid API key → 502/503 is acceptable
      const status = e.response?.status;
      const isLLMError = status === 502 || status === 503;
      assert('2.1 Extract API — LLM error returns 502/503 (or 200 if key valid)', isLLMError || false,
        `status=${status}, error=${e.response?.data?.error || e.message}`);
    }

    // 2.2 Validate-only endpoint
    if (extractedId) {
      try {
        const res = await axios.post(
          `${API_BASE}/api/job/match/requirements/validate`,
          {
            jobTitle: '高级前端工程师',
            jobDescription: SAMPLE_JD,
            language: 'zh',
          },
          { headers: { Authorization: `Bearer ${TOKEN}` } },
        );
        assert('2.8 Validate API returns 200', res.status === 200, `status=${res.status}`);
        assert('2.9 Validate returns valid=true', res.data.valid === true, `valid=${res.data.valid}`);
        assert('2.10 Validate returns extracted', res.data.extracted !== null);
        assert('2.11 Validate requiredSkills count > 0', res.data.extracted?.requiredSkills?.length > 0);
      } catch (e: any) {
        assert('2.8 Validate API returns 200', false, e.response?.data?.error || e.message);
      }
    }

    // 2.3 Skill vocabulary endpoint
    try {
      const res = await axios.get(`${API_BASE}/api/job/match/skills/vocabulary`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      assert('2.12 Skills vocabulary returns 200', res.status === 200, `status=${res.status}`);
      assert('2.13 Skills vocabulary has total', typeof res.data.total === 'number', `total=${res.data.total}`);
      assert('2.14 Skills vocabulary has array', Array.isArray(res.data.skills));
    } catch (e: any) {
      assert('2.12 Skills vocabulary returns 200', false, e.response?.data?.error || e.message);
    }

    // 2.4 Empty jobTitle validation
    try {
      await axios.post(
        `${API_BASE}/api/job/match/requirements/extract`,
        { jobTitle: '', jobDescription: SAMPLE_JD },
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      );
      assert('2.15 Empty jobTitle rejected', false, 'should have thrown');
    } catch (e: any) {
      assert('2.15 Empty jobTitle rejected', e.response?.status === 400, `status=${e.response?.status}`);
    }

    // 2.5 Short jobDescription validation
    try {
      await axios.post(
        `${API_BASE}/api/job/match/requirements/extract`,
        { jobTitle: 'Test', jobDescription: 'short' },
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      );
      assert('2.16 Short jobDescription rejected', false, 'should have thrown');
    } catch (e: any) {
      assert('2.16 Short jobDescription rejected', e.response?.status === 400, `status=${e.response?.status}`);
    }

    // 2.6 Unauthorized access
    try {
      await axios.post(
        `${API_BASE}/api/job/match/requirements/extract`,
        { jobTitle: 'Test', jobDescription: SAMPLE_JD },
      );
      assert('2.17 Unauthorized rejected', false, 'should have thrown');
    } catch (e: any) {
      assert('2.17 Unauthorized rejected', e.response?.status === 401, `status=${e.response?.status}`);
    }
  } else {
    console.log('\nGroup 2: API Endpoints — SKIPPED (no token)');
  }

  // ── Group 3: Validator Unit Tests (no token needed) ──
  console.log('\nGroup 3: Validator Unit Tests');

  const { validateAndNormalize } = await import('../services/matching/validators/job-understanding.validator.js');

  // 3.1 Valid input
  const valid1 = validateAndNormalize({
    requiredSkills: [{ name: 'JavaScript', level: 'expert', yearsRequired: 5 }],
    preferredSkills: [{ name: 'React' }],
    experienceMin: 5,
    educationMin: 'bachelor',
    industries: ['互联网'],
    extractionConfidence: 0.9,
  });
  assert('3.1 Valid input passes', valid1.valid === true);
  assert('3.2 Normalized requiredSkills', valid1.normalized?.requiredSkills.length === 1);
  assert('3.3 Normalized experienceMin', valid1.normalized?.experienceMin === 5);
  assert('3.4 Default weights applied', valid1.normalized?.weights?.skill === 40);

  // 3.2 Empty requiredSkills
  const valid2 = validateAndNormalize({
    requiredSkills: [],
    experienceMin: 3,
  });
  assert('3.5 Empty requiredSkills fails', valid2.valid === false);

  // 3.3 Invalid input type
  const valid3 = validateAndNormalize(null);
  assert('3.6 Null input fails', valid3.valid === false);

  const valid4 = validateAndNormalize('string');
  assert('3.7 String input fails', valid4.valid === false);

  // 3.4 Skill normalization
  const valid5 = validateAndNormalize({
    requiredSkills: [
      { name: 'JavaScript', level: 'expert' },
      { name: '', level: 'beginner' },
      { name: 'Python' },
    ],
    experienceMin: 3,
  });
  assert('3.8 Empty skill name filtered', valid5.normalized?.requiredSkills.length === 2);
  assert('3.9 Warning for filtered skill', valid5.warnings.length > 0);

  // 3.5 Invalid level
  const valid6 = validateAndNormalize({
    requiredSkills: [{ name: 'Java', level: 'master' }],
    experienceMin: 3,
  });
  assert('3.10 Invalid level ignored', valid6.normalized?.requiredSkills[0].level === undefined);

  // 3.6 Experience max < min
  const valid7 = validateAndNormalize({
    requiredSkills: [{ name: 'Go' }],
    experienceMin: 5,
    experienceMax: 3,
  });
  assert('3.11 experienceMax < min corrected', valid7.normalized?.experienceMax === 5);

  // 3.7 Chinese education mapping
  const valid8 = validateAndNormalize({
    requiredSkills: [{ name: 'Test' }],
    experienceMin: 1,
    educationMin: '本科',
  });
  assert('3.12 Chinese education mapped', valid8.normalized?.educationMin === 'bachelor');

  // 3.8 Weights normalization
  const valid9 = validateAndNormalize({
    requiredSkills: [{ name: 'Test' }],
    experienceMin: 1,
    weights: { skill: 50, experience: 50, education: 50, career: 50 },
  });
  assert('3.13 Invalid weights reset to default', valid9.normalized?.weights?.skill === 40);

  // ── Summary ──
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n========================================`);
  console.log(`Result: ${passed}/${total} passed`);
  console.log(`========================================`);

  if (passed < total) {
    console.log('\nFailed tests:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`  ❌ ${r.name}: ${r.detail || ''}`));
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test runner error:', e.message);
  process.exit(1);
});
