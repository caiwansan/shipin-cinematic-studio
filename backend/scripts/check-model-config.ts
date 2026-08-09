/**
 * check-model-config.ts — 检查 AI 员工模型配置状态
 */
import { prisma } from '../src/utils/index.js'

async function main() {
  const recruitmentEmployees = await prisma.enterpriseAgentProfile.findMany({
    where: { businessType: 'career' },
    select: { id: true, name: true, agentType: true, tenantId: true, organizationId: true }
  })

  console.log('=== 招聘类 AI 员工模型配置检查 ===')
  for (const emp of recruitmentEmployees) {
    if (!emp.organizationId) {
      console.log(`  ${emp.name.padEnd(14)} | org: NULL | 需要配置组织`)
      continue
    }

    const orgConfig = await prisma.orgModelConfig.findFirst({
      where: { organizationId: emp.organizationId as any, enabled: true, capability: 'llm' },
      orderBy: { isDefault: 'desc' }
    })

    let keyStatus = 'NO_CONFIG'
    if (orgConfig) {
      const cred = await prisma.providerCredential.findFirst({
        where: { organizationId: emp.organizationId as any, provider: orgConfig.provider }
      })
      keyStatus = cred ? `HAS_KEY(${cred.healthStatus})` : 'NO_KEY'
    }

    console.log(`  ${emp.name.padEnd(14)} | org: ${emp.organizationId.slice(0, 8)} | model: ${orgConfig ? orgConfig.provider + '/' + orgConfig.model : 'NONE'} | key: ${keyStatus}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
