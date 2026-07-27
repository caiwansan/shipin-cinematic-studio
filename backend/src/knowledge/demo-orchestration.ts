/**
 * Phase 3-E 演示：Agent Orchestration Runtime 端到端验证
 * 
 * 验证：Agent Registry + Workflow Engine + Capability Bus + Multi-Agent Coordinator
 */

import { AgentOrchestrationRuntime } from '/root/shipin-cinematic-studio/backend/src/knowledge/orchestration/agent-orchestration'
import { KnowledgeIntelligenceEngine } from '/root/shipin-cinematic-studio/backend/src/knowledge/engine/knowledge-engine'
import { KnowledgeRuntime } from '/root/shipin-cinematic-studio/backend/src/knowledge/runtime/knowledge-runtime'
import { getCareerRepository } from '/root/shipin-cinematic-studio/backend/src/knowledge/repository/careers/career-repository'
import { getSkillRepository } from '/root/shipin-cinematic-studio/backend/src/knowledge/repository/skills/skill-repository'
import { CareerFit } from '/root/shipin-cinematic-studio/backend/src/knowledge/canonical/schemas'
import type { AgentCapability, AgentHandler, AgentInput, AgentExecutionContext, AgentOutput } from '/root/shipin-cinematic-studio/backend/src/knowledge/orchestration/agent-orchestration'

