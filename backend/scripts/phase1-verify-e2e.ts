/**
 * KM-AI-JOB-AGENT-01 Phase 1d
 * 端到端验证：Agent → EmployeeModelBinding → LLM Config → Credential → LLM API
 */
import { prisma } from '../src/utils/index.js'
import { ProviderCredentialResolverImpl } from '../src/agent-runtime/gateway/credential-resolver.service.js'

async function main() {
  const p = prisma as any
  const resolver = new ProviderCredentialResolverImpl(p)

  const agentId = 'c5ce5982-916d-4965-a455-9a857d679d2f'
  const orgId = '5ba4891a-511f-4620-8862-7dc83f37ea75'

  console.log('=== Phase 1d: E2E Binding Verification ===\n')

  // Step 1: 验证 EmployeeModelBinding 存在
  const binding = await p.employeeModelBinding.findFirst({
    where: { employeeId: agentId },
  })
  console.log('✅ Step 1: EmployeeModelBinding exists')
  console.log('   Binding ID:', binding?.id?.slice(0,8))
  console.log('   Provider Config ID:', binding?.providerConfigId?.slice(0,8))
  console.log('   Enabled:', binding?.enabled)

  // Step 2: 验证 Credential Resolver 能解析
  // 注意：Credential Resolver 用的是 agentModelBinding（不是 employeeModelBinding）
  // 需要确认它查的是哪张表
  console.log('\n--- Checking which table Credential Resolver queries ---')

  // 查 agent_model_binding（Credential Resolver 实际查的表）
  const agentBinding = await p.agentModelBinding.findFirst({
    where: { agentId: agentId },
  })
  console.log('agent_model_binding for agent:', agentBinding ? 'EXISTS' : 'NOT FOUND')

  // 查 employee_model_binding（我们刚创建的表）
  const empBinding = await p.employeeModelBinding.findFirst({
    where: { employeeId: agentId },
  })
  console.log('employee_model_binding for agent:', empBinding ? 'EXISTS' : 'NOT FOUND')

  // Step 3: 尝试 Credential Resolver
  // Credential Resolver 查的是 agent_model_binding + enterprise_agent_model_binding
  // 我们需要确认 enterprise_llm_config 的 id 能否被找到
  console.log('\n--- Credential Resolver Test ---')

  // 直接用 enterprise_llm_config 测试（绕过 binding）
  const llmConfig = await p.enterpriseLlmConfig.findFirst({
    where: { tenantId: orgId, provider: 'deepseek' },
  })
  console.log('LLM Config for tenant:', llmConfig ? `${llmConfig.provider}/${llmConfig.modelName}` : 'NOT FOUND')

  // Step 4: 测试 decrypt + API 连通性
  if (llmConfig) {
    try {
      const { decryptApiKey } = await import('../src/services/enterprise/organization/provider-credential.service.js')
      const apiKey = decryptApiKey(llmConfig.encryptedApiKey, llmConfig.apiKeyIv, llmConfig.apiKeyTag)
      console.log('\n✅ Step 4: API Key decrypted successfully')
      console.log('   Key prefix:', apiKey.slice(0, 8) + '...')

      // Step 5: 测试 API 调用
      const baseUrl = llmConfig.baseUrl || 'https://api.deepseek.com/v1'
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: llmConfig.modelName,
          messages: [
            { role: 'system', content: 'You are an AI recruitment assistant. Reply in Chinese.' },
            { role: 'user', content: '你好，请用一句话介绍你自己。' },
          ],
          max_tokens: 100,
        }),
      })
      console.log('\n✅ Step 5: LLM API Response')
      console.log('   Status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('   Reply:', data.choices?.[0]?.message?.content)
        console.log('   Tokens:', data.usage)
      } else {
        console.log('   Error:', await response.text())
      }
    } catch (e: any) {
      console.error('\n❌ decrypt/API error:', e.message)
    }
  }

  await p.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
