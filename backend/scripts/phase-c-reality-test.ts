/**
 * Phase C: 真实 AI招聘助理测试
 * 
 * 走完整调用链：
 *   Agent Brain → executeViaGateway → resolveRuntimeConfig → UserModelConfigV2 → DeepSeek API
 * 
 * 使用有 deepseek key 的用户的 actorId 来触发
 */

import { prisma } from '../src/utils/index.js'
import { AgentBrainService } from '../src/agent-runtime/brain/agent-brain.service.js'

const p = prisma as any

async function main() {
  console.log('=== Phase C: 真实 AI招聘助理测试 ===\n')

  // Agent: AI 招聘官
  const agentId = 'c5ce5982-916d-4965-a455-9a857d679d2f'
  const orgId = '5ba4891a-511f-4620-8862-7dc83f37ea75'

  // 找一个有 deepseek key 的用户作为 actorId
  const userWithKey = await p.userModelConfigV2.findFirst({
    where: { llmProvider: 'deepseek', llmApiKey: { not: null } },
    select: { userId: true, llmModel: true }
  })

  if (!userWithKey) {
    console.log('FAIL: 没有有 deepseek key 的用户')
    process.exit(1)
  }

  const actorId = userWithKey.userId
  console.log('Agent: AI 招聘官 (c5ce5982)')
  console.log('Actor: ' + actorId.slice(0,8) + '... (有 deepseek key, model=' + userWithKey.llmModel + ')')
  console.log('Org: ' + orgId.slice(0,8) + '...')
  console.log('')

  // 构建 RuntimeContext
  const runtimeCtx = {
    organizationId: orgId,
    actorId: actorId,
    agentId: agentId,
    permissionScope: ['agent:execute', 'agent:read'],
    requestId: 'phase-c-test-' + Date.now(),
  }

  const brain = new AgentBrainService(p)

  console.log('调用链: AgentBrain.reason() → executeViaGateway() → resolveRuntimeConfig() → UserModelConfigV2 → DeepSeek API')
  console.log('')
  console.log('输入: "你好，请用一句话介绍你的角色和能力"')
  console.log('')
  console.log('--- 执行中 ---')

  const startTime = Date.now()

  try {
    const result = await brain.reason(
      { input: '你好，请用一句话介绍你的角色和能力' },
      runtimeCtx as any
    )

    const totalDuration = Date.now() - startTime

    console.log('')
    console.log('=== 调用成功 ===')
    console.log('Provider: ' + result.provider)
    console.log('Model: ' + result.model)
    console.log('Tokens: ' + result.tokensUsed)
    console.log('Duration: ' + result.durationMs + 'ms (总耗时: ' + totalDuration + 'ms)')
    console.log('')
    console.log('--- LLM 返回 ---')
    console.log(result.output)
    console.log('--- 返回结束 ---')

    // Reality Gate 判定
    console.log('')
    console.log('=== Reality Gate R3 ===')
    const isRealLLM = result.output.length > 20 && result.durationMs > 500 && !result.output.includes('mock')
    console.log('真实模型返回: ' + (isRealLLM ? '✅ PASS' : '❌ FAIL'))
    console.log('非 mock 响应: ' + (isRealLLM ? '✅ PASS' : '❌ FAIL'))
    console.log('端到端时延合理: ' + (result.durationMs > 500 && result.durationMs < 60000 ? '✅ PASS' : '⚠️ CHECK'))

  } catch (err: any) {
    console.log('')
    console.log('=== 调用失败 ===')
    console.log('Error: ' + err.message)
    
    if (err.message.includes('CONFIG_ERROR')) {
      console.log('')
      console.log('诊断: Credential 解析失败')
      console.log('原因: UserModelConfigV2 中该用户的 provider 不匹配或 Key 未配置')
    }
    if (err.message.includes('401') || err.message.includes('403')) {
      console.log('')
      console.log('诊断: API Key 无效或过期')
    }
    if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
      console.log('')
      console.log('诊断: 网络连接失败，无法访问 DeepSeek API')
    }
  }

  await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
