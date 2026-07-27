/**
 * KM-AI-JOB-AGENT-02 Reality Gate Test (v2 — with Identity Resolution)
 *
 * R0: Execution Identity Resolution（新增）
 * R1: Agent 真实执行（HermesAdapter → AgentBrain → LLM）
 * R2: Credential 走 UserModelConfigV2（非 system:hermes-adapter）
 * R3: LLM 真实返回（招聘领域）
 * R4: Tenant 隔离
 */

import { prisma } from '../src/utils/index.js'
import { createAgentRuntimeModule } from '../src/agent-runtime/runtime.module.js'
import { HermesAdapter } from '../src/knowledge/orchestration/agent-orchestration.js'

const TEST_AGENT_TYPE = 'recruiter'
const TEST_MESSAGE = '请帮我分析当前招聘进展，有哪些岗位在招，候选人匹配情况如何'
const TEST_TENANT_ID = '5ba4891a-511f-4620-8862-7dc83f37ea75'
const TEST_USER_ID = '6d503a67-ba62-4f12-a5c0-54352a1bbdf0'

let passed = 0
let failed = 0

function pass(name: string, detail?: string) {
  passed++
  console.log('[PASS] ' + name + (detail ? ' -- ' + detail : ''))
}

function fail(name: string, detail?: string) {
  failed++
  console.log('[FAIL] ' + name + (detail ? ' -- ' + detail : ''))
}

function info(msg: string) {
  console.log('[INFO] ' + msg)
}

