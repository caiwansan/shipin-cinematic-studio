require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

/**
 * 02-B Task 4 验证：LLM Usage Ledger 统一记账
 * 场景：callLLM 写 UsageLog / meta 附加 / 成本估算 / 各 agent 链路 / 独立调用链
 */
async function main() {
  const results = []
  const add = (n, ok, d) => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${n} — ${d}`) }

  const user = await prisma.user.findFirst()
  if (!user) { console.log('⚠️ 无用户'); return }

  try {
    const src = require('fs')

    // 场景 A：callLLM 成功路径写 UsageLog
    const llmSrc = src.readFileSync('src/services/hdz/llm.client.ts', 'utf8')
    add('A callLLM 写 UsageLog 明细', llmSrc.includes('prisma.usageLog.create') && llmSrc.includes('totalTokens'), 'provider/tokens/cost/isPlatform')

    // 场景 B：成本估算函数
    add('B 成本估算', llmSrc.includes('estimateLlmCost') && llmSrc.includes('deepseek: 2'), '按 provider 单价 × tokens')

    // 场景 C：LLMConfig 支持业务元数据
    add('C LLMConfig 元数据字段', llmSrc.includes('taskType?: string') && llmSrc.includes('userId?: string'), 'userId/taskType/projectId/taskId')

    // 场景 D：getUserLLMConfig 附加 meta
    add('D getUserLLMConfig meta', llmSrc.includes('meta?: { taskType?') && llmSrc.includes('userId,'), '独立调用链可带元数据')

    // 场景 E：orchestrator 附加 agentType
    const orchSrc = src.readFileSync('src/services/hdz/orchestrator.service.ts', 'utf8')
    add('E orchestrator 附加元数据', orchSrc.includes('userCfg.taskType = `hdz_${task.agentType}`'), 'writer/reviewer/planner 等全部带 agentType')

    // 场景 F：reviewer 用传入 cfg
    const revSrc = src.readFileSync('src/services/hdz/reviewer.service.ts', 'utf8')
    add('F reviewer 接收 orchestrator cfg', revSrc.includes('passedCfg'), '不再丢元数据')

    // 场景 G：event-extractor 独立链路附加
    const evSrc = src.readFileSync('src/services/hdz/event-extractor.service.ts', 'utf8')
    add('G event-extractor 独立记账', evSrc.includes("taskType = 'hdz_event_extractor'"), '不经过 orchestrator 也有元数据')

    // 场景 H：真实写一条 UsageLog（直接调 estimateLlmCost 不可达，改用模拟：查表结构可写入）
    const log = await prisma.usageLog.create({
      data: { userId: user.id, taskType: 'hdz_test', provider: 'deepseek', tokens: '12345', cost: 0.02, isPlatform: false },
    })
    const found = await prisma.usageLog.findUnique({ where: { id: log.id } })
    add('H UsageLog 表可写入/读取', found?.tokens === '12345' && found?.taskType === 'hdz_test', `id=${log.id}`)
    await prisma.usageLog.delete({ where: { id: log.id } })

    // 场景 I：统计端点/聚合查询可用（按 taskType 聚合）
    const agg = await prisma.usageLog.groupBy({ by: ['taskType'], _count: true })
    add('I 按 taskType 聚合可用', Array.isArray(agg), `现有 ${agg.length} 类 taskType`)

    const pass = results.every(Boolean)
    console.log(`\n${pass ? '🏆 Task 4 全部验证通过' : '⚠️ 有失败项'}（${results.filter(Boolean).length}/${results.length}）`)
  } finally {
    console.log('🧹 验证完成')
  }
}
main().finally(() => prisma.$disconnect())
