/**
 * fix-recruitment-runtime.ts — 求职招聘工作台 AI 员工修复脚本
 * 
 * 修复项：
 *   Phase 1: 僵尸任务（P0）— 标记卡死 running 任务为 failed
 *   Phase 2: Draft 员工 Runtime Instance（P1）— 为无 instance 的员工创建实例
 *   Phase 3: 验证修复结果
 */
import { prisma } from '../src/utils/index.js'

async function main() {
  // ═══════════════════════════════════════════════
  // Phase 1: 修复僵尸任务（P0）
  // ═══════════════════════════════════════════════
  console.log('=== Phase 1: 修复僵尸任务 ===')

  const zombieTasks = await prisma.enterpriseAgentTask.findMany({
    where: { status: 'running' },
    select: { id: true, taskType: true, startedAt: true, agentInstanceId: true }
  })

  for (const task of zombieTasks) {
    const duration = Date.now() - new Date(task.startedAt).getTime()
    const hours = Math.floor(duration / 3600000)
    console.log(`  任务 ${task.id.slice(0, 8)} | 类型: ${task.taskType} | 卡死: ${hours}h | instance: ${task.agentInstanceId.slice(0, 8)}`)
  }

  if (zombieTasks.length > 0) {
    const updateResult = await prisma.enterpriseAgentTask.updateMany({
      where: { status: 'running' },
      data: {
        status: 'failed',
        outputSummary: 'TIMEOUT: orphaned task auto-marked failed by system (stuck > 1h)',
        completedAt: new Date()
      }
    })
    console.log(`  ✅ 已标记 ${updateResult.count} 个僵尸任务为 failed`)
  } else {
    console.log('  ✅ 无僵尸任务')
  }

  // ═══════════════════════════════════════════════
  // Phase 2: 修复 Draft 员工 Runtime Instance（P1）
  // ═══════════════════════════════════════════════
  console.log('\n=== Phase 2: 修复 Draft 员工 Runtime Instance ===')

  const draftEmployees = await prisma.enterpriseAgentProfile.findMany({
    where: { runtimeStatus: 'draft' },
    select: { id: true, name: true, agentType: true, tenantId: true, organizationId: true }
  })

  let createdCount = 0
  for (const emp of draftEmployees) {
    // Check if instance already exists
    const existing = await prisma.enterpriseAgentInstance.findUnique({
      where: { employeeId: emp.id }
    })

    if (existing) {
      console.log(`  ⏭ ${emp.name} (${emp.agentType}) - 已有 instance: ${existing.id.slice(0, 8)}`)
      // Update employee status to active
      await prisma.enterpriseAgentProfile.update({
        where: { id: emp.id },
        data: { runtimeStatus: 'active' }
      })
      continue
    }

    // Create instance following the same pattern as enterprise-agent-runtime.service.ts
    const agentId = `agent_${emp.tenantId.slice(0, 8)}_${emp.id.slice(0, 8)}`
    const namespace = `tenant_${emp.tenantId.slice(0, 8)}_${emp.agentType}`

    const instance = await prisma.enterpriseAgentInstance.create({
      data: {
        tenantId: emp.tenantId,
        organizationId: emp.organizationId,
        employeeId: emp.id,
        agentId: agentId,
        runtime: 'enterprise',
        namespace: namespace,
        runtimeStatus: 'active',
        lifecycleState: 'ACTIVE',
        lastActiveAt: new Date(),
        totalTasks: 0,
        totalErrors: 0,
      }
    })

    // Update employee status
    await prisma.enterpriseAgentProfile.update({
      where: { id: emp.id },
      data: {
        runtimeAgentId: agentId,
        runtimeStatus: 'active',
        runtimeType: 'enterprise',
        lastExecutionAt: new Date(),
      }
    })

    createdCount++
    console.log(`  ✅ ${emp.name} (${emp.agentType}) - 创建 instance: ${instance.id.slice(0, 8)} | agentId: ${agentId}`)
  }
  console.log(`  ✅ 共创建 ${createdCount} 个 Runtime Instance`)

  // ═══════════════════════════════════════════════
  // Phase 3: 验证修复结果
  // ═══════════════════════════════════════════════
  console.log('\n=== Phase 3: 验证修复结果 ===')

  const remainingZombie = await prisma.enterpriseAgentTask.count({
    where: { status: 'running' }
  })
  console.log(`  僵尸任务剩余: ${remainingZombie}`)

  const remainingDraft = await prisma.enterpriseAgentProfile.count({
    where: { runtimeStatus: 'draft' }
  })
  console.log(`  Draft 员工剩余: ${remainingDraft}`)

  const totalActive = await prisma.enterpriseAgentProfile.count({
    where: { runtimeStatus: 'active' }
  })
  console.log(`  Active 员工总数: ${totalActive}`)

  const totalInstances = await prisma.enterpriseAgentInstance.count()
  console.log(`  Runtime Instance 总数: ${totalInstances}`)

  // ═══════════════════════════════════════════════
  // Phase 4: HermesProfileBinding 检查
  // ═══════════════════════════════════════════════
  console.log('\n=== Phase 4: HermesProfileBinding 检查 ===')

  const allInstances = await prisma.enterpriseAgentInstance.findMany({
    where: { runtimeStatus: 'active' },
    select: { id: true, agentId: true, employeeId: true, tenantId: true }
  })

  for (const inst of allInstances) {
    const binding = await prisma.hermesProfileBinding.findUnique({
      where: { agentInstanceId: inst.id }
    })
    const employee = await prisma.enterpriseAgentProfile.findUnique({
      where: { id: inst.employeeId },
      select: { name: true, agentType: true }
    })
    if (!binding) {
      console.log(`  ⚠️  ${employee?.name} (${inst.agentId}) - 缺少 HermesProfileBinding`)
    } else {
      console.log(`  ✅ ${employee?.name} (${inst.agentId}) - binding: ${binding.hermesAgentId}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
