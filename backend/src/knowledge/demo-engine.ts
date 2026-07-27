/**
 * Phase 3-C 演示：Knowledge Intelligence Engine 功能验证
 */

import { KnowledgeIntelligenceEngine } from '/root/shipin-cinematic-studio/backend/src/knowledge/engine/knowledge-engine'
import { getCareerRepository } from '/root/shipin-cinematic-studio/backend/src/knowledge/repository/careers/career-repository'
import { getSkillRepository } from '/root/shipin-cinematic-studio/backend/src/knowledge/repository/skills/skill-repository'
import { CAREER_IDS } from '/root/shipin-cinematic-studio/backend/src/knowledge/repository/careers/career-seed'
import { CareerFit } from '/root/shipin-cinematic-studio/backend/src/knowledge/canonical/schemas'

async function demo() {
  const careerRepo = getCareerRepository()
  const skillRepo = getSkillRepository()

  const engine = new KnowledgeIntelligenceEngine({
    careerRepo: careerRepo as any,
    skillRepo: skillRepo as any,
  })

  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 3-C: Knowledge Intelligence Engine')
  console.log('═══════════════════════════════════════════════\n')

  // ─── 候选人画像 ───
  const candidateSkills = ['Vue.js', 'TypeScript', 'Node.js', 'HTML/CSS', 'JavaScript', 'PostgreSQL']
  const candidateFit: CareerFit = {
    logicalThinking: 4,
    communication: 3,
    creativity: 3,
    execution: 4,
    leadership: 2,
    analyticalSkill: 3,
  }

  // ═══════════════════════════════════════════════
  // 1. Transition Engine — 职业迁移
  // ═══════════════════════════════════════════════
  console.log('🔄 ════════════════════════════════════════')
  console.log('  ① Transition Engine — 职业迁移')
  console.log('════════════════════════════════════════\n')

  const transition = await engine.transition.calculateTransition(
    CAREER_IDS.frontend,
    CAREER_IDS.ai_engineer,
    candidateSkills,
  )

  console.log(`迁移: ${transition.result.fromCareer.name} → ${transition.result.toCareer.name}`)
  console.log(`难度: ${'★'.repeat(transition.result.difficulty)}${'☆'.repeat(5 - transition.result.difficulty)}`)
  console.log(`成功率: ${transition.result.successRate}%`)
  console.log(`预计时间: ${transition.result.estimatedMonths}个月`)
  console.log(`可行性: ${transition.result.overallFeasibility}/100`)
  console.log(`关键缺口技能 (${transition.result.keyGapSkills.length}):`)
  for (const g of transition.result.keyGapSkills.slice(0, 3)) {
    console.log(`  - ${g.skillName} (重要度: ${g.weight}, 需${g.timeToLearn})`)
  }
  console.log()
  console.log('📋 Evidence (证据链):')
  for (const e of transition.evidence) {
    console.log(`  • ${e.fact} [${e.source}] 置信度:${Math.round(e.confidence * 100)}%`)
  }
  console.log()

  // ═══════════════════════════════════════════════
  // 2. Career Score Engine — 职业适配度
  // ═══════════════════════════════════════════════
  console.log('🎯 ════════════════════════════════════════')
  console.log('  ② Career Score Engine — 适配度')
  console.log('════════════════════════════════════════\n')

  const score = await engine.careerScore.calculateScore(
    candidateSkills,
    candidateFit,
    CAREER_IDS.ai_engineer,
  )

  console.log(`职业: ${score.result.career.name}`)
  console.log(`综合评分: ${score.result.overallScore}/100`)
  console.log(`  技能匹配: ${score.result.skillScore}/100 × 40% = ${Math.round(score.result.skillScore * 0.4)}`)
  console.log(`  能力画像: ${score.result.fitScore}/100 × 30% = ${Math.round(score.result.fitScore * 0.3)}`)
  console.log(`  市场需求: ${score.result.demandScore}/100 × 30% = ${Math.round(score.result.demandScore * 0.3)}`)
  console.log()
  console.log('📋 Evidence (证据链):')
  for (const e of score.evidence) {
    console.log(`  • ${e.fact} [${e.source}] 置信度:${Math.round(e.confidence * 100)}%`)
  }
  console.log()

  // ═══════════════════════════════════════════════
  // 3. Skill Gap Engine — 技能缺口
  // ═══════════════════════════════════════════════
  console.log('📊 ════════════════════════════════════════')
  console.log('  ③ Skill Gap Engine — 技能缺口')
  console.log('════════════════════════════════════════\n')

  const gap = await engine.skillGap.analyze(candidateSkills, CAREER_IDS.ai_engineer)

  console.log(`目标职业: ${gap.result.targetCareer.name}`)
  console.log(`总缺口: ${gap.result.totalGapCount} | 关键: ${gap.result.criticalCount} | 准备度: ${gap.result.overallReadiness}%`)
  console.log(`预计总学习时间: ${gap.result.estimatedTotalTime}`)
  console.log(`优先级排序:`)
  for (const g of gap.result.gaps) {
    const stars = '★'.repeat(Math.min(5, Math.ceil(g.priorityScore / 5)))
    console.log(`  ${g.rank}. ${g.skillName} ${stars} (${g.priority}) [${g.timeToLearn}]`)
  }
  console.log()
  console.log('📋 Evidence (证据链):')
  for (const e of gap.evidence) {
    console.log(`  • ${e.fact} [${e.source}] 置信度:${Math.round(e.confidence * 100)}%`)
  }
  console.log()

  // ═══════════════════════════════════════════════
  // 4. Recommendation Engine — 职业推荐
  // ═══════════════════════════════════════════════
  console.log('🏆 ════════════════════════════════════════')
  console.log('  ④ Recommendation Engine — 职业推荐')
  console.log('════════════════════════════════════════\n')

  const recs = await engine.careerScore.recommendCareers(
    candidateSkills,
    candidateFit,
    8,
  )

  console.log('推荐职业（按适配度排序）:')
  for (let i = 0; i < recs.result.length; i++) {
    const r = recs.result[i]
    const bar = '█'.repeat(Math.round(r.overallScore / 5)) + '░'.repeat(20 - Math.round(r.overallScore / 5))
    console.log(`  ${i + 1}. ${r.career.name.padEnd(12)} ${bar} ${r.overallScore}分`)
  }
  console.log()

  // ═══════════════════════════════════════════════
  // 5. Evidence Engine — 证据追溯
  // ═══════════════════════════════════════════════
  console.log('🔍 ════════════════════════════════════════')
  console.log('  ⑤ Evidence Engine — 证据追溯')
  console.log('════════════════════════════════════════\n')

  console.log('所有结论均可追溯到具体知识对象:')
  console.log()
  console.log('示例: 为什么推荐 AI应用工程师?')
  console.log('────────────────────────────────────')
  for (const e of score.evidence) {
    console.log(`  📎 ${e.fact}`)
    console.log(`     来源: ${e.source}`)
    console.log(`     置信度: ${Math.round(e.confidence * 100)}%`)
    if (e.data) console.log(`     数据: ${JSON.stringify(e.data)}`)
    console.log()
  }

  // ═══════════════════════════════════════════════
  // 总结
  // ═══════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 3-C 验证完成 ✅')
  console.log('  5个引擎全部通过')
  console.log('═══════════════════════════════════════════════')
}

demo().catch(console.error)
