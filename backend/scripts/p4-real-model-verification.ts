/**
 * P4-03.5 Real Model Verification Script
 *
 * 使用 3 个真实 JD 用例，验证 Job Understanding Service 的 LLM 提取质量。
 *
 * 前置条件：
 *   1. API 服务运行中（port 4002）
 *   2. Model Router 已配置真实 LLM Key
 *   3. 测试用户 Token 有效
 *
 * 用法：
 *   npx tsx scripts/p4-real-model-verification.ts
 */

import axios from 'axios';

const API_BASE = process.env.API_BASE || 'http://localhost:4002';
const TOKEN = process.env.TEST_TOKEN || '';

// ============================================================
// Test Cases
// ============================================================

interface ExpectedResult {
  requiredSkills: string[];
  preferredSkills?: string[];
  experienceMin: number;
  jobLevel?: string;
  industries?: string[];
}

interface TestCase {
  name: string;
  input: {
    jobTitle: string;
    jobDescription: string;
    department?: string;
    location?: string;
    salaryMin?: number;
    salaryMax?: number;
    language?: string;
  };
  expected: ExpectedResult;
}

const TEST_CASES: TestCase[] = [
  {
    name: '高级前端工程师',
    input: {
      jobTitle: '高级前端工程师',
      jobDescription: `职位：高级前端工程师

岗位职责：
1. 负责企业级 Web 应用前端架构设计和开发；
2. 参与前端工程体系建设，提升应用性能和用户体验；
3. 与后端、产品、设计团队协作完成业务交付。

任职要求：
1. 5年以上前端开发经验；
2. 熟练掌握 Vue3、TypeScript、JavaScript；
3. 熟悉 Nuxt、React、Webpack 等前端工程化工具；
4. 有大型 SaaS 或企业应用开发经验；
5. 具备良好的代码规范意识和系统设计能力。`,
      department: '技术部',
      location: '上海',
      salaryMin: 25000,
      salaryMax: 35000,
      language: 'zh',
    },
    expected: {
      requiredSkills: ['Vue3', 'TypeScript', 'JavaScript'],
      preferredSkills: ['Nuxt', 'React', 'Webpack'],
      experienceMin: 5,
      jobLevel: 'Senior',
    },
  },
  {
    name: '高级 Java 后端工程师',
    input: {
      jobTitle: '高级 Java 后端工程师',
      jobDescription: `职位：高级 Java 后端工程师

岗位职责：
负责企业级服务端系统设计、开发和维护。

任职要求：
1. 5年以上 Java 后端开发经验；
2. 熟悉 Spring Boot、Spring Cloud 微服务体系；
3. 熟悉 MySQL、Redis 等数据库技术；
4. 熟悉分布式系统设计；
5. 有高并发系统开发经验。`,
      department: '技术部',
      location: '北京',
      salaryMin: 30000,
      salaryMax: 45000,
      language: 'zh',
    },
    expected: {
      requiredSkills: ['Java', 'Spring Boot'],
      preferredSkills: ['MySQL', 'Redis', 'Spring Cloud'],
      experienceMin: 5,
      jobLevel: 'Senior',
    },
  },
  {
    name: '高级产品经理',
    input: {
      jobTitle: '高级产品经理',
      jobDescription: `职位：高级产品经理

岗位职责：
负责 SaaS 产品规划、需求分析和产品生命周期管理。

任职要求：
1. 5年以上互联网产品经验；
2. 熟悉 B 端产品设计流程；
3. 具备用户研究、需求分析、数据分析能力；
4. 有 AI 产品或企业服务产品经验优先；
5. 具备跨团队协作能力。`,
      department: '产品部',
      location: '深圳',
      salaryMin: 25000,
      salaryMax: 40000,
      language: 'zh',
    },
    expected: {
      requiredSkills: ['产品规划', '需求分析'],
      preferredSkills: ['用户研究', '数据分析'],
      experienceMin: 5,
      jobLevel: 'Senior',
      industries: ['SaaS', 'AI'],
    },
  },
];

