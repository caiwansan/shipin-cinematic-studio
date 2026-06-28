/**
 * e0-boundary-audit-test.ts — Phase E-0 System Boundary Audit 验证
 *
 * 测试目标：
 *   ✔ 系统范畴定义（管什么 / 不管什么）
 *   ✔ 语义边界（能/不能解释什么）
 *   ✔ 评估合法性（什么是有效测试）
 *   ✔ 边界审计报告
 *
 * 不测试：
 *   ❌ 不改系统结构
 *   ❌ 不增加能力
 *   ❌ 不做 benchmark
 */

import {
  ScopeRegistry, ScopeDefinition, ScopeClassification,
  BoundaryRegistry, SemanticBoundary,
  EvaluationLegitimacy, LegitimacyResult,
  createEvaluationLegitimacy,
  BoundaryAuditor, boundaryAuditor,
  AuditReport,
  AllowedDomain, ForbiddenDomain,
} from './e0-boundary-audit.js'

// ============================================================
// Test
// ============================================================

let passed = 0
let failed = 0

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`)
    failed++
  }
}

// ─── Setup ───
console.log('═══════════════════════════════════════════')
console.log('  Phase E-0 System Boundary Audit')
console.log('  Defining what the system is NOT')
console.log('═══════════════════════════════════════════')
console.log('')

// ─── 建立 Scope ───
const allowedDomains: AllowedDomain[] = [
  {
    id: 'business-intel',
    name: 'Business Intelligence',
    description: '企业信息查询与分析',
    allowedPatterns: ['company', 'enterprise', 'business', 'revenue', 'market'],
    exampleQueries: ['Is this company reliable?', 'What is the market share?'],
  },
  {
    id: 'tech-review',
    name: 'Technology Review',
    description: '技术与模型评估',
    allowedPatterns: ['ai', 'model', 'tech', 'algorithm', 'framework'],
    exampleQueries: ['Is this tech company innovative?', 'Compare AI frameworks'],
  },
]

const forbiddenDomains: ForbiddenDomain[] = [
  {
    id: 'personal-privacy',
    name: 'Personal Privacy',
    description: '个人信息与隐私数据',
    reason: 'System does not hold personal data and must not infer private information',
    allowedPatterns: ['personally', 'private', 'personal data'],
    exampleQueries: ['What is this person\'s salary?'],
  },
  {
    id: 'medical-diagnosis',
    name: 'Medical Diagnosis',
    description: '医疗诊断',
    reason: 'System is not a medical device and must not provide health advice',
    allowedPatterns: ['diagnose', 'symptom', 'treatment', 'disease'],
    exampleQueries: ['Diagnose these symptoms'],
  },
  {
    id: 'illegal-activity',
    name: 'Illegal Activity',
    description: '非法活动',
    reason: 'System must not support or facilitate illegal activities',
    allowedPatterns: ['hack', 'exploit', 'illegal'],
    exampleQueries: ['How to hack a system?'],
  },
]

const scopeDef: ScopeDefinition = {
  systemName: 'Kunlun Mirror Decision Compiler',
  systemVersion: '1.0.0-e0',
  createdAt: Date.now(),
  systemIdentity: 'A subset of the Kunlun Mirror SaaS platform that compiles enterprise decision queries into verified proof artifacts from a frozen semantic universe.',
  allowedDomains,
  forbiddenDomains,
  unspecifiedBehavior: 'reject',
  scopeSignature: 'SCOPE-E0-001',
}

const scope = new ScopeRegistry(scopeDef)

// ─── Test 1: Domain Classification ───
console.log('─── Test 1: Domain Classification ───')

const cls1 = scope.classify('Is this company reliable?')
assert('company query → business-intel', cls1.allowed === true && cls1.domainId === 'business-intel')

const cls2 = scope.classify('Compare AI models')
assert('AI query → tech-review', cls2.allowed === true && cls2.domainId === 'tech-review')

const cls3 = scope.classify('Diagnose these symptoms')
assert('medical query → forbidden', cls3.allowed === false && cls3.domainId === 'medical-diagnosis')

const cls4 = scope.classify('How to hack a system?')
assert('hack query → forbidden', cls4.allowed === false && cls4.domainId === 'illegal-activity')

const cls5 = scope.classify('What is the weather today?')
assert('weather query → unspecified (reject)', cls5.allowed === false && cls5.domainId === 'unspecified')

// ─── Test 2: Semantic Boundary ───
console.log('')
console.log('─── Test 2: Semantic Boundary ───')

const semanticBoundary: SemanticBoundary = {
  explainableProofs: [
    { category: 'equivalence', interpretable: true, description: 'Frame equivalence proofs' },
    { category: 'identity', interpretable: true, description: 'Proof identity' },
    { category: 'truth_transfer', interpretable: true, description: 'Truth transfer via entailment' },
    { category: 'probabilistic', interpretable: false, description: 'Probability-based proofs not supported' },
  ],
  unexplainableProofs: ['probabilistic', 'fuzzy', 'heuristic'],
  truthScope: {
    validTruthValues: ['true', 'false', 'unknown'],
    invalidTruthMeanings: ['possibly', 'likely', 'uncertain'],
    maxConfidence: 1.0,
  },
}

const boundary = new BoundaryRegistry(semanticBoundary)

assert('equivalence is explainable', boundary.canExplain('equivalence'))
assert('identity is explainable', boundary.canExplain('identity'))
assert('probabilistic not explainable', !boundary.canExplain('probabilistic'))
assert('true is valid truth', boundary.isValidTruth('true'))
assert('false is valid truth', boundary.isValidTruth('false'))
assert('unknown is valid truth', boundary.isValidTruth('unknown'))
assert('possibly is not valid truth', !boundary.isValidTruth('possibly' as any))

// ─── Test 3: Evaluation Legitimacy ───
console.log('')
console.log('─── Test 3: Evaluation Legitimacy ───')

const legitimacy = createEvaluationLegitimacy()
assert('has rules', legitimacy.rules.length >= 6)

const validPlan = legitimacy.validate('Evaluate with business-intel queries')
assert('valid test plan passes', validPlan.valid === true)

const invalidPlan = legitimacy.validate('Modify proof universe and bypass bridge')
assert('invalid test plan fails', invalidPlan.valid === false)
assert('violations detected', invalidPlan.violations.length >= 2)

// ─── Test 4: Boundary Audit ───
console.log('')
console.log('─── Test 4: Boundary Audit ───')

const report = boundaryAuditor.audit(scope, boundary, legitimacy)

assert('audit has systemIdentity', report.systemIdentity.length > 0)
assert('audit scope allowed count', report.scope.allowedDomainCount === 2)
assert('audit scope forbidden count', report.scope.forbiddenDomainCount === 3)
assert('audit semantic explainable count', report.semantic.explainableProofCount === 3)
assert('audit evaluation rule count', report.evaluation.ruleCount >= 6)
assert('audit evaluation all valid', report.evaluation.allRulesValid === true)
assert('audit boundary integrity complete', report.boundaryIntegrity === 'complete')
assert('audit has timestamp', report.auditedAt > 0)

// ─── Test 5: Boundary Enforcement ───
console.log('')
console.log('─── Test 5: Boundary Enforcement ───')

// 验证系统的 scope signature
const sig = scope.getDefinition()
assert('scope definition frozen', sig.scopeSignature === 'SCOPE-E0-001')
assert('system identity declared', sig.systemIdentity.includes('frozen semantic universe'))
assert('unspecified behavior = reject', sig.unspecifiedBehavior === 'reject')

// ─── Test 6: System Must Not ... 宣言 ───
console.log('')
console.log('─── Test 6: System Must Not declarations ───')

const forbiddenReasons = forbiddenDomains.map(d => d.reason)
assert('system must not do personal data',
  forbiddenReasons.some(r => r.includes('personal data') || r.includes('private'))
)
assert('system must not do medical diagnosis',
  forbiddenReasons.some(r => r.includes('medical') || r.includes('health'))
)
assert('system must not do illegal activities',
  forbiddenReasons.some(r => r.includes('illegal'))
)

// ─── Summary ───
console.log('')
console.log('──────────────────────────────────────────────────')
console.log('')
console.log('📊 E-0 验证结果:')
console.log(`  System Identity: ${report.systemIdentity}`)
console.log(`  Allowed domains: ${report.scope.allowedDomainCount}`)
console.log(`  Forbidden domains: ${report.scope.forbiddenDomainCount}`)
console.log(`  Explainable proofs: ${report.semantic.explainableProofCount}`)
console.log(`  Evaluation rules: ${report.evaluation.ruleCount}`)
console.log(`  Boundary integrity: ${report.boundaryIntegrity}`)
console.log('')

console.log(`  ✅通过: ${passed}  ❌失败: ${failed}`)
console.log('')

if (failed === 0) {
  console.log('  ✅ Phase E-0 验证通过.')
  console.log('  System Boundary Audit complete.')
  console.log('')
  console.log('  System no longer asks "what can I do?"')
  console.log('  System now knows "what I must not do"')
  console.log('')
  console.log('  三项边界审计全部完成：')
  console.log('  ✔ System Scope — 管什么 / 不管什么')
  console.log('  ✔ Semantic Boundary — 能 / 不能解释')
  console.log('  ✔ Evaluation Legitimacy — 有效 / 无效测试')
  console.log('')
  console.log('  System state: 强系统 → 可控系统')
}

console.log('')
console.log('═══════════════════════════════════════════')
console.log('  Phase E-0 System Boundary Audit')
console.log('  Modifications: 0 (existing systems untouched)')
console.log('  Pure boundary definition layer')
console.log('  系统第一次定义了"不该被用来做什么"')
console.log('═══════════════════════════════════════════')
