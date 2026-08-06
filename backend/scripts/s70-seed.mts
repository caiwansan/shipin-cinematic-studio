/**
 * S7.0 Task 01 — AgentDefinition Seed（幂等, code 唯一）
 * def-legal-advisor + 3 组件 Skill（F1 同构 Alice/短剧/新媒体）
 */
import { prisma } from '../src/utils/index.js'

const DEFS = [
  { code: 'def-legal-advisor', name: '法务合同审查 AI Employee', capabilities: ['contract.review', 'risk.analysis', 'clause.optimize'] },
  { code: 'def-contract-reviewer', name: '合同审查 Skill', capabilities: ['contract.review'] },
  { code: 'def-risk-analyst', name: '风险分析 Skill', capabilities: ['risk.analysis'] },
  { code: 'def-clause-optimizer', name: '条款优化 Skill', capabilities: ['clause.optimize'] },
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
        description: `${d.name}（S7.0 法务域）`,
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
