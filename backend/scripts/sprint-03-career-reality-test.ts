/**
 * Sprint-03 Career Agent Reality Test
 * 验证 Career Agent 生产链路:
 *   User → CareerAgentInstance → EnterpriseAgentRuntimeService → ModelRouter → EnterpriseLlmConfig → callLLM → Task/Outcome
 */

import { PrismaClient } from '@prisma/client'
import { CareerAgentService } from '../src/services/enterprise/workflow/career-agent.service'
import { enterpriseAgentRuntime } from '../src/services/enterprise/enterprise-agent-runtime.service'

const prisma = new PrismaClient()

async function main() {
  console.log('═══ Sprint-03 Career Agent Reality Test ═══\n')

  // 使用测试用户
  const testUserId = 'b74bb4f2-f1fc-4819-93a5-0f3770e37c5a'
  const testUserName = '若蜀'

  console.log(`Test User: ${testUserName} (${testUserId})`)

  // ─── Step 0: 创建 EnterpriseLlmConfig 用于测试 ───
  console.log('\n[Step 0] 创建测试用 EnterpriseLlmConfig...')
  const existingConfig = await (prisma as any).enterpriseLlmConfig.findFirst({
    where: { tenantId: testUserId },
  })

  if (!existingConfig) {
    // 复用现有配置的 API key
    const sharedConfig = await (prisma as any).enterpriseLlmConfig.findFirst({
      where: { id: 'agent-llm-ms1lfjz3' },
    })

    if (!sharedConfig) {
      throw new Error('共享配置 agent-llm-ms1lfjz3 不存在')
    }

    const newConfig = await (prisma as any).enterpriseLlmConfig.create({
      data: {
        tenantId: testUserId,
        provider: sharedConfig.provider,
        modelName: sharedConfig.modelName,
        encryptedApiKey: sharedConfig.encryptedApiKey,
        baseUrl: sharedConfig.baseUrl,
        credentialOwner: 'enterprise',
        maxTokensPerDay: 0,
        maxRequestsPerMinute: 60,
        capabilities: '[]',
        enabled: true,
        status: 'active',
      },
    })
    console.log(`  ✅ 创建配置: ${newConfig.id}`)
  } else {
    console.log(`  ✅ 配置已存在: ${existingConfig.id}`)
  }

  // ─── Step 1: 创建 Career Agent ───
  console.log('\n[Step 1] 创建 Career Agent...')
  const careerAgentService = new CareerAgentService(prisma)

  let agent = await careerAgentService.getCareerAgent(testUserId)
  let created = false

  if (!agent) {
    const result = await careerAgentService.createAndDeploy({
      userId: testUserId,
      userName: testUserName,
      goal: '测试 Career Agent 生产链路',
    })
    agent = result
    created = true
    console.log(`  ✅ Career Agent 已创建: ${agent.profileId}`)
  } else {
    console.log(`  ✅ Career Agent 已存在: ${agent.profileId}`)
  }

  // ─── Step 2: 验证 Instance 状态 ───
  console.log('\n[Step 2] 验证 Agent Instance...')
  const instance = await (prisma as any).enterpriseAgentInstance.findUnique({
    where: { employeeId: agent.profileId },
  })

  if (!instance) {
    throw new Error('Instance 不存在!')
  }
  console.log(`  Instance ID: ${instance.id}`)
  console.log(`  Runtime: ${instance.runtime}`)
  console.log(`  Lifecycle: ${instance.lifecycleState}`)
  console.log(`  Status: ${instance.runtimeStatus}`)

  if (instance.runtime !== 'enterprise') {
    console.log(`  ⚠️  Runtime 不是 enterprise: ${instance.runtime}`)
  }

  // ─── Step 3: 创建 Task 并执行 ───
  console.log('\n[Step 3] 创建并执行任务...')

  const task = await (prisma as any).enterpriseAgentTask.create({
    data: {
      tenantId: testUserId,
      agentInstanceId: instance.id,
      taskType: 'career_activation',
      inputSummary: '职业助理初始化测试：请简单自我介绍，确认你可以帮助用户的求职需求。',
      status: 'running',
      startedAt: new Date(),
    },
  })
  console.log(`  Task 已创建: ${task.id}`)

  // ─── Step 4: 通过生产链路执行 ───
  console.log('\n[Step 4] 通过 EnterpriseAgentRuntimeService 执行...')

  const result = await enterpriseAgentRuntime.executeTask({
    taskId: task.id,
    profileId: agent.profileId,
    tenantId: testUserId,
    organizationId: testUserId,
    userId: testUserId,
    taskType: 'career_activation',
    instruction: '请简单自我介绍，确认你可以帮助用户的求职需求。用一句话回答。',
  })

  console.log(`  执行结果: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`)
  console.log(`  耗时: ${result.durationMs}ms`)
  console.log(`  Token Input: ${result.tokenInput}`)
  console.log(`  Token Output: ${result.tokenOutput}`)
  console.log(`  Cost: ${result.cost}`)

  if (result.output) {
    console.log(`\n  -- LLM 输出 --`)
    console.log(`  ${result.output.slice(0, 200)}...`)
  }

  if (result.error) {
    console.log(`  错误: ${result.error}`)
  }

  // ─── Step 5: 验证 Outcome ───
  console.log('\n[Step 5] 验证 Outcome...')

  if (result.outcomeId) {
    const outcome = await (prisma as any).enterpriseOutcome.findUnique({
      where: { id: result.outcomeId },
    })
    if (outcome) {
      console.log(`  ✅ Outcome 已生成: ${outcome.id}`)
      console.log(`     Type: ${outcome.outcomeType}`)
      console.log(`     Status: ${outcome.status}`)
    }
  }

  // ─── Step 6: 验证 AuditTrail ───
  console.log('\n[Step 6] 验证 AuditTrail...')
  const auditEvents = await (prisma as any).agentAuditTrail.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`  ✅ Audit 事件数: ${auditEvents.length}`)
  auditEvents.forEach((e: any) => {
    console.log(`     - ${e.action} (${e.resource})`)
  })

  // ─── Step 7: 总结 ───
  console.log('\n═══ Sprint-03 Reality Test 总结 ═══')
  console.log(`Career Agent 创建: ${created ? '✅ 新建' : '✅ 已存在'}`)
  console.log(`Runtime: ${instance.runtime}`)
  console.log(`任务执行: ${result.success ? '✅' : '❌'}`)
  console.log(`Outcome: ${result.outcomeId ? '✅' : '❌'}`)
  console.log(`AuditTrail: ${auditEvents.length > 0 ? '✅' : '❌'}`)

  const realityGate = result.success && result.outcomeId && auditEvents.length > 0
  console.log(`\nReality Gate: ${realityGate ? '✅ PASS' : '❌ FAIL'}`)

  await prisma.$disconnect()
  process.exit(realityGate ? 0 : 1)
}

main().catch(err => {
  console.error('❌ 测试失败:', err.message)
  prisma.$disconnect()
  process.exit(1)
})
