/**
 * Phase 3-B2 演示：Career Repository 功能验证
 */

import { getCareerRepository } from '/root/shipin-cinematic-studio/backend/src/knowledge/repository/careers/career-repository'
import { getSkillRepository } from '/root/shipin-cinematic-studio/backend/src/knowledge/repository/skills/skill-repository'
import { CAREER_IDS, CAREER_STATS } from '/root/shipin-cinematic-studio/backend/src/knowledge/repository/careers/career-seed'
import { CareerCanonicalObject } from '/root/shipin-cinematic-studio/backend/src/knowledge/canonical/schemas'

async function demo() {
  const careerRepo = getCareerRepository()
  const skillRepo = getSkillRepository()

  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 3-B2: Career Repository Demo')
  console.log('═══════════════════════════════════════════════\n')

  // 1. 基本统计
  console.log('📊 Career 知识库统计')
  const stats = careerRepo.getStats()
  console.log(`  总职业数: ${stats.total}`)
  console.log(`  总迁移路径: ${stats.totalTransitions}`)
  console.log(`  总学习资源: ${stats.totalLearningLinks}`)
  console.log(`  按分类: ${JSON.stringify(stats.byCategory)}`)
  console.log(`  热门职业: ${stats.hotCareers.join(', ')}`)
  console.log()

  // 2. 按名称查找
  console.log('🔍 按名称查找: AI应用工程师')
  const aiEngineer = careerRepo.findByName('AI应用工程师')
  if (aiEngineer) {
    console.log(`  名称: ${aiEngineer.name}`)
    console.log(`  分类: ${aiEngineer.category} / ${aiEngineer.subcategory}`)
    console.log(`  状态: ${aiEngineer.status}`)
    console.log(`  技能要求: ${aiEngineer.requiredSkills.length} 个`)
    for (const skillRef of aiEngineer.requiredSkills.slice(0, 5)) {
      const skill = await skillRepo.getById(skillRef.skillId)
      console.log(`    - ${skill?.name || skillRef.skillId} (熟练度: ${skillRef.proficiency})`)
    }
    if (aiEngineer.requiredSkills.length > 5) {
      console.log(`    ... 共 ${aiEngineer.requiredSkills.length} 个`)
    }
  }
  console.log()

  // 3. 薪资参考
  console.log('💰 AI应用工程师 薪资参考（一线城市）:')
  if (aiEngineer) {
    for (const salary of aiEngineer.salaryByLevel) {
      console.log(`  ${salary.level}: ${salary.range} (置信度: ${salary.confidence})`)
    }
  }
  console.log()

  // 4. 增长趋势
  console.log('📈 AI应用工程师 增长趋势:')
  if (aiEngineer) {
    for (const trend of aiEngineer.growthTrend) {
      console.log(`  ${trend.year}Q${trend.quarter}: 需求指数 ${trend.demandIndex}, 薪资增长 ${trend.salaryGrowth}%`)
    }
  }
  console.log()

  // 5. 能力画像
  console.log('🎯 AI应用工程师 能力画像:')
  const fit = careerRepo.getFitProfile(CAREER_IDS.ai_engineer)
  if (fit) {
    console.log(`  逻辑思维: ${'★'.repeat(fit.logicalThinking)}${'☆'.repeat(5 - fit.logicalThinking)}`)
    console.log(`  沟通能力: ${'★'.repeat(fit.communication)}${'☆'.repeat(5 - fit.communication)}`)
    console.log(`  创造力:   ${'★'.repeat(fit.creativity)}${'☆'.repeat(5 - fit.creativity)}`)
    console.log(`  执行力:   ${'★'.repeat(fit.execution)}${'☆'.repeat(5 - fit.execution)}`)
    console.log(`  领导力:   ${'★'.repeat(fit.leadership)}${'☆'.repeat(5 - fit.leadership)}`)
    console.log(`  分析能力: ${'★'.repeat(fit.analyticalSkill)}${'☆'.repeat(5 - fit.analyticalSkill)}`)
  }
  console.log()

  // 6. 职业迁移
  console.log('🔄 AI应用工程师 职业迁移路径:')
  const transitions = careerRepo.getTransitions(CAREER_IDS.ai_engineer)
  for (const t of transitions) {
    const fromCareer = await careerRepo.getById(t.fromCareer)
    const gapSkillNames: string[] = []
    for (const sid of t.keyGapSkills) {
      const skill = await skillRepo.getById(sid)
      gapSkillNames.push(skill?.name || sid)
    }
    console.log(`  ${fromCareer?.name || t.fromCareer} → ${aiEngineer?.name}`)
    console.log(`    难度: ${'★'.repeat(t.difficulty)}${'☆'.repeat(5 - t.difficulty)}`)
    console.log(`    成功率: ${t.successRate}%`)
    console.log(`    预计时间: ${t.estimatedMonths}个月`)
    console.log(`    需补充技能: ${gapSkillNames.join(', ')}`)
  }
  console.log()

  // 7. 学习资源
  console.log('📚 AI应用工程师 学习资源:')
  const links = careerRepo.getLearningLinks(CAREER_IDS.ai_engineer)
  for (const link of links) {
    console.log(`  [${link.type}] ${link.name}`)
    console.log(`    难度: ${link.level} | 免费: ${link.free ? '是' : '否'} | 时长: ${link.duration || '未知'}`)
    console.log(`    ${link.description}`)
  }
  console.log()

  // 8. 热门职业
  console.log('🔥 热门职业 TOP5（按需求指数）:')
  const hotCareers = careerRepo.getHotCareers(5)
  for (let i = 0; i < hotCareers.length; i++) {
    const c = hotCareers[i]
    const demand = c.growthTrend[0]?.demandIndex || 0
    console.log(`  ${i + 1}. ${c.name} (需求: ${demand})`)
  }
  console.log()

  // 9. 搜索
  console.log('🔍 搜索 "AI":')
  const aiResults = await careerRepo.search('AI')
  console.log(`  找到 ${aiResults.length} 个职业:`)
  for (const c of aiResults) {
    console.log(`    - ${c.name} (${c.category})`)
  }
  console.log()

  // 10. 关联职业
  console.log('🔗 AI应用工程师 关联职业:')
  if (aiEngineer) {
    for (const ref of aiEngineer.relatedCareers) {
      const related = await careerRepo.getById(ref.careerId)
      console.log(`  - ${related?.name || ref.careerId} (关联度: ${ref.weight})`)
    }
  }
  console.log()

  // 11. 完整度验证
  console.log('✅ 知识对象完整度验证:')
  const issues: string[] = []
  for (const career of careerRepo.getAll()) {
    if (career.requiredSkills.length === 0) issues.push(`${career.name}: 缺少技能要求`)
    if (career.salaryByLevel.length === 0) issues.push(`${career.name}: 缺少薪资数据`)
    if (career.growthTrend.length === 0) issues.push(`${career.name}: 缺少增长趋势`)
    if (!career.fitProfile) issues.push(`${career.name}: 缺少能力画像`)
    if (career.transitions.length === 0) issues.push(`${career.name}: 缺少迁移路径`)
    if (career.learningLinks.length === 0) issues.push(`${career.name}: 缺少学习资源`)
    if (career.evidence.length === 0) issues.push(`${career.name}: 缺少证据`)
  }
  if (issues.length === 0) {
    console.log('  所有职业知识对象完整 ✅')
  } else {
    for (const issue of issues) {
      console.log(`  ⚠️ ${issue}`)
    }
  }
  console.log()

  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 3-B2 验证完成 ✅')
  console.log('═══════════════════════════════════════════════')
}

demo().catch(console.error)
