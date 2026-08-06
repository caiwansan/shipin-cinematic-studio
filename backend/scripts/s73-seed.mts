/**
 * S7.3 Task 01 — AgentDefinition Seed（幂等, code 唯一）
 * def-finance-analyst + 3 组件 Skill（F1 同构）
 */
import { prisma } from '../src/utils/index.js'

const DEFS = [
  { code: 'def-finance-analyst', name: '财务经营分析 AI Employee', capabilities: ['financial.report', 'expense.analysis', 'business.insight'] },
  { code: 'def-financial-reporter', name: '经营摘要 Skill', capabilities: ['financial.report'] },
  { code: 'def-expense-analyst', name: '费用分析 Skill', capabilities: ['expense.analysis'] },
  { code: 'def-business-insighter', name: '经营洞察 Skill', capabilities: ['business.insight'] },
]

for (const d of DEFS) {
  const existing = await prisma.agentDefinition.findUnique({ where: { code: d.code } })
  if (existing) {
    console.log(`EXISTS: ${d.code} (status=${existing.status}), skip`)
  } else {
    await prisma.agentDefinition.create({
      data: {
        code: d.code,
        name: d.name,
        version: '1.0.0',
        description: `${d.name}（S7.3 财务域）`,
        capabilities: JSON.stringify(d.capabilities),
        executionMode: 'sync',
        category: 'official',
        status: 'active',
      },
    })
    console.log(`CREATED: ${d.code}`)
  }
}

const rows = await prisma.agentDefinition.findMany({ select: { code: true, status: true } })
console.log('agent_definition rows:', rows.length)
for (const r of rows) console.log(' -', r.code, r.status)
process.exit(0)
