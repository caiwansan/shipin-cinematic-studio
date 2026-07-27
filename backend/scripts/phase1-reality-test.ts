/**
 * Phase 1 Reality Test — R1~R4
 * 
 * R1: Agent 可以找到配置 (AgentProfile → RuntimeConfig)
 * R2: Gateway 可以解析 Credential (resolveRuntimeConfig 日志)
 * R3: 真实调用 LLM (非 mock，真实模型返回)
 * R4: Tenant 隔离 (org A 不能读 org B credential)
 */

import { prisma } from '../src/utils/index.js'
import { AgentBrainService } from '../src/agent-runtime/brain/agent-brain.service.js'

async function main() {
  const p = prisma as any
  const brain = new AgentBrainService(p)

  console.log('='.repeat(60))
  console.log('Phase 1 Reality Test — R1~R4')
  console.log('='.repeat(60))

  // ─── R1: Agent 配置解析 ───
  console.log('\n[R1] Agent 配置解析')
  const agentId = 'c5ce5982-c5c4-4ae4-8325-7a7e5c451f3e'
  const orgId = '5ba4891a-511f-4620-8862-7dc83f37ea75'
  
  const agent = await p.enterpriseAgentProfile.findUnique({
    where: { id: agentId }
  })
  if (!agent) {
    console.log('  ❌ FAIL — Agent 不存在')
    process.exit(1)
  }
  console.log(`  ✅ Agent: ${agent.name} (${agent.role})`)
  console.log(`  ✅ Tenant: ${agent.tenantId?.slice(0,8)}...`)

  // 检查 EmployeeModelBinding
  const binding = await p.employeeModelBinding.findFirst({
    where: { employeeId: agentId, enabled: true }
  })
  if (binding) {
    console.log(`  ✅ EmployeeModelBinding: providerConfigId=${binding.providerConfigId?.slice(0,8)}, model=${binding.modelName}`)
  } else {
    console.log('  ⚠️  EmployeeModelBinding 不存在，fallback 到 EnterpriseLlmConfig')
  }

  // 检查 EnterpriseLlmConfig
  const llmConfig = await p.enterpriseLlmConfig.findFirst({
    where: { tenantId: orgId, status: 'active', enabled: true }
  })
  if (llmConfig) {
    console.log(`  ✅ EnterpriseLlmConfig: provider=${llmConfig.provider}, model=${llmConfig.modelName}`)
  } else {
    console.log('  ⚠️  EnterpriseLlmConfig 不存在，fallback 到 env')
  }

  // ─── R2: Gateway Credential 解析 ───
  console.log('\n[R2] Gateway Credential 解析')
  
  // 检查 Credential Vault
  const vaultCred = await p.credentialVault.findFirst({
    where: { ownerType: 'organization', ownerId: orgId, capability: 'text-generation', status: 'active' }
  })
  if (vaultCred) {
    console.log(`  ✅ CredentialVault: source=VAULT, id=${vaultCred.id?.slice(0,8)}`)
  } else {
    console.log('  ⚠️  CredentialVault 无记录，走 LEGACY_ENTERPRISE')
  }

  // 检查 UserModelConfigV2 (Gateway 实际走的路径)
  // Agent Brain 传入 userId = context.actorId
  // 需要知道 actorId 是谁
  const instance = await p.enterpriseAgentInstance.findFirst({
    where: { agentProfileId: agentId }
  })
  if (instance) {
    console.log(`  ✅ AgentInstance: id=${instance.id?.slice(0,8)}, runtime=${instance.runtime}, lifecycle=${instance.lifecycleStatus}`)
  }

  // ─── R3: 真实 LLM 调用 ───
  console.log('\n[R3] 真实 LLM 调用')
  console.log('  调用 AgentBrain.reason() — 输入: "你好，请用一句话介绍自己"')
  
  try {
    const result = await brain.reason(
      { input: '你好，请用一句话介绍自己' },
      {
        agentId: agentId,
        organizationId: orgId,
        actorId: 'system-test',  // 测试用
        capability: 'text-generation',
      } as any
    )
    
    console.log(`  ✅ 调用成功!`)
    console.log(`  Provider: ${result.provider}`)
    console.log(`  Model: ${result.model}`)
    console.log(`  Tokens: ${result.tokensUsed}`)
    console.log(`  Duration: ${result.durationMs}ms`)
    console.log(`  Output: ${result.output?.slice(0, 100)}...`)
    
    // 验证不是 mock
    if (result.output && result.output.length > 10 && result.durationMs > 100) {
      console.log('  ✅ 真实模型返回 (非 mock)')
    } else {
      console.log('  ⚠️  可能是 mock 响应')
    }
  } catch (err: any) {
    console.log(`  ❌ FAIL — ${err.message}`)
    
    // 诊断失败原因
    if (err.message.includes('CONFIG_ERROR')) {
      console.log('  → Credential 解析失败，检查 UserModelConfigV2 或 env')
    }
    if (err.message.includes('401') || err.message.includes('403')) {
      console.log('  → API Key 无效或过期')
    }
    if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
      console.log('  → 网络连接失败')
    }
  }

  // ─── R4: Tenant 隔离 ───
  console.log('\n[R4] Tenant 隔离')
  const otherOrgId = '3f7f5550-0000-0000-0000-000000000000'  // 另一个租户（测试用）
  try {
    await brain.reason(
      { input: '测试越权访问' },
      {
        agentId: agentId,
        organizationId: otherOrgId,  // 用错误的 org
        actorId: 'system-test',
        capability: 'text-generation',
      } as any
    )
    console.log('  ⚠️  未抛出越权错误 — 需要确认是否正确隔离')
  } catch (err: any) {
    if (err.message.includes('CONFIG_ERROR') || err.message.includes('not found')) {
      console.log('  ✅ 隔离有效 — 其他租户无法使用 Agent 配置')
    } else {
      console.log(`  ⚠️  错误类型不确定: ${err.message?.slice(0, 80)}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('Reality Test 完成')
  console.log('='.repeat(60))

  await p.\$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