// ============================================================
// Validation Rules
// ============================================================

interface ValidationCheck {
  rule: string;
  pass: boolean;
  detail: string;
  severity: 'ERROR' | 'WARN' | 'INFO';
}

interface CaseResult {
  name: string;
  checks: ValidationCheck[];
  score: number; // percentage
  status: 'PASS' | 'WARN' | 'FAIL';
  raw?: any;
}

function validateCase(tc: TestCase, actual: any): CaseResult {
  const checks: ValidationCheck[] = [];
  const extracted = actual?.extracted || {};

  // 1. Required skills coverage
  const actualRequired: string[] = (extracted.requiredSkills || []).map((s: any) =>
    typeof s === 'string' ? s : s?.name || '',
  );
  const expectedReq = tc.expected.requiredSkills;
  const hitReq = expectedReq.filter((s) => actualRequired.includes(s));
  const reqCoverage = hitReq.length / expectedReq.length;
  checks.push({
    rule: '技能覆盖率 (requiredSkills)',
    pass: reqCoverage >= 0.8,
    detail: `命中 ${hitReq.length}/${expectedReq.length} — ${hitReq.join(', ')}${hitReq.length < expectedReq.length ? ` | 缺失: ${expectedReq.filter(s => !hitReq.includes(s)).join(', ')}` : ''}`,
    severity: reqCoverage >= 0.8 ? 'INFO' : 'ERROR',
  });

  // 2. Preferred skills coverage (at least 2 if expected)
  if (tc.expected.preferredSkills && tc.expected.preferredSkills.length > 0) {
    const actualPreferred: string[] = (extracted.preferredSkills || []).map((s: any) =>
      typeof s === 'string' ? s : s?.name || '',
    );
    const allSkills = [...actualRequired, ...actualPreferred];
    const hitPref = tc.expected.preferredSkills.filter((s) => allSkills.includes(s));
    const prefCoverage = hitPref.length / tc.expected.preferredSkills.length;
    checks.push({
      rule: '技能覆盖率 (preferredSkills)',
      pass: prefCoverage >= 0.5,
      detail: `命中 ${hitPref.length}/${tc.expected.preferredSkills.length} — ${hitPref.join(', ') || '无'}`,
      severity: prefCoverage >= 0.5 ? 'INFO' : 'WARN',
    });
  }

  // 3. Hallucination detection: required skills not in JD
  const jdText = tc.input.jobDescription.toLowerCase();
  const hallucinations = actualRequired.filter((skill: string) => {
    // Check if the skill name appears in JD (rough check)
    const skillLower = skill.toLowerCase();
    // Common tech aliases
    const aliases: Record<string, string[]> = {
      'vue3': ['vue3', 'vue 3', 'vue.js 3'],
      'typescript': ['typescript', 'ts'],
      'javascript': ['javascript', 'js'],
      'spring boot': ['spring boot', 'springboot'],
      'spring cloud': ['spring cloud'],
      'mysql': ['mysql'],
      'redis': ['redis'],
      'java': ['java'],
    };
    const searchTerms = aliases[skillLower] || [skillLower];
    return !searchTerms.some((term) => jdText.includes(term));
  });
  checks.push({
    rule: '幻觉检测',
    pass: hallucinations.length === 0,
    detail: hallucinations.length === 0
      ? '无幻觉'
      : `发现幻觉技能: ${hallucinations.join(', ')}`,
    severity: hallucinations.length === 0 ? 'INFO' : 'ERROR',
  });

  // 4. Experience accuracy
  const actualExpMin = extracted.experienceMin ?? actual?.experienceMin;
  const expCorrect = actualExpMin === tc.expected.experienceMin;
  checks.push({
    rule: '年限准确性',
    pass: expCorrect,
    detail: `期望: ${tc.expected.experienceMin}, 实际: ${actualExpMin}`,
    severity: expCorrect ? 'INFO' : 'ERROR',
  });

  // 5. Experience range consistency
  const actualExpMax = extracted.experienceMax ?? actual?.experienceMax;
  if (actualExpMax != null && actualExpMin != null) {
    checks.push({
      rule: '经验范围一致性',
      pass: actualExpMax >= actualExpMin,
      detail: `min=${actualExpMin}, max=${actualExpMax}`,
      severity: actualExpMax >= actualExpMin ? 'INFO' : 'WARN',
    });
  }

  // 6. Education reasonableness (should not invent degrees from unrelated context)
  const actualEdu = extracted.educationMin ?? actual?.educationMin;
  if (actualEdu && !tc.input.jobDescription.includes('学历') && !tc.input.jobDescription.includes('本科') && !tc.input.jobDescription.includes('硕士')) {
    checks.push({
      rule: '学历合理性',
      pass: false,
      detail: `JD 未提学历要求，但输出 educationMin=${actualEdu}`,
      severity: 'WARN',
    });
  } else {
    checks.push({
      rule: '学历合理性',
      pass: true,
      detail: `educationMin=${actualEdu || '未设置'}`,
      severity: 'INFO',
    });
  }

  // Score calculation
  const errorCount = checks.filter((c) => c.severity === 'ERROR' && !c.pass).length;
  const warnCount = checks.filter((c) => c.severity === 'WARN' && !c.pass).length;
  const passedCount = checks.filter((c) => c.pass).length;
  const score = Math.round((passedCount / checks.length) * 100);

  let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  if (errorCount > 0) status = 'FAIL';
  else if (warnCount > 0) status = 'WARN';

  return { name: tc.name, checks, score, status, raw: actual };
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('='.repeat(60));
  console.log('P4-03.5 Real Model Verification');
  console.log('='repeat(60));
  console.log(`API: ${API_BASE}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  if (!TOKEN) {
    console.log('⚠️  TEST_TOKEN not set. Set env var TEST_TOKEN=<jwt_token>');
    console.log('   Continuing with validation framework (no API calls)\n');
  }

  const results: CaseResult[] = [];

  for (const tc of TEST_CASES) {
    console.log(`\n${'━'.repeat(50)}`);
    console.log(`Case: ${tc.name}`);
    console.log(`${'━'.repeat(50)}`);

    if (!TOKEN) {
      console.log('  ⏳ Skipped (no token)');
      continue;
    }

    try {
      const res = await axios.post(
        `${API_BASE}/api/job/match/requirements/extract`,
        tc.input,
        { headers: { Authorization: `Bearer ${TOKEN}` }, timeout: 30000 },
      );

      console.log(`  Status: ${res.status}`);
      console.log(`  Model: ${res.data.modelUsed || 'unknown'}`);
      console.log(`  Confidence: ${res.data.extractionConfidence || 'N/A'}`);

      const result = validateCase(tc, res.data);
      results.push(result);

      for (const check of result.checks) {
        const icon = check.pass ? '✅' : check.severity === 'ERROR' ? '❌' : '⚠️';
        console.log(`  ${icon} ${check.rule}: ${check.detail}`);
      }

      console.log(`\n  Score: ${result.score}% — ${result.status}`);
    } catch (e: any) {
      const status = e.response?.status;
      const error = e.response?.data?.error || e.message;
      console.log(`  ❌ API Error: status=${status}, error=${error}`);

      if (status === 502 || status === 503) {
        console.log('  💡 LLM not configured or API key invalid.');
        console.log('     → Configure Model Router with a real LLM Key, then re-run.');
      }

      results.push({
        name: tc.name,
        checks: [{ rule: 'API 调用', pass: false, detail: `status=${status}: ${error}`, severity: 'ERROR' }],
        score: 0,
        status: 'FAIL',
      });
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary');
  console.log('='.repeat(60));

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${r.name}: ${r.score}% — ${r.status}`);
  }

  const totalScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0;
  const allPass = results.every((r) => r.status === 'PASS');

  console.log(`\n  Overall: ${totalScore}%`);
  console.log(`  Result: ${allPass ? '✅ ALL PASS — P4-03 Production Ready' : '❌ NOT YET — See details above'}`);
  console.log('='.repeat(60));

  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
