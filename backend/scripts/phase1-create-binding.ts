/**
 * KM-AI-JOB-AGENT-01 Phase 1
 * 为 AI招聘助理 创建 LLM Config + EmployeeModelBinding
 */
import { prisma } from '../src/utils/index.js'

async function main() {
  const p = prisma as any

  // 1. 为 Agent tenant 创建 LLM Config（复用现有 deepseek 配置）
  const newLlmId = 'agent-llm-' + Date.now().toString(36)
  const tenant5ba4 = '5ba4891a-511f-4620-8862-7dc83f37ea75'
  const sourceLlmId = 'aa27b69d-d983-4cc5-86dd-832ff5938ac0'

  // 检查是否已存在
  const existing = await p.enterpriseLlmConfig.findFirst({
    where: { tenantId: tenant5ba4, provider: 'deepseek' },
  })
  if (existing) {
    console.log('LLM Config already exists for agent tenant:', existing.id)
  } else {
    // 复制现有配置
    const source = await p.enterpriseLlmConfig.findUnique({ where: { id: sourceLlmId } })
    if (!source) {
      console.error('Source LLM Config not found!')
      process.exit(1)
    }
    const newLlm = await p.enterpriseLlmConfig.create({
      data: {
        id: newLlmId,
        tenantId: tenant5ba4,
        provider: source.provider,
        modelName: source.modelName,
        encryptedApiKey: source.encryptedApiKey,
        baseUrl: source.baseUrl,
        credentialOwner: source.credentialOwner,
        status: 'active',
        enabled: true,
      },
    })
    console.log('Created LLM Config:', newLlm.id, newLlm.modelName)
  }

  const llmConfig = existing || await p.enterpriseLlmConfig.findFirst({
    where: { tenantId: tenant5ba4, provider: 'deepseek' },
  })

  // 2. 为 AI招聘助理 (c5ce5982) 创建 EmployeeModelBinding
  const agentId = 'c5ce5982-916d-4965-a455-9a857d679d2f'

  const existingBinding = await p.employeeModelBinding.findFirst({
    where: { employeeId: agentId },
  })
  if (existingBinding) {
    console.log('EmployeeModelBinding already exists:', existingBinding.id)
  } else {
    const binding = await p.employeeModelBinding.create({
      data: {
        tenantId: tenant5ba4,
        employeeId: agentId,
        providerConfigId: llmConfig.id,
        modelName: 'deepseek-v4-flash',
        temperature: 0.7,
        maxTokens: 16384,
        enabled: true,
      },
    })
    console.log('Created EmployeeModelBinding:', binding.id)
  }

  // 3. 验证完整链路（用 raw query 避免 Prisma 关系字段问题）
  const fullBinding = await p.$queryRaw`
    SELECT emb.id, emb.employee_id, emb.provider_config_id, emb.model_name, emb.enabled,
           llm.provider, llm.model_name as llm_model, llm.status as llm_status
    FROM employee_model_binding emb
    JOIN enterprise_llm_config llm ON llm.id = emb.provider_config_id
    WHERE emb.employee_id = ${agentId}
  `
  console.log('\n=== Binding Verification ===')
  console.log('Agent: AI招聘助理 (c5ce5982)')
  if (fullBinding.length > 0) {
    const b = fullBinding[0]
    console.log('Binding ID:', b.id?.slice(0,8))
    console.log('Provider:', b.provider, b.llm_model)
    console.log('Model override:', b.model_name)
    console.log('Enabled:', b.enabled)
    console.log('LLM Status:', b.llm_status)
  } else {
    console.log('ERROR: Binding not found!')
  }

  await p.$disconnect()
}

main().catch(e => { console.error(e.message); process.exit(1) })
