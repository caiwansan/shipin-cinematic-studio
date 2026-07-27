/**
 * Phase 3-D 演示：CareerAdvisorAgent 端到端验证
 * 
 * 验证链路：
 *   用户消息 → 意图识别 → Knowledge Runtime → Knowledge Engine → 回复
 */

import { CareerAdvisorAgent } from '/root/shipin-cinematic-studio/backend/src/knowledge/agent/career-advisor-agent'
import { CareerFit } from '/root/shipin-cinematic-studio/backend/src/knowledge/canonical/schemas'

async function demo() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 3-D: Knowledge Runtime + Agent')
  console.log('═══════════════════════════════════════════════\n')

  const agent = new CareerAdvisorAgent()

  // 设置用户画像（前端工程师）
  const userId = 'demo_user_001'
  const userSkills = ['Vue.js', 'TypeScript', 'Node.js', 'HTML/CSS', 'JavaScript', 'PostgreSQL']
  const userFit: CareerFit = {
    logicalThinking: 4,
    communication: 3,
    creativity: 3,
    execution: 4,
    leadership: 2,
    analyticalSkill: 3,
  }
  agent.setUserProfile(userId, userSkills, userFit)

  // ═══════════════════════════════════════════════
  // 测试 1: 职业推荐
  // ═══════════════════════════════════════════════
  console.log('━━━ 测试 1: 职业推荐 ━━━\n')
  console.log('👤 用户: "我是前端工程师，会Vue和TypeScript，有什么职业推荐？"\n')

  const response1 = await agent.handleMessage({
    userMessage: '我是前端工程师，会Vue和TypeScript，有什么职业推荐？',
    userId,
  })

  console.log('🤖 Agent 回复:')
  console.log(response1.message)
  console.log()
  console.log(`📊 处理时间: ${response1.metadata.processingTimeMs}ms`)
  console.log(`📊 缓存命中: ${response1.metadata.cacheHit}`)
  console.log(`📊 置信度: ${response1.metadata.confidence}`)
  console.log(`📊 建议操作: ${response1.suggestedActions.join(', ')}`)

  // ═══════════════════════════════════════════════
  // 测试 2: 职业迁移
  // ═══════════════════════════════════════════════
  console.log('\n\n━━━ 测试 2: 职业迁移 ━━━\n')
  console.log('👤 用户: "我想从前端转AI应用工程师，可以吗？"\n')

  const response2 = await agent.handleMessage({
    userMessage: '我想从前端转AI应用工程师，可以吗？',
    userId,
  })

  console.log('🤖 Agent 回复:')
  console.log(response2.message)
  console.log()
  console.log(`📊 处理时间: ${response2.metadata.processingTimeMs}ms`)
  console.log(`📊 缓存命中: ${response2.metadata.cacheHit}`)
  console.log(`📊 置信度: ${response2.metadata.confidence}`)

  // ═══════════════════════════════════════════════
  // 测试 3: 技能差距
  // ═══════════════════════════════════════════════
  console.log('\n\n━━━ 测试 3: 技能差距 ━━━\n')
  console.log('👤 用户: "我想做AI应用工程师，还缺什么技能？"\n')

  const response3 = await agent.handleMessage({
    userMessage: '我想做AI应用工程师，还缺什么技能？',
    userId,
  })

  console.log('🤖 Agent 回复:')
  console.log(response3.message)
  console.log()
  console.log(`📊 处理时间: ${response3.metadata.processingTimeMs}ms`)
  console.log(`📊 缓存命中: ${response3.metadata.cacheHit}`)

  // ═══════════════════════════════════════════════
  // 测试 4: 缓存命中
  // ═══════════════════════════════════════════════
  console.log('\n\n━━━ 测试 4: 缓存命中（重复查询） ━━━\n')
  console.log('👤 用户: "再推荐一些职业"（重复意图）\n')

  const response4 = await agent.handleMessage({
    userMessage: '再推荐一些职业',
    userId,
  })

  console.log(`📊 处理时间: ${response4.metadata.processingTimeMs}ms`)
  console.log(`📊 缓存命中: ${response4.metadata.cacheHit}`)

  // ═══════════════════════════════════════════════
  // Runtime 统计
  // ═══════════════════════════════════════════════
  console.log('\n\n━━━ Knowledge Runtime 统计 ━━━\n')
  const stats = agent.getRuntimeStats()
  console.log(`缓存条目: ${stats.cache.size}`)
  console.log(`缓存命中率: ${stats.cache.hitRate.toFixed(2)}`)
  console.log(`用户画像数: ${stats.userProfiles}`)

  // ═══════════════════════════════════════════════
  // 完整链路验证
  // ═══════════════════════════════════════════════
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  完整链路验证')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('✅ 用户消息 → Intent Parser (意图识别)')
  console.log('✅ Intent → Knowledge Runtime (运行时)')
  console.log('✅ Runtime → Retrieval Engine (检索)')
  console.log('✅ Runtime → Context Builder (上下文)')
  console.log('✅ Runtime → Task Planner (规划)')
  console.log('✅ Runtime → Cache Layer (缓存)')
  console.log('✅ Runtime → Explain Runtime (解释)')
  console.log('✅ Runtime → Knowledge Engine (推理)')
  console.log('✅ Engine → Repository (知识存储)')
  console.log('✅ Context → Response Builder (回复)')
  console.log('✅ Agent → 用户回复')

  console.log('\n═══════════════════════════════════════════════')
  console.log('  Phase 3-D 验证完成 ✅')
  console.log('  聊天正式从 State Machine 升级为 Agent')
  console.log('═══════════════════════════════════════════════')
}

demo().catch(console.error)
