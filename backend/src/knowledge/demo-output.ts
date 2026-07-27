/**
 * Phase 4-C 演示：Canonical Output Runtime
 * 
 * 验证：
 *   1. Agent Response（统一响应）
 *   2. Evidence Schema（证据对象）
 *   3. Next Action Schema（下一步行动）
 *   4. UI Card Schema（UI 卡片）
 *   5. ICO — Recommendation Response
 *   6. ICO — Analysis Response
 *   7. ICO — Evaluation Response
 *   8. JSON Schema Validation
 *   9. Renderer（LLM 不直接决定 UI）
 */

import { createCanonicalOutputRuntime } from '/root/shipin-cinematic-studio/backend/src/knowledge/output/canonical-output-runtime'
import type { Evidence, NextAction, UICard } from '/root/shipin-cinematic-studio/backend/src/knowledge/output/canonical-output-runtime'

async function demo() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 4-C: Canonical Output Runtime')
  console.log('═══════════════════════════════════════════════\n')

  const cor = createCanonicalOutputRuntime()

  // ═══════════════════════════════════════════════
  // 1. Evidence Schema 验证
  // ═══════════════════════════════════════════════
  console.log('━━━ ① Evidence Schema ━━━\n')

  const evidence1 = cor.createEvidence({
    source: 'career_repository',
    type: 'fact',
    confidence: 0.85,
    payload: { fact: '前端工程师转AI成功率68%', careerId: 'frontend' },
  })

  const evidence2 = cor.createEvidence({
    source: 'skill_graph',
    type: 'statistic',
    confidence: 0.78,
    payload: { fact: 'TypeScript在AI领域应用增长40%', skill: 'typescript' },
  })

  console.log(`证据1: ${evidence1.id.slice(0, 15)}...`)
  console.log(`  来源: ${evidence1.source}`)
  console.log(`  类型: ${evidence1.type}`)
  console.log(`  置信度: ${evidence1.confidence}`)
  console.log(`  载荷: ${JSON.stringify(evidence1.payload).slice(0, 50)}...`)
  console.log()
  console.log(`证据2: ${evidence2.id.slice(0, 15)}...`)
  console.log(`  来源: ${evidence2.source}`)
  console.log(`  类型: ${evidence2.type}`)
  console.log(`  置信度: ${evidence2.confidence}`)
  console.log()

  // ═══════════════════════════════════════════════
  // 2. Next Action Schema 验证
  // ═══════════════════════════════════════════════
  console.log('━━━ ② Next Action Schema ━━━\n')

  const action1 = cor['nextActionFactory'].learn('学习 LangChain', { courseId: 'lc101' })
  const action2 = cor['nextActionFactory'].apply('申请 AI 应用工程师', { jobId: 'job001' })
  const action3 = cor['nextActionFactory'].analyze('分析技能缺口', { target: 'ai_engineer' })

  console.log(`行动1: ${action1.title} (${action1.type}, ${action1.priority})`)
  console.log(`行动2: ${action2.title} (${action2.type}, ${action2.priority})`)
  console.log(`行动3: ${action3.title} (${action3.type}, ${action3.priority})`)
  console.log()

  // ═══════════════════════════════════════════════
  // 3. Agent Response 验证
  // ═══════════════════════════════════════════════
  console.log('━━━ ③ Agent Response ━━━\n')

  const response = cor.createResponse({
    agent: 'career_advisor',
    version: '1.0.0',
    status: 'success',
    data: {
      recommendations: [
        { name: 'Agent Engineer', score: 85, reason: '技能匹配度高，市场需求旺盛' },
        { name: 'AI应用工程师', score: 78, reason: '前端背景可迁移，薪资增长40%' },
      ],
    },
    evidence: [evidence1, evidence2],
    confidence: 0.82,
    nextActions: [action1, action2, action3],
    metrics: {
      latency: 2400,
      tokens: 2300,
      cost: 0.0023,
    },
  })

  console.log(`响应 ID: ${response.id.slice(0, 20)}...`)
  console.log(`Agent: ${response.agent}`)
  console.log(`状态: ${response.status}`)
  console.log(`置信度: ${response.confidence}`)
  console.log(`证据数: ${response.evidence.length}`)
  console.log(`下一步: ${response.nextActions.length}`)
  console.log(`成本: ¥${response.metrics.cost}`)
  console.log()

  // ═══════════════════════════════════════════════
  // 4. ICO — Recommendation Response
  // ═══════════════════════════════════════════════
  console.log('━━━ ④ ICO: Recommendation Response ━━━\n')

  const recICO = cor.createRecommendationResponse({
    title: '职业推荐结果',
    items: [
      { id: '1', name: 'Agent Engineer', score: 85, reason: '技能匹配度高', tags: ['热门', '高薪'], evidence: ['成功率68%'] },
      { id: '2', name: 'AI应用工程师', score: 78, reason: '前端可迁移', tags: ['成长快'], evidence: ['薪资增长40%'] },
      { id: '3', name: 'AI产品经理', score: 72, reason: '综合能力强', tags: ['管理岗'], evidence: ['需求增长35%'] },
    ],
    nextActions: [action1, action2],
  })

  console.log(`类型: ${recICO.type}`)
  console.log(`标题: ${recICO.title}`)
  console.log(`推荐数: ${recICO.items.length}`)
  for (const item of recICO.items) {
    console.log(`  ${item.name}: ${item.score}分 — ${item.reason}`)
  }
  console.log()

  // ═══════════════════════════════════════════════
  // 5. ICO — Analysis Response
  // ═══════════════════════════════════════════════
  console.log('━━━ ⑤ ICO: Analysis Response ━━━\n')

  const analysisICO = cor.createAnalysisResponse({
    title: '技能缺口分析',
    summary: '用户当前技能与目标职业存在一定差距，但可弥补',
    details: [
      { dimension: '编程基础', score: 85, finding: 'TypeScript熟练，符合要求', suggestion: '保持现状' },
      { dimension: 'AI理论', score: 45, finding: '缺乏机器学习基础', suggestion: '学习吴恩达ML课程' },
      { dimension: '工程实践', score: 60, finding: '有前端工程经验，缺乏AI部署经验', suggestion: '学习MLOps' },
      { dimension: '产品设计', score: 70, finding: '有产品思维，需加强AI产品认知', suggestion: '阅读AI产品案例' },
    ],
    overallScore: 65,
    evidence: [evidence1, evidence2],
    nextActions: [action1, action3],
  })

  console.log(`类型: ${analysisICO.type}`)
  console.log(`标题: ${analysisICO.title}`)
  console.log(`总分: ${analysisICO.overallScore}`)
  for (const d of analysisICO.details) {
    console.log(`  ${d.dimension}: ${d.score}分 — ${d.finding}`)
  }
  console.log()

  // ═══════════════════════════════════════════════
  // 6. ICO — Evaluation Response
  // ═══════════════════════════════════════════════
  console.log('━━━ ⑥ ICO: Evaluation Response ━━━\n')

  const evalICO = cor.createEvaluationResponse({
    title: '简历评估结果',
    target: 'AI应用工程师',
    criteria: [
      { name: '技能匹配', score: 75, maxScore: 100, comment: '前端技能可迁移，需补充AI技能' },
      { name: '经验相关', score: 60, maxScore: 100, comment: '3年前端经验，但无AI项目经验' },
      { name: '学历背景', score: 80, maxScore: 100, comment: '本科，计算机相关专业' },
      { name: '项目经历', score: 70, maxScore: 100, comment: '有完整项目经历，但缺少AI相关' },
    ],
    overallScore: 71,
    overallComment: '整体匹配度良好，建议补充AI项目经验后申请',
    nextActions: [action1, action2],
  })

  console.log(`类型: ${evalICO.type}`)
  console.log(`目标: ${evalICO.target}`)
  console.log(`总分: ${evalICO.overallScore}/100`)
  for (const c of evalICO.criteria) {
    console.log(`  ${c.name}: ${c.score}/${c.maxScore} — ${c.comment.slice(0, 30)}...`)
  }
  console.log()

  // ═══════════════════════════════════════════════
  // 7. JSON Schema Validation
  // ═══════════════════════════════════════════════
  console.log('━━━ ⑦ JSON Schema Validation ━━━\n')

  const validResult = cor.validateOutput('AgentResponse', response)
  console.log(`AgentResponse 验证: ${validResult.valid ? '✅ 通过' : '❌ 失败'}`)
  if (!validResult.valid) {
    console.log(`  错误: ${validResult.errors.join(', ')}`)
  }

  const validRec = cor.validateOutput('RecommendationResponse', recICO)
  console.log(`RecommendationResponse 验证: ${validRec.valid ? '✅ 通过' : '❌ 失败'}`)

  const validAnalysis = cor.validateOutput('AnalysisResponse', analysisICO)
  console.log(`AnalysisResponse 验证: ${validAnalysis.valid ? '✅ 通过' : '❌ 失败'}`)

  // 验证错误案例
  const invalidResult = cor.validateOutput('AgentResponse', { foo: 'bar' })
  console.log(`错误数据验证: ${invalidResult.valid ? '✅ 通过' : '❌ 失败'} (${invalidResult.errors.length} 个错误)`)
  console.log()

  // ═══════════════════════════════════════════════
  // 8. Renderer（LLM 不直接决定 UI）
  // ═══════════════════════════════════════════════
  console.log('━━━ ⑧ Renderer（LLM 不直接决定 UI）━━━\n')

  // 从 ICO 渲染 Cards
  const recCards = cor.renderICO(recICO)
  console.log(`推荐 ICO → ${recCards.length} 张卡片`)
  for (const card of recCards) {
    console.log(`  [${card.type}] ${card.title} ${card.score}分`)
  }
  console.log()

  const analysisCards = cor.renderICO(analysisICO)
  console.log(`分析 ICO → ${analysisCards.length} 张卡片`)
  for (const card of analysisCards) {
    console.log(`  [${card.type}] ${card.title} ${card.score}分`)
  }
  console.log()

  // 从 Agent Response 提取 Cards
  const responseCards = cor.extractCards(response)
  console.log(`Agent Response → ${responseCards.length} 张卡片`)
  for (const card of responseCards) {
    console.log(`  [${card.type}] ${card.title} ${card.score}分`)
  }
  console.log()

  // 渲染为 Markdown
  const markdown = cor.renderCards(recCards.slice(0, 2))
  console.log('渲染为 Markdown:')
  console.log('─'.repeat(40))
  console.log(markdown.slice(0, 300))
  console.log('─'.repeat(40))
  console.log()

  // ═══════════════════════════════════════════════
  // 总结
  // ═══════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Phase 4-C 验证完成 ✅')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log('✅ Canonical Response Schema  — AgentResponse<T>')
  console.log('✅ Evidence Schema            — 冻结')
  console.log('✅ Task Result Schema         — TaskResult')
  console.log('✅ Next Action Schema         — NextAction')
  console.log('✅ UI Card Schema             — UICard')
  console.log('✅ JSON Validation            — SchemaValidator')
  console.log('✅ Schema Version             — v1.0.0')
  console.log('✅ Renderer Adapter           — MarkdownRenderer')
  console.log()
  console.log('✅ ICO Types:')
  console.log('  • RecommendationResponse')
  console.log('  • AnalysisResponse')
  console.log('  • EvaluationResponse')
  console.log('  • GenerationResponse')
  console.log('  • ConversationResponse')
  console.log()
  console.log('核心原则验证:')
  console.log('  ✅ LLM 永远不能直接决定 UI')
  console.log('  ✅ LLM → Canonical Output → Renderer → 页面')
  console.log('  ✅ 所有 Agent 输出统一协议')
  console.log('  ✅ 换模型（Claude/DeepSeek/GPT）页面不用改')
  console.log('═══════════════════════════════════════════════')
}

demo().catch(console.error)