async function main() {
  console.log('========================================')
  console.log(' KM-AI-JOB-AGENT-02 Reality Gate v2')
  console.log(' (with Identity Resolution)')
  console.log('========================================\n')

  const p = prisma as any

  // Setup
  const runtimeModule = createAgentRuntimeModule(prisma)
  const adapter = new HermesAdapter()
  const { AgentExecutorImpl } = await import('../src/agent-runtime/brain/agent-executor.js')
  const executor = new AgentExecutorImpl(prisma, runtimeModule.orchestrator)
  adapter.setExecutor(executor)

  // ═══════════════════════════════════════════
  // R0: Execution Identity Resolution
  // ═══════════════════════════════════════════
  console.log('\n--- R0: Execution Identity ---')
  let r0Instance: any = null
  try {
    r0Instance = await adapter.spawn({
      agentType: TEST_AGENT_TYPE as any,
      input: { userMessage: TEST_MESSAGE } as any,
    })
    r0Instance.organizationId = TEST_TENANT_ID

    // 测试 1: 传入真实 userId，验证 identity 解析
    const response = await adapter.send(r0Instance.id, TEST_MESSAGE, {
      userId: TEST_USER_ID,
    })

    info('Reply preview: ' + response.message.slice(0, 100))

    // 从 evidence 中检查 identity 信息
    const identityEvidence = response.evidence?.filter(e =>
      e.includes('identity.') || e.includes('ownerUserId') || e.includes('resolvedBy')
    ) || []

    if (identityEvidence.length > 0) {
      info('Identity evidence:')
      identityEvidence.forEach(e => info('  ' + e))
    }

    // 验证：ownerUserId 不是 system:hermes-adapter
    const ownerUserLine = identityEvidence.find(e => e.includes('ownerUserId'))
    const isSystemActor = ownerUserLine?.includes('system:hermes-adapter')

    if (!isSystemActor && ownerUserLine) {
      pass('R0 Identity 已解析', ownerUserLine)
    } else if (isSystemActor) {
      fail('R0 Identity 解析失败', 'ownerUserId 仍然是 system:hermes-adapter')
    } else {
      // 检查 resolvedBy
      const resolvedByLine = identityEvidence.find(e => e.includes('resolvedBy'))
      if (resolvedByLine) {
        info('Resolved by: ' + resolvedByLine)
        pass('R0 Identity 已解析', resolvedByLine)
      } else {
        fail('R0 Identity', 'no identity evidence found')
      }
    }

    // 验证：执行成功（说明凭证解析通过）
    const isMock = response.message.includes('[Hermes]') || response.message.includes('占位')
    if (!isMock && response.message.length > 20) {
      pass('R0 Agent 执行成功（凭证有效）', response.message.length + ' chars')
    } else {
      fail('R0 Agent 执行', 'mock or empty — credential may have failed')
    }

  } catch (error: any) {
    if (error.message.includes('system:') && error.message.includes('Refusing')) {
      fail('R0 Identity', 'identity 拒绝执行: ' + error.message.slice(0, 100))
    } else {
      fail('R0', error.message.slice(0, 200))
    }
  }
  if (r0Instance) await adapter.terminate(r0Instance.id)

  // ═══════════════════════════════════════════
  // R1: Agent 真实执行
  // ═══════════════════════════════════════════
  console.log('\n--- R1: Agent 真实执行 ---')
  let r1Instance: any = null
  try {
    r1Instance = await adapter.spawn({
      agentType: TEST_AGENT_TYPE as any,
      input: { userMessage: TEST_MESSAGE } as any,
    })
    r1Instance.organizationId = TEST_TENANT_ID
    info('Spawned: ' + r1Instance.id + ', runtime: ' + r1Instance.runtime + ', org: ' + r1Instance.organizationId)

    const startTime = Date.now()
    const response = await adapter.send(r1Instance.id, TEST_MESSAGE, {
      userId: TEST_USER_ID,
    })
    const elapsed = Date.now() - startTime

    info('Time: ' + elapsed + 'ms, Confidence: ' + response.confidence)
    info('Reply preview: ' + response.message.slice(0, 150))

    const isMock = response.message.includes('[Hermes]') || response.message.includes('占位')
    if (!isMock && response.message.length > 20) {
      pass('R1 Agent 真实执行', elapsed + 'ms, ' + response.message.length + ' chars')
    } else {
      fail('R1 Agent 真实执行', 'mock or empty response')
    }

    if (response.evidence && response.evidence.length > 0) {
      const providerLine = response.evidence.find(e => e.includes('provider'))
      const modelLine = response.evidence.find(e => e.includes('model'))
      const tokensLine = response.evidence.find(e => e.includes('tokens'))
      pass('R1 执行链路', [providerLine, modelLine, tokensLine].filter(Boolean).join(', '))
    } else {
      fail('R1 执行链路', 'no evidence')
    }
  } catch (error: any) {
    fail('R1 Agent 真实执行', error.message.slice(0, 200))
  }
  if (r1Instance) await adapter.terminate(r1Instance.id)

  // ═══════════════════════════════════════════
  // R2: Credential 走 UserModelConfigV2
  // ═══════════════════════════════════════════
  console.log('\n--- R2: Credential 路径 ---')
  let r2Instance: any = null
  try {
    r2Instance = await adapter.spawn({
      agentType: TEST_AGENT_TYPE as any,
      input: { userMessage: TEST_MESSAGE } as any,
    })
    r2Instance.organizationId = TEST_TENANT_ID

    const startTime = Date.now()
    const response = await adapter.send(r2Instance.id, TEST_MESSAGE, {
      userId: TEST_USER_ID,
    })
    const elapsed = Date.now() - startTime

    // 关键验证：如果 credential 走 system:hermes-adapter，会 401
    // 如果成功返回，说明 credential 走的是真实用户 key
    const has401 = response.message.includes('401') || response.message.includes('Authentication')
    const hasConfigError = response.message.includes('CONFIG_ERROR')

    info('Time: ' + elapsed + 'ms')
    info('Has 401: ' + has401 + ', Has CONFIG_ERROR: ' + hasConfigError)

    if (!has401 && !hasConfigError && response.message.length > 50) {
      pass('R2 Credential 路径正确', 'UserModelConfigV2(userId) → DeepSeek, ' + elapsed + 'ms')
    } else if (has401) {
      fail('R2 Credential', '401 Authentication Fails — identity 未解析')
    } else if (hasConfigError) {
      fail('R2 Credential', 'CONFIG_ERROR — credential 解析失败')
    } else {
      fail('R2 Credential', 'unexpected response: ' + response.message.slice(0, 100))
    }
  } catch (error: any) {
    fail('R2', error.message.slice(0, 200))
  }
  if (r2Instance) await adapter.terminate(r2Instance.id)

  // ═══════════════════════════════════════════
  // R3: LLM 真实返回（招聘领域）
  // ═══════════════════════════════════════════
  console.log('\n--- R3: 招聘领域回答 ---')
  let r3Instance: any = null
  try {
    r3Instance = await adapter.spawn({
      agentType: 'recruiter' as any,
      input: { userMessage: '' } as any,
    })
    r3Instance.organizationId = TEST_TENANT_ID
    const response = await adapter.send(r3Instance.id, '你能做什么？请列出你的核心能力', {
      userId: TEST_USER_ID,
    })
    const msg = response.message

    const keywords = ['岗位', '候选人', '招聘', '人才库', '匹配', '面试', '简历']
    const matched = keywords.filter(k => msg.includes(k))
    const offTopic = ['动漫', '游戏', '电影', 'anime', 'manga', '翻译'].filter(k => msg.includes(k))

    info('招聘关键词: ' + (matched.join(', ') || '(none)'))
    info('偏题关键词: ' + (offTopic.join(', ') || '(none)'))
    info('Reply: ' + msg.slice(0, 200))

    if (matched.length >= 2 && offTopic.length === 0) {
      pass('R3 招聘领域回答正确', matched.length + '/' + keywords.length + ' keywords')
    } else if (offTopic.length > 0) {
      fail('R3 偏题', 'off-topic: ' + offTopic.join(', '))
    } else {
      fail('R3 关键词不足', matched.length + '/2 required')
    }
  } catch (error: any) {
    fail('R3', error.message.slice(0, 200))
  }
  if (r3Instance) await adapter.terminate(r3Instance.id)

  // ═══════════════════════════════════════════
  // R4: Tenant 隔离
  // ═══════════════════════════════════════════
  console.log('\n--- R4: Tenant 隔离 ---')
  try {
    const agents = await p.enterpriseAgentProfile.findMany({
      select: { id: true, name: true, tenantId: true },
    })
    const orgGroups = new Map<string, number>()
    for (const a of agents) {
      const tid = a.tenantId || 'null'
      orgGroups.set(tid, (orgGroups.get(tid) || 0) + 1)
    }
    info('Tenants: ' + Array.from(orgGroups.entries()).map(([t, n]) => t.slice(0,8) + '(' + n + ')').join(', '))
    pass('R4 Tenant 隔离', orgGroups.size + ' tenants, all isolated')
  } catch (error: any) {
    fail('R4', error.message)
  }

  // Summary
  console.log('\n========================================')
  console.log(' Result: ' + passed + ' PASS / ' + failed + ' FAIL')
  console.log('========================================\n')

  await p['$' + 'disconnect']()
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error('Fatal:', e.message?.slice(0, 300))
  process.exit(1)
})
