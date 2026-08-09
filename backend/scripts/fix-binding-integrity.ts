/**
 * fix-binding-integrity.ts — 修复 HermesProfileBinding 数据完整性
 * 1. 删除孤儿 binding（引用不存在的 instance）
 * 2. 修复不匹配的 binding（agentInstanceId 用了 employeeId）
 */
import { prisma } from '../src/utils/index.js'

async function main() {
  const allBindings = await (prisma as any).hermesProfileBinding.findMany()

  console.log(`=== 绑定数据完整性检查 (${allBindings.length} bindings) ===`)

  let orphanCount = 0
  let mismatchCount = 0
  let healthyCount = 0

  for (const b of allBindings) {
    const inst = await prisma.enterpriseAgentInstance.findUnique({
      where: { id: b.agentInstanceId }
    })

    if (!inst) {
      // Check if agentInstanceId is actually an employeeId
      const profile = await prisma.enterpriseAgentProfile.findUnique({
        where: { id: b.agentInstanceId }
      })
      if (profile) {
        console.log(`  WARN MISMATCH: binding ${b.hermesAgentId} uses employeeId ${b.agentInstanceId.slice(0,8)} as agentInstanceId`)

        // Find the correct instance for this employee
        const correctInst = await prisma.enterpriseAgentInstance.findUnique({
          where: { employeeId: b.agentInstanceId }
        })
        if (correctInst) {
          console.log(`    -> Found correct instance: ${correctInst.id.slice(0,8)}`)
          // Check if binding already exists for correct instance
          const existingBinding = await (prisma as any).hermesProfileBinding.findUnique({
            where: { agentInstanceId: correctInst.id }
          })
          if (!existingBinding) {
            // Update the binding to point to correct instance
            await (prisma as any).hermesProfileBinding.update({
              where: { id: b.id },
              data: {
                agentInstanceId: correctInst.id,
                organizationId: correctInst.organizationId,
              }
            })
            console.log(`    -> FIXED: updated agentInstanceId to ${correctInst.id.slice(0,8)}`)
          } else {
            console.log(`    -> SKIP: correct instance already has binding, deleting orphan`)
            await (prisma as any).hermesProfileBinding.delete({ where: { id: b.id } })
          }
        } else {
          console.log(`    -> No instance found for employee, deleting orphan binding`)
          await (prisma as any).hermesProfileBinding.delete({ where: { id: b.id } })
        }
        mismatchCount++
      } else {
        console.log(`  DELETE ORPHAN: binding ${b.hermesAgentId} references non-existent instance ${b.agentInstanceId.slice(0,8)}`)
        await (prisma as any).hermesProfileBinding.delete({ where: { id: b.id } })
        orphanCount++
      }
    } else {
      healthyCount++
    }
  }

  console.log(`\n  Total: ${allBindings.length} | Healthy: ${healthyCount} | Fixed mismatch: ${mismatchCount} | Deleted orphan: ${orphanCount}`)

  // Final verification
  const finalBindings = await (prisma as any).hermesProfileBinding.count()
  const finalInstances = await prisma.enterpriseAgentInstance.count({ where: { runtimeStatus: 'active' } })
  console.log(`\n  Final: ${finalBindings} bindings / ${finalInstances} active instances`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
