/**
 * Phase 3-B1 演示：Skill Graph 功能验证
 */

import { getSkillRepository } from '/root/shipin-cinematic-studio/backend/src/knowledge/repository/skills/skill-repository'
import { SKILL_IDS } from '/root/shipin-cinematic-studio/backend/src/knowledge/repository/skills/skill-seed'

async function demo() {
  const repo = getSkillRepository()

  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 3-B1: Skill Graph Foundation Demo')
  console.log('═══════════════════════════════════════════════\n')

  // 1. 基本统计
  const stats = repo.getStats()
  console.log('📊 技能图谱统计')
  console.log(`  总技能数: ${stats.total}`)
  console.log(`  按分类: ${JSON.stringify(stats.byCategory)}`)
  console.log(`  按需求: ${JSON.stringify(stats.byDemand)}`)
  console.log(`  热门技能: ${stats.hotSkills.join(', ')}`)
  console.log()

  // 2. 按名称查找
  console.log('🔍 按名称查找: LangChain')
  const langchain = repo.findByName('LangChain')
  if (langchain) {
    console.log(`  名称: ${langchain.name}`)
    console.log(`  分类: ${langchain.category} / ${langchain.subcategory}`)
    console.log(`  需求: ${langchain.demandLevel}`)
    console.log(`  学习周期: ${langchain.timeToLearn}`)
    console.log(`  前置技能数: ${langchain.prerequisites.length}`)
    console.log(`  进阶技能数: ${langchain.nextSkills.length}`)
  }
  console.log()

  // 3. 搜索
  console.log('🔍 搜索 "AI":')
  const aiResults = await repo.search('AI')
  console.log(`  找到 ${aiResults.length} 个技能:`)
  for (const s of aiResults) {
    console.log(`    - ${s.name} (${s.demandLevel})`)
  }
  console.log()

  // 4. 热门技能
  console.log('🔥 热门技能 TOP5:')
  const hotSkills = repo.getHotSkills(5)
  for (let i = 0; i < hotSkills.length; i++) {
    console.log(`  ${i + 1}. ${hotSkills[i].name} [${hotSkills[i].demandLevel}]`)
  }
  console.log()

  // 5. 学习路径
  console.log('📚 LangChain 学习路径（前置技能 BFS）:')
  const path = repo.getLearningPath(SKILL_IDS.langchain)
  for (let i = 0; i < path.length; i++) {
    const skill = await repo.getById(path[i])
    console.log(`  ${i + 1}. ${skill?.name || path[i]}`)
  }
  console.log()

  // 6. 技能差距分析
  console.log('📊 技能差距分析:')
  console.log('  当前技能: HTML/CSS, JavaScript, Python')
  console.log('  目标: AI应用工程师所需技能')
  const gap = repo.calculateGap(
    ['HTML/CSS', 'JavaScript', 'Python'],
    [SKILL_IDS.prompt_engineering, SKILL_IDS.langchain, SKILL_IDS.rag, SKILL_IDS.vector_database, SKILL_IDS.agent_design]
  )
  console.log(`  优势: ${gap.strengths.join(', ') || '无'}`)
  console.log(`  差距 (${gap.gaps.length}):`)
  for (const g of gap.gaps) {
    console.log(`    - ${g.name} [${g.type}]`)
  }
  console.log()

  // 7. 最短路径
  console.log('🛤️ 技能转换最短路径:')
  console.log('  HTML/CSS → LangChain')
  const shortestPath = repo.findShortestPath(SKILL_IDS.html_css, SKILL_IDS.langchain)
  const pathNames: string[] = []
  for (const id of shortestPath) {
    const skill = await repo.getById(id)
    pathNames.push(skill?.name || id)
  }
  console.log(`  路径: ${pathNames.join(' → ')}`)
  console.log()

  // 8. 前置技能树
  console.log('🌳 LangChain 前置技能树:')
  const tree = repo.getPrerequisiteTree(SKILL_IDS.langchain, 3)
  printTree(tree, '  ')
  console.log()

  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 3-B1 验证完成 ✅')
  console.log('═══════════════════════════════════════════════')
}

interface TreeNode {
  skillId: string
  name: string
  weight: number
  children: TreeNode[]
}

function printTree(nodes: TreeNode[], indent: string) {
  for (const node of nodes) {
    console.log(`${indent}├─ ${node.name} (权重: ${node.weight})`)
    if (node.children && node.children.length > 0) {
      printTree(node.children, indent + '│  ')
    }
  }
}

demo().catch(console.error)
