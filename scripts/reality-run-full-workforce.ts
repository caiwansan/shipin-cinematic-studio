/**
 * scripts/reality-run-full-workforce.ts
 * 
 * 南波万 Full Workforce Reality Run
 * 验证所有 AI 员工全链路执行
 */
import { prisma } from '../backend/src/utils/index.js'
import { mediaAgentRuntimeAdapter } from '../backend/src/services/media/agent/media-agent-runtime-adapter.js'

const NANBOWAN_ID = '9085bc18-ea34-466d-91ab-b636c9e8431a'

interface AgentTest {
  name: string
  taskType: string
  instruction: string
}

const AGENTS: AgentTest[] = [
  { name: 'Alice', taskType: 'daily_operation_check', instruction: '执行今日运营检查，输出日报模板' },
  { name: '热点分析师小镜', taskType: 'hotspot_scan', instruction: '扫描今日AI/科技热点，列出3个热门话题' },
  { name: '内容创作小笔', taskType: 'content_creation', instruction: '写一篇关于AI如何改变新媒体运营的短文（200字以内）' },
]

async function main() {
  console.log('=== 南波万 Full Workforce Reality Run ===\n')

  const results: { name: string; success: boolean; durationMs: number; tokens: number; cost: number; error?: string }[] = []

  for (const agent of AGENTS) {
    const profile = await prisma.enterpriseAgentProfile.findFirst({ where: { name: agent.name } })
    if (!profile) {
      results.push({ name: agent.name, success: false, durationMs: 0, tokens: 0, cost: 0, error: 'Profile not found' })
      console.log(`❌ ${agent.name}: Profile not found`)
      continue
    }

    const inst = await prisma.enterpriseAgentInstance.findFirst({ where: { employeeId: profile.id } })
    if (!inst) {
      results.push({ name: agent.name, success: false, durationMs: 0, tokens: 0, cost: 0, error: 'No instance' })
      console.log(`❌ ${agent.name}: No instance`)
      continue
    }

    try {
      const result = await mediaAgentRuntimeAdapter.executeMediaAgentTask({
        instanceId: inst.id,
        taskType: agent.taskType,
        instruction: agent.instruction,
        taskId: `${agent.name.toLowerCase().replace(/[^a-z]/g, '_')}_${Date.now()}`,
        userId: NANBOWAN_ID,
      })

      if (result.success) {
        results.push({
          name: agent.name,
          success: true,
          durationMs: result.durationMs,
          tokens: (result.tokenInput || 0) + (result.tokenOutput || 0),
          cost: result.cost || 0,
        })
        console.log(`✅ ${agent.name}: ${result.durationMs}ms, ${(result.tokenInput || 0) + (result.tokenOutput || 0)} tokens, ¥${(result.cost || 0).toFixed(4)}`)
      } else {
        results.push({ name: agent.name, success: false, durationMs: result.durationMs, tokens: 0, cost: 0, error: result.error })
        console.log(`❌ ${agent.name}: ${result.error}`)
      }
    } catch (err: any) {
      results.push({ name: agent.name, success: false, durationMs: 0, tokens: 0, cost: 0, error: err.message })
      console.log(`❌ ${agent.name}: ${err.message}`)
    }
  }

  console.log('\n=== Summary ===')
  const passed = results.filter(r => r.success).length
  for (const r of results) {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.name}: ${r.success ? `${r.durationMs}ms, ${r.tokens} tokens, ¥${r.cost.toFixed(4)}` : r.error}`)
  }
  console.log(`\nResult: ${passed}/${results.length} PASS`)

  if (passed === results.length) {
    console.log('\n🎉 ALL AGENTS EXECUTED SUCCESSFULLY — Workforce is operational!')
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
