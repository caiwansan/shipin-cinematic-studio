/**
 * fix-hermes-bindings.ts — 为缺少 HermesProfileBinding 的实例创建绑定
 * 
 * 宪法依据：
 *   F4 Execution Authority: Hermes = 唯一执行者，binding = 子代理身份
 *   F5 Hermes Boundary: toolAllowList = 白名单 Tool 限权
 *   S3.3: Hermes = Atomic Executor，每 step 独立授权
 */
import { prisma } from '../src/utils/index.js'

async function main() {
  console.log('=== 修复 HermesProfileBinding ===')

  const allInstances = await prisma.enterpriseAgentInstance.findMany({
    where: { runtimeStatus: 'active' },
    select: { id: true, agentId: true, employeeId: true, tenantId: true, organizationId: true }
  })

  let createdCount = 0
  let skippedCount = 0

  for (const inst of allInstances) {
    // Check if binding already exists
    const existing = await (prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId: inst.id }
    })

    if (existing) {
      skippedCount++
      continue
    }

    // Generate hermesAgentId following the pattern
    const tenantShort = inst.tenantId.slice(0, 8)
    const instanceShort = inst.id.slice(0, 8)
    const hermesAgentId = `hermes_${tenantShort}_${instanceShort}`
    const memoryNamespace = `tenant/${inst.tenantId}/agent/${inst.id}`

    // Get employee info for tool allowlist
    const employee = await prisma.enterpriseAgentProfile.findUnique({
      where: { id: inst.employeeId },
      select: { name: true, agentType: true, tools: true, capabilities: true }
    })

    // Build tool allowlist based on agent type
    const toolAllowList = buildToolAllowList(employee?.agentType || 'general')

    try {
      await (prisma as any).hermesProfileBinding.create({
        data: {
          tenantId: inst.tenantId,
          organizationId: inst.organizationId,
          agentInstanceId: inst.id,
          hermesAgentId: hermesAgentId,
          soulMdContent: null,
          toolAllowList: JSON.stringify(toolAllowList),
          memoryNamespace: memoryNamespace,
          identityProvider: 'hermes',
          status: 'active',
        }
      })

      createdCount++
      console.log(`  ✅ ${employee?.name || inst.agentId} → ${hermesAgentId} [${toolAllowList.join(', ')}]`)
    } catch (e: any) {
      console.log(`  ❌ ${employee?.name || inst.agentId} → ${e.message}`)
    }
  }

  console.log(`\n  ✅ 创建 ${createdCount} 个 | 跳过 ${skippedCount} 个（已有）`)

  // Verify
  const totalBindings = await (prisma as any).hermesProfileBinding.count()
  const totalInstances = await prisma.enterpriseAgentInstance.count({ where: { runtimeStatus: 'active' } })
  console.log(`\n  验证: ${totalBindings} bindings / ${totalInstances} active instances`)
}

/**
 * Build tool allowlist based on agent type
 * 宪法 F5: Hermes Boundary — 只执行 approved tools
 */
function buildToolAllowList(agentType: string): string[] {
  const baseTools = ['memory.read', 'memory.write', 'llm.chat']

  switch (agentType) {
    case 'recruiter':
      return [...baseTools, 'resume.parse', 'resume.match', 'job.analyze', 'candidate.search', 'candidate.compare']
    case 'interview':
      return [...baseTools, 'interview.evaluate', 'interview.question', 'interview.report', 'resume.parse']
    case 'talent_analyst':
      return [...baseTools, 'resume.parse', 'candidate.score', 'candidate.report', 'market.data']
    case 'talent_agent':
      return [...baseTools, 'resume.parse', 'candidate.search', 'candidate.outreach', 'job.match']
    case 'career_advisor':
      return [...baseTools, 'career.analyze', 'skill.gap', 'learning.path', 'market.trend']
    case 'hotspot_analyst':
      return [...baseTools, 'trend.analyze', 'trend.report', 'content.suggest']
    case 'content_creator':
      return [...baseTools, 'content.write', 'content.edit', 'content.publish', 'media.upload']
    default:
      return baseTools
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
