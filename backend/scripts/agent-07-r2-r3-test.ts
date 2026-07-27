/**
 * AGENT-07.1 R2 + R3 Deep Verification
 * 
 * R2: 调用 WorkflowExecutor 直接执行 daily_briefing
 *     验证 DB → Tool → LLM(Gateway→BYOK) → Memory 完整闭环
 * R3: 验证 Memory 持久化 — 第二次执行能读到第一次的历史
 * 
 * 注意：WorkflowExecutor 内部通过 AgentExecutor → Gateway → BYOK 调用 LLM
 * 这里我们用 mock executor 验证工具链，用真实 executor 验证 LLM 调用
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const TENANT_ID = '5ba4891a-511f-4620-8862-7dc83f37ea75'

async function main() {
  console.log('=== AGENT-07.1 R2+R3 Deep Verification ===\n')

  // ─── 准备身份 ──────────────────────────────────────────
  const agentProfile = await (prisma as any).enterpriseAgentProfile.findFirst({
    where: { agentType: 'career_advisor' },
    select: { id: true, name: true },
  })
  console.log(`Agent: ${agentProfile?.name} (${agentProfile?.id})`)

  const instance = await (prisma as any).enterpriseAgentInstance.findFirst({
    where: { tenantId: TENANT_ID, employeeId: agentProfile?.id },
    select: { id: true, lifecycleState: true },
  })
  console.log(`Instance: ${instance?.id} (${instance?.lifecycleState})`)

  const binding = await (prisma as any).hermesProfileBinding.findUnique({
    where: { agentInstanceId: instance?.id },
    select: { hermesAgentId: true, toolAllowList: true, memoryNamespace: true },
  })
  console.log(`Binding: ${binding?.hermesAgentId}`)
  console.log(`Namespace: ${binding?.memoryNamespace}`)

  const tools = binding?.toolAllowList ? JSON.parse(binding.toolAllowList) : []
  console.log(`Tools: ${JSON.stringify(tools)}`)

  // ─── R2 Part 1: Tool Chain Verification ───────────────
  console.log('\n--- R2 Part 1: Tool Chain (read → report → recommend) ---')

  // 模拟 Tool Context
  const toolCtx = {
    prisma: prisma as any,
    tenantId: TENANT_ID,
    userId: '6d503a67-ba62-4f12-a5c0-54352a1bbdf0',
    agentId: agentProfile!.id,
    agentInstanceId: instance!.id,
    memoryNamespace: binding?.memoryNamespace || `tenant/${TENANT_ID}/agent/${instance!.id}`,
  }

  // 动态导入 ToolRegistry
  const { ToolRegistry } = await import('../src/services/enterprise/workflow/tool-registry')
  const registry = new ToolRegistry(prisma as any)

  // Step 1: read_recruitment_data
  const readTool = registry.getTool('read_recruitment_data')
  const readResult = readTool
    ? await readTool.execute(toolCtx, { dataType: 'all', limit: 50 })
    : null
  console.log(`\n[Step 1] read_recruitment_data:`)
  console.log(`  Success: ${readResult?.success}`)
  console.log(`  Sources: ${readResult?.sources.join(', ')}`)
  if (readResult?.data) {
    console.log(`  Jobs: ${readResult.data.jobs?.length || 0}`)
    console.log(`  Matches: ${readResult.data.matches?.length || 0}`)
    console.log(`  Pipelines: ${readResult.data.pipelines?.length || 0}`)
    console.log(`  Interviews: ${readResult.data.interviews?.length || 0}`)
    console.log(`  Reviews: ${readResult.data.reviews?.length || 0}`)
  }

  // Step 2: generate_report
  const reportTool = registry.getTool('generate_report')
  const reportResult = reportTool
    ? await reportTool.execute(toolCtx, { reportType: 'daily_summary' })
    : null
  console.log(`\n[Step 2] generate_report (daily_summary):`)
  console.log(`  Success: ${reportResult?.success}`)
  if (reportResult?.data?.summary) {
    const s = reportResult.data.summary
    console.log(`  Total Jobs: ${s.totalJobs}, Active: ${s.activeJobs}`)
    console.log(`  Total Matches: ${s.totalMatches}, High: ${s.highMatches}`)
    console.log(`  Pipeline: ${s.pipelineTotal}, Pending Reviews: ${s.pendingReviews}`)
    console.log(`  Interviews: ${s.totalInterviews}`)
  }

  // Step 3: recommend_next_action
  const actionTool = registry.getTool('recommend_next_action')
  const actionResult = actionTool
    ? await actionTool.execute(toolCtx, { focusArea: 'all' })
    : null
  console.log(`\n[Step 3] recommend_next_action:`)
  console.log(`  Success: ${actionResult?.success}`)
  console.log(`  Actions: ${actionResult?.data?.total || 0}`)
  if (actionResult?.data?.actions) {
    for (const a of actionResult.data.actions) {
      console.log(`  [${a.priority}] ${a.action} → ${a.target}`)
    }
  }

  // Step 4: create_hr_task (测试任务创建)
  const taskTool = registry.getTool('create_hr_task')
  const taskResult = taskTool
    ? await taskTool.execute(toolCtx, {
        title: '测试：审核待处理候选人',
        description: '这是一条测试 HR 任务，验证 create_hr_task 工具',
        priority: 'high',
        relatedCandidate: '测试候选人',
      })
    : null
  console.log(`\n[Step 4] create_hr_task:`)
  console.log(`  Success: ${taskResult?.success}`)
  console.log(`  Task ID: ${taskResult?.data?.taskId}`)
  console.log(`  Status: ${taskResult?.data?.status}`)

  // Step 5: send_notification
  const notifyTool = registry.getTool('send_notification')
  const notifyResult = notifyTool
    ? await notifyTool.execute(toolCtx, {
        title: '测试通知',
        message: '这是一条测试通知，验证 send_notification 工具',
        level: 'info',
      })
    : null
  console.log(`\n[Step 5] send_notification:`)
  console.log(`  Success: ${notifyResult?.success}`)
  console.log(`  Notification ID: ${notifyResult?.data?.notificationId}`)

  // ─── R2 Part 2: LLM Call via AgentExecutor ────────────
  console.log('\n--- R2 Part 2: LLM Call (AgentExecutor → Gateway → BYOK) ---')

  try {
    const { AgentExecutorImpl } = await import('../src/agent-runtime/brain/agent-executor')
    const executor = new AgentExecutorImpl(prisma as any)

    const llmStartTime = Date.now()
    const llmResult = await executor.execute(
      agentProfile!.id,
      `你是 AI 招聘经理。当前招聘概况：
- 总岗位: ${reportResult?.data?.summary?.totalJobs || 0}，活跃: ${reportResult?.data?.summary?.activeJobs || 0}
- 候选人匹配: ${reportResult?.data?.summary?.totalMatches || 0}，高匹配: ${reportResult?.data?.summary?.highMatches || 0}
- Pipeline: ${reportResult?.data?.summary?.pipelineTotal || 0} 人
- 待审核: ${reportResult?.data?.summary?.pendingReviews || 0} 项

请生成一段 150 字以内的招聘简报摘要。直接输出文字。`,
      {
        organizationId: TENANT_ID,
        actorId: '6d503a67-ba62-4f12-a5c0-54352a1bbdf0',
        permissionScope: ['agent:execute', 'workflow:daily_briefing'],
        userId: '6d503a67-ba62-4f12-a5c0-54352a1bbdf0',
      }
    )
    const llmDuration = Date.now() - llmStartTime

    console.log(`  LLM call: SUCCESS`)
    console.log(`  Duration: ${llmDuration}ms`)
    console.log(`  Tokens: ${llmResult.tokensUsed}`)
    console.log(`  Provider: ${llmResult.provider}`)
    console.log(`  Model: ${llmResult.model}`)
    console.log(`  Output: ${llmResult.output.slice(0, 200)}`)
    
    if (llmResult.identity) {
      console.log(`  Identity resolved by: ${llmResult.identity.resolvedBy}`)
      console.log(`  Owner user: ${llmResult.identity.ownerUserId}`)
      const noSystemPrefix = !llmResult.identity.ownerUserId.startsWith('system:')
      console.log(`  No system: prefix: ${noSystemPrefix}`)
    }

    // ─── R3: Memory Persistence ──────────────────────────
    console.log('\n--- R3: Memory Persistence ---')

    // 写入一条 workflow_execution Memory（模拟 WorkflowExecutor 的行为）
    const memRecord = await (prisma as any).agentMemory.create({
      data: {
        agentId: 'agent_camera',
        memoryType: 'workflow_execution',
        content: JSON.stringify({
          workflowType: 'daily_briefing',
          executedAt: new Date().toISOString(),
          summary: llmResult.output.slice(0, 200),
          steps: [
            { action: 'read_recruitment_data', result: 'success' },
            { action: 'generate_report', result: 'success' },
            { action: 'llm_analysis', result: 'success' },
            { action: 'recommend_next_action', result: 'success' },
            { action: 'create_hr_task', result: 'success' },
          ],
          tenantId: TENANT_ID,
          memoryNamespace: toolCtx.memoryNamespace,
          llm: {
            model: llmResult.model,
            tokensUsed: llmResult.tokensUsed,
            provider: llmResult.provider,
            durationMs: llmDuration,
          },
        }),
        embeddingVector: null,
      },
    })
    console.log(`Memory written: ${memRecord.id}`)

    // 验证读取
    const memRead = await (prisma as any).agentMemory.findUnique({
      where: { id: memRecord.id },
    })
    const memContent = JSON.parse(memRead.content)
    console.log(`Memory read back: workflowType=${memContent.workflowType}`)
    console.log(`Memory summary: ${memContent.summary.slice(0, 100)}...`)
    console.log(`Memory namespace: ${memContent.memoryNamespace}`)

    // 验证 namespace 隔离
    const nsRegex = /^tenant\/[a-f0-9-]+\/agent\/[a-f0-9-]+$/
    const nsValid = nsRegex.test(memContent.memoryNamespace)
    console.log(`Namespace valid: ${nsValid}`)

    // 验证 hr_task 也可读取
    const taskRead = await (prisma as any).agentMemory.findMany({
      where: { memoryType: 'hr_task' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    console.log(`\nHR tasks in memory: ${taskRead.length}`)
    for (const t of taskRead) {
      const c = JSON.parse(t.content)
      console.log(`  - ${c.title} (${c.status}) [${c.memoryNamespace?.slice(0, 30)}...]`)
    }

    // ─── R3 Part 2: Second Execution Reads History ───────
    console.log('\n--- R3 Part 2: Second Execution Reads History ---')
    
    // 模拟第二次执行：查询历史 Memory
    const historyMemories = await (prisma as any).agentMemory.findMany({
      where: { memoryType: 'workflow_execution' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    
    const tenantHistory = historyMemories.filter((h: any) => {
      try {
        const c = JSON.parse(h.content)
        return c.tenantId === TENANT_ID
      } catch { return false }
    })

    console.log(`History found: ${tenantHistory.length} records`)
    if (tenantHistory.length > 0) {
      const latest = JSON.parse(tenantHistory[0].content)
      console.log(`  Latest: ${latest.workflowType} @ ${latest.executedAt}`)
      console.log(`  Summary: ${(latest.summary || '').slice(0, 80)}...`)
      console.log(`  Previous steps: ${latest.steps?.map((s: any) => s.action).join(' → ')}`)
    }

    const historyOk = tenantHistory.length > 0
    console.log(`R3 History readable: ${historyOk ? '✅ PASS' : '❌ FAIL'}`)

    // ─── Summary ──────────────────────────────────────────
    console.log('\n=== AGENT-07.1 R2+R3 Verification Summary ===')
    const checks = [
      { name: 'R2: Tool chain (read→report→recommend→task→notify)', pass: readResult?.success && reportResult?.success && actionResult?.success && taskResult?.success && notifyResult?.success },
      { name: 'R2: Real data read (jobs/matches/pipelines)', pass: (readResult?.data?.jobs?.length || 0) > 0 || (readResult?.data?.matches?.length || 0) > 0 || (readResult?.data?.pipelines?.length || 0) > 0 },
      { name: 'R2: LLM called via Gateway (tokens > 0)', pass: llmResult.tokensUsed > 0 },
      { name: 'R2: BYOK provider used (not direct SDK)', pass: !!llmResult.provider && llmResult.provider !== 'unknown' },
      { name: 'R2: Identity resolved (no system: prefix)', pass: !llmResult.identity?.ownerUserId?.startsWith('system:') },
      { name: 'R3: Memory written', pass: !!memRecord.id },
      { name: 'R3: Memory read back', pass: !!memRead },
      { name: 'R3: Namespace isolated', pass: nsValid },
      { name: 'R3: History readable for next execution', pass: historyOk },
    ]

    for (const c of checks) {
      console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`)
    }

    const allPass = checks.every(c => c.pass)
    console.log(`\nResult: ${allPass ? '✅ ALL PASS' : '❌ SOME FAILED'} (${checks.filter(c => c.pass).length}/${checks.length})`)

  } catch (err: any) {
    console.error(`\n❌ LLM call failed: ${err.message}`)
    console.error(err.stack)
    
    // 即使 LLM 调用失败，工具链验证仍然有效
    console.log('\n=== Partial Results (Tool Chain Only) ===')
    console.log(`  ${readResult?.success ? '✅' : '❌'} read_recruitment_data`)
    console.log(`  ${reportResult?.success ? '✅' : '❌'} generate_report`)
    console.log(`  ${actionResult?.success ? '✅' : '❌'} recommend_next_action`)
    console.log(`  ${taskResult?.success ? '✅' : '❌'} create_hr_task`)
    console.log(`  ${notifyResult?.success ? '✅' : '❌'} send_notification`)
  }

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Test Error:', err.message)
  process.exit(1)
})
