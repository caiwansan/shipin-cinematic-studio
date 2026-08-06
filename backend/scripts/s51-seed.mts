/**
 * S5.1 Task 01 — AgentDefinition Seed（幂等, code 唯一, 不覆盖已有）
 * Alice 模板同构: 员工 def + 3 组件 Skill def（F1: AgentDefinition 唯能力源, 自排除）
 */
import { prisma } from '../src/utils/index.js'

const DEFS = [
  { code: 'def-shortdrama-director', name: '短剧导演 AI Employee', capabilities: ['script.analysis', 'storyboard.plan', 'prompt.optimize'] },
  { code: 'def-script-analyst', name: '剧本分析 Skill', capabilities: ['script.analysis'] },
  { code: 'def-storyboard-planner', name: '分镜规划 Skill', capabilities: ['storyboard.plan'] },
  { code: 'def-prompt-optimizer', name: 'Prompt 优化 Skill', capabilities: ['prompt.optimize'] },
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
        description: `${d.name}（S5.1 短剧域）`,
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