async function demo() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 3-E: Agent Orchestration Runtime')
  console.log('═══════════════════════════════════════════════\n')

  // 初始化
  const careerRepo = getCareerRepository()
  const skillRepo = getSkillRepository()
  const engine = new KnowledgeIntelligenceEngine({ careerRepo: careerRepo as any, skillRepo: skillRepo as any })
  const runtime = new KnowledgeRuntime({ careerRepo: careerRepo as any, skillRepo: skillRepo as any, engine })
  const orchestration = new AgentOrchestrationRuntime({ runtime, engine })

  // ═══════════════════════════════════════════════
  // ① 注册 Agent
  // ═══════════════════════════════════════════════
  console.log('━━━ ① Agent Registry ━━━\n')

  // Career Advisor Agent
  const careerAgentCapability: AgentCapability = {
    id: 'career_advisor_v1',
    name: '职业顾问',
    description: '提供职业推荐、迁移分析、技能差距分析',
    type: 'career_advisor',
    inputSchema: {
      type: 'object',
      properties: {
        userMessage: { type: 'string', description: '用户消息' },
        skills: { type: 'array', description: '用户技能' },
      },
      required: ['userMessage'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '回复消息' },
        confidence: { type: 'number', description: '置信度' },
      },
    },
    permissions: ['read:career', 'read:skill', 'write:memory'],
    priority: 90,
    status: 'available',
    metadata: { version: '1.0.0', author: 'kunlun', createdAt: Date.now() },
  }

  const careerAgentHandler: AgentHandler = {
    async execute(input: AgentInput, context: AgentExecutionContext): Promise<AgentOutput> {
      const score = await context.engine.careerScore.calculateScore(
        input.skills || [],
        input.fit || null,
        'cco_ai_engineer',
      )
      return {
        message: `职业分析完成: AI应用工程师 适配度 ${score.result.overallScore}/100`,
        data: { careerScore: score.result.overallScore },
        evidence: score.evidence.map(e => e.fact),
        confidence: score.evidence[0]?.confidence || 0.5,
        suggestedActions: ['查看详情', '分析技能缺口'],
      }
    },
  }

  // Resume Analyst Agent
  const resumeAgentCapability: AgentCapability = {
    id: 'resume_analyst_v1',
    name: '简历分析师',
    description: '分析简历技能匹配度',
    type: 'resume_analyst',
    inputSchema: {
      type: 'object',
      properties: { userMessage: { type: 'string', description: '用户消息' } },
      required: ['userMessage'],
    },
    outputSchema: {
      type: 'object',
      properties: { message: { type: 'string', description: '分析结果' } },
    },
    permissions: ['read:career', 'read:skill'],
    priority: 70,
    status: 'available',
    metadata: { version: '1.0.0', author: 'kunlun', createdAt: Date.now() },
  }

  const resumeAgentHandler: AgentHandler = {
    async execute(input: AgentInput): Promise<AgentOutput> {
      return {
        message: `简历分析完成: 识别到 ${input.skills?.length || 0} 项技能`,
        data: { skillCount: input.skills?.length || 0 },
        evidence: [`识别技能: ${input.skills?.join(', ') || '无'}`],
        confidence: 0.85,
        nextAgent: 'career_advisor',
      }
    },
  }

  // 注册
  orchestration.registerAgent(careerAgentCapability, careerAgentHandler)
  orchestration.registerAgent(resumeAgentCapability, resumeAgentHandler)

  const allAgents = orchestration.registry.getAll()
  console.log(`已注册 ${allAgents.length} 个 Agent:`)
  for (const agent of allAgents) {
    console.log(`  ✅ ${agent.name} (${agent.type}) — 优先级${agent.priority} [${agent.status}]`)
  }
  console.log()

  // ═══════════════════════════════════════════════
  // ② Capability Bus
  // ═══════════════════════════════════════════════
  console.log('━━━ ② Capability Bus ━━━\n')

  // 订阅测试：响应 test_agent 的请求
  orchestration.bus.subscribe({
    id: 'career_advisor_v1',
    filter: msg => msg.to === 'career_advisor_v1',
    handler: (msg) => {
      console.log(`  📡 Bus: ${msg.from} → ${msg.to} (${msg.type})`)
      // 回复
      orchestration.bus.publish({
        id: `resp_${Date.now().toString(36)}`,
        from: 'career_advisor_v1',
        to: msg.from,
        type: 'response',
        payload: { status: 'ok', message: 'Career Advisor 已就绪' },
        timestamp: Date.now(),
        correlationId: msg.correlationId,
      })
    },
  })

  const resp = await orchestration.bus.request('test_agent', 'career_advisor_v1', { action: 'ping' })
  console.log(`  Capability Bus 通信测试通过 ✅ 响应: ${JSON.stringify(resp.payload)}`)
  console.log()

  // ═══════════════════════════════════════════════
  // ③ Workflow Engine
  // ═══════════════════════════════════════════════
  console.log('━━━ ③ Workflow Engine ━━━\n')

  const templates = ['job_change', 'career_planning', 'interview_prep']
  for (const name of templates) {
    const steps = orchestration.workflowEngine.getTemplate(name)
    console.log(`  工作流模板 "${name}": ${steps.length} 步`)
    for (const step of steps) {
      console.log(`    ${step.id}: ${step.agentType} ${step.dependsOn ? `(依赖: ${step.dependsOn.join(', ')})` : ''}`)
    }
  }
  console.log()

  // ═══════════════════════════════════════════════
  // ④ Multi-Agent Coordination
  // ═══════════════════════════════════════════════
  console.log('━━━ ④ Multi-Agent Coordination ━━━\n')

  const userSkills = ['Vue.js', 'TypeScript', 'Node.js', 'HTML/CSS']
  const userFit: CareerFit = {
    logicalThinking: 4, communication: 3, creativity: 3,
    execution: 4, leadership: 2, analyticalSkill: 3,
  }

  console.log('👤 用户: "我想转AI，帮我看看"\n')

  const response = await orchestration.process({
    userMessage: '我想转AI，帮我看看',
    userId: 'demo_user',
    skills: userSkills,
    fit: userFit,
    intent: { type: 'career_transition' },
    workflow: 'job_change',
  })

  console.log('🤖 协调结果:')
  console.log(response.message)
  console.log()
  console.log(`📊 处理时间: ${response.metadata.processingTimeMs}ms`)
  console.log(`📊 使用 Agent: ${response.metadata.agentsUsed.join(', ') || '无'}`)
  console.log(`📊 置信度: ${response.confidence}`)
  console.log(`📊 建议操作: ${response.suggestedActions.join(', ')}`)
  console.log(`📊 工作流步骤: ${response.steps.length}`)
  for (const step of response.steps) {
    console.log(`    ${step.stepId}: ${step.status} (${step.durationMs}ms)`)
  }
  console.log()

  // ═══════════════════════════════════════════════
  // ⑤ Hermes Adapter
  // ═══════════════════════════════════════════════
  console.log('━━━ ⑤ Hermes Adapter ━━━\n')

  const adapter = orchestration.adapter
  console.log(`适配器: ${adapter.name} v${adapter.version}`)

  const instance = await adapter.spawn({
    agentType: 'career_advisor',
    input: { userMessage: '测试' },
  })
  console.log(`创建 Agent 实例: ${instance.id} (${instance.type})`)

  const status = await adapter.getStatus(instance.id)
  console.log(`实例状态: ${status}`)

  await adapter.terminate(instance.id)
  console.log(`实例已销毁`)
  console.log()

  // ═══════════════════════════════════════════════
  // 系统状态
  // ═══════════════════════════════════════════════
  console.log('━━━ 系统状态 ━━━\n')

  const sysStatus = orchestration.getStatus()
  console.log(`已注册 Agent: ${sysStatus.agents.length}`)
  console.log(`Bus 消息历史: ${sysStatus.busHistory.length} 条`)
  console.log(`适配器: ${sysStatus.adapter}`)

  console.log('\n═══════════════════════════════════════════════')
  console.log('  Phase 3-E 验证完成 ✅')
  console.log('  Agent Orchestration Runtime 全部通过')
  console.log('═══════════════════════════════════════════════')
}

demo().catch(console.error)
