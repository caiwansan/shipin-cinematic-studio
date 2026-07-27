/**
 * BETA-06.1 Golden Case — Runtime Truth Verification 执行脚本
 * 直接通过 Prisma + Service 层验证 AI 员工真实工作能力
 */
import { prisma } from '../utils/index.js'
import { enterpriseAgentRuntime } from '../services/enterprise/enterprise-agent-runtime.service.js'
import { enterpriseLlmService } from '../services/enterprise/enterprise-llm.service.js'

// 测试：使用一个假的 DeepSeek API Key 来验证调用链路
// 真实环境需要替换为有效 KEY
const TEST_API_KEY = 'sk-test-golden-case-' + Date.now()

async function main() {
  console.log('=== BETA-06.1 Golden Case — Runtime Truth Verification ===\n')

  // ── Step 1: 创建 Tenant + Organization ────────────────────
  console.log('[Step 1] Creating Tenant + Organization...')

  const tenant = await prisma.tenant.create({
    data: { name: '昆仑镜 Demo Company', type: 'enterprise' }
  })
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`)

  const govOrg = await prisma.govOrganization.create({
    data: {
      name: '昆仑镜 Demo Company',
      tenantId: tenant.id,
      type: 'enterprise',
      departmentRole: 'ai_department',
      status: 'active',
    }
  })
  console.log(`  Organization: ${govOrg.name} (${govOrg.id})`)

  // ── Step 2: 创建 Enterprise LLM Config (BYOK) ──────────────
  console.log('\n[Step 2] Creating Enterprise LLM Config (BYOK)...')

  const llmConfig = await enterpriseLlmService.create({
    tenantId: govOrg.id,
    provider: 'deepseek',
    modelName: 'deepseek-chat',
    apiKey: TEST_API_KEY,
    baseUrl: 'https://api.deepseek.com',
    credentialOwner: 'enterprise',
  })
  console.log(`  LLM Config: ${llmConfig.provider}/${llmConfig.modelName} (${llmConfig.id})`)

  // ── Step 3: 创建 Enterprise Agent Profile ──────────────────
  console.log('\n[Step 3] Creating Enterprise Agent Profile...')

  const profile = await prisma.enterpriseAgentProfile.create({
    data: {
      tenantId: govOrg.id,
      organizationId: govOrg.id,
      name: '市场分析师 AI',
      role: 'market_analyst',
      agentType: 'analyst',
      goal: '分析行业趋势并输出商业建议',
      status: 'active',
      runtimeStatus: 'draft',
      runtimeAgentId: null,
      knowledgeScope: '[]',
      tools: '[]',
      permissions: '[]',
    }
  })
  console.log(`  Agent Profile: ${profile.name} (${profile.id})`)

  // ── Step 4: 激活 Agent ────────────────────────────────────
  console.log('\n[Step 4] Activating Agent...')

  const activateResult = await enterpriseAgentRuntime.createAndActivateAgent({
    profileId: profile.id,
    tenantId: govOrg.id,
    organizationId: govOrg.id,
    name: profile.name,
    role: profile.role,
    agentType: profile.agentType,
    userId: tenant.id, // 使用 tenant ID 作为 userId
  })
  console.log(`  Activation: ${JSON.stringify(activateResult)}`)

  // ── Step 5: 创建 Task ──────────────────────────────────────
  console.log('\n[Step 5] Creating Task...')

  const instance = await prisma.enterpriseAgentInstance.findUnique({
    where: { employeeId: profile.id }
  })

  const task = await prisma.enterpriseAgentTask.create({
    data: {
      tenantId: govOrg.id,
      agentInstanceId: instance?.id || '',
      taskType: 'market_analysis',
      inputSummary: '分析 AI SaaS 市场三个竞争趋势，输出企业机会建议。',
      status: 'pending',
      startedAt: new Date(),
    }
  })
  console.log(`  Task: ${task.id}`)

  // ── Step 6: 执行任务（真实 LLM 调用）─────────────────────
  console.log('\n[Step 6] Executing Task (Real LLM Call)...')

  const execResult = await enterpriseAgentRuntime.executeTask({
    taskId: task.id,
    profileId: profile.id,
    tenantId: govOrg.id,
    organizationId: govOrg.id,
    userId: tenant.id,
    taskType: 'market_analysis',
    instruction: '分析最近 AI SaaS 市场三个竞争趋势，输出企业机会建议。',
  })
  console.log(`  Execution: success=${execResult.success}, tokens=${execResult.tokenInput}+${execResult.tokenOutput}, cost=${execResult.cost}, duration=${execResult.durationMs}ms`)
  if (execResult.error) console.log(`  Error: ${execResult.error}`)
  if (execResult.output) console.log(`  Output (first 500): ${execResult.output.slice(0, 500)}`)

  // ── Step 7: 验证数据库 ────────────────────────────────────
  console.log('\n[Step 7] Database Verification...\n')

  const verifyInstance = await prisma.enterpriseAgentInstance.findUnique({
    where: { employeeId: profile.id }
  })
  const verifyTask = await prisma.enterpriseAgentTask.findUnique({
    where: { id: task.id }
  })
  const verifyProfile = await prisma.enterpriseAgentProfile.findUnique({
    where: { id: profile.id }
  })

  console.log('  === Database Results ===')
  console.log(`  EnterpriseAgentInstance:`)
  console.log(`    status: ${verifyInstance?.runtimeStatus}`)
  console.log(`    agentId: ${verifyInstance?.agentId}`)
  console.log(`    totalTasks: ${verifyInstance?.totalTasks}`)
  console.log(`  EnterpriseAgentTask:`)
  console.log(`    status: ${verifyTask?.status}`)
  console.log(`    tokenInput: ${verifyTask?.tokenInput}`)
  console.log(`    tokenOutput: ${verifyTask?.tokenOutput}`)
  console.log(`    cost: ${verifyTask?.cost}`)
  console.log(`    durationMs: ${verifyTask?.durationMs}`)

  // ── Step 8: Outcome 验证 ──────────────────────────────────
  console.log('\n[Step 8] Outcome Verification...')
  const outcomes = await prisma.enterpriseOutcome.findMany({
    where: { tenantId: govOrg.id }
  })
  console.log(`  EnterpriseOutcome count: ${outcomes.length}`)
  if (outcomes.length > 0) {
    console.log(`  First Outcome: type=${outcomes[0].type}, status=${outcomes[0].status}`)
  }

  // ── 最终判定 ──────────────────────────────────────────────
  console.log('\n=== BETA-06.1 GATE RESULT ===\n')

  const checks: [string, boolean][] = [
    ['Agent 激活', verifyInstance?.runtimeStatus === 'active'],
    ['Runtime 绑定', !!verifyInstance?.agentId],
    ['Task 完成', verifyTask?.status === 'completed'],
    ['Token > 0', (verifyTask?.tokenInput || 0) > 0 && (verifyTask?.tokenOutput || 0) > 0],
    ['Cost > 0', (verifyTask?.cost || 0) > 0],
    ['Duration > 0', (verifyTask?.durationMs || 0) > 0],
    ['Outcome VERIFIED', outcomes.some(o => o.status === 'VERIFIED')],
  ]

  let allPass = true
  for (const [name, pass] of checks) {
    console.log(`  ${pass ? '✅' : '❌'} ${name}: ${pass ? 'PASS' : 'FAIL'}`)
    if (!pass) allPass = false
  }

  console.log(`\n  ${allPass ? '🟢 BETA-06.1 PASS — Runtime Truth Verified!' : '🔴 BETA-06.1 FAIL — See details above'}`)

  await prisma.$disconnect()
}

main().catch((e: any) => {
  console.error('Golden Case Error:', e.message)
  process.exit(1)
})
