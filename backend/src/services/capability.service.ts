import { prisma } from '../utils/index.js'
import { credentialResolver } from './credential/credential-resolver'
import { vaultService } from './credential/vault-service'
import crypto from 'crypto'

const DEFAULT_ENDPOINTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  bailian: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
}

// Sprint-ADMIN-IA-REALITY-03 T02: 与 admin-models-v2 一致的 AES 解密
const ENCRYPTION_KEY = process.env.CRYPTO_ENCRYPTION_KEY || 'default-dev-key-32chars!!'

function decryptApiKey(value: string): string {
  try {
    const parts = value.split(':')
    if (parts.length < 2) return value // 非加密格式（明文）
    const iv = Buffer.from(parts.shift()!, 'hex')
    const encrypted = parts.join(':')
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return value // 解密失败按明文处理
  }
}

// Sprint-ADMIN-IA-REALITY-03 T02: 平台 API Key 解析
// 优先级：env > ApiKey 表（解密）> CredentialVault（try/catch 兜底，vault.owner_id 是 UUID 列）
async function resolveProviderApiKey(provider: string): Promise<string> {
  // 1. env
  const envMap: Record<string, string> = {
    deepseek: 'DEEPSEEK_API_KEY',
    openai: 'OPENAI_API_KEY',
    aliyun: 'ALIYUN_API_KEY',
    bailian: 'ALIYUN_API_KEY',
    volcengine: 'VOLCENGINE_API_KEY',
    siliconflow: 'SILICONFLOW_API_KEY',
    google: 'GOOGLE_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    xai: 'XAI_API_KEY',
    moonshot: 'MOONSHOT_API_KEY',
    zhipu: 'ZHIPU_API_KEY',
    replicate: 'REPLICATE_API_KEY',
  }
  const envVal = process.env[envMap[provider]] || process.env[`${provider.toUpperCase()}_API_KEY`] || ''
  if (envVal) return envVal

  // 2. ApiKey 表（加密存储）
  try {
    const row = await prisma.apiKey.findUnique({ where: { provider } })
    if (row?.keyValue) return decryptApiKey(row.keyValue)
  } catch { /* 忽略 */ }

  // 3. CredentialVault（既有路径，try/catch 兜底）
  try {
    const resolved = await credentialResolver.resolve({ ownerType: 'system', ownerId: `model:${provider}`, capability: 'text-generation' })
    if (resolved) {
      const decrypted = await vaultService.getDecryptedCredential(resolved.credentialId)
      if (decrypted?.apiKey) return decrypted.apiKey
    }
  } catch { /* vault 查询失败（UUID 列约束等）→ 返回空 */ }

  return ''
}

export async function testModelConnection(modelId: string) {
  const model = await prisma.aiModel.findUnique({ where: { id: modelId } })
  if (!model) {
    return { ok: false, latency: null, error: '模型不存在' }
  }

  // Sprint-ADMIN-IA-REALITY-03 T02: 统一平台 Key 解析（env → ApiKey 表 → vault）
  let apiKey = await resolveProviderApiKey(model.provider)

  const endpoint = model.endpointUrl || DEFAULT_ENDPOINTS[model.provider] || ''
  if (!endpoint) {
    return { ok: false, latency: null, error: `未配置 ${model.provider} 的默认 Endpoint，请手动填写 Endpoint URL` }
  }
  if (!apiKey) {
    return { ok: false, latency: null, error: `缺少 ${model.provider} 的 API Key（env / ApiKey 表 / vault 均未找到）` }
  }

  const t0 = Date.now()
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.name,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
    })
    const json = await res.json()
    const ok = !!(json.choices || json.data || json.id)
    return {
      ok,
      latency: ok ? Math.round(Date.now() - t0) : null,
      error: ok ? undefined : `HTTP ${res.status}`,
    }
  } catch (e: any) {
    return { ok: false, latency: null, error: e.message?.slice(0, 100) }
  }
}
