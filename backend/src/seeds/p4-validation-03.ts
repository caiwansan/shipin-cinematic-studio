// ============================================================
// P4-02 Validation-03: MatchExplanationService Reality Test
// 目标：验证 LLM 解释生成 + Evidence 约束 + Fallback 机制
// ============================================================

import { prisma } from '../utils/index.js';
import { matchExplanationService } from '../services/matching/services/match-explanation.service.js';
import { validateExplanation, generateTemplateExplanation, type EvidenceItem } from '../services/matching/validators/explanation.validator.js';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function main() {
  console.log('══════════════════════════════════════════════════════════');
  console.log(' P4-02 Validation-03: MatchExplanationService');
  console.log('══════════════════════════════════════════════════════════\n');

  // ── 获取测试数据 ──
  const matchResult = await prisma.talentMatchResult.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { jobRequirement: true },
  });

  if (!matchResult) {
    console.log('❌ No match result found, run P4-02 seed first');
    process.exit(1);
  }

  const evidenceRecords = await prisma.matchEvidence.findMany({
    where: { matchResultId: matchResult.id },
  });

  const evidenceList: EvidenceItem[] = evidenceRecords.map((e) => ({
    evidenceType: e.evidenceType,
    claim: e.claim,
    sourceType: e.sourceType,
    sourceId: e.sourceId,
    confidence: e.confidence,
  }));

  console.log(`Test data: matchResult=${matchResult.id}, score=${matchResult.score}, evidence=${evidenceList.length}\n`);

  // ──────────────────────────────────────────────────────────
  // Gate-1: Validator 基础功能
  // ──────────────────────────────────────────────────────────
  console.log('── Gate-1: Validator 基础功能 ──\n');

  // Gate-1.1: 有效 Explanation 通过校验
  const validOutput = {
    matchResultId: matchResult.id,
    generatedAt: new Date().toISOString(),
    modelUsed: 'test/model',
    explanationVersion: 'v1',
    summary: '候选人匹配度高',
    strengths: [{ claim: '技能匹配', evidenceIds: [evidenceList[0]?.sourceId || 'test'], category: 'skill' }],
    gaps: [],
    interviewSuggestions: [],
    riskWarnings: [],
    confidence: 0.9,
  };
  const v1 = validateExplanation(validOutput, evidenceList);
  assert(v1.valid, 'Gate-1.1: 有效 Explanation 通过校验');
  assert(v1.filtered.strengths === 0, 'Gate-1.1: 无过滤（strengths）');

  // Gate-1.2: 无 evidence 的 claim 被过滤
  const invalidOutput = {
    ...validOutput,
    strengths: [
      { claim: '技能匹配', evidenceIds: [evidenceList[0]?.sourceId || 'test'], category: 'skill' },
      { claim: '编造的优势', evidenceIds: ['fake-id-123'], category: 'skill' },
    ],
  };
  const v2 = validateExplanation(invalidOutput, evidenceList);
  assert(v2.filtered.strengths === 1, 'Gate-1.2: 无效 evidenceIds 的 claim 被过滤');
  assert(invalidOutput.strengths.length === 1, 'Gate-1.2: 过滤后只剩有效 claim');

  // Gate-1.3: 空 evidenceIds 被过滤
  const emptyIdsOutput = {
    ...validOutput,
    strengths: [{ claim: '无证据的优势', evidenceIds: [] }],
  };
  const v3 = validateExplanation(emptyIdsOutput, evidenceList);
  assert(v3.filtered.strengths === 1, 'Gate-1.3: 空 evidenceIds 的 claim 被过滤');

  // Gate-1.4: 超长 summary 触发警告
  const longSummaryOutput = {
    ...validOutput,
    summary: '超'.repeat(250),
  };
  const v4 = validateExplanation(longSummaryOutput, evidenceList);
  assert(v4.warnings.some((w) => w.includes('过长')), 'Gate-1.4: 超长 summary 触发警告');

  // Gate-1.5: 超过 5 条 strengths 被截断
  const tooManyOutput = {
    ...validOutput,
    strengths: Array.from({ length: 8 }, (_, i) => ({
      claim: `优势${i}`,
      evidenceIds: [evidenceList[0]?.sourceId || 'test'],
    })),
  };
  const v5 = validateExplanation(tooManyOutput, evidenceList);
  assert(tooManyOutput.strengths.length === 5, 'Gate-1.5: 超过 5 条 strengths 被截断到 5');
  assert(v5.warnings.some((w) => w.includes('超过')), 'Gate-1.5: 截断触发警告');

  // ──────────────────────────────────────────────────────────
  // Gate-2: Template Fallback
  // ──────────────────────────────────────────────────────────
  console.log('\n── Gate-2: Template Fallback ──\n');

  // Gate-2.1: Template 生成基础结构
  const breakdown = (matchResult.breakdown as any) || { skill: 80, experience: 70, education: 90, career: 85 };
  const matchedSkills = (matchResult.matchedSkills as any[]) || [];
  const missingSkills = (matchResult.missingSkills as any[]) || [];
  const riskFlags = (matchResult.riskFlags as any[]) || [];

  const tpl = generateTemplateExplanation({
    matchResultId: matchResult.id,
    score: matchResult.score,
    breakdown,
    matchedSkills,
    missingSkills,
    riskFlags,
    evidenceList,
  });

  assert(tpl.fallback === true, 'Gate-2.1: Template fallback 标记为 true');
  assert(tpl.explanationVersion === 'v1', 'Gate-2.1: 版本号 v1');
  assert(tpl.summary.length > 0, 'Gate-2.1: summary 非空');
  assert(tpl.modelUsed === 'template-fallback', 'Gate-2.1: modelUsed 标记');
  assert(tpl.confidence === 0.5, 'Gate-2.1: Template confidence = 0.5');

  // Gate-2.2: 高分候选人 summary 正确
  const highScore = generateTemplateExplanation({
    matchResultId: 'test',
    score: 92,
    breakdown: { skill: 95, experience: 90, education: 88, career: 92 },
    matchedSkills: [{ name: 'Vue3', required: true }],
    missingSkills: [],
    riskFlags: [],
    evidenceList,
  });
  assert(highScore.summary.includes('高度匹配'), 'Gate-2.2: 92 分 → 高度匹配');

  // Gate-2.3: 低分候选人 summary 正确
  const lowScore = generateTemplateExplanation({
    matchResultId: 'test',
    score: 30,
    breakdown: { skill: 30, experience: 30, education: 30, career: 30 },
    matchedSkills: [],
    missingSkills: [{ name: 'Python', required: true }],
    riskFlags: [{ type: 'skill_gap', severity: 'high', detail: '缺少核心技能' }],
    evidenceList,
  });
  assert(lowScore.summary.includes('较低'), 'Gate-2.3: 30 分 → 匹配度较低');

  // Gate-2.4: 缺失技能出现在 gaps 中
  assert(lowScore.gaps.length > 0, 'Gate-2.4: 缺失技能出现在 gaps 中');

  // Gate-2.5: 风险标记出现在 riskWarnings 中
  assert(lowScore.riskWarnings.length > 0, 'Gate-2.5: 风险标记出现在 riskWarnings 中');

  // ──────────────────────────────────────────────────────────
  // Gate-3: Service 集成（Template 模式）
  // ──────────────────────────────────────────────────────────
  console.log('\n── Gate-3: Service 集成（Template 模式）──\n');

  // Gate-3.1: Service.generateTemplate 正常返回
  try {
    const enterpriseId = matchResult.jobRequirement?.enterpriseId || '';
    const tplResult = await matchExplanationService.generateTemplate({
      matchResultId: matchResult.id,
      enterpriseId,
    });
    assert(tplResult !== null, 'Gate-3.1: generateTemplate 返回非 null');
    assert(tplResult.matchResultId === matchResult.id, 'Gate-3.1: matchResultId 匹配');
    assert(typeof tplResult.summary === 'string', 'Gate-3.1: summary 是字符串');
  } catch (e: any) {
    assert(false, 'Gate-3.1: generateTemplate 抛出异常', e.message);
  }

  // Gate-3.2: 不存在的 matchResultId 抛出 404
  try {
    await matchExplanationService.generateTemplate({
      matchResultId: '00000000-0000-0000-0000-000000000000',
      enterpriseId: 'test',
    });
    assert(false, 'Gate-3.2: 应该抛出异常');
  } catch (e: any) {
    assert(e.statusCode === 404, 'Gate-3.2: 不存在的 ID 抛出 404');
  }

  // ──────────────────────────────────────────────────────────
  // Gate-4: Service 集成（LLM 模式 — 可能 Fallback）
  // ──────────────────────────────────────────────────────────
  console.log('\n── Gate-4: Service 集成（LLM / Fallback）──\n');

  // Gate-4.1: Service.generateExplanation 正常返回（LLM 或 Fallback）
  try {
    const enterpriseId = matchResult.jobRequirement?.enterpriseId || '';
    const result = await matchExplanationService.generateExplanation({
      matchResultId: matchResult.id,
      enterpriseId,
      language: 'zh',
    });
    assert(result !== null, 'Gate-4.1: generateExplanation 返回非 null');
    assert(result.matchResultId === matchResult.id, 'Gate-4.1: matchResultId 匹配');
    assert(result.explanationVersion === 'v1', 'Gate-4.1: 版本号 v1');
    assert(result.summary.length > 0, 'Gate-4.1: summary 非空');
    assert(Array.isArray(result.strengths), 'Gate-4.1: strengths 是数组');
    assert(Array.isArray(result.gaps), 'Gate-4.1: gaps 是数组');
    assert(Array.isArray(result.interviewSuggestions), 'Gate-4.1: interviewSuggestions 是数组');
    assert(Array.isArray(result.riskWarnings), 'Gate-4.1: riskWarnings 是数组');
    assert(result.confidence >= 0 && result.confidence <= 1, 'Gate-4.1: confidence 在 0-1 之间');

    console.log(`  ℹ️  modelUsed: ${result.modelUsed}`);
    console.log(`  ℹ️  fallback: ${result.fallback}`);
    console.log(`  ℹ️  summary: ${result.summary}`);
    if (result.strengths.length > 0) {
      console.log(`  ℹ️  strengths[0]: ${result.strengths[0].claim} (evidenceIds: ${result.strengths[0].evidenceIds.length})`);
    }
  } catch (e: any) {
    assert(false, 'Gate-4.1: generateExplanation 抛出异常', e.message);
  }

  // ──────────────────────────────────────────────────────────
  // Gate-5: API 路由
  // ──────────────────────────────────────────────────────────
  console.log('\n── Gate-5: API 路由 ──\n');

  // Gate-5.1: 路由存在（服务已返回 401 说明路由注册成功）
  // 实际测试需要 JWT token，这里只验证路由已注册
  const healthCheck = await fetch('http://localhost:4002/api/job/match/explanation/test').then(r => r.status);
  assert(healthCheck === 401, 'Gate-5.1: 路由注册成功（返回 401 未授权）');

  // ──────────────────────────────────────────────────────────
  // 汇总
  // ──────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(` Result: ${passed}/${passed + failed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log(' Failed:');
    failures.forEach((f) => console.log(`   - ${f}`));
  }
  console.log('══════════════════════════════════════════════════════════');

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Validation crashed:', e);
  prisma.$disconnect();
  process.exit(1);
});
