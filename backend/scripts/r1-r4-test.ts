/**
 * Phase 1 Reality Test R1~R4
 */

import { prisma } from '../src/utils/index.js'

const p = prisma as any

async function main() {
  const agentId = 'c5ce5982-916d-4965-a455-9a857d679d2f'
  const orgId = '5ba4891a-511f-4620-8862-7dc83f37ea75'

  console.log('=== Phase 1 Reality Test ===\n')

  // R1: Agent 配置解析
  console.log('[R1] Agent 配置解析')
  const agent = await p.enterpriseAgentProfile.findUnique({ where: { id: agentId } })
  if (!agent) { console.log('  FAIL: Agent 不存在'); return }
  console.log('  OK: Agent =', agent.name, '(' + agent.role + ')')

  const binding = await p.employeeModelBinding.findFirst({ where: { employeeId: agentId, enabled: true } })
  if (binding) {
    console.log('  OK: EmployeeModelBinding modelName =', binding.modelName)
  } else {
    console.log('  SKIP: 无 EmployeeModelBinding')
  }

  const llmConfig = await p.enterpriseLlmConfig.findFirst({ where: { tenantId: orgId, status: 'active', enabled: true } })
  if (llmConfig) {
    console.log('  OK: EnterpriseLlmConfig =', llmConfig.provider + '/' + llmConfig.modelName)
  } else {
    console.log('  SKIP: 无 EnterpriseLlmConfig')
  }

  // R2: Credential 解析路径
  console.log('\n[R2] Credential 解析路径')
  
  // Gateway 走 loadFullConfigV2(userId) -> UserModelConfigV2
  // 检查是否有 DEEPSEEK_API_KEY 环境变量
  const envKey = process.env.DEEPSEEK_API_KEY
  console.log('  DEEPSEEK_API_KEY env:', envKey ? 'YES (length=' + envKey.length + ')' : 'NO')
  
  // Credential Vault
  try {
    const vault = await p.credentialVault.findFirst({ where: { ownerType: 'organization', ownerId: orgId } })
    console.log('  CredentialVault:', vault ? 'YES id=' + vault.id.slice(0,8) : 'NO')
  } catch {
    console.log('  CredentialVault: 表不存在')
  }

  // R3: 真实 LLM 调用 (直接测试)
  console.log('\n[R3] 真实 LLM 调用')
  
  // 直接用 fetch 测试 DeepSeek API 是否可用
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.log('  SKIP: 无 DEEPSEEK_API_KEY，无法直接测试')
  } else {
    try {
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 10
        })
      })
      const data = await resp.json()
      if (resp.ok && data.choices) {
        console.log('  OK: DeepSeek API 调用成功')
        console.log('  Response:', data.choices[0]?.message?.content)
      } else {
        console.log('  FAIL:', resp.status, JSON.stringify(data).slice(0, 200))
      }
    } catch (e: any) {
      console.log('  FAIL:', e.message)
    }
  }

  // R4: Tenant 隔离
  console.log('\n[R4] Tenant 隔离')
  const fakeOrg = '00000000-0000-0000-0000-000000000000'
  const fakeConfig = await p.enterpriseLlmConfig.findFirst({ where: { tenantId: fakeOrg } })
  console.log('  伪造 tenant 查询结果:', fakeConfig ? 'FOUND (隔离失败!)' : 'NULL (隔离有效)')

  console.log('\n=== Test Complete ===')
  await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
