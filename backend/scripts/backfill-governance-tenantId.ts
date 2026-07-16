/**
 * Backfill Script — Sprint 4.2.3.1
 * 
 * 为已有 Enterprise 记录回填 governanceTenantId。
 * CTO 要求: 必须支持 --dry-run 模式。
 * 
 * 使用方式:
 *   npx ts-node scripts/backfill-governance-tenantId.ts --dry-run
 *   npx ts-node scripts/backfill-governance-tenantId.ts --execute
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DRY_RUN = process.argv.includes('--dry-run')
const EXECUTE = process.argv.includes('--execute')

interface BackfillResult {
  table: string
  total: number
  mapped: number
  conflicts: number
  missing: number
}

async function backfillTable(
  table: string,
  records: any[],
): Promise<BackfillResult> {
  let mapped = 0
  let conflicts = 0
  let missing = 0

  for (const record of records) {
    const tenantId = record.tenantId || record.tenant_id
    if (!tenantId) {
      missing++
      continue
    }

    // 查找 User → GovUser → Tenant
    const user = await prisma.user.findUnique({
      where: { id: tenantId },
    })

    if (!user) {
      // tenantId 不是 userId，尝试直接作为 governanceTenantId
      const govTenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      })
      if (govTenant) {
        if (EXECUTE) {
          await (prisma as any)[table].update({
            where: { id: record.id },
            data: { governanceTenantId: tenantId },
          })
        }
        mapped++
      } else {
        missing++
      }
      continue
    }

    // 通过 User.email 找 GovUser
    const govUser = await prisma.govUser.findFirst({
      where: { email: user.email },
    })

    if (govUser) {
      if (EXECUTE) {
        await (prisma as any)[table].update({
          where: { id: record.id },
          data: { governanceTenantId: govUser.tenantId },
        })
      }
      mapped++
    } else {
      missing++
    }
  }

  return { table, total: records.length, mapped, conflicts, missing }
}

async function main() {
  if (!DRY_RUN && !EXECUTE) {
    console.error('Usage: backfill-governance-tenantId.ts --dry-run|--execute')
    process.exit(1)
  }

  console.log(`\n🔄 Backfill Governance TenantId`)
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}\n`)

  const tables = [
    'enterpriseOperationEvent',
    'enterpriseSignal',
    'enterpriseRecommendation',
    'enterpriseAction',
  ]

  const tableAccess: Record<string, string> = {
    enterpriseOperationEvent: 'enterpriseOperationEvent',
    enterpriseSignal: 'enterpriseSignal',
    enterpriseRecommendation: 'enterpriseRecommendation',
    enterpriseAction: 'enterpriseAction',
  }

  for (const table of tables) {
    const records = await (prisma as any)[tableAccess[table]].findMany({
      where: { governanceTenantId: null },
      select: { id: true, tenantId: true },
    })

    const result = await backfillTable(table, records)
    console.log(
      `   ${table}: total=${result.total}, mapped=${result.mapped}, missing=${result.missing}`
    )
  }

  console.log('\n✅ Done.')
  if (DRY_RUN) {
    console.log('   This was a dry run. No changes were made.')
    console.log('   Run with --execute to apply changes.')
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('Backfill failed:', e)
  process.exit(1)
})
