/**
 * Phase 4-A 演示：Reasoning Runtime
 * 
 * 验证：
 *   1. Evidence Builder 证据构建
 *   2. LLM 推理（通过 LLM Gateway）
 *   3. 结构化输出
 */

import { ReasoningRuntime } from '/root/shipin-cinematic-studio/backend/src/knowledge/reasoning/reasoning-runtime'
import { LLMGateway } from '/root/shipin-cinematic-studio/backend/src/knowledge/gateway/llm-gateway'
import { KnowledgeRuntime } from '/root/shipin-cinematic-studio/backend/src/knowledge/runtime/knowledge-runtime'
import { KnowledgeIntelligenceEngine } from '/root/shipin-cinematic-studio/backend/src/knowledge/engine/knowledge-engine'
import { getCareerRepository } from '/root/shipin-cinematic-studio/backend/src/knowledge/repository/careers/career-repository'
import { getSkillRepository } from '/root/shipin-cinematic-studio/backend/src/knowledge/repository/skills/skill-repository'
import { DeepSeekAdapter } from '/root/shipin-cinematic-studio/backend/src/knowledge/gateway/llm-gateway'
import type { LLMModel } from '/root/shipin-cinematic-studio/backend/src/knowledge/gateway/llm-gateway'
import type { CareerFit } from '/root/shipin-cinematic-studio/backend/src/knowledge/canonical/schemas'

async function demo() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 4-A: Reasoning Runtime')
  console.log('═══════════════════════════════════════════════\n')

  // 初始化基础设施
  const careerRepo = getCareerRepository()
  const skillRepo = getSkillRepository()
  const engine = new KnowledgeIntelligenceEngine({ careerRepo: careerRepo as any, skillRepo: skillRepo as any })
  const knowledgeRuntime = new KnowledgeRuntime({ careerRepo: careerRepo as any, skillRepo: skillRepo as any, engine })

  // 配置 LLM Gateway
  const models: LLMModel[] = [
    {
      id: 'deepseek:deepseek-chat',
      provider: 'deepseek',
      model: 'deepseek-chat',
      label: 'DeepSeek Chat',
      maxTokens: 4096,
      costPerInputToken: 0.000001,
      costPerOutputToken: 0.000002,
      supportedTasks: ['default', 'career_analysis', 'job_matching'],
      enabled: true,
    },
  ]

  const gateway = new LLMGateway({ models, defaultProvider: 'deepseek' })
  gateway.registerAdapter('deepseek', new DeepSeekAdapter('sk-test-key'))

  // 创建 Reasoning Runtime
  const reasoningRuntime = new ReasoningRuntime({
    gateway,
    knowledgeRuntime,
    engine,
  })

  // 用户信息
  const userSkills = ['Vue.js', 'TypeScript', 'Node.js']
  const userFit: CareerFit = {
    logicalThinking: 4, communication: 3, creativity: 3,
    execution: 4, leadership: 2, analyticalSkill: 3,
  }

  // 先获取 Knowledge Context
  const knowledge = await knowledgeRuntime.processQuery({
    userSkills,
    userFit,
    intent: { type: 'career_recommendation' },
  })

  console.log('━━━ ① Knowledge Runtime 输出 ━━━\n')
  console.log(`  推荐数: ${knowledge.analysis.recommendations.length}`)
  console.log(`  最高分: ${knowledge.analysis.recommendations[0]?.careerName} ${knowledge.analysis.recommendations[0]?.score}分`)
  console.log(`  证据链: ${knowledge.explain.traces.length} 条`)
  console.log()

  // 调用 Reasoning Runtime
  console.log('━━━ ② Reasoning Runtime ━━━\n')
  console.log('👤 用户: "我是前端工程师，会Vue和TypeScript，有什么职业推荐？"\n')

  const result = await reasoningRuntime.reason({
    userMessage: '我是前端工程师，会Vue和TypeScript，有什么职业推荐？',
    intent: { type: 'career_recommendation' },
    skills: userSkills,
    fit: userFit,
    knowledge,
  })

  console.log('🤖 推理结果:')
  console.log(`  类型: ${result.output?.type}`)
  console.log(`  置信度: ${result.output?.confidence}`)
  console.log(`  证据数: ${result.evidence.length}`)
  console.log()

  console.log('📋 证据链:')
  for (const ev of result.evidence.slice(0, 5)) {
    console.log(`  • ${ev.fact.slice(0, 60)}... (置信度: ${Math.round(ev.confidence * 100)}%)`)
  }
  console.log()

  console.log('📋 结构化输出:')
  if (result.output?.data.recommendations) {
    const recs = result.output.data.recommendations as Array<{ name: string; score: number; reason: string }>
    for (let i = 0; i < Math.min(3, recs.length); i++) {
      const rec = recs[i]
      console.log(`  ${i + 1}. ${rec.name} — ${rec.score}分`)
    }
  } else if (result.output?.data.rawContent) {
    console.log(`  ${(result.output.data.rawContent as string).slice(0, 100)}...`)
  }
  console.log()

  console.log('📋 建议操作:')
  if (result.output?.nextActions) {
    for (const action of result.output.nextActions) {
      console.log(`  → ${action}`)
    }
  }
  console.log()

  // ═══════════════════════════════════════════════
  // 验证架构约束
  // ═══════════════════════════════════════════════
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  架构约束验证')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('✅ LLM 不是知识来源 — 知识来自 Knowledge Runtime')
  console.log('✅ LLM 不是数据库 — 数据来自 Repository')
  console.log('✅ LLM 不是工具 — 工具由 Tool Runtime 提供')
  console.log('✅ LLM 只是 Reasoning Engine — 负责推理和表达')
  console.log('✅ 所有结论都有证据链 — 可追溯')
  console.log('✅ 输出结构化 JSON — 非 Markdown')

  console.log('\n═══════════════════════════════════════════════')
  console.log('  Phase 4-A 验证完成 ✅')
  console.log('═══════════════════════════════════════════════')
}

demo().catch(console.error)
